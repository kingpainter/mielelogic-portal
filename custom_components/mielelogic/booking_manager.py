# VERSION = "2.0.0"
"""Manage booking and cancellation operations."""
import logging
from typing import Dict, List
from datetime import datetime

from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)


class BookingManager:
    """Handle booking and cancellation logic."""
    
    def __init__(self, coordinator, store=None, notification_manager=None):
        """Initialize booking manager.
        
        Args:
            coordinator: MieleLogic coordinator
            store: MieleLogicStore for metadata tracking (optional for v1.5.2+)
            notification_manager: NotificationManager for sending notifications (optional v1.5.2+)
        """
        self.coordinator = coordinator
        self.hass = coordinator.hass
        self.store = store  # ✨ NEW v1.5.2: Store for user tracking
        self.notification_manager = notification_manager  # ✨ v1.5.2: Notification support
    
    def _get_time_manager(self):
        """Get time_manager instance from hass.data (helper for notifications)."""
        from .const import DOMAIN
        domain_data = self.hass.data.get(DOMAIN, {})
        for key, value in domain_data.items():
            if isinstance(value, dict) and "time_manager" in value:
                return value["time_manager"]
        return None
    
    async def make_booking(
        self,
        machine_number: int,
        start_datetime: str,
        duration: int,
        context = None,  # ✨ v1.5.2: User context for tracking
    ) -> Dict:
        """Make a booking via service call.
        
        Args:
            machine_number: Machine to book (1-5)
            start_datetime: Start time as "YYYY-MM-DD HH:MM:SS"
            duration: Duration in minutes
            context: HomeAssistant context (for user tracking)
        
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
            
            # ✨ v1.6.0: Save booking metadata with real HA username
            if self.store:
                try:
                    user_name = "Via Panel"
                    if context:
                        try:
                            # connection.context is a callable in HA — call it to get the Context object
                            ctx = context() if callable(context) else context
                            user_id = ctx.user_id if ctx else None
                            if user_id:
                                user = await self.hass.auth.async_get_user(user_id)
                                if user and user.name:
                                    user_name = user.name
                                    _LOGGER.info("👤 Booking by: %s", user.name)
                                else:
                                    _LOGGER.warning("👤 user_id %s found but no name", user_id)
                            else:
                                _LOGGER.warning("👤 Context has no user_id")
                        except Exception as user_err:
                            _LOGGER.warning("👤 User lookup failed: %s", user_err)

                    await self.store.async_save_booking_metadata(
                        machine=machine_number,
                        start_time=start_datetime,
                        user_name=user_name,
                        duration=duration,
                    )
                    _LOGGER.debug("Saved booking metadata for machine %s by %s", machine_number, user_name)

                except Exception as err:
                    _LOGGER.warning("Could not save booking metadata: %s", err)
            
            # ✨ v1.5.2: Send booking created notification
            if self.notification_manager:
                try:
                    # Get vaskehus name for notification
                    from .time_manager import TimeSlotManager
                    time_manager = self._get_time_manager()
                    vaskehus = "Vaskehus"
                    if time_manager:
                        vaskehus = time_manager.get_vaskehus_for_machine(machine_number) or "Vaskehus"
                    
                    # Parse datetime for notification
                    from datetime import datetime
                    dt = datetime.fromisoformat(start_datetime.replace(" ", "T"))
                    
                    await self.notification_manager.send_notification(
                        "booking_created",
                        {
                            "vaskehus": vaskehus,
                            "date": dt.strftime("%d-%m-%Y"),
                            "time": dt.strftime("%H:%M"),
                            "duration": duration,
                        }
                    )
                    _LOGGER.info("📨 Sent booking created notification")
                except Exception as err:
                    _LOGGER.warning("Could not send booking notification: %s", err)
                    # Don't fail the booking if notification fails
            
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
            
            # ✨ NEW v1.5.2: Delete booking metadata
            if self.store:
                try:
                    await self.store.async_delete_booking_metadata(
                        machine=machine_number,
                        start_time=start_time,
                    )
                    _LOGGER.debug("Deleted booking metadata")
                except Exception as err:
                    _LOGGER.warning("Could not delete booking metadata: %s", err)
            
            # ✨ v1.5.2: Send booking canceled notification
            if self.notification_manager:
                try:
                    time_manager = self._get_time_manager()
                    vaskehus = "Vaskehus"
                    if time_manager:
                        vaskehus = time_manager.get_vaskehus_for_machine(machine_number) or "Vaskehus"
                    
                    await self.notification_manager.send_notification(
                        "booking_canceled",
                        {"vaskehus": vaskehus}
                    )
                    _LOGGER.info("📨 Sent booking canceled notification")
                except Exception as err:
                    _LOGGER.warning("Could not send cancellation notification: %s", err)
            
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
