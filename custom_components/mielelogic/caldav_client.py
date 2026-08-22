# VERSION = "2.6.1"
"""Direct CalDAV client used only for deleting calendar events.

Home Assistant's built-in CalDAV integration does not implement the
DELETE_EVENT entity feature (see home-assistant/core#159784), so the
`calendar.delete_event` service always fails for CalDAV-backed calendars
even though `get_events`/`create_event` work fine. This module talks to
the CalDAV server directly (via the `caldav` package) to find and delete
the matching event, bypassing the HA calendar entity for deletion only.
Event creation still goes through `calendar.create_event` as before.
"""
import logging
from datetime import datetime

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class CalDAVDeleteClient:
    """Minimal, read/delete-only CalDAV client.

    Connects lazily on first use and caches the calendar list for the
    lifetime of this instance (recreated on integration reload).
    """

    def __init__(self, hass: HomeAssistant, url: str, username: str, password: str) -> None:
        self.hass = hass
        self.url = url
        self.username = username
        self.password = password
        self._calendars_by_name: dict | None = None

    def _connect_and_list_calendars(self) -> dict:
        """Blocking: connect to the CalDAV server and index calendars by display name."""
        import caldav

        client = caldav.DAVClient(url=self.url, username=self.username, password=self.password)
        principal = client.principal()
        result: dict = {}
        for cal in principal.calendars():
            try:
                name = cal.get_display_name() or cal.name
            except Exception:
                name = getattr(cal, "name", None)
            if name:
                result[name] = cal
        return result

    async def _get_calendars(self) -> dict:
        if self._calendars_by_name is None:
            self._calendars_by_name = await self.hass.async_add_executor_job(
                self._connect_and_list_calendars
            )
        return self._calendars_by_name

    def _search_and_delete(self, cal, summary: str, window_start: datetime, window_end: datetime) -> bool:
        """Blocking: search a time window on one calendar and delete the first summary match."""
        events = cal.date_search(start=window_start, end=window_end)
        for event in events:
            try:
                event.load()
                event_summary = str(event.vobject_instance.vevent.summary.value)
            except Exception:
                continue
            if event_summary == summary:
                event.delete()
                return True
        return False

    async def delete_event(
        self, calendar_name: str, summary: str, window_start_utc: datetime, window_end_utc: datetime
    ) -> bool:
        """Find and delete the first event matching `summary` in the given UTC window.

        Returns True if an event was found and deleted, False otherwise —
        including when the calendar can't be matched by name or the
        connection fails. Callers should fall back to the HA service path
        (calendar.delete_event) when this returns False, in case the target
        calendar is not CalDAV-backed or the name lookup didn't match.
        """
        try:
            calendars = await self._get_calendars()
        except Exception as err:
            _LOGGER.warning("CalDAV: could not connect to %s: %s", self.url, err)
            return False

        cal = calendars.get(calendar_name)
        if not cal:
            _LOGGER.debug(
                "CalDAV: calendar '%s' not found among %s", calendar_name, list(calendars.keys())
            )
            return False

        try:
            deleted = await self.hass.async_add_executor_job(
                self._search_and_delete, cal, summary, window_start_utc, window_end_utc
            )
        except Exception as err:
            _LOGGER.warning("CalDAV: delete failed for '%s' on '%s': %s", summary, calendar_name, err)
            return False

        if deleted:
            _LOGGER.info("✅ CalDAV: deleted event '%s' from '%s'", summary, calendar_name)
        else:
            _LOGGER.debug("CalDAV: no matching event '%s' found on '%s'", summary, calendar_name)
        return deleted
