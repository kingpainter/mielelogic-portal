# VERSION = "1.5.1"
"""Manage booking and cancellation operations."""
import logging
from typing import Dict, List
from datetime import datetime

from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)


class BookingManager:
    """Handle booking and cancellation logic."""
    
    def __init__(self, coordinator):
        """Initialize booking manager."""
        self.coordinator = coordinator
        self.hass = coordinator.hass
    
    async def make_booking(
        self,
        machine_number: int,
        start_datetime: str,
        duration: int,
    ) -> Dict:
        """Make a booking via service call.
        
        Args:
            machine_number: Machine to book (1-5)
            start_datetime: Start time as "YYYY-MM-DD HH:MM:SS"
            duration: Duration in minutes
        
        Returns:
            Dict with:
            - success: bool
            - message: str
            - data: dict (if successful)
        """
        _LOGGER.info(
            "🔵 Booking: Machine %s at %s for %s min",
            machine_number,
            start_datetime,
            duration,
        )
        
        try:
            # Call existing service (now with response support!)
            result = await self.hass.services.async_call(
                "mielelogic",
                "make_reservation",
                {
                    "machine_number": machine_number,
                    "start_time": start_datetime,
                    "duration": duration,
                },
                blocking=True,
                return_response=True,
            )
            
            _LOGGER.info("✅ Booking successful!")
            
            return {
                "success": True,
                "message": "Booking gennemført",
                "data": result,
            }
        
        except HomeAssistantError as err:
            _LOGGER.error("❌ Booking failed: %s", err)
            return {
                "success": False,
                "message": str(err),
            }
        except Exception as err:
            _LOGGER.exception("❌ Unexpected booking error: %s", err)
            return {
                "success": False,
                "message": f"Ukendt fejl: {err}",
            }
    
    async def cancel_booking(
        self,
        machine_number: int,
        start_time: str,
        end_time: str,
    ) -> Dict:
        """Cancel a booking.
        
        Args:
            machine_number: Machine number
            start_time: Start time from reservation
            end_time: End time from reservation
        
        Returns:
            Dict with:
            - success: bool
            - message: str
        """
        _LOGGER.info(
            "🔴 Canceling: Machine %s from %s to %s",
            machine_number,
            start_time,
            end_time,
        )
        
        try:
            await self.hass.services.async_call(
                "mielelogic",
                "cancel_reservation",
                {
                    "machine_number": machine_number,
                    "start_time": start_time,
                    "end_time": end_time,
                },
                blocking=True,
            )
            
            _LOGGER.info("✅ Cancellation successful!")
            
            return {
                "success": True,
                "message": "Booking annulleret",
            }
        
        except HomeAssistantError as err:
            _LOGGER.error("❌ Cancellation failed: %s", err)
            return {
                "success": False,
                "message": str(err),
            }
        except Exception as err:
            _LOGGER.exception("❌ Unexpected cancellation error: %s", err)
            return {
                "success": False,
                "message": f"Ukendt fejl: {err}",
            }
    
    def get_current_bookings(self) -> List[Dict]:
        """Get current bookings from coordinator.
        
        Returns:
            List of reservation dicts from API
        """
        reservations = self.coordinator.data.get("reservations", {})
        bookings = reservations.get("Reservations", [])
        
        _LOGGER.debug("📋 Current bookings: %d", len(bookings))
        
        return bookings
    
    def get_account_balance(self) -> float:
        """Get account balance from coordinator."""
        account = self.coordinator.data.get("account_details", {})
        balance = account.get("Balance", 0.0)
        
        return balance
    
    def get_max_reservations(self) -> int:
        """Get max allowed reservations from coordinator."""
        reservations = self.coordinator.data.get("reservations", {})
        max_res = reservations.get("MaxUserReservations", 2)
        
        return max_res
