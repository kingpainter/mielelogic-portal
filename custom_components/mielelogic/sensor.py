# VERSION = "1.3.2"
"""
MieleLogic sensor platform.

This module creates sensors for:
1. Global sensors (reservations, account balance)
2. Machine-type sensors (washer status, dryer status)
3. Per-machine sensors (dynamically created for each machine)

v1.3.2 Update: Per-machine sensors now combine status + reservation info
"""
import logging
from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorStateClass,
)
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up MieleLogic sensor platform."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]

    # Global sensors
    sensors = [
        MieleLogicReservationsSensor(coordinator, config_entry),
        MieleLogicAccountBalanceSensor(coordinator, config_entry),
    ]

    # Machine-type sensors (Washer/Dryer overview)
    machine_states = coordinator.data.get("machine_states", {}).get("MachineStates", [])
    
    has_washers = any(m.get("MachineType") in ["51", "85"] for m in machine_states)
    has_dryers = any(m.get("MachineType") == "58" for m in machine_states)

    if has_washers:
        sensors.append(MieleLogicWasherStatusSensor(coordinator, config_entry))
    if has_dryers:
        sensors.append(MieleLogicDryerStatusSensor(coordinator, config_entry))

    # Per-machine sensors (dynamically created)
    for machine in machine_states:
        machine_number = machine.get("MachineNumber")
        machine_name = machine.get("UnitName", "Unknown")
        machine_type = machine.get("MachineType")

        if machine_number and machine_name:
            sensors.append(
                MieleLogicMachineStatusSensor(
                    coordinator,
                    config_entry,
                    machine_number,
                    machine_name,
                    machine_type,
                )
            )

    async_add_entities(sensors)
    _LOGGER.debug("Added %d sensors for MieleLogic", len(sensors))


class MieleLogicReservationsSensor(SensorEntity):
    """Sensor showing user's reservations."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:calendar-clock"

    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_reservations"
        self._attr_name = "Reservations"
        self._attr_device_info = coordinator.device_info

    @property
    def native_value(self):
        """Return the number of reservations."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return len(reservations)

    @property
    def extra_state_attributes(self):
        """Return enhanced attributes with structured data."""
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])

        # Count by type
        washer_count = sum(
            1 for r in reservations
            if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]
        )
        dryer_count = sum(
            1 for r in reservations
            if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"
        )

        # Find next reservation
        next_reservation = None
        if reservations:
            # Sort by start time and get first
            sorted_res = sorted(reservations, key=lambda r: r.get("Start", ""))
            if sorted_res:
                next_res = sorted_res[0]
                next_reservation = {
                    "machine_name": next_res.get("MachineName"),
                    "machine_number": next_res.get("MachineNumber"),
                    "start_time": next_res.get("Start"),
                    "end_time": next_res.get("End"),
                    "duration_minutes": next_res.get("Duration"),
                }

        # Count reservations today (basic check on date)
        from datetime import datetime
        today = datetime.now().date().isoformat()
        reservations_today = sum(
            1 for r in reservations
            if r.get("Start", "").startswith(today)
        )

        return {
            "total_count": len(reservations),
            "washer_count": washer_count,
            "dryer_count": dryer_count,
            "reservations_today": reservations_today,
            "next_reservation": next_reservation,
            "raw_data": reservations,  # Backward compatibility
        }


class MieleLogicAccountBalanceSensor(SensorEntity):
    """Sensor showing account balance."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_native_unit_of_measurement = "DKK"
    _attr_icon = "mdi:cash"

    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_account_balance"
        self._attr_name = "Account Balance"
        self._attr_device_info = coordinator.device_info

    @property
    def native_value(self):
        """Return the account balance."""
        account = self.coordinator.data.get("account_details", {})
        return account.get("Balance", 0)

    @property
    def extra_state_attributes(self):
        """Return account details."""
        account = self.coordinator.data.get("account_details", {})
        return {
            "account_number": account.get("AccountNumber"),
            "customer_number": account.get("CustomerNumber"),
        }


class MieleLogicWasherStatusSensor(SensorEntity):
    """Sensor showing washer overview status."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:washing-machine"

    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_washer_status"
        self._attr_name = "Washer Status"
        self._attr_device_info = coordinator.device_info

    @property
    def native_value(self):
        """Return washer overview status."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        washers = [m for m in machine_states if m.get("MachineType") in ["51", "85"]]

        if not washers:
            return "No washers"

        available = sum(
            1 for m in washers
            if "ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower()
        )

        total = len(washers)

        if available == total:
            return "All available"
        elif available == 0:
            return "All occupied"
        else:
            return f"{available}/{total} available"

    @property
    def extra_state_attributes(self):
        """Return washer details."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        washers = [m for m in machine_states if m.get("MachineType") in ["51", "85"]]

        return {
            "total_count": len(washers),
            "available_count": sum(
                1 for m in washers
                if "ledig" in m.get("Text1", "").lower()
            ),
            "machines": [
                {
                    "number": m.get("MachineNumber"),
                    "name": m.get("UnitName"),
                    "status": m.get("Text1"),
                }
                for m in washers
            ],
        }


