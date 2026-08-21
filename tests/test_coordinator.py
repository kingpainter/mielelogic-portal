"""Tests for MieleLogic coordinator."""
# VERSION = "1.0.0"

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp

from custom_components.mielelogic.coordinator import (
    MieleLogicDataUpdateCoordinator,
    MAX_RETRIES,
)

from .conftest import MockConfigEntry


@pytest.fixture
def coordinator(hass):
    """Build a real coordinator instance."""
    config_entry = MockConfigEntry()
    return MieleLogicDataUpdateCoordinator(hass, config_entry)


class TestVaskehusName:
    """_get_vaskehus_name maps configured machine numbers to friendly names."""

    def test_klatvask_machine_returns_klatvask(self, coordinator):
        assert coordinator._get_vaskehus_name(1) == "Klatvask"

    def test_storvask_machine_returns_storvask(self, coordinator):
        assert coordinator._get_vaskehus_name(4) == "Storvask"

    def test_unknown_machine_returns_generic_label(self, coordinator):
        assert coordinator._get_vaskehus_name(99) == "Maskine 99"

    def test_respects_custom_config_entry_mapping(self, hass):
        """If klatvask/storvask machine numbers are reconfigured, mapping follows."""
        entry = MockConfigEntry(data={
            "username": "u", "password": "p", "client_id": "c", "laundry_id": "1",
            "klatvask_primary_machine": 7, "storvask_primary_machine": 8,
        })
        coord = MieleLogicDataUpdateCoordinator(hass, entry)
        assert coord._get_vaskehus_name(7) == "Klatvask"
        assert coord._get_vaskehus_name(8) == "Storvask"
        assert coord._get_vaskehus_name(1) == "Maskine 1"


class TestParseDatetime:
    """_parse_datetime handles both naive CPH-local and explicit-offset strings."""

    def test_naive_string_assumed_copenhagen(self, coordinator):
        dt = coordinator._parse_datetime("2026-03-30T09:00:00")
        assert dt.tzinfo is not None
        assert dt.tzinfo.key == "Europe/Copenhagen" if hasattr(dt.tzinfo, "key") else True
        assert dt.hour == 9

    def test_utc_z_suffix_parsed_as_utc(self, coordinator):
        dt = coordinator._parse_datetime("2026-03-30T07:00:00Z")
        assert dt.astimezone(ZoneInfo("UTC")).hour == 7

    def test_explicit_offset_string_parsed(self, coordinator):
        dt = coordinator._parse_datetime("2026-03-30T09:00:00+01:00")
        assert dt.utcoffset() == timedelta(hours=1)

    def test_empty_string_raises(self, coordinator):
        with pytest.raises(ValueError):
            coordinator._parse_datetime("")


class TestTimesMatch:
    """_times_match compares an API event start string against an expected datetime."""

    def test_matching_times_return_true(self, coordinator):
        expected = datetime(2026, 3, 30, 9, 0, tzinfo=ZoneInfo("Europe/Copenhagen"))
        event_start = expected.astimezone(ZoneInfo("UTC")).isoformat()
        assert coordinator._times_match(event_start, expected) is True

    def test_mismatching_times_return_false(self, coordinator):
        expected = datetime(2026, 3, 30, 9, 0, tzinfo=ZoneInfo("Europe/Copenhagen"))
        other = datetime(2026, 3, 30, 11, 0, tzinfo=ZoneInfo("Europe/Copenhagen"))
        event_start = other.astimezone(ZoneInfo("UTC")).isoformat()
        assert coordinator._times_match(event_start, expected) is False

    def test_empty_event_start_returns_false(self, coordinator):
        expected = datetime(2026, 3, 30, 9, 0, tzinfo=ZoneInfo("Europe/Copenhagen"))
        assert coordinator._times_match("", expected) is False

    def test_unparseable_event_start_returns_false(self, coordinator):
        expected = datetime(2026, 3, 30, 9, 0, tzinfo=ZoneInfo("Europe/Copenhagen"))
        assert coordinator._times_match("not-a-date", expected) is False


class TestCaching:
    """Response cache with 60s TTL."""

    def test_cache_miss_when_empty(self, coordinator):
        assert coordinator._get_from_cache("reservations_1") is None

    def test_cache_hit_after_save(self, coordinator):
        coordinator._save_to_cache("reservations_1", {"foo": "bar"})
        assert coordinator._get_from_cache("reservations_1") == {"foo": "bar"}

    def test_cache_expires_after_ttl(self, coordinator):
        coordinator._save_to_cache("reservations_1", {"foo": "bar"})
        # Manually age the cache entry past the 60s TTL
        coordinator._cache["reservations_1"]["timestamp"] = (
            datetime.now(ZoneInfo("UTC")) - timedelta(seconds=61)
        )
        assert coordinator._get_from_cache("reservations_1") is None

    def test_clear_cache_empties_store(self, coordinator):
        coordinator._save_to_cache("reservations_1", {"foo": "bar"})
        coordinator.clear_cache()
        assert coordinator._get_from_cache("reservations_1") is None

    def test_get_cache_key_strips_query_and_path(self, coordinator):
        key = coordinator._get_cache_key(
            "https://api.mielelogic.com/v7/country/DA/laundry/1234/timetable?x=1"
        )
        assert key == "timetable"


