# VERSION = "2.6.6"
"""Tests for the async CalDAV delete client.

The HTTP layer (`CalDAVDeleteClient._request`) is replaced with canned
CalDAV responses, so these tests run in CI without a network. The same
flow is also checked against a real CalDAV server (Radicale) manually.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest

from custom_components.mielelogic.caldav_async import CalDAVDeleteClient

BASE = "https://cal.example.com"
PRINCIPAL = "/user/"
HOME = "/user/calendars/"
CAL_HREF = "/user/calendars/vask/"
EVENT_HREF = "/user/calendars/vask/evt1.ics"

WINDOW_START = datetime(2026, 11, 24, 8, 0, tzinfo=timezone.utc)
WINDOW_END = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)

PRINCIPAL_XML = """<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:"><d:response><d:href>/user/</d:href>
<d:propstat><d:prop><d:current-user-principal><d:href>/user/</d:href></d:current-user-principal></d:prop>
<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>"""

HOME_XML = """<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/user/</d:href>
<d:propstat><d:prop><c:calendar-home-set><d:href>/user/calendars/</d:href></c:calendar-home-set></d:prop>
<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>"""

CALENDARS_XML = """<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>/user/calendars/</d:href><d:propstat><d:prop>
<d:resourcetype><d:collection/></d:resourcetype><d:displayname>calendars</d:displayname>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
<d:response><d:href>/user/calendars/vask/</d:href><d:propstat><d:prop>
<d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>Vaskeri</d:displayname>
</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>"""


def _report_xml(summary: str) -> str:
    ics = (
        "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\n"
        f"SUMMARY:{summary}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
    )
    return f"""<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response>
<d:href>{EVENT_HREF}</d:href><d:propstat><d:prop>
<c:calendar-data>{ics}</c:calendar-data></d:prop>
<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>"""


def _client() -> CalDAVDeleteClient:
    return CalDAVDeleteClient(MagicMock(), BASE, "user", "pass")


def _script(*responses: tuple[int, str] | Exception) -> AsyncMock:
    """Build a mock _request that returns the given responses in order."""
    mock = AsyncMock()
    mock.side_effect = list(responses)
    return mock


def _full_discovery() -> list[tuple[int, str]]:
    return [(207, PRINCIPAL_XML), (207, HOME_XML), (207, CALENDARS_XML)]


async def test_delete_event_success() -> None:
    """Finds the matching event in the calendar and deletes it."""
    request = _script(*_full_discovery(), (207, _report_xml("Vask 3")), (204, ""))
    client = _client()

    with patch.object(client, "_request", request):
        ok = await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)

    assert ok is True
    delete_call = request.await_args_list[-1]
    assert delete_call.args[0] == "DELETE"
    assert delete_call.args[1] == f"{BASE}{EVENT_HREF}"


async def test_unknown_calendar_returns_false_without_query() -> None:
    """A calendar name not on the server returns False and never runs a REPORT."""
    request = _script(*_full_discovery())
    client = _client()

    with patch.object(client, "_request", request):
        ok = await client.delete_event("Ukendt", "Vask 3", WINDOW_START, WINDOW_END)

    assert ok is False
    assert request.await_count == 3  # discovery only


async def test_no_matching_summary_returns_false_without_delete() -> None:
    """If no event in the window has the summary, nothing is deleted."""
    request = _script(*_full_discovery(), (207, _report_xml("Anden booking")))
    client = _client()

    with patch.object(client, "_request", request):
        ok = await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)

    assert ok is False
    methods = [c.args[0] for c in request.await_args_list]
    assert "DELETE" not in methods


async def test_delete_http_error_returns_false() -> None:
    """A failing DELETE (HTTP 500) returns False so the caller can fall back."""
    request = _script(*_full_discovery(), (207, _report_xml("Vask 3")), (500, ""))
    client = _client()

    with patch.object(client, "_request", request):
        ok = await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)

    assert ok is False


async def test_connection_error_returns_false() -> None:
    """A network error during discovery is caught and returns False."""
    request = _script(aiohttp.ClientConnectionError("boom"))
    client = _client()

    with patch.object(client, "_request", request):
        ok = await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)

    assert ok is False


async def test_bad_auth_returns_false() -> None:
    """HTTP 401 with an empty body returns False."""
    request = _script((401, ""))
    client = _client()

    with patch.object(client, "_request", request):
        ok = await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)

    assert ok is False


async def test_bad_auth_reports_http_status() -> None:
    """A 401 with an empty body reports the HTTP status, not an XML parse error."""
    request = _script((401, ""))
    client = _client()

    with patch.object(client, "_request", request), pytest.raises(RuntimeError, match="HTTP 401"):
        await client._discover_calendars()


async def test_calendars_are_cached_between_deletes() -> None:
    """Discovery runs once; the second delete only queries and deletes."""
    request = _script(
        *_full_discovery(),
        (207, _report_xml("Vask 3")), (204, ""),
        (207, _report_xml("Vask 3")), (204, ""),
    )
    client = _client()

    with patch.object(client, "_request", request):
        assert await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)
        assert await client.delete_event("Vaskeri", "Vask 3", WINDOW_START, WINDOW_END)

    propfinds = [c for c in request.await_args_list if c.args[0] == "PROPFIND"]
    assert len(propfinds) == 3
