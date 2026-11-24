# VERSION = "2.6.5"
"""Access Home Assistant's shared aiohttp session.

The session belongs to Home Assistant and must never be closed by us.
Wrapping it in an async context manager keeps the original
`async with ... as session:` structure, so call sites stay readable.
"""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession


@asynccontextmanager
async def shared_session(hass: HomeAssistant) -> AsyncIterator[aiohttp.ClientSession]:
    """Yield Home Assistant's shared aiohttp session (not closed on exit)."""
    yield async_get_clientsession(hass)
