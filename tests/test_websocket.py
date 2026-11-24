"""Tests for MieleLogic websocket API."""
# VERSION = "2.6.6"

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from custom_components.mielelogic import websocket as ws_module
from custom_components.mielelogic.const import DOMAIN


@pytest.fixture(autouse=True)
def _unwrap_async_handlers(monkeypatch):
    """Async websocket handlers are wrapped by HA's async_response decorator,
    which schedules the coroutine and returns None. Tests need the coroutine
    itself, so use the undecorated function (functools.wraps sets __wrapped__)."""
    for name in ("ws_make_booking", "ws_cancel_booking", "ws_reset_notification"):
        handler = getattr(ws_module, name)
        monkeypatch.setattr(ws_module, name, getattr(handler, "__wrapped__", handler))


class FakeConnection:
    """Minimal fake of the HA websocket connection object."""

    def __init__(self, context=None):
        self.results = {}
        self.errors = {}
        self._context = context or MagicMock()

    def send_result(self, msg_id, result=None):
        self.results[msg_id] = result

    def send_error(self, msg_id, code, message):
        self.errors[msg_id] = (code, message)

    def context(self, msg):
        return self._context


class TestGetFromRuntime:
    """_get_from_runtime prefers entry.runtime_data, falls back to hass.data."""

    def test_finds_value_in_runtime_data(self):
        hass = MagicMock()
        entry = MagicMock()
        entry.runtime_data = {"store": "the_store"}
        hass.config_entries.async_entries = MagicMock(return_value=[entry])

        result = ws_module._get_from_runtime(hass, "store")
        assert result == "the_store"

    def test_falls_back_to_hass_data_when_no_runtime_data(self):
        hass = MagicMock()
        entry = MagicMock()
        entry.runtime_data = None
        hass.config_entries.async_entries = MagicMock(return_value=[entry])
        hass.data = {DOMAIN: {"some_entry_id": {"store": "legacy_store"}}}

        result = ws_module._get_from_runtime(hass, "store")
        assert result == "legacy_store"

    def test_returns_none_when_key_missing_everywhere(self):
        hass = MagicMock()
        hass.config_entries.async_entries = MagicMock(return_value=[])
        hass.data = {}

        assert ws_module._get_from_runtime(hass, "store") is None

    def test_skips_entries_without_the_requested_key(self):
        hass = MagicMock()
        entry_without = MagicMock()
        entry_without.runtime_data = {"other_key": "x"}
        entry_with = MagicMock()
        entry_with.runtime_data = {"store": "found_it"}
        hass.config_entries.async_entries = MagicMock(
            return_value=[entry_without, entry_with]
        )

        assert ws_module._get_from_runtime(hass, "store") == "found_it"


class TestGetBookedStartsFromTimetable:
    """_get_booked_starts_from_timetable — pure parsing of the timetable payload."""

    def test_empty_timetable_returns_empty_set(self):
        assert ws_module._get_booked_starts_from_timetable({}, 1, "2026-03-30") == set()

    def test_extracts_booked_slot_for_matching_date_and_machine(self):
        timetable = {
            "MachineTimeTables": {
                "1": {
                    "TimeTable": [
                        {"Start": "2026-03-30T09:00:00", "Status": "Reserved"},
                        {"Start": "2026-03-30T11:00:00", "Status": "Available"},
                    ]
                }
            }
        }
        result = ws_module._get_booked_starts_from_timetable(timetable, 1, "2026-03-30")
        assert result == {"09:00"}

    def test_ignores_other_dates(self):
        timetable = {
            "MachineTimeTables": {
                "1": {
                    "TimeTable": [
                        {"Start": "2026-03-31T09:00:00", "Status": "Reserved"},
                    ]
                }
            }
        }
        result = ws_module._get_booked_starts_from_timetable(timetable, 1, "2026-03-30")
        assert result == set()

    def test_ignores_other_machines(self):
        timetable = {
            "MachineTimeTables": {
                "2": {
                    "TimeTable": [
                        {"Start": "2026-03-30T09:00:00", "Status": "Reserved"},
                    ]
                }
            }
        }
        result = ws_module._get_booked_starts_from_timetable(timetable, 1, "2026-03-30")
        assert result == set()

    def test_malformed_entry_is_skipped_not_raised(self):
        timetable = {"MachineTimeTables": {"1": {"TimeTable": [{"Start": "", "Status": "Reserved"}]}}}
        result = ws_module._get_booked_starts_from_timetable(timetable, 1, "2026-03-30")
        assert result == set()


