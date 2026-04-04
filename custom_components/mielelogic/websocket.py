# VERSION = "2.0.0"
"""WebSocket API for MieleLogic panel."""
import logging
import voluptuous as vol

from homeassistant.core import HomeAssistant, callback
from homeassistant.components import websocket_api

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register WebSocket commands for panel communication."""
    websocket_api.async_register_command(hass, ws_get_slots)
    websocket_api.async_register_command(hass, ws_make_booking)
    websocket_api.async_register_command(hass, ws_cancel_booking)
    websocket_api.async_register_command(hass, ws_get_bookings)
    websocket_api.async_register_command(hass, ws_get_status)
    websocket_api.async_register_command(hass, ws_get_admin)
    websocket_api.async_register_command(hass, ws_get_history)
    websocket_api.async_register_command(hass, ws_cleanup_history)
    websocket_api.async_register_command(hass, ws_save_admin)
    websocket_api.async_register_command(hass, ws_get_machines)
    websocket_api.async_register_command(hass, ws_get_devices)
    websocket_api.async_register_command(hass, ws_save_devices)
    websocket_api.async_register_command(hass, ws_get_notifications)
    websocket_api.async_register_command(hass, ws_save_notification)
    websocket_api.async_register_command(hass, ws_test_notification)
    websocket_api.async_register_command(hass, ws_reset_notification)
    _LOGGER.info("✅ MieleLogic WebSocket API registered (v1.9.2 - 16 commands)")


def _get_time_manager(hass: HomeAssistant):
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "time_manager" in value:
            return value["time_manager"]
    return None


def _get_booking_manager(hass: HomeAssistant):
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "booking_manager" in value:
            return value["booking_manager"]
    return None


def _get_coordinator(hass: HomeAssistant):
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "coordinator" in value:
            return value["coordinator"]
    return None


def _get_store(hass: HomeAssistant):
    return hass.data.get(DOMAIN, {}).get("store")


def _get_notification_manager(hass: HomeAssistant):
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "notification_manager" in value:
            return value["notification_manager"]
    return None


def _get_booked_starts_from_timetable(timetable: dict, machine_number: int, date_str: str) -> set:
    """Extract booked slot start times from timetable data for a specific machine and date.

    Timetable structure:
      {
        "MachineTimeTables": {
          "1": {
            "TimeTable": [
              {"Start": "2026-03-30T09:00:00", "End": "...", "Status": "Reserved"},
              ...
            ]
          }
        }
      }

    Returns a set of "HH:MM" strings for slots with Status != "Available" on the given date.
    """
    booked = set()
    if not timetable:
        return booked

    machine_tables = timetable.get("MachineTimeTables", {})
    machine_data = machine_tables.get(str(machine_number))
    if not machine_data:
        return booked

    for entry in machine_data.get("TimeTable", []):
        start_raw = entry.get("Start", "")
        status = entry.get("Status", "Available")

        if not start_raw or len(start_raw) < 16:
            continue

        entry_date = start_raw[:10]   # "2026-03-30"
        entry_time = start_raw[11:16] # "09:00"

        if entry_date == date_str and status != "Available":
            booked.add(entry_time)
            _LOGGER.debug(
                "Timetable: machine %s slot %s on %s is %s",
                machine_number, entry_time, date_str, status,
            )

    return booked


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_slots",
    vol.Required("vaskehus"): str,
    vol.Optional("date"): str,  # "YYYY-MM-DD" — if provided, marks booked slots
})
@callback
def ws_get_slots(hass: HomeAssistant, connection, msg):
    """Get time slots for vaskehus, annotated with real availability from timetable.

    v1.9.2: Uses /timetable endpoint data (all users' bookings) instead of only
    the current user's reservations. Gives accurate booked/available status.
    """
    time_manager = _get_time_manager(hass)

    if not time_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return

    try:
        slots = time_manager.get_slots(msg["vaskehus"])
        date_str = msg.get("date")

        if date_str:
            coordinator = _get_coordinator(hass)
            booked_starts = set()

            if coordinator and coordinator.data:
                timetable = coordinator.data.get("timetable", {})
                machine = time_manager.get_machine_for_vaskehus(msg["vaskehus"])

                if timetable:
                    # ✨ v1.9.2: Use timetable (all users) for accurate availability
                    booked_starts = _get_booked_starts_from_timetable(timetable, machine, date_str)
                    _LOGGER.debug(
                        "Timetable booked slots for machine %s on %s: %s",
                        machine, date_str, booked_starts,
                    )
                else:
                    # Fallback: use own reservations only
                    reservations = coordinator.data.get("reservations", {}).get("Reservations", [])
                    for res in reservations:
                        if res.get("MachineNumber") != machine:
                            continue
                        start_raw = res.get("Start", "")
                        if start_raw[:10] == date_str:
                            booked_starts.add(start_raw[11:16])
                    _LOGGER.debug(
                        "Fallback own-reservations booked for machine %s on %s: %s",
                        machine, date_str, booked_starts,
                    )

            for slot in slots:
                slot["booked"] = slot["start"] in booked_starts
        else:
            for slot in slots:
                slot["booked"] = False

        _LOGGER.debug(
            "Returning %d slots for %s on %s (%d booked)",
            len(slots), msg["vaskehus"], date_str or "no date",
            sum(1 for s in slots if s.get("booked")),
        )

        connection.send_result(msg["id"], {"slots": slots})

    except Exception as err:
        _LOGGER.exception("Error getting slots: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/make_booking",
    vol.Required("vaskehus"): str,
    vol.Required("slot_start"): str,
    vol.Required("date"): str,
})
@websocket_api.async_response
async def ws_make_booking(hass: HomeAssistant, connection, msg):
    """Make a booking from the panel."""
    time_manager = _get_time_manager(hass)
    booking_manager = _get_booking_manager(hass)
    
    if not time_manager or not booking_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        slots = time_manager.get_slots(msg["vaskehus"])
        slot = next((s for s in slots if s["start"] == msg["slot_start"]), None)
        
        if not slot:
            connection.send_error(msg["id"], "invalid_slot", "Invalid time slot")
            return
        
        machine = time_manager.get_machine_for_vaskehus(msg["vaskehus"])
        start_datetime = f"{msg['date']} {slot['start']}:00"
        
        _LOGGER.info("📅 WebSocket booking: %s machine %s at %s", msg["vaskehus"], machine, start_datetime)
        
        result = await booking_manager.make_booking(machine, start_datetime, slot["duration"], connection.context)
        
        if result.get("success"):
            coordinator = booking_manager.coordinator
            coordinator.clear_cache()
            await coordinator.async_request_refresh()
            _LOGGER.debug("🔄 Cache cleared + coordinator refreshed after booking")
        
        connection.send_result(msg["id"], result)
    
    except Exception as err:
        _LOGGER.exception("Error making booking: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/cancel_booking",
    vol.Required("machine_number"): int,
    vol.Required("start_time"): str,
    vol.Required("end_time"): str,
})
@websocket_api.async_response
async def ws_cancel_booking(hass: HomeAssistant, connection, msg):
    """Cancel a booking from the panel."""
    booking_manager = _get_booking_manager(hass)
    
    if not booking_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        _LOGGER.info("🗑️ WebSocket cancel: Machine %s", msg["machine_number"])
        result = await booking_manager.cancel_booking(msg["machine_number"], msg["start_time"], msg["end_time"])
        
        if result.get("success"):
            coordinator = booking_manager.coordinator
            coordinator.clear_cache()
            await coordinator.async_request_refresh()
            _LOGGER.debug("🔄 Cache cleared + coordinator refreshed after cancellation")
        
        connection.send_result(msg["id"], result)
    
    except Exception as err:
        _LOGGER.exception("Error canceling booking: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_bookings",
})
@callback
def ws_get_bookings(hass: HomeAssistant, connection, msg):
    """Get current bookings for display in panel."""
    time_manager = _get_time_manager(hass)
    booking_manager = _get_booking_manager(hass)
    store = _get_store(hass)
    
    if not time_manager or not booking_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        bookings = booking_manager.get_current_bookings()
        enhanced_bookings = []
        
        for booking in bookings:
            enhanced = dict(booking)
            enhanced["vaskehus"] = time_manager.get_vaskehus_for_machine(booking.get("MachineNumber", 0))
            
            if store:
                api_start = booking.get("Start", "")
                machine_nr = booking.get("MachineNumber", 0)
                metadata = store.get_booking_metadata(machine=machine_nr, start_time=api_start)
                if not metadata:
                    normalized = api_start.replace("T", " ").split("+")[0].split("Z")[0].strip()
                    metadata = store.get_booking_metadata(machine=machine_nr, start_time=normalized)
                if metadata:
                    enhanced["created_by"] = metadata.get("created_by")
                    enhanced["created_at"] = metadata.get("created_at")
            
            enhanced_bookings.append(enhanced)
        
        _LOGGER.debug("📋 WebSocket: Returning %d bookings", len(enhanced_bookings))
        connection.send_result(msg["id"], {"bookings": enhanced_bookings})
    
    except Exception as err:
        _LOGGER.exception("Error getting bookings: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_status",
})
@callback
def ws_get_status(hass: HomeAssistant, connection, msg):
    """Get integration status."""
    booking_manager = _get_booking_manager(hass)
    
    if not booking_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        balance = booking_manager.get_account_balance()
        max_reservations = booking_manager.get_max_reservations()
        current_count = len(booking_manager.get_current_bookings())
        
        coordinator = _get_coordinator(hass)
        opening_time = "07:00"
        closing_time = "21:00"
        if coordinator and coordinator.config_entry:
            opening_time = coordinator.config_entry.data.get("opening_time", "07:00")
            closing_time = coordinator.config_entry.data.get("closing_time", "21:00")

        from datetime import datetime
        now = datetime.now()
        open_h, open_m = [int(x) for x in opening_time.split(":")]
        close_h, close_m = [int(x) for x in closing_time.split(":")]
        is_open = (open_h * 60 + open_m) <= (now.hour * 60 + now.minute) < (close_h * 60 + close_m)

        store = _get_store(hass)
        admin = store.get_admin_settings() if store else {}

        connection.send_result(msg["id"], {
            "balance": balance,
            "max_reservations": max_reservations,
            "current_count": current_count,
            "can_book": current_count < max_reservations and not admin.get("booking_locked", False),
            "opening_time": opening_time,
            "closing_time": closing_time,
            "is_open": is_open,
            "booking_locked": admin.get("booking_locked", False),
            "lock_message": admin.get("lock_message", ""),
            "info_message": admin.get("info_message", ""),
        })
    
    except Exception as err:
        _LOGGER.exception("Error getting status: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_machines",
})
@callback
def ws_get_machines(hass: HomeAssistant, connection, msg):
    """Get all machine states for display in booking card."""
    coordinator = _get_coordinator(hass)

    if not coordinator:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return

    try:
        machine_states = (
            coordinator.data.get("machine_states", {}).get("MachineStates", [])
            if coordinator.data else []
        )

        machines = []
        for m in machine_states:
            text1 = m.get("Text1", "")
            reservation_info = m.get("ReservationInfo", "")
            unit_name = m.get("UnitName", f"Maskine {m.get('MachineNumber', '?')}")
            machine_type_code = m.get("MachineType", "")
            text_lower = text1.lower()
            name_lower = unit_name.lower()

            if "klatvask" in name_lower or "storvask" in name_lower or "vask" in name_lower or machine_type_code in ("51", "85"):
                machine_type = "washer"
            elif "tørre" in name_lower or "dryer" in name_lower or machine_type_code == "58":
                machine_type = "dryer"
            else:
                machine_type = "unknown"

            if "ledig" in text_lower or "available" in text_lower:
                state = "available"
            elif "resttid" in text_lower or "remaining" in text_lower:
                state = "running"
            elif "reserveret" in text_lower or "reserved" in text_lower:
                state = "reserved"
            elif "lukket" in text_lower or "closed" in text_lower:
                state = "closed"
            else:
                state = "unknown"

            combined_status = f"{text1} {reservation_info}".strip() if reservation_info and reservation_info.strip() else (text1 or "Ukendt")

            machines.append({
                "number": m.get("MachineNumber"),
                "name": unit_name,
                "status": combined_status,
                "state": state,
                "machine_type": machine_type,
            })

        machines.sort(key=lambda x: x.get("number") or 0)
        _LOGGER.debug("🔧 WebSocket: Returning %d machines", len(machines))
        connection.send_result(msg["id"], {"machines": machines})

    except Exception as err:
        _LOGGER.exception("Error getting machines: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


#
# ADMIN MANAGEMENT
#

@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_admin",
})
@callback
def ws_get_admin(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    try:
        connection.send_result(msg["id"], store.get_admin_settings())
    except Exception as err:
        _LOGGER.exception("Error getting admin settings: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_admin",
    vol.Required("booking_locked"): bool,
    vol.Optional("lock_message", default="Booking er midlertidigt spærret"): str,
    vol.Optional("info_message", default=""): str,
})
@websocket_api.async_response
async def ws_save_admin(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    try:
        await store.async_save_admin_settings({
            "booking_locked": msg["booking_locked"],
            "lock_message": msg.get("lock_message", "Booking er midlertidigt spærret"),
            "info_message": msg.get("info_message", ""),
        })
        _LOGGER.info("Admin settings updated: locked=%s", msg["booking_locked"])
        connection.send_result(msg["id"], {"success": True})
    except Exception as err:
        _LOGGER.exception("Error saving admin settings: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


#
# STATISTICS
#

@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_history",
})
@callback
def ws_get_history(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    try:
        history = store.get_booking_history(days=30)
        connection.send_result(msg["id"], {"history": history, "count": len(history)})
    except Exception as err:
        _LOGGER.exception("Error getting history: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/cleanup_history",
})
@websocket_api.async_response
async def ws_cleanup_history(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    try:
        cleaned = await store.async_cleanup_old_bookings(days=30)
        _LOGGER.info("Cleaned up %d old booking entries", cleaned)
        connection.send_result(msg["id"], {"cleaned": cleaned})
    except Exception as err:
        _LOGGER.exception("Error cleaning history: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


#
# NOTIFICATION MANAGEMENT
#

@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_devices",
})
@callback
def ws_get_devices(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    try:
        connection.send_result(msg["id"], {
            "configured": store.get_devices(),
            "available": store.get_available_mobile_apps(),
        })
    except Exception as err:
        _LOGGER.exception("Error getting devices: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_devices",
    vol.Required("devices"): list,
})
@websocket_api.async_response
async def ws_save_devices(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    try:
        await store.async_save_devices(msg["devices"])
        _LOGGER.info("📱 Saved %d notification devices", len(msg["devices"]))
        connection.send_result(msg["id"], {"success": True})
    except Exception as err:
        _LOGGER.exception("Error saving devices: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_notifications",
})
@callback
def ws_get_notifications(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    try:
        connection.send_result(msg["id"], {"notifications": store.get_notifications()})
    except Exception as err:
        _LOGGER.exception("Error getting notifications: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/save_notification",
    vol.Required("notification_id"): str,
    vol.Required("config"): dict,
})
@websocket_api.async_response
async def ws_save_notification(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    try:
        await store.async_save_notification(msg["notification_id"], msg["config"])
        _LOGGER.info("💾 Saved notification: %s", msg["notification_id"])
        connection.send_result(msg["id"], {"success": True})
    except Exception as err:
        _LOGGER.exception("Error saving notification: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/test_notification",
    vol.Required("notification_id"): str,
})
@websocket_api.async_response
async def ws_test_notification(hass: HomeAssistant, connection, msg):
    notification_manager = _get_notification_manager(hass)
    if not notification_manager:
        connection.send_error(msg["id"], "not_ready", "Notification manager not ready")
        return
    try:
        from datetime import datetime, timedelta
        test_time = datetime.now() + timedelta(minutes=15)
        await notification_manager.send_notification(msg["notification_id"], {
            "vaskehus": "Klatvask", "time": test_time.strftime("%H:%M"),
            "date": test_time.strftime("%d-%m-%Y"), "duration": "120 minutter", "machine": "Maskine 1",
        })
        _LOGGER.info("📬 Test notification sent: %s", msg["notification_id"])
        connection.send_result(msg["id"], {"success": True})
    except Exception as err:
        _LOGGER.exception("Error sending test notification: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/reset_notification",
    vol.Required("notification_id"): str,
})
@websocket_api.async_response
async def ws_reset_notification(hass: HomeAssistant, connection, msg):
    store = _get_store(hass)
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    try:
        default_config = await store.async_reset_notification(msg["notification_id"])
        if default_config is None:
            connection.send_error(msg["id"], "not_found", f"Notification {msg['notification_id']} not found")
            return
        _LOGGER.info("🔄 Reset notification to default: %s", msg["notification_id"])
        connection.send_result(msg["id"], {"success": True, "config": default_config})
    except Exception as err:
        _LOGGER.exception("Error resetting notification: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))
