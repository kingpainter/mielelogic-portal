# VERSION = "1.5.1"
from datetime import datetime
from zoneinfo import ZoneInfo
from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback
import logging

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up MieleLogic calendar platform."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]["coordinator"]
    
    calendar = MieleLogicReservationCalendar(coordinator, config_entry)
    async_add_entities([calendar])
    _LOGGER.debug("Added MieleLogic reservation calendar")


class MieleLogicReservationCalendar(CalendarEntity):
    """Calendar showing MieleLogic reservations."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        """Initialize the calendar."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_calendar"
        self._attr_name = "Reservations"
        self._attr_device_info = coordinator.device_info
    
    @property
    def event(self) -> CalendarEvent | None:
        """Return the next upcoming event."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        
        if not reservations:
            return None
        
        # Find next reservation
        now = datetime.now(ZoneInfo("UTC"))
        upcoming = []
        
        for res in reservations:
            try:
                start_str = res.get("Start")
                if not start_str:
                    continue
                
                # Parse datetime - handle both with and without timezone
                if "Z" in start_str or "+" in start_str or start_str.count("-") > 2:
                    # Has timezone info
                    start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                else:
                    # No timezone info - API returns Europe/Copenhagen local time
                    start_time = datetime.fromisoformat(start_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
                
                if start_time > now:
                    upcoming.append((start_time, res))
            except (ValueError, TypeError) as err:
                _LOGGER.warning("Failed to parse reservation time '%s': %s", start_str, err)
                continue
        
        if not upcoming:
            return None
        
        # Sort and get next event
        upcoming.sort(key=lambda x: x[0])
        next_res = upcoming[0][1]
        
        return self._create_calendar_event(next_res)
    
    async def async_get_events(
        self, hass: HomeAssistant, start_date: datetime, end_date: datetime
    ) -> list[CalendarEvent]:
        """Return all events in date range."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        
        events = []
        for res in reservations:
            try:
                start_str = res.get("Start")
                if not start_str:
                    continue
                
                # Parse datetime - handle both with and without timezone
                if "Z" in start_str or "+" in start_str or start_str.count("-") > 2:
                    # Has timezone info
                    start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                else:
                    # No timezone info - API returns Europe/Copenhagen local time
                    start_time = datetime.fromisoformat(start_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
                
                # Check if event is in requested range
                if start_date <= start_time <= end_date:
                    event = self._create_calendar_event(res)
                    if event:
                        events.append(event)
            except (ValueError, TypeError) as err:
                _LOGGER.warning("Failed to parse reservation time '%s': %s", start_str, err)
                continue
        
        # Sort by start time
        events.sort(key=lambda e: e.start)
        
        _LOGGER.debug(
            "Found %d calendar events between %s and %s",
            len(events),
            start_date,
            end_date
        )
        
        return events
    
    def _create_calendar_event(self, reservation: dict) -> CalendarEvent | None:
        """Create a CalendarEvent from reservation data."""
        try:
            start_str = reservation.get("Start")
            end_str = reservation.get("End")
            
            if not start_str or not end_str:
                return None
            
            # Parse datetime - handle both with and without timezone
            if "Z" in start_str or "+" in start_str or start_str.count("-") > 2:
                # Has timezone info
                start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            else:
                # No timezone info - API returns Europe/Copenhagen local time
                start_time = datetime.fromisoformat(start_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
            
            if "Z" in end_str or "+" in end_str or end_str.count("-") > 2:
                # Has timezone info
                end_time = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            else:
                # No timezone info - API returns Europe/Copenhagen local time
                end_time = datetime.fromisoformat(end_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
            
            machine_name = reservation.get("MachineName", "Unknown")
            machine_number = reservation.get("MachineNumber", "")
            
            # NEW v1.4.6: Get vaskehus name from config
            vaskehus_name = self._get_vaskehus_name(machine_number)
            
            # Create summary with vaskehus name
            summary = f"{vaskehus_name} booket"
            
            # Create description
            duration = reservation.get("Duration", 0)
            description = f"MieleLogic Reservation\n"
            description += f"Vaskehus: {vaskehus_name}\n"
            description += f"Maskine: {machine_name} #{machine_number}\n"
            description += f"Varighed: {duration} minutter"
            
            return CalendarEvent(
                start=start_time,
                end=end_time,
                summary=summary,
                description=description,
            )
        except (ValueError, TypeError) as err:
            _LOGGER.warning("Failed to create calendar event: %s", err)
            return None
    
    def _get_vaskehus_name(self, machine_number: int) -> str:
        """Get vaskehus name from machine number.
        
        NEW v1.4.6: Maps machine number to vaskehus name for display.
        Returns "Klatvask", "Storvask", or "Maskine X" (fallback).
        """
        config_entry = self.coordinator.config_entry
        klatvask_machine = config_entry.data.get("klatvask_primary_machine", 1)
        storvask_machine = config_entry.data.get("storvask_primary_machine", 4)
        
        if machine_number == klatvask_machine:
            return "Klatvask"
        elif machine_number == storvask_machine:
            return "Storvask"
        else:
            return f"Maskine {machine_number}"
