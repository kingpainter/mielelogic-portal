# VERSION = "1.7.0"
from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorDeviceClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import logging

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def _parse_datetime(datetime_str: str) -> datetime:
    """Parse datetime string - handle both with and without timezone.
    
    IMPORTANT: MieleLogic API returns naive datetimes in Europe/Copenhagen local time,
    NOT in UTC!
    """
    if not datetime_str:
        raise ValueError("Empty datetime string")
    
    # Check if datetime has timezone info
    if "Z" in datetime_str or "+" in datetime_str or datetime_str.count("-") > 2:
        # Has timezone info
        return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
    else:
        # No timezone info - API returns Europe/Copenhagen local time
        return datetime.fromisoformat(datetime_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up MieleLogic binary sensor platform."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]["coordinator"]
    
    sensors = [
        MieleLogicHasReservationBinarySensor(coordinator, config_entry),
        MieleLogicHasWasherReservationBinarySensor(coordinator, config_entry),
        MieleLogicHasDryerReservationBinarySensor(coordinator, config_entry),
        MieleLogicReservationStartingSoonBinarySensor(coordinator, config_entry),
        MieleLogicWasherAvailableBinarySensor(coordinator, config_entry),
        MieleLogicDryerAvailableBinarySensor(coordinator, config_entry),
    ]
    
    async_add_entities(sensors)
    _LOGGER.debug("Added %d binary sensors for MieleLogic", len(sensors))


class MieleLogicHasReservationBinarySensor(BinarySensorEntity):
    """Binary sensor showing if user has any reservations."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_has_reservation"
        self._attr_name = "Has Reservation"
        self._attr_device_info = coordinator.device_info
        self._attr_icon = "mdi:calendar-check"
    
    @property
    def is_on(self) -> bool:
        """Return True if user has any reservations."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return len(reservations) > 0
    
    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return {
            "count": len(reservations),
            "reservation_ids": [r.get("ReservationId") for r in reservations],
        }


class MieleLogicHasWasherReservationBinarySensor(BinarySensorEntity):
    """Binary sensor showing if user has washer reservation."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_has_washer_reservation"
        self._attr_name = "Has Washer Reservation"
        self._attr_device_info = coordinator.device_info
        self._attr_icon = "mdi:washing-machine"
    
    @property
    def is_on(self) -> bool:
        """Return True if user has washer reservation."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        washer_reservations = [
            r for r in reservations 
            if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]
        ]
        return len(washer_reservations) > 0
    
    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        washer_reservations = [
            r for r in reservations 
            if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]
        ]
        return {
            "count": len(washer_reservations),
            "machines": [r.get("MachineName") for r in washer_reservations],
        }


class MieleLogicHasDryerReservationBinarySensor(BinarySensorEntity):
    """Binary sensor showing if user has dryer reservation."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_has_dryer_reservation"
        self._attr_name = "Has Dryer Reservation"
        self._attr_device_info = coordinator.device_info
        self._attr_icon = "mdi:tumble-dryer"
    
    @property
    def is_on(self) -> bool:
        """Return True if user has dryer reservation."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        dryer_reservations = [
            r for r in reservations 
            if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"
        ]
        return len(dryer_reservations) > 0
    
    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        dryer_reservations = [
            r for r in reservations 
            if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"
        ]
        return {
            "count": len(dryer_reservations),
            "machines": [r.get("MachineName") for r in dryer_reservations],
        }


