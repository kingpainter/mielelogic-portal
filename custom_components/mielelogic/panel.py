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

PANEL_URL = f"/api/{DOMAIN}-panel"
PANEL_ICON = "mdi:washing-machine"
PANEL_NAME = "mielelogic-panel-v2"
PANEL_TITLE = "MieleLogic"
PANEL_FOLDER = "frontend"
PANEL_FILENAME = "panel.js"
CUSTOM_COMPONENTS = "custom_components"
INTEGRATION_FOLDER = DOMAIN

CARD_URL = f"/api/{DOMAIN}-card"
CARD_FILENAME = "mielelogic-booking-card.js"

_SESSION_KEY = f"{DOMAIN}_session_registered"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the MieleLogic panel and Lovelace booking card."""

    root_dir = os.path.join(hass.config.path(CUSTOM_COMPONENTS), INTEGRATION_FOLDER)
    frontend_dir = os.path.join(root_dir, PANEL_FOLDER)
    panel_file = os.path.join(frontend_dir, PANEL_FILENAME)
    card_file = os.path.join(frontend_dir, CARD_FILENAME)

    # ── Static paths — once per HA session ───────────────────────────────────
    if not hass.data.get(_SESSION_KEY, False):
        static_paths = []
        if os.path.exists(panel_file):
            static_paths.append(StaticPathConfig(PANEL_URL, panel_file, cache_headers=False))
        if os.path.exists(card_file):
            static_paths.append(StaticPathConfig(CARD_URL, card_file, cache_headers=False))
        if static_paths:
            try:
                await hass.http.async_register_static_paths(static_paths)
                _LOGGER.info("Static paths registered: %s", [p.url_path for p in static_paths])
            except RuntimeError as err:
                _LOGGER.debug("Static paths already registered: %s", err)
        hass.data[_SESSION_KEY] = True

    # ── Sidebar panel — once per session ──────────────────────────────────────
    hass.data.setdefault(DOMAIN, {})
    if not hass.data[DOMAIN].get("_panel_registered", False):
        try:
            panel_mtime = int(os.path.getmtime(panel_file))
        except OSError:
            panel_mtime = 0

        try:
            from .const import VERSION
            await panel_custom.async_register_panel(
                hass,
                webcomponent_name=PANEL_NAME,
                frontend_url_path=DOMAIN,
                module_url=f"{PANEL_URL}?v={VERSION}&m={panel_mtime}",
                sidebar_title=PANEL_TITLE,
                sidebar_icon=PANEL_ICON,
                require_admin=False,
                config={},
            )
            _LOGGER.info("Panel '%s' registered at /%s", PANEL_TITLE, DOMAIN)
        except Exception as err:  # pylint: disable=broad-except
            _LOGGER.warning("Could not register panel: %s", err)

        hass.data[DOMAIN]["_panel_registered"] = True

    # ── Lovelace card resource ─────────────────────────────────────────────────
    try:
        from homeassistant.components.frontend import add_extra_js_url
        try:
            card_mtime = int(os.path.getmtime(card_file))
        except OSError:
            card_mtime = 0
        from .const import VERSION
        add_extra_js_url(hass, f"{CARD_URL}?v={VERSION}&m={card_mtime}")
        _LOGGER.info("Booking card registered as Lovelace resource")
    except Exception as err:  # pylint: disable=broad-except
        _LOGGER.warning("Could not register booking card: %s", err)


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the MieleLogic panel."""
    from homeassistant.components import frontend
    frontend.async_remove_panel(hass, DOMAIN)
    _LOGGER.debug("Panel removed from sidebar")
