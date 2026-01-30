# VERSION = "1.4.5"
"""
MieleLogic Services

Provides services for making and canceling reservations programmatically.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import aiohttp
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

from .const import DOMAIN, API_BASE_URL

_LOGGER = logging.getLogger(__name__)

# Service schemas
MAKE_RESERVATION_SCHEMA = vol.Schema(
    {
        vol.Required("machine_number"): cv.positive_int,
        vol.Required("start_time"): cv.datetime,
        vol.Optional("duration", default=120): cv.positive_int,
        vol.Optional("end_time"): cv.datetime,
    }
)

CANCEL_RESERVATION_SCHEMA = vol.Schema(
    {
        vol.Required("machine_number"): cv.positive_int,
        vol.Required("start_time"): cv.datetime,
        vol.Required("end_time"): cv.datetime,
    }
)


async def async_setup_services(hass: HomeAssistant, coordinator) -> None:
    """Set up services for MieleLogic integration."""
    
    async def handle_make_reservation(call: ServiceCall) -> None:
        """Handle make_reservation service call."""
        machine_number = call.data.get("machine_number")
        start_time = call.data.get("start_time")
        duration = call.data.get("duration", 120)
        end_time = call.data.get("end_time")
        
        _LOGGER.debug(
            "Making reservation: machine=%s, start=%s, duration=%s, end=%s",
            machine_number,
            start_time,
            duration,
            end_time,
        )
        
        # Ensure start_time has timezone
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
        
        # Validation
        _validate_machine_number(machine_number)
        _validate_start_time(start_time, coordinator)
        
        # Calculate end_time if not provided
        if end_time is None:
            end_time = start_time + timedelta(minutes=duration)
        else:
            # Ensure end_time has timezone
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
        
        _validate_end_time(end_time, start_time, coordinator)
        _validate_duration(start_time, end_time)
        
        # Check max reservations
        await _check_max_reservations(coordinator)
        
        # Ensure token is valid
        await coordinator._ensure_token()
        
        # Format datetime strings (remove timezone, API expects naive datetime)
        start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
        end_str = end_time.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Make API request
        url = f"{API_BASE_URL}/reservations"
        headers = {
            "Authorization": f"Bearer {coordinator.access_token}",
            "Content-Type": "application/json;charset=UTF-8",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
        
        body = {
            "MachineNumber": machine_number,
            "LaundryNumber": str(coordinator.laundry_id),  # Must be string!
            "Start": start_str,
            "End": end_str,
        }
        
        _LOGGER.info(
            "ðŸ”µ Making reservation: Machine %s from %s to %s (%s min)",
            machine_number,
            start_str,
            end_str,
            duration,
        )
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.put(url, json=body, headers=headers, timeout=10) as response:
                    response_text = await response.text()
                    _LOGGER.debug("API Response Status: %s", response.status)
                    _LOGGER.debug("API Response Body: %s", response_text)
                    
                    if response.status == 401:
                        # Token expired - refresh and retry
                        _LOGGER.warning("Token expired during reservation, refreshing...")
                        await coordinator._refresh_token()
                        headers["Authorization"] = f"Bearer {coordinator.access_token}"
                        
                        async with session.put(url, json=body, headers=headers, timeout=10) as retry_response:
                            retry_text = await retry_response.text()
                            _LOGGER.debug("Retry Response Status: %s", retry_response.status)
                            _LOGGER.debug("Retry Response Body: %s", retry_text)
                            retry_response.raise_for_status()
                            result = await retry_response.json()
                    else:
                        response.raise_for_status()
                        try:
                            result = await response.json()
                        except Exception as json_err:
                            _LOGGER.error("Failed to parse JSON response: %s", json_err)
                            _LOGGER.error("Response was: %s", response_text)
                            raise HomeAssistantError(f"Invalid API response: {response_text[:200]}")
            
            # Check API response
            _LOGGER.debug("API Result: %s", result)
            if not result.get("ResultOK"):
                error_msg = result.get("ResultText", "Unknown error")
                _LOGGER.error("âŒ Reservation failed: %s", error_msg)
                _LOGGER.error("Full API response: %s", result)
                raise HomeAssistantError(f"Reservation failed: {error_msg}")
            
            _LOGGER.info("âœ… Reservation successful!")
            
            # Force refresh coordinator to update sensors
            await coordinator.async_request_refresh()
            
        except aiohttp.ClientError as err:
            _LOGGER.error("Network error during reservation: %s", err)
            raise HomeAssistantError(f"Network error: {err}") from err
        except Exception as err:
            _LOGGER.error("Unexpected error during reservation: %s", err)
            raise HomeAssistantError(f"Unexpected error: {err}") from err
    
    async def handle_cancel_reservation(call: ServiceCall) -> None:
        """Handle cancel_reservation service call."""
        machine_number = call.data.get("machine_number")
        start_time = call.data.get("start_time")
        end_time = call.data.get("end_time")
        
        _LOGGER.debug(
            "Canceling reservation: machine=%s, start=%s, end=%s",
            machine_number,
            start_time,
            end_time,
        )
        
        # Ensure datetimes have timezone
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
        
        # Validation
        _validate_machine_number(machine_number)
        
        # Verify reservation exists
        await _verify_reservation_exists(coordinator, machine_number, start_time, end_time)
        
        # Ensure token is valid
        await coordinator._ensure_token()
        
        # Format datetime strings (remove timezone)
        start_str = start_time.strftime("%Y-%m-%dT%H:%M:%S")
        end_str = end_time.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Make API request (DELETE with query parameters)
        url = f"{API_BASE_URL}/reservations"
        params = {
            "MachineNumber": int(machine_number),  # Force int
            "LaundryNumber": int(coordinator.laundry_id),  # Force int (match app!)
            "Start": start_str,
            "End": end_str,
        }
        
        headers = {
            "Authorization": f"Bearer {coordinator.access_token}",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
        
        _LOGGER.info(
            "ðŸ”´ Canceling reservation: Machine %s from %s to %s",
            machine_number,
            start_str,
            end_str,
        )
        _LOGGER.debug("Cancel params: %s", params)
        _LOGGER.debug("Cancel URL: %s", url)
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.delete(url, params=params, headers=headers, timeout=10) as response:
                    response_text = await response.text()
                    _LOGGER.debug("Cancel API Response Status: %s", response.status)
                    _LOGGER.debug("Cancel API Response Body: %s", response_text)
                    
                    if response.status == 401:
                        # Token expired - refresh and retry
                        _LOGGER.warning("Token expired during cancellation, refreshing...")
                        await coordinator._refresh_token()
                        headers["Authorization"] = f"Bearer {coordinator.access_token}"
                        
                        async with session.delete(url, params=params, headers=headers, timeout=10) as retry_response:
                            retry_text = await retry_response.text()
                            _LOGGER.debug("Cancel Retry Response Status: %s", retry_response.status)
                            _LOGGER.debug("Cancel Retry Response Body: %s", retry_text)
                            retry_response.raise_for_status()
                            result = await retry_response.json()
                    else:
                        response.raise_for_status()
                        try:
                            result = await response.json()
                        except Exception as json_err:
                            _LOGGER.error("Failed to parse cancel JSON response: %s", json_err)
                            _LOGGER.error("Response was: %s", response_text)
                            raise HomeAssistantError(f"Invalid cancel API response: {response_text[:200]}")
            
            # Check API response
            _LOGGER.debug("Cancel API Result: %s", result)
            if not result.get("ResultOK"):
                error_msg = result.get("ResultText", "Unknown error")
                _LOGGER.error("âŒ Cancellation failed: %s", error_msg)
                _LOGGER.error("Full cancel API response: %s", result)
                raise HomeAssistantError(f"Cancellation failed: {error_msg}")
            
            _LOGGER.info("âœ… Cancellation successful!")
            
            # Force refresh coordinator to update sensors
            await coordinator.async_request_refresh()
            
        except aiohttp.ClientError as err:
            _LOGGER.error("Network error during cancellation: %s", err)
            raise HomeAssistantError(f"Network error: {err}") from err
        except Exception as err:
            _LOGGER.error("Unexpected error during cancellation: %s", err)
            raise HomeAssistantError(f"Unexpected error: {err}") from err
    
    # Register services
    hass.services.async_register(
        DOMAIN,
        "make_reservation",
        handle_make_reservation,
        schema=MAKE_RESERVATION_SCHEMA,
    )
    
    hass.services.async_register(
        DOMAIN,
        "cancel_reservation",
        handle_cancel_reservation,
        schema=CANCEL_RESERVATION_SCHEMA,
    )
    
    _LOGGER.info("âœ… MieleLogic services registered: make_reservation, cancel_reservation")


# ===== VALIDATION HELPERS =====

def _validate_machine_number(machine_number: int) -> None:
    """Validate machine number is in valid range."""
    if not 1 <= machine_number <= 5:
        raise ServiceValidationError(
            f"Invalid machine number: {machine_number}. Must be 1-5."
        )


def _validate_start_time(start_time: datetime, coordinator) -> None:
    """Validate start time is in the future and within laundry hours."""
    # Ensure both datetimes have timezone info for comparison
    if start_time.tzinfo is None:
        # Input datetime is naive - assume local timezone (Europe/Copenhagen)
        start_time = start_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    
    now = datetime.now(ZoneInfo("Europe/Copenhagen"))
    
    # Must be in future
    if start_time <= now:
        raise ServiceValidationError(
            "Start time must be in the future"
        )
    
    # Check laundry hours
    opening_time = coordinator.config_entry.data.get("opening_time", "07:00")
    closing_time = coordinator.config_entry.data.get("closing_time", "21:00")
    
    opening_hour = int(opening_time.split(":")[0])
    closing_hour = int(closing_time.split(":")[0])
    
    if start_time.hour < opening_hour:
        raise ServiceValidationError(
            f"Start time is before laundry opens ({opening_time})"
        )
    
    if start_time.hour >= closing_hour:
        raise ServiceValidationError(
            f"Start time is after laundry closes ({closing_time})"
        )


def _validate_end_time(end_time: datetime, start_time: datetime, coordinator) -> None:
    """Validate end time is after start time and within laundry hours."""
    # Ensure both datetimes have timezone info
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    
    if end_time <= start_time:
        raise ServiceValidationError(
            "End time must be after start time"
        )
    
    # Check laundry hours
    closing_time = coordinator.config_entry.data.get("closing_time", "21:00")
    closing_hour = int(closing_time.split(":")[0])
    
    if end_time.hour > closing_hour:
        raise ServiceValidationError(
            f"End time is after laundry closes ({closing_time})"
        )


def _validate_duration(start_time: datetime, end_time: datetime) -> None:
    """Validate duration is within acceptable range."""
    # Ensure both have timezone for calculation
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    
    duration_minutes = (end_time - start_time).total_seconds() / 60
    
    if duration_minutes < 30:
        raise ServiceValidationError(
            f"Duration too short: {duration_minutes:.0f} minutes. Minimum is 30 minutes."
        )
    
    if duration_minutes > 180:
        raise ServiceValidationError(
            f"Duration too long: {duration_minutes:.0f} minutes. Maximum is 180 minutes (3 hours)."
        )


async def _check_max_reservations(coordinator) -> None:
    """Check if user has reached max reservations."""
    reservations = coordinator.data.get("reservations", {}).get("Reservations", [])
    max_reservations = coordinator.data.get("reservations", {}).get("MaxUserReservations", 2)
    
    if len(reservations) >= max_reservations:
        raise ServiceValidationError(
            f"Maximum number of reservations reached ({max_reservations}). "
            "Cancel an existing reservation before making a new one."
        )


async def _verify_reservation_exists(
    coordinator, machine_number: int, start_time: datetime, end_time: datetime
) -> None:
    """Verify that the reservation exists before attempting to cancel."""
    reservations = coordinator.data.get("reservations", {}).get("Reservations", [])
    
    # Ensure datetimes have timezone
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    
    # Find matching reservation
    found = False
    found_reservation = None
    
    for res in reservations:
        res_machine = res.get("MachineNumber")
        res_start_str = res.get("Start", "")
        res_end_str = res.get("End", "")
        
        if not res_start_str or not res_end_str:
            continue
        
        # Parse reservation times (handle both with/without timezone)
        try:
            # Handle timezone in API response
            if "Z" in res_start_str or "+" in res_start_str:
                res_start = datetime.fromisoformat(res_start_str.replace("Z", "+00:00"))
            else:
                # Naive datetime - API returns Europe/Copenhagen local time
                res_start = datetime.fromisoformat(res_start_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
            
            if "Z" in res_end_str or "+" in res_end_str:
                res_end = datetime.fromisoformat(res_end_str.replace("Z", "+00:00"))
            else:
                # Naive datetime - API returns Europe/Copenhagen local time
                res_end = datetime.fromisoformat(res_end_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
            
            # Both datetimes are now in Europe/Copenhagen timezone
            # Compare directly without conversion
            
            # Match on machine and times (with 1 minute tolerance for rounding)
            if res_machine == machine_number:
                start_diff = abs((res_start - start_time).total_seconds())
                end_diff = abs((res_end - end_time).total_seconds())
                
                # Allow 60 second tolerance (handles seconds/milliseconds differences)
                if start_diff <= 60 and end_diff <= 60:
                    found = True
                    found_reservation = res
                    _LOGGER.debug(
                        "✅ Found matching reservation: Machine %s, Start: %s, End: %s",
                        res_machine,
                        res_start.strftime("%Y-%m-%d %H:%M"),
                        res_end.strftime("%Y-%m-%d %H:%M"),
                    )
                    break
                else:
                    _LOGGER.debug(
                        "⏰ Time mismatch for machine %s: start_diff=%ds, end_diff=%ds",
                        res_machine,
                        start_diff,
                        end_diff,
                    )
        except (ValueError, TypeError) as err:
            _LOGGER.warning("Failed to parse reservation time: %s", err)
            continue
    
    if not found:
        # Log available reservations for debugging
        _LOGGER.error(
            "❌ No reservation found for machine %s from %s to %s",
            machine_number,
            start_time.strftime("%Y-%m-%d %H:%M"),
            end_time.strftime("%Y-%m-%d %H:%M"),
        )
        _LOGGER.error("Available reservations: %s", [
            {
                "machine": r.get("MachineNumber"),
                "start": r.get("Start"),
                "end": r.get("End"),
            }
            for r in reservations
        ])
        raise ServiceValidationError(
            f"No reservation found for machine {machine_number} "
            f"from {start_time.strftime('%Y-%m-%d %H:%M')} to {end_time.strftime('%Y-%m-%d %H:%M')}. "
            f"Please check Developer Tools → States → sensor.mielelogic_reservations for available reservations."
        )


async def async_unload_services(hass: HomeAssistant) -> None:
    """Unload MieleLogic services."""
    hass.services.async_remove(DOMAIN, "make_reservation")
    hass.services.async_remove(DOMAIN, "cancel_reservation")
    _LOGGER.info("MieleLogic services unloaded")