class MieleLogicReservationStartingSoonBinarySensor(BinarySensorEntity):
    """Binary sensor showing if a reservation is starting within 15 minutes."""
    
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.RUNNING
    
    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_reservation_starting_soon"
        self._attr_name = "Reservation Starting Soon"
        self._attr_device_info = coordinator.device_info
        self._attr_icon = "mdi:clock-alert"
    
    @property
    def is_on(self) -> bool:
        """Return True if reservation starts within 15 minutes."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        now = datetime.now(ZoneInfo("UTC"))
        threshold = now + timedelta(minutes=15)
        
        for reservation in reservations:
            try:
                start_str = reservation.get("Start")
                if not start_str:
                    continue
                
                # Parse datetime with timezone handling
                start_time = _parse_datetime(start_str)
                
                # Check if reservation starts between now and 15 minutes from now
                if now < start_time <= threshold:
                    return True
            except (ValueError, TypeError) as err:
                _LOGGER.warning("Failed to parse reservation start time '%s': %s", start_str, err)
                continue
        
        return False
    
    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        now = datetime.now(ZoneInfo("UTC"))
        threshold = now + timedelta(minutes=15)
        
        upcoming = []
        for reservation in reservations:
            try:
                start_str = reservation.get("Start")
                if not start_str:
                    continue
                
                # Parse datetime with timezone handling
                start_time = _parse_datetime(start_str)
                
                if now < start_time <= threshold:
                    minutes_until = int((start_time - now).total_seconds() / 60)
                    upcoming.append({
                        "machine_name": reservation.get("MachineName"),
                        "start_time": start_str,
                        "minutes_until_start": minutes_until,
                    })
            except (ValueError, TypeError):
                continue
        
        # Sort by time
        upcoming.sort(key=lambda r: r["minutes_until_start"])
        
        return {
            "count": len(upcoming),
            "upcoming_reservations": upcoming,
            "next_start_in_minutes": upcoming[0]["minutes_until_start"] if upcoming else None,
        }


class MieleLogicWasherAvailableBinarySensor(BinarySensorEntity):
    """Binary sensor showing if at least one washer is available."""
    
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.POWER
    
    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_washer_available"
        self._attr_name = "Washer Available"
        self._attr_device_info = coordinator.device_info
    
    @property
    def is_on(self) -> bool:
        """Return True if at least one washer is available."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        
        for machine in machine_states:
            machine_type = machine.get("MachineType")
            status = machine.get("Text1", "").lower()
            
            # Check if it's a washer and if it's available
            if machine_type in ["51", "85"]:
                if "ledig" in status or "available" in status:
                    return True
        
        return False
    
    @property
    def icon(self):
        """Return dynamic icon based on state."""
        return "mdi:washing-machine" if self.is_on else "mdi:washing-machine-off"
    
    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        
        washers = [m for m in machine_states if m.get("MachineType") in ["51", "85"]]
        available = [
            m for m in washers 
            if "ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower()
        ]
        
        return {
            "total_washers": len(washers),
            "available_count": len(available),
            "available_machines": [
                {
                    "number": m.get("MachineNumber"),
                    "name": m.get("UnitName"),
                    "status": m.get("Text1"),
                }
                for m in available
            ],
        }


class MieleLogicDryerAvailableBinarySensor(BinarySensorEntity):
    """Binary sensor showing if at least one dryer is available."""
    
    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.POWER
    
    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_dryer_available"
        self._attr_name = "Dryer Available"
        self._attr_device_info = coordinator.device_info
    
    @property
    def is_on(self) -> bool:
        """Return True if at least one dryer is available."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        
        for machine in machine_states:
            machine_type = machine.get("MachineType")
            status = machine.get("Text1", "").lower()
            
            # Check if it's a dryer and if it's available
            if machine_type == "58":
                if "ledig" in status or "available" in status:
                    return True
        
        return False
    
    @property
    def icon(self):
        """Return dynamic icon based on state."""
        return "mdi:tumble-dryer" if self.is_on else "mdi:tumble-dryer-off"
    
    @property
    def extra_state_attributes(self):
        """Return additional attributes."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        
        dryers = [m for m in machine_states if m.get("MachineType") == "58"]
        available = [
            m for m in dryers 
            if "ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower()
        ]
        
        return {
            "total_dryers": len(dryers),
            "available_count": len(available),
            "available_machines": [
                {
                    "number": m.get("MachineNumber"),
                    "name": m.get("UnitName"),
                    "status": m.get("Text1"),
                }
                for m in available
            ],
        }
