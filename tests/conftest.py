"""Shared fixtures for MieleLogic tests."""
# VERSION = "2.6.4"

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock
from typing import Any

from homeassistant.config_entries import ConfigEntryState


class MockConfigEntry:
    """Mock HA config entry with MieleLogic-shaped data."""

    def __init__(self, data: dict | None = None, options: dict | None = None):
        self.entry_id = "test_entry_id_mielelogic"
        self.title = "MieleLogic"
        self.data = data or {
            "username": "test_user",
            "password": "test_pass",
            "client_id": "test_client_id",
            "laundry_id": "1234",
            "klatvask_primary_machine": 1,
            "storvask_primary_machine": 4,
            "opening_time": "07:00",
            "closing_time": "21:00",
        }
        self.options = options or {}
        self.source = "user"
        self.unique_id = "mielelogic"
        self.runtime_data = None
        self.add_update_listener = MagicMock(return_value=MagicMock())
        self.async_start_reauth = MagicMock()
        # HA's DataUpdateCoordinator registers shutdown via this method
        self.async_on_unload = MagicMock()
        # Read by pytest-homeassistant-custom-component's hass teardown
        self.state = ConfigEntryState.NOT_LOADED


class MockCoordinator:
    """Minimal mock of MieleLogicDataUpdateCoordinator for BookingManager/websocket tests.

    Deliberately a plain mock (not the real class) so BookingManager and the
    websocket handlers can be unit-tested in isolation from the real
    coordinator's network/token logic, which is covered separately in
    test_coordinator.py against the real class.
    """

    def __init__(self, hass):
        self.hass = hass
        self.config_entry = MockConfigEntry()
        self.data = {
            "reservations": {"Reservations": [], "MaxUserReservations": 2},
            "machine_states": {"MachineStates": []},
            "timetable": {},
            "account_details": {"Balance": 10.0},
        }
        self.sync_to_calendar = None
        self._created_events: set = set()
        self.clear_cache = MagicMock()
        self.async_request_refresh = AsyncMock()

    def _get_vaskehus_name(self, machine_number: int) -> str:
        if machine_number == 1:
            return "Klatvask"
        if machine_number == 4:
            return "Storvask"
        return f"Maskine {machine_number}"


@pytest.fixture
def mock_config_entry() -> MockConfigEntry:
    """Create a mock config entry."""
    return MockConfigEntry()


@pytest.fixture
def mock_store():
    """Create a mock MieleLogicStore."""
    store = MagicMock()
    store.async_load = AsyncMock()
    store.async_save_booking_metadata = AsyncMock()
    store.async_delete_booking_metadata = AsyncMock()
    store.get_booking_metadata = MagicMock(return_value=None)
    store.get_secondary_calendar_events = MagicMock(return_value=[])
    store.async_add_secondary_calendar_event = AsyncMock()
    store.async_remove_secondary_calendar_events = AsyncMock()
    store.async_remove_calendar_synced_event = AsyncMock()
    store.get_calendar_synced_events = MagicMock(return_value=set())
    store.async_add_calendar_synced_event = AsyncMock()
    store.get_admin_settings = MagicMock(return_value={
        "booking_locked": False, "lock_message": "", "info_message": "",
    })
    store.get_notifications = MagicMock(return_value={})
    store.get_devices = MagicMock(return_value=[])
    store.get_available_mobile_apps = MagicMock(return_value=[])
    store.get_booking_history = MagicMock(return_value=[])
    return store


@pytest.fixture
def mock_notification_manager():
    """Create a mock NotificationManager."""
    nm = MagicMock()
    nm.send_notification = AsyncMock()
    nm.schedule_voice_reminder = MagicMock()
    nm.cancel_voice_reminder = MagicMock()
    return nm


@pytest.fixture
def mock_time_manager():
    """Create a mock TimeManager."""
    tm = MagicMock()
    tm.get_machine_for_vaskehus = MagicMock(return_value=1)
    tm.get_vaskehus_for_machine = MagicMock(return_value="Klatvask")
    tm.get_slots = MagicMock(return_value=[
        {"start": "09:00", "duration": 120},
        {"start": "11:00", "duration": 120},
    ])
    return tm


@pytest.fixture
def mock_coordinator(hass):
    """Create a mock coordinator (see MockCoordinator docstring)."""
    return MockCoordinator(hass)
