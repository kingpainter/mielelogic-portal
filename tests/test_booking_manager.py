"""Tests for MieleLogic booking_manager."""
# VERSION = "2.6.4"

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from homeassistant.exceptions import HomeAssistantError

from custom_components.mielelogic.booking_manager import BookingManager


@pytest.fixture
def booking_manager(mock_coordinator, mock_store, mock_notification_manager, mock_time_manager):
    """Create a BookingManager wired to mocks, with time_manager lookup stubbed."""
    bm = BookingManager(
        coordinator=mock_coordinator,
        store=mock_store,
        notification_manager=mock_notification_manager,
    )
    bm._get_time_manager = MagicMock(return_value=mock_time_manager)
    return bm


class TestMakeBooking:
    """make_booking() happy path and failure handling."""

    @pytest.mark.asyncio
    async def test_successful_booking_calls_reservation_service(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={"id": "abc"})
        result = await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)

        assert result["success"] is True
        mock_coordinator.hass.services.async_call.assert_awaited_once()
        call_args = mock_coordinator.hass.services.async_call.call_args
        assert call_args[0][0] == "mielelogic"
        assert call_args[0][1] == "make_reservation"
        assert call_args[0][2] == {
            "machine_number": 1, "start_time": "2026-03-30 09:00:00", "duration": 120,
        }

    @pytest.mark.asyncio
    async def test_successful_booking_saves_metadata(self, booking_manager, mock_coordinator, mock_store):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={})
        await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)
        mock_store.async_save_booking_metadata.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_successful_booking_sends_notification_with_cancel_action(
        self, booking_manager, mock_coordinator, mock_notification_manager
    ):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={})
        await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)

        mock_notification_manager.send_notification.assert_awaited_once()
        call_args = mock_notification_manager.send_notification.call_args
        assert call_args[0][0] == "booking_created"
        payload = call_args[0][1]
        assert payload["vaskehus"] == "Klatvask"
        assert payload["_cancel_action"] == "MIELELOGIC_CANCEL_1_2026-03-30T09:00:00"

    @pytest.mark.asyncio
    async def test_successful_booking_schedules_voice_reminder(
        self, booking_manager, mock_coordinator, mock_notification_manager
    ):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={})
        await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)
        mock_notification_manager.schedule_voice_reminder.assert_called_once()
        booking_key = mock_notification_manager.schedule_voice_reminder.call_args[0][0]
        assert booking_key == "machine_1_2026-03-30T09:00:00"

    @pytest.mark.asyncio
    async def test_home_assistant_error_returns_failure_dict(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(
            side_effect=HomeAssistantError("slot taken")
        )
        result = await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)
        assert result == {"success": False, "message": "slot taken"}

    @pytest.mark.asyncio
    async def test_unexpected_error_returns_failure_dict_with_prefix(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(side_effect=ValueError("boom"))
        result = await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)
        assert result["success"] is False
        assert "Ukendt fejl" in result["message"]

    @pytest.mark.asyncio
    async def test_metadata_save_failure_does_not_fail_booking(
        self, booking_manager, mock_coordinator, mock_store
    ):
        """Booking is already confirmed with the API by the time metadata is
        saved — a storage hiccup must not turn a real booking into a
        reported failure."""
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={})
        mock_store.async_save_booking_metadata = AsyncMock(side_effect=Exception("disk full"))
        result = await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_extra_calendars_triggers_secondary_sync(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={})
        booking_manager._sync_to_secondary_calendars = AsyncMock()

        await booking_manager.make_booking(
            1, "2026-03-30 09:00:00", 120, extra_calendars=["calendar.lukas"]
        )

        booking_manager._sync_to_secondary_calendars.assert_awaited_once_with(
            1, "2026-03-30 09:00:00", 120, ["calendar.lukas"]
        )

    @pytest.mark.asyncio
    async def test_no_extra_calendars_skips_secondary_sync(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value={})
        booking_manager._sync_to_secondary_calendars = AsyncMock()

        await booking_manager.make_booking(1, "2026-03-30 09:00:00", 120)

        booking_manager._sync_to_secondary_calendars.assert_not_awaited()


