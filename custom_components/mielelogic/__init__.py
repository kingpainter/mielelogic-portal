# VERSION = "1.4.5"
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from .const import DOMAIN
from .coordinator import MieleLogicDataUpdateCoordinator
from .services import async_setup_services, async_unload_services

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor", "binary_sensor", "calendar"]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up MieleLogic from a config entry."""
    _LOGGER.debug("Setting up MieleLogic integration for entry: %s", entry.entry_id)
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