class TestGetStore:
    """_get_store prefers entry.runtime_data, falls back to hass.data."""

    def test_returns_store_from_runtime_data(self, coordinator, mock_store):
        coordinator.config_entry.runtime_data = {"store": mock_store}
        coordinator.hass.config_entries.async_entries = MagicMock(
            return_value=[coordinator.config_entry]
        )
        assert coordinator._get_store() is mock_store

    def test_falls_back_to_hass_data_when_no_runtime_data(self, coordinator, mock_store):
        coordinator.hass.config_entries.async_entries = MagicMock(return_value=[])
        coordinator.hass.data["mielelogic"] = {"store": mock_store}
        assert coordinator._get_store() is mock_store

    def test_returns_none_when_nothing_available(self, coordinator):
        coordinator.hass.config_entries.async_entries = MagicMock(return_value=[])
        assert coordinator._get_store() is None


class TestFetchWithRetry:
    """_fetch_with_retry retries on aiohttp.ClientError with exponential backoff."""

    @pytest.mark.asyncio
    async def test_succeeds_first_try_without_sleeping(self, coordinator):
        fetch = AsyncMock(return_value={"ok": True})
        with patch("asyncio.sleep", new=AsyncMock()) as sleep_mock:
            result = await coordinator._fetch_with_retry(fetch, "test fetch")
        assert result == {"ok": True}
        fetch.assert_awaited_once()
        sleep_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_retries_then_succeeds(self, coordinator):
        fetch = AsyncMock(
            side_effect=[
                aiohttp.ClientError("boom"),
                aiohttp.ClientError("boom again"),
                {"ok": True},
            ]
        )
        with patch("asyncio.sleep", new=AsyncMock()):
            result = await coordinator._fetch_with_retry(fetch, "test fetch")
        assert result == {"ok": True}
        assert fetch.await_count == 3

    @pytest.mark.asyncio
    async def test_exhausts_retries_and_raises_last_error(self, coordinator):
        fetch = AsyncMock(side_effect=aiohttp.ClientError("always fails"))
        with patch("asyncio.sleep", new=AsyncMock()):
            with pytest.raises(aiohttp.ClientError):
                await coordinator._fetch_with_retry(fetch, "test fetch")
        assert fetch.await_count == MAX_RETRIES

    @pytest.mark.asyncio
    async def test_non_client_error_propagates_immediately(self, coordinator):
        fetch = AsyncMock(side_effect=ValueError("unexpected"))
        with pytest.raises(ValueError):
            await coordinator._fetch_with_retry(fetch, "test fetch")
        fetch.assert_awaited_once()


class TestTokenManagement:
    """Token acquisition and refresh logic."""

    @pytest.mark.asyncio
    async def test_ensure_token_skips_refresh_when_still_valid(self, coordinator):
        coordinator.access_token = "abc123"
        coordinator.token_expiry = datetime.now(ZoneInfo("UTC")) + timedelta(minutes=10)
        coordinator._refresh_token = AsyncMock()
        await coordinator._ensure_token()
        coordinator._refresh_token.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_ensure_token_refreshes_when_expiring_soon(self, coordinator):
        coordinator.access_token = "abc123"
        coordinator.token_expiry = datetime.now(ZoneInfo("UTC")) + timedelta(seconds=30)
        coordinator._refresh_token = AsyncMock()
        await coordinator._ensure_token()
        coordinator._refresh_token.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_ensure_token_refreshes_when_no_token_yet(self, coordinator):
        coordinator.access_token = None
        coordinator._refresh_token = AsyncMock()
        await coordinator._ensure_token()
        coordinator._refresh_token.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_refresh_token_prefers_refresh_grant_when_available(self, coordinator):
        coordinator.refresh_token = "existing_refresh_token"
        coordinator._token_request_refresh_grant = AsyncMock()
        coordinator._token_request_password_grant = AsyncMock()
        await coordinator._refresh_token()
        coordinator._token_request_refresh_grant.assert_awaited_once()
        coordinator._token_request_password_grant.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_refresh_token_falls_back_to_password_grant(self, coordinator):
        coordinator.refresh_token = "expired_refresh_token"
        coordinator._token_request_refresh_grant = AsyncMock(
            side_effect=Exception("refresh grant rejected")
        )
        coordinator._token_request_password_grant = AsyncMock()
        await coordinator._refresh_token()
        coordinator._token_request_refresh_grant.assert_awaited_once()
        coordinator._token_request_password_grant.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_refresh_token_starts_reauth_when_password_grant_fails(self, coordinator):
        coordinator.refresh_token = None
        coordinator._token_request_password_grant = AsyncMock(
            side_effect=Exception("invalid credentials")
        )
        with pytest.raises(Exception):
            await coordinator._refresh_token()
        coordinator.config_entry.async_start_reauth.assert_called_once_with(coordinator.hass)
