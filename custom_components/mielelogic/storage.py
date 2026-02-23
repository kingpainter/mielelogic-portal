# VERSION = "1.5.1"
"""Data storage for MieleLogic panel configuration."""

import logging
from typing import Any

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
            "✅ MieleLogic store loaded (%d devices, %d notifications)",
            len(self._data.get("devices", [])),
            len(self._data.get("notifications", {})),
        )

    async def async_save(self) -> None:
        """Save data to storage."""
        await self._store.async_save(self._data)

    def _default_data(self) -> dict[str, Any]:
        """Return default data structure."""
        return {
            "devices": [],  # Mobile app devices for notifications
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
