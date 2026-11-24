# VERSION = "2.6.6"
"""Tests for MieleLogic services: validation rules and error translation keys.

Validators are called directly with a fake coordinator. The handlers are
captured from a mocked hass and run against a mocked API session, so no
network is used.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from custom_components.mielelogic.services import (
    _check_max_reservations,
    _get_coordinator,
    _validate_duration,
    _validate_end_time,
    _validate_machine_number,
    _validate_start_time,
    async_setup_services,
)

TZ = ZoneInfo("Europe/Copenhagen")


def _coordinator(
    *,
    opening: str = "07:00",
    closing: str = "21:00",
    reservations: list[dict] | None = None,
    max_reservations: int = 2,
) -> MagicMock:
    """Fake coordinator with the config entry data and reservation data the validators read."""
    coord = MagicMock()
    coord.config_entry.data = {"opening_time": opening, "closing_time": closing}
    coord.data = {
        "reservations": {
            "Reservations": reservations or [],
            "MaxUserReservations": max_reservations,
        }
    }
    coord.laundry_id = 3444
    coord.access_token = "token"
    coord._ensure_token = AsyncMock()
    coord._refresh_token = AsyncMock()
    coord.clear_cache = MagicMock()
    coord.async_request_refresh = AsyncMock()
    return coord


def _at(days: int, hour: int, minute: int = 0) -> datetime:
    """A timezone-aware Copenhagen time `days` from now at the given clock time."""
    base = datetime.now(TZ) + timedelta(days=days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _key(err: pytest.ExceptionInfo) -> str | None:
    return getattr(err.value, "translation_key", None)


# ── Validators ──────────────────────────────────────────────────────────────


def test_machine_number_out_of_range_has_translation_key() -> None:
    with pytest.raises(ServiceValidationError) as err:
        _validate_machine_number(8)
    assert _key(err) == "invalid_machine_number"
    assert err.value.translation_placeholders == {"machine_number": "8"}


def test_machine_number_in_range_passes() -> None:
    _validate_machine_number(7)


def test_start_time_in_past_is_rejected() -> None:
    past = datetime.now(TZ) - timedelta(days=1)
    with pytest.raises(ServiceValidationError) as err:
        _validate_start_time(past, _coordinator())
    assert _key(err) == "start_time_passed"


def test_start_time_before_opening_is_rejected() -> None:
    with pytest.raises(ServiceValidationError) as err:
        _validate_start_time(_at(1, 6), _coordinator(opening="07:00"))
    assert _key(err) == "laundry_opens_later"
    assert err.value.translation_placeholders["opening_time"] == "07:00"


def test_start_time_after_closing_is_rejected() -> None:
    with pytest.raises(ServiceValidationError) as err:
        _validate_start_time(_at(1, 21, 30), _coordinator(closing="21:00"))
    assert _key(err) == "laundry_closed"


def test_valid_start_time_passes() -> None:
    _validate_start_time(_at(1, 12), _coordinator())


def test_end_before_start_is_rejected() -> None:
    start = _at(1, 12)
    with pytest.raises(ServiceValidationError) as err:
        _validate_end_time(start - timedelta(minutes=5), start, _coordinator())
    assert _key(err) == "end_before_start"


def test_end_after_closing_is_rejected() -> None:
    start = _at(1, 20)
    with pytest.raises(ServiceValidationError) as err:
        _validate_end_time(_at(1, 22), start, _coordinator(closing="21:00"))
    assert _key(err) == "end_after_closing"


def test_duration_too_short_is_rejected() -> None:
    start = _at(1, 12)
    with pytest.raises(ServiceValidationError) as err:
        _validate_duration(start, start + timedelta(minutes=20))
    assert _key(err) == "duration_too_short"
    assert err.value.translation_placeholders == {"minutes": "20"}


def test_duration_too_long_is_rejected() -> None:
    start = _at(1, 8)
    with pytest.raises(ServiceValidationError) as err:
        _validate_duration(start, start + timedelta(minutes=200))
    assert _key(err) == "duration_too_long"


async def test_max_reservations_reached_is_rejected() -> None:
    existing = [{"MachineNumber": 3, "Start": "2026-11-25T10:00:00"}]
    coord = _coordinator(reservations=existing + existing, max_reservations=2)
    with pytest.raises(ServiceValidationError) as err:
        await _check_max_reservations(coord)
    assert _key(err) == "max_reservations_reached"
    assert err.value.translation_placeholders["count"] == "2"
    assert err.value.translation_placeholders["max_count"] == "2"


async def test_invalid_max_reservations_is_ignored() -> None:
    """A MaxUserReservations of 0 is a bad read and must not block bookings."""
    await _check_max_reservations(_coordinator(max_reservations=0))


# ── Coordinator lookup ─────────────────────────────────────────────────────


def test_get_coordinator_without_loaded_entry_raises_not_configured() -> None:
    hass = MagicMock()
    hass.config_entries.async_loaded_entries.return_value = []
    with pytest.raises(ServiceValidationError) as err:
        _get_coordinator(hass)
    assert _key(err) == "not_configured"


# ── Handlers (captured from async_setup_services) ──────────────────────────


def _async_cm(value: object) -> MagicMock:
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=value)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


async def _run_make_reservation(api_json: dict) -> HomeAssistantError:
    """Call make_reservation with the API returning `api_json`; return the raised error."""
    coord = _coordinator()
    hass = MagicMock()
    entry = MagicMock()
    entry.runtime_data = {"coordinator": coord}
    hass.config_entries.async_loaded_entries.return_value = [entry]

    await async_setup_services(hass)
    handler = next(
        c.args[2] for c in hass.services.async_register.call_args_list if c.args[1] == "make_reservation"
    )

    response = MagicMock()
    response.status = 200
    response.text = AsyncMock(return_value="{}")
    response.raise_for_status = MagicMock()
    response.json = AsyncMock(return_value=api_json)
    session = MagicMock()
    session.put = MagicMock(return_value=_async_cm(response))

    call = MagicMock()
    call.data = {"machine_number": 3, "start_time": _at(1, 12), "duration": 120}

    with patch(
        "custom_components.mielelogic.services.shared_session",
        return_value=_async_cm(session),
    ):
        with pytest.raises(HomeAssistantError) as err:
            await handler(call)
    return err.value


async def test_api_rejection_keeps_reservation_failed_key() -> None:
    """Regression: an API rejection must not be re-wrapped as 'unexpected_error'."""
    error = await _run_make_reservation({"ResultOK": False, "ResultText": "Maskinen er optaget"})
    assert error.translation_key == "reservation_failed"
    assert error.translation_placeholders == {"error": "Maskinen er optaget"}