class TestWsGetSlots:
    """ws_get_slots — not-ready guard, and booked-slot annotation from timetable."""

    def test_not_ready_when_no_time_manager(self):
        hass = MagicMock()
        connection = FakeConnection()
        with patch.object(ws_module, "_get_time_manager", return_value=None):
            ws_module.ws_get_slots(hass, connection, {"id": 1, "vaskehus": "Klatvask"})
        assert connection.errors[1][0] == "not_ready"

    def test_returns_slots_with_booked_flag_false_when_no_date(self, mock_time_manager):
        hass = MagicMock()
        connection = FakeConnection()
        with patch.object(ws_module, "_get_time_manager", return_value=mock_time_manager):
            ws_module.ws_get_slots(hass, connection, {"id": 1, "vaskehus": "Klatvask"})
        slots = connection.results[1]["slots"]
        assert all(s["booked"] is False for s in slots)

    def test_marks_slot_booked_from_timetable(self, mock_time_manager, mock_coordinator):
        hass = MagicMock()
        connection = FakeConnection()
        mock_coordinator.data["timetable"] = {
            "MachineTimeTables": {
                "1": {"TimeTable": [{"Start": "2026-03-30T09:00:00", "Status": "Reserved"}]}
            }
        }
        with patch.object(ws_module, "_get_time_manager", return_value=mock_time_manager), \
             patch.object(ws_module, "_get_coordinator", return_value=mock_coordinator):
            ws_module.ws_get_slots(
                hass, connection, {"id": 1, "vaskehus": "Klatvask", "date": "2026-03-30"}
            )
        slots = {s["start"]: s["booked"] for s in connection.results[1]["slots"]}
        assert slots["09:00"] is True
        assert slots["11:00"] is False

    def test_service_error_on_unexpected_exception(self, mock_time_manager):
        hass = MagicMock()
        connection = FakeConnection()
        mock_time_manager.get_slots = MagicMock(side_effect=ValueError("boom"))
        with patch.object(ws_module, "_get_time_manager", return_value=mock_time_manager):
            ws_module.ws_get_slots(hass, connection, {"id": 1, "vaskehus": "Klatvask"})
        assert connection.errors[1][0] == "service_error"


class TestWsMakeBooking:
    """ws_make_booking — invalid slot guard and success path."""

    @pytest.mark.asyncio
    async def test_not_ready_when_managers_missing(self):
        hass = MagicMock()
        connection = FakeConnection()
        with patch.object(ws_module, "_get_time_manager", return_value=None), \
             patch.object(ws_module, "_get_booking_manager", return_value=None):
            await ws_module.ws_make_booking(hass, connection, {
                "id": 1, "vaskehus": "Klatvask", "slot_start": "09:00", "date": "2026-03-30",
            })
        assert connection.errors[1][0] == "not_ready"

    @pytest.mark.asyncio
    async def test_invalid_slot_returns_invalid_input(self, mock_time_manager):
        hass = MagicMock()
        connection = FakeConnection()
        booking_manager = MagicMock()
        with patch.object(ws_module, "_get_time_manager", return_value=mock_time_manager), \
             patch.object(ws_module, "_get_booking_manager", return_value=booking_manager):
            await ws_module.ws_make_booking(hass, connection, {
                "id": 1, "vaskehus": "Klatvask", "slot_start": "23:59", "date": "2026-03-30",
            })
        assert connection.errors[1][0] == "invalid_input"

    @pytest.mark.asyncio
    async def test_successful_booking_refreshes_coordinator(self, mock_time_manager, mock_coordinator):
        hass = MagicMock()
        connection = FakeConnection()
        booking_manager = MagicMock()
        booking_manager.coordinator = mock_coordinator
        booking_manager.make_booking = AsyncMock(return_value={"success": True, "message": "ok"})

        with patch.object(ws_module, "_get_time_manager", return_value=mock_time_manager), \
             patch.object(ws_module, "_get_booking_manager", return_value=booking_manager):
            await ws_module.ws_make_booking(hass, connection, {
                "id": 1, "vaskehus": "Klatvask", "slot_start": "09:00", "date": "2026-03-30",
                "extra_calendars": ["calendar.lukas"],
            })

        booking_manager.make_booking.assert_awaited_once()
        call_kwargs = booking_manager.make_booking.call_args
        assert call_kwargs[1]["extra_calendars"] == ["calendar.lukas"]
        mock_coordinator.clear_cache.assert_called_once()
        mock_coordinator.async_request_refresh.assert_awaited_once()
        assert connection.results[1]["success"] is True

    @pytest.mark.asyncio
    async def test_failed_booking_does_not_refresh_coordinator(self, mock_time_manager, mock_coordinator):
        hass = MagicMock()
        connection = FakeConnection()
        booking_manager = MagicMock()
        booking_manager.coordinator = mock_coordinator
        booking_manager.make_booking = AsyncMock(return_value={"success": False, "message": "full"})

        with patch.object(ws_module, "_get_time_manager", return_value=mock_time_manager), \
             patch.object(ws_module, "_get_booking_manager", return_value=booking_manager):
            await ws_module.ws_make_booking(hass, connection, {
                "id": 1, "vaskehus": "Klatvask", "slot_start": "09:00", "date": "2026-03-30",
            })

        mock_coordinator.clear_cache.assert_not_called()
        mock_coordinator.async_request_refresh.assert_not_awaited()


