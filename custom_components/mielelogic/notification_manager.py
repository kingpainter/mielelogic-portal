# VERSION = "2.0.0"
"""Notification manager for MieleLogic."""

import logging
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant

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
                await self.hass.services.async_call(
                    "notify",
                    device.replace("notify.", ""),
                    {
                        "title": title,
                        "message": message,
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
