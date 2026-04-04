# VERSION = "2.0.0"
"""Manage booking and cancellation operations."""
import logging
from typing import Dict, List
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)


class BookingManager:
    """Handle booking and cancellation logic."""

    def __init__(self, coordinator, store=None, notification_manager=None):
        self.coordinator = coordinator
        self.hass = coordinator.hass
        self.store = store
        self.notification_manager = notification_manager

    def _get_time_manager(self):
        """Get time_manager from hass.data."""
        from .const import DOMAIN
        domain_data = self.hass.data.get(DOMAIN, {})
        for key, value in domain_data.items():
            if isinstance(value, dict) and "time_manager" in value:
                return value["time_manager"]
        return None

    async def make_booking(self, machine_number: int, start_datetime: str, duration: int, context=None) -> Dict:
        _LOGGER.info("Booking: Machine %s at %s for %s min", machine_number, start_datetime, duration)
        try:
            result = await self.hass.services.async_call(
                "mielelogic", "make_reservation",
                {"machine_number": machine_number, "start_time": start_datetime, "duration": duration},
                blocking=True, return_response=True,
            )
            _LOGGER.info("Booking successful!")

            if self.store:
                try:
                    user_name = "Via Panel"
                    if context:
                        try:
                            # context is already a resolved Context object (passed as connection.context(msg))
                            user_id = getattr(context, "user_id", None)
                            if user_id:
                                user = await self.hass.auth.async_get_user(user_id)
                                if user and user.name:
                                    user_name = user.name
                        except Exception as user_err:
                            _LOGGER.warning("User lookup failed: %s", user_err)
                    await self.store.async_save_booking_metadata(
                        machine=machine_number, start_time=start_datetime,
                        user_name=user_name, duration=duration,
                    )
                except Exception as err:
                    _LOGGER.warning("Could not save booking metadata: %s", err)

            if self.notification_manager:
                try:
                    time_manager = self._get_time_manager()
                    vaskehus = "Vaskehus"
                    if time_manager:
                        vaskehus = time_manager.get_vaskehus_for_machine(machine_number) or "Vaskehus"
                    dt = datetime.fromisoformat(start_datetime.replace(" ", "T"))
                    await self.notification_manager.send_notification(
                        "booking_created",
                        {"vaskehus": vaskehus, "date": dt.strftime("%d-%m-%Y"),
                         "time": dt.strftime("%H:%M"), "duration": duration},
                    )
                except Exception as err:
                    _LOGGER.warning("Could not send booking notification: %s", err)

            return {"success": True, "message": "Booking gennemfort", "data": result}

        except HomeAssistantError as err:
            _LOGGER.error("Booking failed: %s", err)
            return {"success": False, "message": str(err)}
        except Exception as err:
            _LOGGER.exception("Unexpected booking error: %s", err)
            return {"success": False, "message": f"Ukendt fejl: {err}"}

    async def cancel_booking(self, machine_number: int, start_time: str, end_time: str) -> Dict:
        _LOGGER.info("Canceling: Machine %s from %s to %s", machine_number, start_time, end_time)
        try:
            await self.hass.services.async_call(
                "mielelogic", "cancel_reservation",
                {"machine_number": machine_number, "start_time": start_time, "end_time": end_time},
                blocking=True,
            )
            _LOGGER.info("Cancellation successful!")

            # Delete calendar event for this booking
            await self._delete_calendar_event(machine_number, start_time)

            if self.store:
                try:
                    await self.store.async_delete_booking_metadata(
                        machine=machine_number, start_time=start_time,
                    )
                except Exception as err:
                    _LOGGER.warning("Could not delete booking metadata: %s", err)

            if self.notification_manager:
                try:
                    time_manager = self._get_time_manager()
                    vaskehus = "Vaskehus"
                    if time_manager:
                        vaskehus = time_manager.get_vaskehus_for_machine(machine_number) or "Vaskehus"
                    await self.notification_manager.send_notification("booking_canceled", {"vaskehus": vaskehus})
                except Exception as err:
                    _LOGGER.warning("Could not send cancellation notification: %s", err)

            return {"success": True, "message": "Booking annulleret"}

        except HomeAssistantError as err:
            _LOGGER.error("Cancellation failed: %s", err)
            return {"success": False, "message": str(err)}
        except Exception as err:
            _LOGGER.exception("Unexpected cancellation error: %s", err)
            return {"success": False, "message": f"Ukendt fejl: {err}"}

    async def _delete_calendar_event(self, machine_number: int, start_time: str) -> None:
        """Delete the calendar event associated with a cancelled booking."""
        try:
            target_calendar = self.coordinator.sync_to_calendar
            if not target_calendar:
                return

            if not self.hass.services.has_service("calendar", "get_events"):
                _LOGGER.debug("calendar.get_events not available — skipping calendar delete")
                return

            time_manager = self._get_time_manager()
            vaskehus = time_manager.get_vaskehus_for_machine(machine_number) if time_manager else None
            if not vaskehus:
                vaskehus = self.coordinator._get_vaskehus_name(machine_number)
            summary = f"{vaskehus} booket"

            try:
                start_dt = datetime.fromisoformat(
                    start_time.replace(" ", "T")
                ).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
            except Exception:
                _LOGGER.warning("Could not parse start_time for calendar delete: %s", start_time)
                return

            window_start = (start_dt - timedelta(hours=1)).astimezone(ZoneInfo("UTC"))
            window_end   = (start_dt + timedelta(hours=1)).astimezone(ZoneInfo("UTC"))

            response = await self.hass.services.async_call(
                "calendar", "get_events",
                {"entity_id": target_calendar, "start_date_time": window_start.isoformat(), "end_date_time": window_end.isoformat()},
                blocking=True, return_response=True,
            )

            events = response.get(target_calendar, {}).get("events", [])
            matching = [e for e in events if e.get("summary") == summary]

            if not matching:
                _LOGGER.debug("No calendar event found to delete: %s at %s", summary, start_time)
                if self.store:
                    await self.store.async_remove_calendar_synced_event(machine_number, start_time)
                return

            event = matching[0]
            event_start = event.get("start", start_dt.isoformat())
            event_end   = event.get("end", event_start)

            if not self.hass.services.has_service("calendar", "delete_event"):
                _LOGGER.debug("calendar.delete_event not available (HA 2026.1+ required)")
                return

            call_data = {
                "entity_id": target_calendar,
                "start_date_time": event_start,
                "end_date_time": event_end,
                "summary": summary,
            }
            if event.get("uid"):
                call_data["uid"] = event["uid"]

            await self.hass.services.async_call("calendar", "delete_event", call_data, blocking=True)

            if self.store:
                await self.store.async_remove_calendar_synced_event(machine_number, start_time)
            self.coordinator._created_events.discard((machine_number, start_time))

            _LOGGER.info("Deleted calendar event: %s at %s", summary, start_time)

        except Exception as err:
            _LOGGER.warning("Could not delete calendar event for machine %s at %s: %s", machine_number, start_time, err)

    def get_current_bookings(self) -> List[Dict]:
        reservations = self.coordinator.data.get("reservations", {})
        bookings = reservations.get("Reservations", [])
        _LOGGER.debug("Current bookings: %d", len(bookings))
        return bookings

    def get_account_balance(self) -> float:
        account = self.coordinator.data.get("account_details", {})
        return account.get("Balance", 0.0)

    def get_max_reservations(self) -> int:
        reservations = self.coordinator.data.get("reservations", {})
        return reservations.get("MaxUserReservations", 2)
