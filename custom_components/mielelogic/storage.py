# VERSION = "1.9.1"
"""Data storage for MieleLogic panel configuration."""

import logging
from typing import Any
from datetime import datetime

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}.panel_config"


class MieleLogicStore:
    """Manage persistent storage for MieleLogic panel."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize store."""
        self.hass = hass
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {}

    async def async_load(self) -> None:
        """Load data from storage."""
        stored = await self._store.async_load()
        if stored:
            self._data = stored
        else:
            self._data = self._default_data()
        
        _LOGGER.info(
            "✅ MieleLogic store loaded (%d devices, %d notifications, %d bookings)",
            len(self._data.get("devices", [])),
            len(self._data.get("notifications", {})),
            len(self._data.get("bookings", {})),
        )

    async def async_save(self) -> None:
        """Save data to storage."""
        await self._store.async_save(self._data)

    def _default_data(self) -> dict[str, Any]:
        """Return default data structure."""
        return {
            "devices": [],  # Mobile app devices for notifications
            "bookings": {},  # Booking metadata {booking_key: metadata}
            "notifications": {
                "reminder_15min": {
                    "enabled": True,
                    "title": "🧺 Vasketid om 15 minutter",
                    "message": "Din {vaskehus} booking starter kl. {time}",
                },
                "reminder_5min_left": {
                    "enabled": True,
                    "title": "⏰ 5 minutter tilbage",
                    "message": "{vaskehus} er færdig om 5 minutter",
                },
                "booking_created": {
                    "enabled": True,
                    "title": "✅ Booking bekræftet",
                    "message": "{vaskehus} booket {date} kl. {time}",
                },
                "booking_canceled": {
                    "enabled": False,
                    "title": "❌ Booking annulleret",
                    "message": "{vaskehus} booking slettet",
                },
            },
        }

    # ─── Devices ───

    def get_devices(self) -> list[str]:
        """Get all configured mobile app devices."""
        return self._data.get("devices", [])

    async def async_save_devices(self, devices: list[str]) -> None:
        """Save device list."""
        self._data["devices"] = devices
        await self.async_save()

    def get_available_mobile_apps(self) -> list[dict[str, Any]]:
        """Get all available mobile app notify services."""
        services = []
        
        # Get all notify services
        for service in self.hass.services.async_services().get("notify", {}).keys():
            if service.startswith("mobile_app_"):
                # Extract device name
                device_name = service.replace("mobile_app_", "").replace("_", " ").title()
                
                services.append({
                    "service": f"notify.{service}",
                    "name": device_name,
                    "entity_id": service,
                })
        
        return services

    # ─── Notifications ───

    def get_notifications(self) -> dict[str, Any]:
        """Get all notification configurations."""
        return self._data.get("notifications", {})

    def get_notification(self, notification_id: str) -> dict[str, Any] | None:
        """Get specific notification config."""
        return self._data.get("notifications", {}).get(notification_id)

    async def async_save_notification(
        self, 
        notification_id: str, 
        config: dict[str, Any]
    ) -> None:
        """Save notification configuration."""
        if "notifications" not in self._data:
            self._data["notifications"] = {}
        
        self._data["notifications"][notification_id] = config
        await self.async_save()

    async def async_delete_notification(self, notification_id: str) -> bool:
        """Delete a notification."""
        if notification_id in self._data.get("notifications", {}):
            del self._data["notifications"][notification_id]
            await self.async_save()
            return True
        return False

    # ─── Booking Metadata ───

    def _get_booking_key(self, machine: int, start_time: str) -> str:
        """Generate unique booking key.
        
        Normalizes start_time format to ensure consistency.
        Accepts: "2026-05-04 07:00:00" or "2026-05-04T07:00:00"
        Returns: "machine_1_2026-05-04 07:00:00"
        """
        # Normalize: Replace T with space for consistency
        normalized_time = start_time.replace("T", " ")
        # Key format: "machine_1_2026-02-23 14:00:00"
        return f"machine_{machine}_{normalized_time}"

    async def async_save_booking_metadata(
        self,
        machine: int,
        start_time: str,
        user_name: str,
        vaskehus: str | None = None,
        duration: int | None = None,
        calendar_event_id: str | None = None,
    ) -> None:
        """Save booking metadata (who created it, when, etc).
        
        Args:
            machine: Machine number
            start_time: Start time string
            user_name: Username who created booking
            vaskehus: Vaskehus name
            duration: Duration in minutes
            calendar_event_id: Calendar event ID (for deletion on cancel)
        """
        if "bookings" not in self._data:
            self._data["bookings"] = {}
        
        key = self._get_booking_key(machine, start_time)
        
        self._data["bookings"][key] = {
            "created_by": user_name,
            "created_at": datetime.now().isoformat(),
            "machine": machine,
            "start_time": start_time,
            "vaskehus": vaskehus,
            "duration": duration,
            "calendar_event_id": calendar_event_id,  # ✨ v1.7.0: Track for deletion
        }
        
        await self.async_save()
        _LOGGER.debug("Saved booking metadata for %s (created by %s)", key, user_name)

    def get_booking_metadata(self, machine: int, start_time: str) -> dict[str, Any] | None:
        """Get booking metadata if exists."""
        key = self._get_booking_key(machine, start_time)
        return self._data.get("bookings", {}).get(key)

    async def async_delete_booking_metadata(self, machine: int, start_time: str) -> None:
        """Delete booking metadata when booking is canceled."""
        if "bookings" not in self._data:
            return
        
        key = self._get_booking_key(machine, start_time)
        if key in self._data["bookings"]:
            del self._data["bookings"][key]
            await self.async_save()
            _LOGGER.debug("Deleted booking metadata for %s", key)

    async def async_cleanup_old_bookings(self, days: int = 7) -> int:
        """Clean up booking metadata older than X days.
        
        Returns number of bookings cleaned up.
        """
        if "bookings" not in self._data:
            return 0
        
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)
        cleaned = 0
        
        to_delete = []
        for key, metadata in self._data["bookings"].items():
            created_at = datetime.fromisoformat(metadata["created_at"])
            if created_at < cutoff:
                to_delete.append(key)
        
        for key in to_delete:
            del self._data["bookings"][key]
            cleaned += 1
        
        if cleaned > 0:
            await self.async_save()
            _LOGGER.info("Cleaned up %d old booking metadata entries", cleaned)
        
        return cleaned