class TestWsCancelBooking:
    """ws_cancel_booking — not-ready guard and success/error handling."""

    @pytest.mark.asyncio
    async def test_not_ready_when_booking_manager_missing(self):
        hass = MagicMock()
        connection = FakeConnection()
        with patch.object(ws_module, "_get_booking_manager", return_value=None):
            await ws_module.ws_cancel_booking(hass, connection, {
                "id": 1, "machine_number": 1, "start_time": "2026-03-30 09:00:00",
                "end_time": "2026-03-30 11:00:00",
            })
        assert connection.errors[1][0] == "not_ready"

    @pytest.mark.asyncio
    async def test_successful_cancel_refreshes_coordinator(self, mock_coordinator):
        hass = MagicMock()
        connection = FakeConnection()
        booking_manager = MagicMock()
        booking_manager.coordinator = mock_coordinator
        booking_manager.cancel_booking = AsyncMock(return_value={"success": True, "message": "ok"})

        with patch.object(ws_module, "_get_booking_manager", return_value=booking_manager):
            await ws_module.ws_cancel_booking(hass, connection, {
                "id": 1, "machine_number": 1, "start_time": "2026-03-30 09:00:00",
                "end_time": "2026-03-30 11:00:00",
            })

        mock_coordinator.clear_cache.assert_called_once()
        mock_coordinator.async_request_refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_exception_returns_service_error(self):
        hass = MagicMock()
        connection = FakeConnection()
        booking_manager = MagicMock()
        booking_manager.cancel_booking = AsyncMock(side_effect=ValueError("boom"))

        with patch.object(ws_module, "_get_booking_manager", return_value=booking_manager):
            await ws_module.ws_cancel_booking(hass, connection, {
                "id": 1, "machine_number": 1, "start_time": "2026-03-30 09:00:00",
                "end_time": "2026-03-30 11:00:00",
            })

        assert connection.errors[1][0] == "service_error"


class TestWsGetNotifications:
    """ws_get_notifications — storage-not-ready guard and storage_error on failure."""

    def test_not_ready_when_store_missing(self):
        hass = MagicMock()
        connection = FakeConnection()
        with patch.object(ws_module, "_get_store", return_value=None):
            ws_module.ws_get_notifications(hass, connection, {"id": 1})
        assert connection.errors[1][0] == "not_ready"

    def test_storage_error_on_exception(self):
        hass = MagicMock()
        connection = FakeConnection()
        store = MagicMock()
        store.get_notifications = MagicMock(side_effect=Exception("disk error"))
        with patch.object(ws_module, "_get_store", return_value=store):
            ws_module.ws_get_notifications(hass, connection, {"id": 1})
        assert connection.errors[1][0] == "storage_error"

    def test_success_returns_notifications(self):
        hass = MagicMock()
        connection = FakeConnection()
        store = MagicMock()
        store.get_notifications = MagicMock(return_value={"booking_created": {"enabled": True}})
        with patch.object(ws_module, "_get_store", return_value=store):
            ws_module.ws_get_notifications(hass, connection, {"id": 1})
        assert connection.results[1]["notifications"] == {"booking_created": {"enabled": True}}


class TestWsResetNotification:
    """ws_reset_notification — not_found guard when notification id is unknown."""

    @pytest.mark.asyncio
    async def test_not_found_when_store_returns_none(self):
        hass = MagicMock()
        connection = FakeConnection()
        store = MagicMock()
        store.async_reset_notification = AsyncMock(return_value=None)
        with patch.object(ws_module, "_get_store", return_value=store):
            await ws_module.ws_reset_notification(hass, connection, {
                "id": 1, "notification_id": "unknown_type",
            })
        assert connection.errors[1][0] == "not_found"

    @pytest.mark.asyncio
    async def test_success_returns_default_config(self):
        hass = MagicMock()
        connection = FakeConnection()
        store = MagicMock()
        default_cfg = {"title": "default title", "message": "default message"}
        store.async_reset_notification = AsyncMock(return_value=default_cfg)
        with patch.object(ws_module, "_get_store", return_value=store):
            await ws_module.ws_reset_notification(hass, connection, {
                "id": 1, "notification_id": "booking_created",
            })
        assert connection.results[1] == {"success": True, "config": default_cfg}
