# VERSION = "1.9.1"
"""Panel registration for MieleLogic."""
from __future__ import annotations

import os
import logging

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Panel configuration
VERSION = "1.7.0"
PANEL_URL = f"/api/{DOMAIN}-panel"
PANEL_ICON = "mdi:washing-machine"
PANEL_NAME = "mielelogic-panel"
PANEL_TITLE = "MieleLogic"
PANEL_FOLDER = "frontend"
PANEL_FILENAME = "panel.js"
CUSTOM_COMPONENTS = "custom_components"
INTEGRATION_FOLDER = DOMAIN


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the MieleLogic panel (Alarmo/Secure Me style)."""
    
    # Check if panel already registered
    if hass.data[DOMAIN].get("_panel_registered", False):
        _LOGGER.debug("Panel already registered, skipping")
        return
    
    # Get paths
    root_dir = os.path.join(hass.config.path(CUSTOM_COMPONENTS), INTEGRATION_FOLDER)
    panel_dir = os.path.join(root_dir, PANEL_FOLDER)
    view_url = os.path.join(panel_dir, PANEL_FILENAME)

    # Cache busting based on file modification time
    try:
        cache_bust = int(os.path.getmtime(view_url))
    except OSError:
        _LOGGER.warning(f"Panel file not found: {view_url}")
        cache_bust = 0

    # Register static path for panel file
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_URL, view_url, cache_headers=False)]
    )
    
    _LOGGER.info(f"✅ Panel static path registered: {PANEL_URL}")

    # Register custom panel
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_NAME,
        frontend_url_path=DOMAIN,
        module_url=f"{PANEL_URL}?v={VERSION}&m={cache_bust}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
        # NOTE: Do NOT set config_panel_domain - it hijacks the config button!
    )
    
    # Mark as registered
    hass.data[DOMAIN]["_panel_registered"] = True
    
    _LOGGER.info(f"✅ Panel '{PANEL_TITLE}' registered in sidebar at /{DOMAIN}")


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the MieleLogic panel."""
    from homeassistant.components import frontend
    frontend.async_remove_panel(hass, DOMAIN)
    _LOGGER.debug("Panel removed from sidebar")
