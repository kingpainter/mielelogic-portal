# VERSION = "2.0.0"
"""The MieleLogic integration - Integrated Panel Edition."""
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from .const import (
    DOMAIN,
    CONF_PANEL_ENABLED,
    CONF_SIDEBAR_TITLE,
    CONF_SIDEBAR_ICON,
    CONF_REQUIRE_ADMIN,
    DEFAULT_PANEL_ENABLED,
    DEFAULT_SIDEBAR_TITLE,
    DEFAULT_SIDEBAR_ICON,
    DEFAULT_REQUIRE_ADMIN,
)
from .coordinator import MieleLogicDataUpdateCoordinator
from .services import async_setup_services, async_unload_services
from .panel import async_register_panel, async_unregister_panel
from .websocket import async_register_websocket_commands
from .time_manager import TimeSlotManager
from .booking_manager import BookingManager

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "binary_sensor", "calendar"]

# Default configuration values (v1.4.6+)
DEFAULT_CONFIG = {
    "klatvask_primary_machine": 1,
    "storvask_primary_machine": 4,
    "klatvask_slots": [
        {"start": "07:00", "end": "09:00"},
        {"start": "09:00", "end": "11:00"},
        {"start": "11:00", "end": "13:00"},
        {"start": "13:00", "end": "15:00"},
        {"start": "15:00", "end": "17:00"},
        {"start": "17:00", "end": "19:00"},
        {"start": "19:00", "end": "21:00"},
    ],
    "storvask_slots": [
        {"start": "07:00", "end": "09:00"},
        {"start": "09:00", "end": "12:00"},
        {"start": "12:00", "end": "14:00"},
        {"start": "14:00", "end": "17:00"},
        {"start": "17:00", "end": "19:00"},
        {"start": "19:00", "end": "21:00"},
    ],
    "opening_time": "07:00",
    "closing_time": "21:00",
}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up MieleLogic from a config entry."""
    _LOGGER.debug("Setting up MieleLogic integration for entry: %s", entry.entry_id)
    
    # Ensure config has all required keys
    await _ensure_config_complete(hass, entry)
    
    # Listen for option changes → reload automatically, no restart needed
    entry.async_on_unload(
        entry.add_update_listener(_async_update_listener)
    )
    
    # Initialize store (global, shared)
    from .storage import MieleLogicStore
    if "store" not in hass.data.get(DOMAIN, {}):
        store = MieleLogicStore(hass)
        await store.async_load()
        hass.data.setdefault(DOMAIN, {})
        hass.data[DOMAIN]["store"] = store
    else:
        store = hass.data[DOMAIN]["store"]
    
    # Setup coordinator
    coordinator = MieleLogicDataUpdateCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    
    # Setup managers
    time_manager = TimeSlotManager(entry)
    
    from .notification_manager import NotificationManager
    notification_manager = NotificationManager(hass, store)
    
    booking_manager = BookingManager(coordinator, store, notification_manager)
    
    # Store coordinator (platforms need coordinator object)
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        "coordinator": coordinator,
        "time_manager": time_manager,
        "booking_manager": booking_manager,
        "notification_manager": notification_manager,
    }
    
    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    # Set up services (only once, not per config entry)
    if len([k for k in hass.data[DOMAIN].keys() if k != "store"]) == 1:
        await async_setup_services(hass, coordinator)
        
        # Register panel from options (Energy Hub pattern)
        options = entry.options
        panel_enabled = options.get(CONF_PANEL_ENABLED, DEFAULT_PANEL_ENABLED)

        if panel_enabled:
            await async_register_panel(
                hass,
                sidebar_title=options.get(CONF_SIDEBAR_TITLE, DEFAULT_SIDEBAR_TITLE),
                sidebar_icon=options.get(CONF_SIDEBAR_ICON, DEFAULT_SIDEBAR_ICON),
                require_admin=options.get(CONF_REQUIRE_ADMIN, DEFAULT_REQUIRE_ADMIN),
            )
        else:
            _LOGGER.info("MieleLogic: panel is disabled via settings")
        
        # Register WebSocket commands (only once)
        async_register_websocket_commands(hass)
    
    _LOGGER.info("MieleLogic v2.0.0 setup complete with integrated panel")
    return True


async def _ensure_config_complete(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Ensure config entry has all required keys with defaults."""
    needs_update = False
    new_data = dict(entry.data)
    
    # Check and add missing config keys
    for key, default_value in DEFAULT_CONFIG.items():
        if key not in new_data or new_data[key] is None:
            _LOGGER.info(
                "🔧 Config migration: Adding missing key '%s' with default value", 
                key
            )
            new_data[key] = default_value
            needs_update = True
    
    # Update entry if any keys were added
    if needs_update:
        hass.config_entries.async_update_entry(entry, data=new_data)
        _LOGGER.info("✅ Config migration complete - all required keys present")
    else:
        _LOGGER.debug("✅ Config already complete - no migration needed")


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    _LOGGER.debug("Unloading MieleLogic integration for entry: %s", entry.entry_id)
    
    # Unload platforms
    if await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        hass.data[DOMAIN].pop(entry.entry_id)
        
        # Unload services and panel only if this is the last config entry
        if not any(
            k for k in hass.data[DOMAIN] if k not in ("store", "_panel_registered")
        ):
            await async_unload_services(hass)
            async_unregister_panel(hass)
        
        _LOGGER.info("MieleLogic integration unloaded successfully")
        return True
    return False


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Called automatically when the user saves new settings via Configure.

    Reloads the integration (async_unload_entry + async_setup_entry)
    without requiring a HA restart.
    """
    _LOGGER.debug("MieleLogic: settings updated, reloading panel...")
    await hass.config_entries.async_reload(entry.entry_id)
