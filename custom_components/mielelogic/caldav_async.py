# VERSION = "2.6.6"
"""Async CalDAV client used only for deleting calendar events.

Replaces caldav_client.py (which used the synchronous `caldav` package).
Home Assistant's CalDAV integration does not implement event deletion
(home-assistant/core#159784), so this module talks to the CalDAV server
directly with HA's shared aiohttp session:

  1. PROPFIND  -> current-user-principal
  2. PROPFIND  -> calendar-home-set
  3. PROPFIND  -> list calendars (displayname -> href)
  4. REPORT    -> calendar-query time range, read SUMMARY from ICS
  5. DELETE    -> the matching event

Event creation still goes through calendar.create_event.
"""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from urllib.parse import urljoin

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

DAV_NS = "DAV:"
CALDAV_NS = "urn:ietf:params:xml:ns:caldav"
_D = f"{{{DAV_NS}}}"
_C = f"{{{CALDAV_NS}}}"
_TIMEOUT = aiohttp.ClientTimeout(total=15)

_PROPFIND_PRINCIPAL = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>'
)
_PROPFIND_HOME = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
    "<d:prop><c:calendar-home-set/></d:prop></d:propfind>"
)
_PROPFIND_CALENDARS = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>'
)


def _time_range_report(start_utc: datetime, end_utc: datetime) -> str:
    fmt = "%Y%m%dT%H%M%SZ"
    return (
        '<?xml version="1.0" encoding="utf-8"?>'
        '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
        "<d:prop><d:getetag/><c:calendar-data/></d:prop>"
        "<c:filter><c:comp-filter name=\"VCALENDAR\"><c:comp-filter name=\"VEVENT\">"
        f'<c:time-range start="{start_utc.strftime(fmt)}" end="{end_utc.strftime(fmt)}"/>'
        "</c:comp-filter></c:comp-filter></c:filter>"
        "</c:calendar-query>"
    )


def _ics_summary(ics: str) -> str | None:
    """Return the SUMMARY of the first VEVENT in an ICS payload (unfolded)."""
    unfolded = ics.replace("\r\n ", "").replace("\n ", "").replace("\r\n\t", "")
    for line in unfolded.splitlines():
        if line.startswith("SUMMARY"):
            value = line.split(":", 1)[1] if ":" in line else ""
            return value.replace("\\,", ",").replace("\\;", ";").replace("\\n", "\n").strip()
    return None


class CalDAVDeleteClient:
    """Minimal async, delete-only CalDAV client.

    Discovers calendars lazily on first use and caches name -> href
    for the lifetime of this instance (recreated on integration reload).
    """

    def __init__(self, hass: HomeAssistant, url: str, username: str, password: str) -> None:
        self.hass = hass
        self.url = url
        self._auth = aiohttp.BasicAuth(username, password)
        self._calendars_by_name: dict[str, str] | None = None

    async def _request(self, method: str, url: str, body: str | None = None, depth: str | None = None) -> tuple[int, str]:
        headers = {"Content-Type": 'application/xml; charset="utf-8"'}
        if depth is not None:
            headers["Depth"] = depth
        session = async_get_clientsession(self.hass)
        async with session.request(
            method, url, data=body, headers=headers, auth=self._auth, timeout=_TIMEOUT
        ) as response:
            return response.status, await response.text()

    def _first_href(self, root: ET.Element, prop: str) -> str | None:
        for el in root.iter(prop):
            href = el.find(f"{_D}href")
            if href is not None and href.text:
                return href.text
        return None

    async def _discover_calendars(self) -> dict[str, str]:
        """Return {displayname: absolute calendar href}."""
        status, text = await self._request("PROPFIND", self.url, _PROPFIND_PRINCIPAL, depth="0")
        principal = self._first_href(ET.fromstring(text), f"{_D}current-user-principal")
        if status >= 400 or not principal:
            raise RuntimeError(f"no current-user-principal (HTTP {status})")
        principal_url = urljoin(self.url, principal)

        status, text = await self._request("PROPFIND", principal_url, _PROPFIND_HOME, depth="0")
        home = self._first_href(ET.fromstring(text), f"{_C}calendar-home-set")
        if status >= 400 or not home:
            raise RuntimeError(f"no calendar-home-set (HTTP {status})")
        home_url = urljoin(principal_url, home)

        status, text = await self._request("PROPFIND", home_url, _PROPFIND_CALENDARS, depth="1")
        if status >= 400:
            raise RuntimeError(f"calendar listing failed (HTTP {status})")

        result: dict[str, str] = {}
        for response in ET.fromstring(text).iter(f"{_D}response"):
            href_el = response.find(f"{_D}href")
            if href_el is None or not href_el.text:
                continue
            resourcetype = response.find(f".//{_D}resourcetype")
            if resourcetype is None or resourcetype.find(f"{_C}calendar") is None:
                continue
            name_el = response.find(f".//{_D}displayname")
            name = (name_el.text if name_el is not None else None) or href_el.text.rstrip("/").rsplit("/", 1)[-1]
            result[name] = urljoin(home_url, href_el.text)
        return result

    async def _get_calendars(self) -> dict[str, str]:
        if self._calendars_by_name is None:
            self._calendars_by_name = await self._discover_calendars()
        return self._calendars_by_name

    async def _find_event_href(
        self, calendar_href: str, summary: str, window_start_utc: datetime, window_end_utc: datetime
    ) -> str | None:
        """Return the href of the first event whose SUMMARY matches, or None."""
        status, text = await self._request(
            "REPORT", calendar_href, _time_range_report(window_start_utc, window_end_utc), depth="1"
        )
        if status >= 400:
            raise RuntimeError(f"calendar-query failed (HTTP {status})")
        for response in ET.fromstring(text).iter(f"{_D}response"):
            href_el = response.find(f"{_D}href")
            data_el = response.find(f".//{_C}calendar-data")
            if href_el is None or data_el is None or not data_el.text:
                continue
            if _ics_summary(data_el.text) == summary:
                return urljoin(calendar_href, href_el.text)
        return None

    async def delete_event(
        self, calendar_name: str, summary: str, window_start_utc: datetime, window_end_utc: datetime
    ) -> bool:
        """Find and delete the first event matching `summary` in the given UTC window.

        Returns True if an event was found and deleted, False otherwise,
        including when the calendar can't be matched by name or the
        connection fails. Callers should fall back to the HA service path
        when this returns False.
        """
        try:
            calendars = await self._get_calendars()
        except (aiohttp.ClientError, ET.ParseError, RuntimeError, TimeoutError) as err:
            _LOGGER.warning("CalDAV: could not connect to %s: %s", self.url, err)
            return False

        calendar_href = calendars.get(calendar_name)
        if not calendar_href:
            _LOGGER.debug("CalDAV: calendar '%s' not found among %s", calendar_name, list(calendars))
            return False

        try:
            event_href = await self._find_event_href(calendar_href, summary, window_start_utc, window_end_utc)
            if not event_href:
                _LOGGER.debug("CalDAV: no matching event '%s' found on '%s'", summary, calendar_name)
                return False
            status, _ = await self._request("DELETE", event_href)
            if status >= 400:
                _LOGGER.warning("CalDAV: delete of '%s' failed (HTTP %s)", summary, status)
                return False
        except (aiohttp.ClientError, ET.ParseError, RuntimeError, TimeoutError) as err:
            _LOGGER.warning("CalDAV: delete failed for '%s' on '%s': %s", summary, calendar_name, err)
            return False

        _LOGGER.info("✅ CalDAV: deleted event '%s' from '%s'", summary, calendar_name)
        return True
