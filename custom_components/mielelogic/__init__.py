# VERSION = "1.4.6"
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from .const import DOMAIN
from .coordinator import MieleLogicDataUpdateCoordinator
from .services import async_setup_services, async_unload_services

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "binary_sensor", "calendar"]

# Default configuration values (v1.4.6)
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
    
    # NEW v1.4.6: Migrate/ensure config has all required keys
    await _ensure_config_complete(hass, entry)
    
    coordinator = MieleLogicDataUpdateCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator
    
    # Set up platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    # Set up services (only once, not per config entry)
    if len(hass.data[DOMAIN]) == 1:
        await async_setup_services(hass, coordinator)
    
    _LOGGER.info("MieleLogic integration setup complete with platforms: %s", PLATFORMS)
    return True


async def _ensure_config_complete(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Ensure config entry has all required keys with defaults.
    
    NEW v1.4.6: This migration ensures that machine numbers and slots
    are always present in config_entry.data, even after upgrades or
    if Options Flow failed to save them properly.
    """
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
        
        # Unload services only if this is the last config entry
        if not hass.data[DOMAIN]:
            await async_unload_services(hass)
        
        _LOGGER.info("MieleLogic integration unloaded successfully")
        return True
    return False