class TestCancelBooking:
    """cancel_booking() happy path and failure handling."""

    @pytest.mark.asyncio
    async def test_successful_cancel_calls_service(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value=None)
        booking_manager._delete_calendar_event = AsyncMock()
        booking_manager._delete_secondary_calendar_events = AsyncMock()

        result = await booking_manager.cancel_booking(1, "2026-03-30 09:00:00", "2026-03-30 11:00:00")

        assert result == {"success": True, "message": "Booking annulleret"}
        mock_coordinator.hass.services.async_call.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_successful_cancel_deletes_primary_and_secondary_events(
        self, booking_manager, mock_coordinator
    ):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value=None)
        booking_manager._delete_calendar_event = AsyncMock()
        booking_manager._delete_secondary_calendar_events = AsyncMock()

        await booking_manager.cancel_booking(1, "2026-03-30 09:00:00", "2026-03-30 11:00:00")

        booking_manager._delete_calendar_event.assert_awaited_once_with(1, "2026-03-30 09:00:00")
        booking_manager._delete_secondary_calendar_events.assert_awaited_once_with(
            1, "2026-03-30 09:00:00"
        )

    @pytest.mark.asyncio
    async def test_successful_cancel_removes_booking_metadata(
        self, booking_manager, mock_coordinator, mock_store
    ):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value=None)
        booking_manager._delete_calendar_event = AsyncMock()
        booking_manager._delete_secondary_calendar_events = AsyncMock()

        await booking_manager.cancel_booking(1, "2026-03-30 09:00:00", "2026-03-30 11:00:00")

        mock_store.async_delete_booking_metadata.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_successful_cancel_sends_notification_and_cancels_voice_reminder(
        self, booking_manager, mock_coordinator, mock_notification_manager
    ):
        mock_coordinator.hass.services.async_call = AsyncMock(return_value=None)
        booking_manager._delete_calendar_event = AsyncMock()
        booking_manager._delete_secondary_calendar_events = AsyncMock()

        await booking_manager.cancel_booking(1, "2026-03-30 09:00:00", "2026-03-30 11:00:00")

        mock_notification_manager.send_notification.assert_awaited_once_with(
            "booking_canceled", {"vaskehus": "Klatvask"}
        )
        mock_notification_manager.cancel_voice_reminder.assert_called_once_with(
            "machine_1_2026-03-30T09:00:00"
        )

    @pytest.mark.asyncio
    async def test_home_assistant_error_returns_failure_dict(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.async_call = AsyncMock(
            side_effect=HomeAssistantError("already cancelled")
        )
        result = await booking_manager.cancel_booking(1, "2026-03-30 09:00:00", "2026-03-30 11:00:00")
        assert result == {"success": False, "message": "already cancelled"}


class TestDeleteCalendarEvent:
    """_delete_calendar_event matches on summary + start time, then falls back."""

    @pytest.mark.asyncio
    async def test_no_target_calendar_configured_is_a_noop(self, booking_manager, mock_coordinator):
        mock_coordinator.sync_to_calendar = None
        mock_coordinator.hass.services.async_call = AsyncMock()
        await booking_manager._delete_calendar_event(1, "2026-03-30 09:00:00")
        mock_coordinator.hass.services.async_call.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_events_unavailable_is_a_noop(self, booking_manager, mock_coordinator):
        mock_coordinator.sync_to_calendar = "calendar.flemming"
        mock_coordinator.hass.services.has_service = MagicMock(return_value=False)
        mock_coordinator.hass.services.async_call = AsyncMock()
        await booking_manager._delete_calendar_event(1, "2026-03-30 09:00:00")
        mock_coordinator.hass.services.async_call.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_matching_event_is_deleted_and_tracking_cleared(
        self, booking_manager, mock_coordinator, mock_store
    ):
        mock_coordinator.sync_to_calendar = "calendar.flemming"
        mock_coordinator._created_events = {(1, "2026-03-30 09:00:00")}
        mock_coordinator.hass.services.has_service = MagicMock(return_value=True)

        from datetime import datetime
        from zoneinfo import ZoneInfo
        start_dt = datetime(2026, 3, 30, 9, 0, tzinfo=ZoneInfo("Europe/Copenhagen"))
        event = {
            "summary": "Klatvask booket",
            "start": start_dt.isoformat(),
            "end": start_dt.isoformat(),
            "uid": "event-uid-123",
        }

        async def fake_service_call(domain, service, data, **kwargs):
            if service == "get_events":
                return {"calendar.flemming": {"events": [event]}}
            return None

        mock_coordinator.hass.services.async_call = AsyncMock(side_effect=fake_service_call)

        await booking_manager._delete_calendar_event(1, "2026-03-30 09:00:00")

        # get_events + delete_event = 2 calls
        assert mock_coordinator.hass.services.async_call.await_count == 2
        mock_store.async_remove_calendar_synced_event.assert_awaited_once_with(1, "2026-03-30 09:00:00")
        assert (1, "2026-03-30 09:00:00") not in mock_coordinator._created_events

    @pytest.mark.asyncio
    async def test_no_matching_event_still_clears_store_tracking(
        self, booking_manager, mock_coordinator, mock_store
    ):
        mock_coordinator.sync_to_calendar = "calendar.flemming"
        mock_coordinator.hass.services.has_service = MagicMock(return_value=True)

        async def fake_service_call(domain, service, data, **kwargs):
            return {"calendar.flemming": {"events": []}}

        mock_coordinator.hass.services.async_call = AsyncMock(side_effect=fake_service_call)

        await booking_manager._delete_calendar_event(1, "2026-03-30 09:00:00")

        mock_store.async_remove_calendar_synced_event.assert_awaited_once_with(1, "2026-03-30 09:00:00")


class TestSecondaryCalendarSync:
    """_sync_to_secondary_calendars creates events in each selected calendar."""

    @pytest.mark.asyncio
    async def test_creates_event_in_each_calendar(self, booking_manager, mock_coordinator, mock_store):
        mock_coordinator.hass.services.has_service = MagicMock(return_value=True)
        mock_coordinator.hass.services.async_call = AsyncMock(return_value=None)

        await booking_manager._sync_to_secondary_calendars(
            1, "2026-03-30 09:00:00", 120, ["calendar.lukas", "calendar.mor"]
        )

        assert mock_coordinator.hass.services.async_call.await_count == 2
        assert mock_store.async_add_secondary_calendar_event.await_count == 2

    @pytest.mark.asyncio
    async def test_create_event_service_unavailable_skips_all(self, booking_manager, mock_coordinator):
        mock_coordinator.hass.services.has_service = MagicMock(return_value=False)
        mock_coordinator.hass.services.async_call = AsyncMock()

        await booking_manager._sync_to_secondary_calendars(
            1, "2026-03-30 09:00:00", 120, ["calendar.lukas"]
        )

        mock_coordinator.hass.services.async_call.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_one_calendar_failing_does_not_block_the_others(
        self, booking_manager, mock_coordinator, mock_store
    ):
        mock_coordinator.hass.services.has_service = MagicMock(return_value=True)
        mock_coordinator.hass.services.async_call = AsyncMock(
            side_effect=[Exception("bad calendar"), None]
        )

        await booking_manager._sync_to_secondary_calendars(
            1, "2026-03-30 09:00:00", 120, ["calendar.broken", "calendar.works"]
        )

        assert mock_coordinator.hass.services.async_call.await_count == 2
        mock_store.async_add_secondary_calendar_event.assert_awaited_once()


class TestBookingManagerReadHelpers:
    """Simple pass-through reads from coordinator.data."""

    def test_get_current_bookings_returns_reservations_list(self, booking_manager, mock_coordinator):
        mock_coordinator.data["reservations"]["Reservations"] = [{"MachineNumber": 1}]
        assert booking_manager.get_current_bookings() == [{"MachineNumber": 1}]

    def test_get_account_balance_reads_balance(self, booking_manager, mock_coordinator):
        mock_coordinator.data["account_details"]["Balance"] = 42.5
        assert booking_manager.get_account_balance() == 42.5

    def test_get_max_reservations_reads_limit(self, booking_manager, mock_coordinator):
        mock_coordinator.data["reservations"]["MaxUserReservations"] = 3
        assert booking_manager.get_max_reservations() == 3

    def test_get_max_reservations_defaults_to_two(self, booking_manager, mock_coordinator):
        mock_coordinator.data["reservations"] = {}
        assert booking_manager.get_max_reservations() == 2
