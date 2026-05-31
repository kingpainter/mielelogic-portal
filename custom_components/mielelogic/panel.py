# VERSION = "2.5.1"
"""Panel registration for MieleLogic.

Serves the JS panel as a static HTTP path and registers it in the HA
sidebar via panel_custom.  Pattern based on Energy Hub panel.py v1.1.0
and Indeklima panel.py v2.4.0.

The booking card is also registered as a Lovelace extra JS resource.
"""
from __future__ import annotations

import os
import logging

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    VERSION,
    DEFAULT_SIDEBAR_TITLE,
    DEFAULT_SIDEBAR_ICON,
    DEFAULT_REQUIRE_ADMIN,
)

_LOGGER = logging.getLogger(__name__)

PANEL_URL = f"/api/{DOMAIN}-panel"
PANEL_NAME = "mielelogic-panel-v2"
PANEL_FOLDER = "frontend"
PANEL_FILENAME = "panel.js"
CUSTOM_COMPONENTS = "custom_components"

CARD_URL = f"/api/{DOMAIN}-card"
CARD_FILENAME = "mielelogic-booking-card.js"

LOGO_URL = f"/api/{DOMAIN}-logo"
LOGO_FILENAME = "mielelogic_logo.png"


async def async_register_panel(
    hass: HomeAssistant,
    sidebar_title: str = DEFAULT_SIDEBAR_TITLE,
    sidebar_icon: str = DEFAULT_SIDEBAR_ICON,
    require_admin: bool = DEFAULT_REQUIRE_ADMIN,
    frontend_url_path: str = DOMAIN,
) -> None:
    """Register the MieleLogic sidebar panel and booking card."""
    # Guard against double registration within the same HA session
    if hass.data.get(DOMAIN, {}).get("_panel_registered", False):
        _LOGGER.debug("MieleLogic panel already registered, skipping")
        return

    root_dir = hass.config.path(CUSTOM_COMPONENTS, DOMAIN)
    frontend_dir = os.path.join(root_dir, PANEL_FOLDER)
    panel_file = os.path.join(frontend_dir, PANEL_FILENAME)
    card_file = os.path.join(frontend_dir, CARD_FILENAME)

    if not os.path.isfile(panel_file):
        _LOGGER.error(
            "MieleLogic: panel JS not found at %s", panel_file,
        )
        return

    try:
        panel_mtime = int(os.path.getmtime(panel_file))
    except OSError:
        panel_mtime = 0

    logo_file = os.path.join(frontend_dir, LOGO_FILENAME)

    static_paths = [
        StaticPathConfig(PANEL_URL, panel_file, cache_headers=False),
    ]
    if os.path.isfile(card_file):
        static_paths.append(StaticPathConfig(CARD_URL, card_file, cache_headers=False))
    if os.path.isfile(logo_file):
        static_paths.append(StaticPathConfig(LOGO_URL, logo_file, cache_headers=True))

    try:
        await hass.http.async_register_static_paths(static_paths)
        _LOGGER.info("MieleLogic: static paths registered: %s", [p.url_path for p in static_paths])
    except RuntimeError as err:
        _LOGGER.debug("MieleLogic: static paths already registered: %s", err)

    try:
        await panel_custom.async_register_panel(
            hass,
            webcomponent_name=PANEL_NAME,
            frontend_url_path=frontend_url_path,
            module_url=f"{PANEL_URL}?v={VERSION}&m={panel_mtime}",
            sidebar_title=sidebar_title,
            sidebar_icon=sidebar_icon,
            require_admin=require_admin,
            config={},
        )
        _LOGGER.info("MieleLogic: panel registered in sidebar at /%s", frontend_url_path)
    except Exception as err:
        _LOGGER.warning("MieleLogic: could not register panel: %s", err)

    # ── Register booking card as Lovelace resource ─────────────────────────
    if os.path.isfile(card_file):
        try:
            from homeassistant.components.frontend import add_extra_js_url

            try:
                card_mtime = int(os.path.getmtime(card_file))
            except OSError:
                card_mtime = 0

            card_url = f"{CARD_URL}?v={VERSION}&m={card_mtime}"
            add_extra_js_url(hass, card_url)
            _LOGGER.warning(
                "MieleLogic: booking card registered at %s (size=%d bytes)",
                card_url,
                os.path.getsize(card_file),
            )
        except Exception as err:
            _LOGGER.warning("MieleLogic: could not register booking card: %s", err)
    else:
        _LOGGER.error(
            "MieleLogic: booking card JS NOT FOUND at %s — card will not load",
            card_file,
        )

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["_panel_registered"] = True


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove the MieleLogic panel from the sidebar."""
    from homeassistant.components import frontend

    if hass.data.get(DOMAIN, {}).get("_panel_registered", False):
        frontend.async_remove_panel(hass, DOMAIN)
        _LOGGER.debug("MieleLogic: panel removed from sidebar")
    else:
        _LOGGER.debug("MieleLogic: panel was not registered, skipping removal")

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["_panel_registered"] = False
