# VERSION = "2.5.4"
"""Notification manager for MieleLogic."""

import logging
from datetime import datetime, timezone
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

_LOGGER = logging.getLogger(__name__)


class NotificationManager:
    """Manage notifications for MieleLogic bookings."""

    def __init__(self, hass: HomeAssistant, store) -> None:
        """Initialize notification manager."""
        self.hass = hass
        self.store = store

    async def send_notification(
        self,
        notification_type: str,
        variables: dict[str, Any],
    ) -> None:
        """Send notification to configured devices.
        
        Args:
            notification_type: Type of notification (reminder_15min, etc)
            variables: Variables to replace in message template
        """
        # Get notification config
        notification = self.store.get_notification(notification_type)
        
        if not notification or not notification.get("enabled", False):
            _LOGGER.debug("Notification %s is disabled, skipping", notification_type)
            return
        
        # Get configured devices
        devices = self.store.get_devices()
        
        if not devices:
            _LOGGER.warning("No devices configured for notifications")
            return
        
        # Format message
        title = self._format_message(notification.get("title", ""), variables)
        message = self._format_message(notification.get("message", ""), variables)
        
        # Send to all devices
        for device in devices:
            try:
                # Build rich notification data
                notification_data: dict[str, Any] = {
                    "url": "/mielelogic",  # Deep link to panel on tap
                    "push": {"sound": "default"},
                }

                # For booking_created: add Cancel action button
                # Action identifier encodes machine + start_time for the event listener
                cancel_action = variables.get("_cancel_action")
                if cancel_action:
                    notification_data["actions"] = [
                        {
                            "action": cancel_action,
                            "title": "Aflys booking",
                            "destructive": True,
                        },
                        {
                            "action": "URI",
                            "title": "Åbn panel",
                            "uri": "/mielelogic",
                        },
                    ]
                else:
                    notification_data["actions"] = [
                        {
                            "action": "URI",
                            "title": "Åbn panel",
                            "uri": "/mielelogic",
                        },
                    ]

                await self.hass.services.async_call(
                    "notify",
                    device.replace("notify.", ""),
                    {
                        "title": title,
                        "message": message,
                        "data": notification_data,
                    },
                    blocking=False,
                )
                
                _LOGGER.debug(
                    "📱 Notification sent to %s: %s",
                    device,
                    title,
                )
            
            except Exception as err:
                _LOGGER.error(
                    "Failed to send notification to %s: %s",
                    device,
                    err,
                )

    def _format_message(self, template: str, variables: dict[str, Any]) -> str:
        """Format message with variables.
        
        Supports variables:
        - {vaskehus}: Klatvask / Storvask
        - {time}: 14:00
        - {date}: 22-02-2026
        - {duration}: 120 minutter
        - {machine}: Maskine 1
        """
        result = template
        
        for key, value in variables.items():
            result = result.replace(f"{{{key}}}", str(value))
        
        return result

    async def notify_booking_created(
        self,
        vaskehus: str,
        start_time: datetime,
        duration: int,
        machine: int,
    ) -> None:
        """Send notification when booking is created."""
        await self.send_notification(
            "booking_created",
            {
                "vaskehus": vaskehus,
                "time": start_time.strftime("%H:%M"),
                "date": start_time.strftime("%d-%m-%Y"),
                "duration": f"{duration} minutter",
                "machine": f"Maskine {machine}",
            },
        )

    async def notify_booking_canceled(
        self,
        vaskehus: str,
        start_time: datetime,
    ) -> None:
        """Send notification when booking is canceled."""
        await self.send_notification(
            "booking_canceled",
            {
                "vaskehus": vaskehus,
                "time": start_time.strftime("%H:%M"),
                "date": start_time.strftime("%d-%m-%Y"),
            },
        )

    async def notify_reminder_15min(
        self,
        vaskehus: str,
        start_time: datetime,
    ) -> None:
        """Send 15-minute reminder."""
        await self.send_notification(
            "reminder_15min",
            {
                "vaskehus": vaskehus,
                "time": start_time.strftime("%H:%M"),
            },
        )

    async def notify_5min_left(
        self,
        vaskehus: str,
    ) -> None:
        """Send notification when 5 minutes left."""
        await self.send_notification(
            "reminder_5min_left",
            {
                "vaskehus": vaskehus,
            },
        )

    def schedule_voice_reminder(
        self,
        booking_key: str,
        start_dt: datetime,
    ) -> None:
        """Schedule a House Voice reminder 15 min before start_dt.

        Cancels any existing reminder for the same booking_key first.
        Does nothing if voice_reminder is disabled or house_voice.say is unavailable.
        """
        config = self.store.get_notification("voice_reminder")
        if not config or not config.get("enabled", False):
            _LOGGER.debug("Voice reminder disabled — skipping schedule")
            return

        if not self.hass.services.has_service("house_voice", "say"):
            _LOGGER.warning("house_voice.say not available — skipping voice reminder")
            return

        # Cancel any existing handle for this booking
        self.cancel_voice_reminder(booking_key)

        now = datetime.now(timezone.utc)
        remind_at = start_dt.astimezone(timezone.utc).replace(tzinfo=timezone.utc)
        # Ensure start_dt is timezone-aware
        if start_dt.tzinfo is None:
            from zoneinfo import ZoneInfo
            remind_at = start_dt.replace(tzinfo=ZoneInfo("Europe/Copenhagen")).astimezone(timezone.utc)

        from datetime import timedelta
        remind_at = remind_at - timedelta(minutes=15)
        delay = (remind_at - now).total_seconds()

        if delay <= 0:
            _LOGGER.debug("Voice reminder for %s is in the past — skipping", booking_key)
            return

        event_id = config.get("event_id", "Vaske tid")

        async def _fire(_now):
            """Fire the house_voice.say call."""
            try:
                await self.hass.services.async_call(
                    "house_voice", "say",
                    {"event": event_id},
                    blocking=False,
                )
                _LOGGER.info("🔊 Voice reminder fired: house_voice.say event=%s", event_id)
            except Exception as err:
                _LOGGER.warning("Voice reminder failed: %s", err)
            finally:
                self.store._voice_reminder_handles.pop(booking_key, None)

        cancel = async_call_later(self.hass, delay, _fire)
        self.store._voice_reminder_handles[booking_key] = cancel
        _LOGGER.info(
            "🔔 Voice reminder scheduled for %s in %.0f seconds (event=%s)",
            booking_key, delay, event_id,
        )

    def cancel_voice_reminder(self, booking_key: str) -> None:
        """Cancel a previously scheduled voice reminder."""
        handle = self.store._voice_reminder_handles.pop(booking_key, None)
        if handle:
            handle()
            _LOGGER.debug("Voice reminder cancelled for %s", booking_key)
