# VERSION = "2.0.0"
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
        self.hass = hass
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {}

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if stored:
            self._data = stored
        else:
            self._data = self._default_data()
        _LOGGER.info(
            "MieleLogic store loaded (%d devices, %d notifications, %d bookings)",
            len(self._data.get("devices", [])),
            len(self._data.get("notifications", {})),
            len(self._data.get("bookings", {})),
        )

    async def async_save(self) -> None:
        await self._store.async_save(self._data)

    def _default_data(self) -> dict[str, Any]:
        return {
            "devices": [],
            "bookings": {},
            "calendar_synced": [],  # v2.1.0: Persistent calendar event tracking
            "admin": {
                "booking_locked": False,
                "lock_message": "Booking er midlertidigt spærret",
                "info_message": "",
            },
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
        return self._data.get("devices", [])

    async def async_save_devices(self, devices: list[str]) -> None:
        self._data["devices"] = devices
        await self.async_save()

    def get_available_mobile_apps(self) -> list[dict[str, Any]]:
        services = []
        for service in self.hass.services.async_services().get("notify", {}).keys():
            if service.startswith("mobile_app_"):
                device_name = service.replace("mobile_app_", "").replace("_", " ").title()
                services.append({
                    "service": f"notify.{service}",
                    "name": device_name,
                    "entity_id": service,
                })
        return services

    # ─── Notifications ───

    def get_notifications(self) -> dict[str, Any]:
        return self._data.get("notifications", {})

    def get_notification(self, notification_id: str) -> dict[str, Any] | None:
        return self._data.get("notifications", {}).get(notification_id)

    async def async_save_notification(self, notification_id: str, config: dict[str, Any]) -> None:
        if "notifications" not in self._data:
            self._data["notifications"] = {}
        self._data["notifications"][notification_id] = config
        await self.async_save()

    async def async_delete_notification(self, notification_id: str) -> bool:
        if notification_id in self._data.get("notifications", {}):
            del self._data["notifications"][notification_id]
            await self.async_save()
            return True
        return False

    # ─── Booking Metadata ───

    def _get_booking_key(self, machine: int, start_time: str) -> str:
        normalized_time = start_time.replace("T", " ")
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
            "calendar_event_id": calendar_event_id,
        }
        await self.async_save()
        _LOGGER.debug("Saved booking metadata for %s (created by %s)", key, user_name)

    def get_booking_history(self, days: int = 30) -> list:
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)
        history = []
        for key, meta in self._data.get("bookings", {}).items():
            try:
                created_at = datetime.fromisoformat(meta["created_at"])
                if created_at >= cutoff:
                    start_str = meta.get("start_time", "")
                    try:
                        start_dt = datetime.fromisoformat(start_str.replace(" ", "T").split("+")[0])
                        if start_dt < datetime.now():
                            history.append({**meta, "key": key})
                    except Exception:
                        pass
            except Exception:
                pass
        history.sort(key=lambda x: x.get("start_time", ""), reverse=True)
        return history

    def get_booking_metadata(self, machine: int, start_time: str) -> dict[str, Any] | None:
        key = self._get_booking_key(machine, start_time)
        return self._data.get("bookings", {}).get(key)

    async def async_delete_booking_metadata(self, machine: int, start_time: str) -> None:
        if "bookings" not in self._data:
            return
        key = self._get_booking_key(machine, start_time)
        if key in self._data["bookings"]:
            del self._data["bookings"][key]
            await self.async_save()
            _LOGGER.debug("Deleted booking metadata for %s", key)

    # ─── Admin ───

    def get_admin_settings(self) -> dict:
        return self._data.get("admin", {
            "booking_locked": False,
            "lock_message": "Booking er midlertidigt spærret",
            "info_message": "",
        })

    async def async_save_admin_settings(self, settings: dict) -> None:
        self._data["admin"] = {
            "booking_locked": bool(settings.get("booking_locked", False)),
            "lock_message": str(settings.get("lock_message", "Booking er midlertidigt spærret")),
            "info_message": str(settings.get("info_message", "")),
        }
        await self.async_save()
        _LOGGER.debug("Admin settings saved: %s", self._data["admin"])

    # ─── Calendar Sync Tracking (persistent — survives HA restarts) ───

    def get_calendar_synced_events(self) -> set:
        """Return set of (machine, start_time) tuples already synced to calendar."""
        raw = self._data.get("calendar_synced", [])
        return set(tuple(item) for item in raw)

    async def async_add_calendar_synced_event(self, machine: int, start_time: str) -> None:
        """Record that a calendar event was created — persisted across restarts."""
        if "calendar_synced" not in self._data:
            self._data["calendar_synced"] = []
        key = [machine, start_time]
        if key not in self._data["calendar_synced"]:
            self._data["calendar_synced"].append(key)
            await self.async_save()
            _LOGGER.debug("Calendar sync recorded: machine %s at %s", machine, start_time)

    async def async_remove_calendar_synced_event(self, machine: int, start_time: str) -> None:
        """Remove sync record when booking is cancelled."""
        if "calendar_synced" not in self._data:
            return
        key = [machine, start_time]
        if key in self._data["calendar_synced"]:
            self._data["calendar_synced"].remove(key)
            await self.async_save()
            _LOGGER.debug("Calendar sync removed: machine %s at %s", machine, start_time)

    # ─── Cleanup ───

    async def async_cleanup_old_bookings(self, days: int = 7) -> int:
        """Clean up booking metadata older than X days. Returns count cleaned."""
        if "bookings" not in self._data:
            return 0
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)
        to_delete = [
            key for key, meta in self._data["bookings"].items()
            if datetime.fromisoformat(meta["created_at"]) < cutoff
        ]
        for key in to_delete:
            del self._data["bookings"][key]
        if to_delete:
            await self.async_save()
            _LOGGER.info("Cleaned up %d old booking metadata entries", len(to_delete))
        return len(to_delete)
