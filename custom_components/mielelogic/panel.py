# VERSION = "2.0.0"
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
PANEL_URL = f"/api/{DOMAIN}-panel"
PANEL_ICON = "mdi:washing-machine"
PANEL_NAME = "mielelogic-panel"
PANEL_TITLE = "MieleLogic"
PANEL_FOLDER = "frontend"
PANEL_FILENAME = "panel.js"
CUSTOM_COMPONENTS = "custom_components"
INTEGRATION_FOLDER = DOMAIN

# Booking card (Lovelace custom card)
CARD_URL = f"/api/{DOMAIN}-card"
CARD_FILENAME = "mielelogic-booking-card.js"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the MieleLogic panel and Lovelace booking card."""

    if hass.data[DOMAIN].get("_panel_registered", False):
        _LOGGER.debug("Panel already registered, skipping")
        return

    root_dir = os.path.join(hass.config.path(CUSTOM_COMPONENTS), INTEGRATION_FOLDER)
    # panel.js and booking card both live in frontend/ subfolder
    frontend_dir = os.path.join(root_dir, PANEL_FOLDER)
    panel_file = os.path.join(frontend_dir, PANEL_FILENAME)
    card_file = os.path.join(frontend_dir, CARD_FILENAME)

    # Cache busting based on file modification time
    try:
        panel_cache_bust = int(os.path.getmtime(panel_file))
    except OSError:
        _LOGGER.warning("Panel file not found: %s", panel_file)
        panel_cache_bust = 0

    try:
        card_cache_bust = int(os.path.getmtime(card_file))
    except OSError:
        _LOGGER.warning("Booking card file not found: %s", card_file)
        card_cache_bust = 0

    # Register static paths for both panel and booking card
    static_paths = [
        StaticPathConfig(PANEL_URL, panel_file, cache_headers=False),
        StaticPathConfig(CARD_URL, card_file, cache_headers=False),
    ]
    await hass.http.async_register_static_paths(static_paths)

    _LOGGER.info("Panel static path registered: %s", PANEL_URL)
    _LOGGER.info("Booking card static path registered: %s → %s", CARD_URL, card_file)

    # Register custom sidebar panel
    from .const import VERSION
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_NAME,
        frontend_url_path=DOMAIN,
        module_url=f"{PANEL_URL}?v={VERSION}&m={panel_cache_bust}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
    )

    # Mark as registered
    hass.data[DOMAIN]["_panel_registered"] = True
    _LOGGER.info("Panel '%s' registered in sidebar at /%s", PANEL_TITLE, DOMAIN)


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the MieleLogic panel."""
    from homeassistant.components import frontend
    frontend.async_remove_panel(hass, DOMAIN)
    _LOGGER.debug("Panel removed from sidebar")
