# VERSION = "1.1.0"
from homeassistant.components.sensor import SensorEntity
from homeassistant.const import CONF_NAME
from .const import DOMAIN

async def async_setup_entry(hass, config_entry, async_add_entities):
    """Set up the sensor platform."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]
    sensors = [
        MieleLogicReservationsSensor(coordinator, config_entry),
        MieleLogicWasherStatusSensor(coordinator, config_entry),
        MieleLogicDryerStatusSensor(coordinator, config_entry),
        MieleLogicAccountSensor(coordinator, config_entry),
    ]
    # Tilføj sensorer for hver maskine
    machine_states = coordinator.data.get("machine_states", {}).get("MachineStates", [])
    for machine in machine_states:
        sensors.append(MieleLogicMachineStatusSensor(coordinator, config_entry, machine))
    async_add_entities(sensors)

class MieleLogicReservationsSensor(SensorEntity):
    """Representation of a MieleLogic Reservations sensor."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_reservations"
        self._attr_name = "Reservations"
        self._attr_icon = "mdi:calendar"
        self._attr_device_info = coordinator.device_info

    @property
    def state(self):
        return str(len(self.coordinator.data.get("reservations", {}).get("Reservations", [])))

    @property
    def extra_state_attributes(self):
        return self.coordinator.data.get("reservations", {})

class MieleLogicWasherStatusSensor(SensorEntity):
    """Representation of a MieleLogic Washer Status sensor."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_washer_status"
        self._attr_name = "Washer Status"
        self._attr_icon = "mdi:washing-machine"
        self._attr_device_info = coordinator.device_info

    @property
    def state(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        washer_reservations = [r for r in reservations if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]]
        return "Reserved" if washer_reservations else "Idle"

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return {"washer_reservations": [r for r in reservations if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]]}

class MieleLogicDryerStatusSensor(SensorEntity):
    """Representation of a MieleLogic Dryer Status sensor."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_dryer_status"
        self._attr_name = "Dryer Status"
        self._attr_icon = "mdi:tumble-dryer"
        self._attr_device_info = coordinator.device_info

    @property
    def state(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        dryer_reservations = [r for r in reservations if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"]
        return "Reserved" if dryer_reservations else "Idle"

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return {"dryer_reservations": [r for r in reservations if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"]}

class MieleLogicMachineStatusSensor(SensorEntity):
    """Representation of a MieleLogic Machine Status sensor."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry, machine):
        self.coordinator = coordinator
        self._machine = machine
        self._attr_unique_id = f"{config_entry.entry_id}_machine_{machine['MachineNumber']}_status"
        self._attr_name = f"{machine['UnitName']} {machine['MachineNumber']}"
        self._attr_icon = "mdi:washing-machine" if machine["MachineType"] in ["51", "85"] else "mdi:tumble-dryer"
        self._attr_device_info = coordinator.device_info

    @property
    def state(self):
        return self._machine.get("Text1", "Unknown")

    @property
    def extra_state_attributes(self):
        return {
            "machine_number": self._machine.get("MachineNumber"),
            "unit_name": self._machine.get("UnitName"),
            "machine_type": self._machine.get("MachineType"),
            "machine_color": self._machine.get("MachineColor"),
            "machine_symbol": self._machine.get("MachineSymbol"),
            "reservation_info": self._machine.get("Text2"),
        }

class MieleLogicAccountSensor(SensorEntity):
    """Representation of a MieleLogic Account sensor."""
    
    _attr_has_entity_name = True
    
    def __init__(self, coordinator, config_entry):
        self.coordinator = coordinator
        self._attr_unique_id = f"{config_entry.entry_id}_account"
        self._attr_name = "Account"
        self._attr_icon = "mdi:account"
        self._attr_device_info = coordinator.device_info

    @property
    def state(self):
        account = self.coordinator.data.get("account_details", {}).get("Cards", [{}])[0]
        return account.get("Name", "Unknown")

    @property
    def extra_state_attributes(self):
        return self.coordinator.data.get("account_details", {})
