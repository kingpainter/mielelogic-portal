# VERSION = "2.3.0"
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
        """Get time_manager — prefer runtime_data."""
        from .const import DOMAIN
        for entry in self.hass.config_entries.async_entries(DOMAIN):
            rd = getattr(entry, "runtime_data", None)
            if rd and "time_manager" in rd:
                return rd["time_manager"]
        # Legacy fallback
        domain_data = self.hass.data.get(DOMAIN, {})
        for key, value in domain_data.items():
            if isinstance(value, dict) and "time_manager" in value:
                return value["time_manager"]
        return None

    async def make_booking(
        self,
        machine_number: int,
        start_datetime: str,
        duration: int,
        context=None,
        extra_calendars: list | None = None,
    ) -> Dict:
        """Make a booking and sync to primary + any selected secondary calendars.

        Args:
            extra_calendars: list of secondary calendar entity_ids chosen by user in panel.
                             Primary calendar is always synced by coordinator auto-sync.
                             These are synced immediately on booking creation.
        """
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
                    # Build cancel action ID — decoded by the HA event listener in __init__.py
                    # Format: MIELELOGIC_CANCEL_{machine}_{start_iso}
                    cancel_action = f"MIELELOGIC_CANCEL_{machine_number}_{start_datetime.replace(' ', 'T')}"
                    await self.notification_manager.send_notification(
                        "booking_created",
                        {
                            "vaskehus": vaskehus,
                            "date": dt.strftime("%d-%m-%Y"),
                            "time": dt.strftime("%H:%M"),
                            "duration": duration,
                            "_cancel_action": cancel_action,  # stripped before display
                        },
                    )
                except Exception as err:
                    _LOGGER.warning("Could not send booking notification: %s", err)

            # Sync to secondary calendars chosen by user in panel (v2.5.0)
            # Primary calendar is handled by coordinator auto-sync.
            if extra_calendars:
                await self._sync_to_secondary_calendars(
                    machine_number, start_datetime, duration, extra_calendars
                )

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

            # Delete calendar event for this booking (primary)
            await self._delete_calendar_event(machine_number, start_time)

            # Delete secondary calendar events if any were created (v2.5.0)
            await self._delete_secondary_calendar_events(machine_number, start_time)

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
        """Delete the calendar event associated with a cancelled booking.

        Strategy (v2.3.0):
        1. Primary: match by UID stored in _created_events (most reliable)
        2. Fallback: search a ±1h window and match by summary
        3. Fallback: try summary match without UID
        """
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
                {
                    "entity_id": target_calendar,
                    "start_date_time": window_start.isoformat(),
                    "end_date_time": window_end.isoformat(),
                },
                blocking=True, return_response=True,
            )

            events = response.get(target_calendar, {}).get("events", [])

            # Match priority: exact summary + start time match, then summary only
            start_dt_str = start_dt.isoformat()
            matching = [
                e for e in events
                if e.get("summary") == summary
                and (
                    e.get("start", "").startswith(start_dt_str[:16])
                    or e.get("start", "") == start_dt_str
                )
            ]
            # Wider fallback: summary match only
            if not matching:
                matching = [e for e in events if e.get("summary") == summary]

            if not matching:
                _LOGGER.debug("No calendar event found to delete: %s at %s", summary, start_time)
                if self.store:
                    await self.store.async_remove_calendar_synced_event(machine_number, start_time)
                return

            if not self.hass.services.has_service("calendar", "delete_event"):
                _LOGGER.debug("calendar.delete_event not available (HA 2026.1+ required)")
                return

            event = matching[0]
            event_start = event.get("start", start_dt.isoformat())
            event_end   = event.get("end", event_start)

            call_data: dict = {
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
            _LOGGER.warning(
                "Could not delete calendar event for machine %s at %s: %s",
                machine_number, start_time, err,
            )

    async def _sync_to_secondary_calendars(
        self, machine_number: int, start_datetime: str, duration: int, calendars: list
    ) -> None:
        """Create calendar events in secondary calendars selected by user.

        Called immediately after a successful booking. Uses UTC conversion
        identical to the coordinator's primary sync.
        """
        if not self.hass.services.has_service("calendar", "create_event"):
            _LOGGER.debug("calendar.create_event not available — skipping secondary sync")
            return

        time_manager = self._get_time_manager()
        vaskehus = time_manager.get_vaskehus_for_machine(machine_number) if time_manager else None
        if not vaskehus:
            vaskehus = self.coordinator._get_vaskehus_name(machine_number)
        summary = f"{vaskehus} booket"

        try:
            start_cph = datetime.fromisoformat(
                start_datetime.replace(" ", "T")
            ).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
            end_cph = start_cph + timedelta(minutes=duration)
            start_utc = start_cph.astimezone(ZoneInfo("UTC"))
            end_utc = end_cph.astimezone(ZoneInfo("UTC"))
        except Exception as err:
            _LOGGER.warning("Secondary calendar sync: could not parse datetime: %s", err)
            return

        description = (
            f"MieleLogic Reservation (sekundær)\n"
            f"Vaskehus: {vaskehus}\n"
            f"Varighed: {duration} minutter"
        )

        for calendar_entity_id in calendars:
            try:
                await self.hass.services.async_call(
                    "calendar", "create_event",
                    {
                        "entity_id": calendar_entity_id,
                        "summary": summary,
                        "start_date_time": start_utc.isoformat(),
                        "end_date_time": end_utc.isoformat(),
                        "description": description,
                    },
                    blocking=True,
                )
                # Persist secondary sync record for cleanup on cancel
                if self.store:
                    await self.store.async_add_secondary_calendar_event(
                        machine_number, start_datetime, calendar_entity_id
                    )
                _LOGGER.info(
                    "✅ Secondary calendar event created: %s in %s",
                    summary, calendar_entity_id,
                )
            except Exception as err:
                _LOGGER.warning(
                    "Could not create secondary calendar event in %s: %s",
                    calendar_entity_id, err,
                )

    async def _delete_secondary_calendar_events(self, machine_number: int, start_time: str) -> None:
        """Delete secondary calendar events when a booking is cancelled."""
        if not self.store:
            return
        secondary_calendars = self.store.get_secondary_calendar_events(machine_number, start_time)
        if not secondary_calendars:
            return

        if not self.hass.services.has_service("calendar", "delete_event"):
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
            return

        window_start = (start_dt - timedelta(hours=1)).astimezone(ZoneInfo("UTC"))
        window_end   = (start_dt + timedelta(hours=1)).astimezone(ZoneInfo("UTC"))

        for calendar_entity_id in secondary_calendars:
            try:
                response = await self.hass.services.async_call(
                    "calendar", "get_events",
                    {
                        "entity_id": calendar_entity_id,
                        "start_date_time": window_start.isoformat(),
                        "end_date_time": window_end.isoformat(),
                    },
                    blocking=True, return_response=True,
                )
                events = response.get(calendar_entity_id, {}).get("events", [])
                matching = [e for e in events if e.get("summary") == summary]
                if not matching:
                    continue
                event = matching[0]
                call_data: dict = {
                    "entity_id": calendar_entity_id,
                    "start_date_time": event.get("start", start_dt.isoformat()),
                    "end_date_time": event.get("end", event.get("start", start_dt.isoformat())),
                    "summary": summary,
                }
                if event.get("uid"):
                    call_data["uid"] = event["uid"]
                await self.hass.services.async_call("calendar", "delete_event", call_data, blocking=True)
                _LOGGER.info("Deleted secondary calendar event in %s", calendar_entity_id)
            except Exception as err:
                _LOGGER.warning("Could not delete secondary calendar event in %s: %s", calendar_entity_id, err)

        await self.store.async_remove_secondary_calendar_events(machine_number, start_time)

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
