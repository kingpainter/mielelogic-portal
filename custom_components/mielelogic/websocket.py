# VERSION = "1.5.1"
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
    
    # ✨ NEW: Notification commands
    websocket_api.async_register_command(hass, ws_get_devices)
    websocket_api.async_register_command(hass, ws_save_devices)
    websocket_api.async_register_command(hass, ws_get_notifications)
    websocket_api.async_register_command(hass, ws_save_notification)
    websocket_api.async_register_command(hass, ws_test_notification)
    
    _LOGGER.info("✅ MieleLogic WebSocket API registered")


def _get_time_manager(hass: HomeAssistant):
    """Get the time_manager instance (Secure Me pattern)."""
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "time_manager" in value:
            return value["time_manager"]
    return None


def _get_booking_manager(hass: HomeAssistant):
    """Get the booking_manager instance (Secure Me pattern)."""
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "booking_manager" in value:
            return value["booking_manager"]
    return None


def _get_store(hass: HomeAssistant):
    """Get the store instance."""
    return hass.data.get(DOMAIN, {}).get("store")


def _get_notification_manager(hass: HomeAssistant):
    """Get the notification_manager instance."""
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "notification_manager" in value:
            return value["notification_manager"]
    return None


@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_slots",
    vol.Required("vaskehus"): str,
})
@callback
def ws_get_slots(hass: HomeAssistant, connection, msg):
    """Get time slots for vaskehus."""
    time_manager = _get_time_manager(hass)
    
    if not time_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        slots = time_manager.get_slots(msg["vaskehus"])
        
        _LOGGER.debug(
            "🔍 WebSocket: Returning %d slots for %s",
            len(slots),
            msg["vaskehus"],
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
        # Find slot info
        slots = time_manager.get_slots(msg["vaskehus"])
        slot = next((s for s in slots if s["start"] == msg["slot_start"]), None)
        
        if not slot:
            connection.send_error(msg["id"], "invalid_slot", "Invalid time slot")
            return
        
        # Get machine number
        machine = time_manager.get_machine_for_vaskehus(msg["vaskehus"])
        
        # Build datetime
        start_datetime = f"{msg['date']} {slot['start']}:00"
        
        _LOGGER.info(
            "📅 WebSocket booking: %s machine %s at %s",
            msg["vaskehus"],
            machine,
            start_datetime,
        )
        
        # Make booking
        result = await booking_manager.make_booking(
            machine,
            start_datetime,
            slot["duration"],
        )
        
        # ✨ NEW: Force coordinator refresh to get latest data
        if result.get("success"):
            coordinator = booking_manager.coordinator
            coordinator.clear_cache()  # Clear cache first!
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
        _LOGGER.info(
            "🗑️ WebSocket cancel: Machine %s",
            msg["machine_number"],
        )
        
        result = await booking_manager.cancel_booking(
            msg["machine_number"],
            msg["start_time"],
            msg["end_time"],
        )
        
        # ✨ NEW: Force coordinator refresh to get latest data
        if result.get("success"):
            coordinator = booking_manager.coordinator
            coordinator.clear_cache()  # Clear cache first!
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
    
    if not time_manager or not booking_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        bookings = booking_manager.get_current_bookings()
        
        # Add vaskehus names to bookings
        enhanced_bookings = []
        for booking in bookings:
            enhanced = dict(booking)
            enhanced["vaskehus"] = time_manager.get_vaskehus_for_machine(
                booking.get("MachineNumber", 0)
            )
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
    """Get integration status (balance, max reservations, etc)."""
    booking_manager = _get_booking_manager(hass)
    
    if not booking_manager:
        connection.send_error(msg["id"], "not_ready", "Integration not ready")
        return
    
    try:
        balance = booking_manager.get_account_balance()
        max_reservations = booking_manager.get_max_reservations()
        current_count = len(booking_manager.get_current_bookings())
        
        status = {
            "balance": balance,
            "max_reservations": max_reservations,
            "current_count": current_count,
            "can_book": current_count < max_reservations,
        }
        
        _LOGGER.debug("📊 WebSocket: Status - %s", status)
        
        connection.send_result(msg["id"], status)
    
    except Exception as err:
        _LOGGER.exception("Error getting status: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))


#
# NOTIFICATION MANAGEMENT
#

@websocket_api.websocket_command({
    vol.Required("type"): f"{DOMAIN}/get_devices",
})
@callback
def ws_get_devices(hass: HomeAssistant, connection, msg):
    """Get configured devices and available mobile apps."""
    store = _get_store(hass)
    
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    
    try:
        configured_devices = store.get_devices()
        available_apps = store.get_available_mobile_apps()
        
        connection.send_result(msg["id"], {
            "configured": configured_devices,
            "available": available_apps,
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
    """Save configured notification devices."""
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
    """Get all notification configurations."""
    store = _get_store(hass)
    
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    
    try:
        notifications = store.get_notifications()
        
        connection.send_result(msg["id"], {"notifications": notifications})
    
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
    """Save notification configuration."""
    store = _get_store(hass)
    
    if not store:
        connection.send_error(msg["id"], "not_ready", "Store not ready")
        return
    
    try:
        await store.async_save_notification(
            msg["notification_id"],
            msg["config"],
        )
        
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
    """Send test notification."""
    notification_manager = _get_notification_manager(hass)
    
    if not notification_manager:
        connection.send_error(msg["id"], "not_ready", "Notification manager not ready")
        return
    
    try:
        # Send test with example variables
        from datetime import datetime, timedelta
        test_time = datetime.now() + timedelta(minutes=15)
        
        await notification_manager.send_notification(
            msg["notification_id"],
            {
                "vaskehus": "Klatvask",
                "time": test_time.strftime("%H:%M"),
                "date": test_time.strftime("%d-%m-%Y"),
                "duration": "120 minutter",
                "machine": "Maskine 1",
            },
        )
        
        _LOGGER.info("📬 Test notification sent: %s", msg["notification_id"])
        
        connection.send_result(msg["id"], {"success": True})
    
    except Exception as err:
        _LOGGER.exception("Error sending test notification: %s", err)
        connection.send_error(msg["id"], "unknown_error", str(err))