class MieleLogicDryerStatusSensor(SensorEntity):
    """Sensor showing dryer overview status."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:tumble-dryer"

    def __init__(self, coordinator, config_entry):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_dryer_status"
        self._attr_name = "Dryer Status"
        self._attr_device_info = coordinator.device_info

    @property
    def native_value(self):
        """Return dryer overview status."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        dryers = [m for m in machine_states if m.get("MachineType") == "58"]

        if not dryers:
            return "No dryers"

        available = sum(
            1 for m in dryers
            if "ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower()
        )

        total = len(dryers)

        if available == total:
            return "All available"
        elif available == 0:
            return "All occupied"
        else:
            return f"{available}/{total} available"

    @property
    def extra_state_attributes(self):
        """Return dryer details."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        dryers = [m for m in machine_states if m.get("MachineType") == "58"]

        return {
            "total_count": len(dryers),
            "available_count": sum(
                1 for m in dryers
                if "ledig" in m.get("Text1", "").lower()
            ),
            "machines": [
                {
                    "number": m.get("MachineNumber"),
                    "name": m.get("UnitName"),
                    "status": m.get("Text1"),
                }
                for m in dryers
            ],
        }


class MieleLogicMachineStatusSensor(SensorEntity):
    """Sensor for individual machine status.
    
    v1.3.2: Now combines Text1 (status) + ReservationInfo for display.
    Examples:
    - "Ledig indtil kl. 21:00" (Text1="Ledig indtil", ReservationInfo="kl. 21:00")
    - "Resttid: 55 min" (Text1="Resttid: 55 min", ReservationInfo="")
    - "Reserveret fra kl. 19:00" (Text1="Reserveret fra", ReservationInfo="kl. 19:00")
    """

    _attr_has_entity_name = True

    def __init__(self, coordinator, config_entry, machine_number, machine_name, machine_type):
        """Initialize the sensor."""
        self.coordinator = coordinator
        self._machine_number = machine_number
        self._machine_name = machine_name
        self._machine_type = machine_type

        # Clean name for entity_id (remove spaces, special chars)
        clean_name = machine_name.lower().replace(" ", "_").replace("æ", "ae").replace("ø", "oe").replace("å", "aa")

        self._attr_unique_id = f"{config_entry.entry_id}_{clean_name}_{machine_number}_status"
        self._attr_name = f"{machine_name} {machine_number} Status"
        self._attr_device_info = coordinator.device_info

        # Set icon based on machine type
        if machine_type in ["51", "85"]:
            self._attr_icon = "mdi:washing-machine"
        elif machine_type == "58":
            self._attr_icon = "mdi:tumble-dryer"
        else:
            self._attr_icon = "mdi:washing-machine"

    @property
    def native_value(self):
        """Return combined status + reservation info.
        
        v1.3.2: Combines Text1 (status) + ReservationInfo (time) for complete display.
        Also adds opening time for "Lukket indtil" status.
        """
        machine_data = self._get_machine_data()
        if not machine_data:
            return "Unknown"

        status = machine_data.get("Text1", "Unknown")
        reservation_info = machine_data.get("ReservationInfo", "")

        # Priority 1: Combine status + reservation_info if reservation_info has data
        if reservation_info and reservation_info.strip():
            return f"{status} {reservation_info}"
        
        # Priority 2: If "Lukket indtil" → add opening time from config
        elif "lukket indtil" in status.lower():
            opening_time = self.coordinator.config_entry.data.get("opening_time", "07:00")
            return f"{status} kl. {opening_time}"
        
        # Priority 3: Just status
        else:
            return status

    @property
    def extra_state_attributes(self):
        """Return machine details with structured data."""
        machine_data = self._get_machine_data()
        if not machine_data:
            return {}

        # Determine machine type name
        machine_type_name = "Unknown"
        if self._machine_type in ["51", "85"]:
            machine_type_name = "Washer"
        elif self._machine_type == "58":
            machine_type_name = "Dryer"

        # Determine boolean flags from status
        status_text = machine_data.get("Text1", "").lower()
        is_available = "ledig" in status_text or "available" in status_text
        is_reserved = "reserveret" in status_text or "reserved" in status_text
        is_running = "resttid" in status_text or "remaining" in status_text

        return {
            "machine_number": self._machine_number,
            "unit_name": self._machine_name,
            "machine_type": self._machine_type,
            "machine_type_name": machine_type_name,
            "is_available": is_available,
            "is_reserved": is_reserved,
            "is_running": is_running,
            "status_text": machine_data.get("Text1", ""),
            "reservation_info": machine_data.get("ReservationInfo", ""),  # Keep as separate attribute
            "color_code": machine_data.get("ColorCode", ""),
            "symbol_code": machine_data.get("SymbolCode", ""),
        }

    def _get_machine_data(self):
        """Get data for this specific machine from coordinator."""
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])

        for machine in machine_states:
            if machine.get("MachineNumber") == self._machine_number:
                return machine

        return None
