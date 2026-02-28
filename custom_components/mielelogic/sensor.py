# VERSION = "2.0.0"
"""
MieleLogic sensor platform.

v2.0.0 Update:
  - Refactored to use SensorEntityDescription dataclasses (Gold tier)
  - Entity names now driven by translation keys
  - State translations for washer/dryer status values
"""
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from homeassistant.components.sensor import (
    SensorEntity,
    SensorDeviceClass,
    SensorEntityDescription,
)
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


# ── Entity Descriptions ────────────────────────────────────────────────────────

@dataclass(frozen=True, kw_only=True)
class MieleLogicSensorEntityDescription(SensorEntityDescription):
    """Describe a MieleLogic sensor entity."""


SENSOR_DESCRIPTIONS: tuple[MieleLogicSensorEntityDescription, ...] = (
    MieleLogicSensorEntityDescription(
        key="reservations",
        translation_key="reservations",
        icon="mdi:calendar-clock",
    ),
    MieleLogicSensorEntityDescription(
        key="account_balance",
        translation_key="account_balance",
        device_class=SensorDeviceClass.MONETARY,
        native_unit_of_measurement="DKK",
        icon="mdi:cash",
    ),
    MieleLogicSensorEntityDescription(
        key="vaskehus_config",
        translation_key="vaskehus_config",
        icon="mdi:cog",
    ),
    MieleLogicSensorEntityDescription(
        key="washer_status",
        translation_key="washer_status",
        icon="mdi:washing-machine",
    ),
    MieleLogicSensorEntityDescription(
        key="dryer_status",
        translation_key="dryer_status",
        icon="mdi:tumble-dryer",
    ),
)


# ── Setup ──────────────────────────────────────────────────────────────────────

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up MieleLogic sensor platform."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]["coordinator"]
    desc_map = {d.key: d for d in SENSOR_DESCRIPTIONS}

    sensors = [
        MieleLogicReservationsSensor(coordinator, config_entry, desc_map["reservations"]),
        MieleLogicAccountBalanceSensor(coordinator, config_entry, desc_map["account_balance"]),
        MieleLogicConfigSensor(coordinator, config_entry, desc_map["vaskehus_config"]),
    ]

    machine_states = coordinator.data.get("machine_states", {}).get("MachineStates", [])
    has_washers = any(m.get("MachineType") in ["51", "85"] for m in machine_states)
    has_dryers = any(m.get("MachineType") == "58" for m in machine_states)

    if has_washers:
        sensors.append(MieleLogicWasherStatusSensor(coordinator, config_entry, desc_map["washer_status"]))
    if has_dryers:
        sensors.append(MieleLogicDryerStatusSensor(coordinator, config_entry, desc_map["dryer_status"]))

    for machine in machine_states:
        machine_number = machine.get("MachineNumber")
        machine_name = machine.get("UnitName", "Unknown")
        machine_type = machine.get("MachineType")
        if machine_number and machine_name:
            sensors.append(
                MieleLogicMachineStatusSensor(
                    coordinator, config_entry, machine_number, machine_name, machine_type
                )
            )

    async_add_entities(sensors)
    _LOGGER.debug("Added %d sensors for MieleLogic", len(sensors))


# ── Base class ─────────────────────────────────────────────────────────────────

class MieleLogicSensorBase(SensorEntity):
    """Base class for MieleLogic sensors using EntityDescription."""

    _attr_has_entity_name = True

    def __init__(self, coordinator, config_entry, description: MieleLogicSensorEntityDescription):
        self.coordinator = coordinator
        self.entity_description = description
        self._attr_unique_id = f"{config_entry.entry_id}_{description.key}"
        self._attr_device_info = coordinator.device_info


# ── Sensor implementations ─────────────────────────────────────────────────────

class MieleLogicReservationsSensor(MieleLogicSensorBase):
    """Sensor showing number of active reservations."""

    @property
    def native_value(self):
        return len(self.coordinator.data.get("reservations", {}).get("Reservations", []))

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        washer_count = sum(
            1 for r in reservations
            if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]
        )
        dryer_count = sum(
            1 for r in reservations
            if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"
        )
        next_reservation = None
        if reservations:
            nr = sorted(reservations, key=lambda r: r.get("Start", ""))[0]
            next_reservation = {
                "machine_name": nr.get("MachineName"),
                "machine_number": nr.get("MachineNumber"),
                "start_time": nr.get("Start"),
                "end_time": nr.get("End"),
                "duration_minutes": nr.get("Duration"),
            }
        today = datetime.now().date().isoformat()
        return {
            "total_count": len(reservations),
            "washer_count": washer_count,
            "dryer_count": dryer_count,
            "reservations_today": sum(1 for r in reservations if r.get("Start", "").startswith(today)),
            "next_reservation": next_reservation,
            "raw_data": reservations,
        }


class MieleLogicAccountBalanceSensor(MieleLogicSensorBase):
    """Sensor showing account balance."""

    @property
    def native_value(self):
        return self.coordinator.data.get("account_details", {}).get("Balance", 0)

    @property
    def extra_state_attributes(self):
        account = self.coordinator.data.get("account_details", {})
        return {
            "account_number": account.get("AccountNumber"),
            "customer_number": account.get("CustomerNumber"),
        }


class MieleLogicConfigSensor(MieleLogicSensorBase):
    """Sensor exposing vaskehus configuration."""

    @property
    def native_value(self):
        return "OK"

    @property
    def extra_state_attributes(self):
        data = self.coordinator.config_entry.data
        return {
            "klatvask_machine": data.get("klatvask_primary_machine") or 1,
            "storvask_machine": data.get("storvask_primary_machine") or 4,
            "klatvask_slots": data.get("klatvask_slots") or [
                {"start": "07:00", "end": "09:00"},
                {"start": "09:00", "end": "11:00"},
                {"start": "11:00", "end": "13:00"},
                {"start": "13:00", "end": "15:00"},
                {"start": "15:00", "end": "17:00"},
                {"start": "17:00", "end": "19:00"},
                {"start": "19:00", "end": "21:00"},
            ],
            "storvask_slots": data.get("storvask_slots") or [
                {"start": "07:00", "end": "09:00"},
                {"start": "09:00", "end": "12:00"},
                {"start": "12:00", "end": "14:00"},
                {"start": "14:00", "end": "17:00"},
                {"start": "17:00", "end": "19:00"},
                {"start": "19:00", "end": "21:00"},
            ],
        }


class MieleLogicWasherStatusSensor(MieleLogicSensorBase):
    """Sensor showing washer overview status.

    State values (translatable):
      all_available, partially_available, all_occupied, no_washers
    """

    @property
    def native_value(self):
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        washers = [m for m in machine_states if m.get("MachineType") in ["51", "85"]]
        if not washers:
            return "no_washers"
        available = sum(
            1 for m in washers
            if "ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower()
        )
        if available == len(washers):
            return "all_available"
        elif available == 0:
            return "all_occupied"
        return "partially_available"

    @property
    def extra_state_attributes(self):
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        washers = [m for m in machine_states if m.get("MachineType") in ["51", "85"]]
        return {
            "total_count": len(washers),
            "available_count": sum(1 for m in washers if "ledig" in m.get("Text1", "").lower()),
            "machines": [
                {"number": m.get("MachineNumber"), "name": m.get("UnitName"), "status": m.get("Text1")}
                for m in washers
            ],
        }


class MieleLogicDryerStatusSensor(MieleLogicSensorBase):
    """Sensor showing dryer overview status.

    State values (translatable):
      all_available, partially_available, all_occupied, no_dryers
    """

    @property
    def native_value(self):
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        dryers = [m for m in machine_states if m.get("MachineType") == "58"]
        if not dryers:
            return "no_dryers"
        available = sum(
            1 for m in dryers
            if "ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower()
        )
        if available == len(dryers):
            return "all_available"
        elif available == 0:
            return "all_occupied"
        return "partially_available"

    @property
    def extra_state_attributes(self):
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        dryers = [m for m in machine_states if m.get("MachineType") == "58"]
        return {
            "total_count": len(dryers),
            "available_count": sum(1 for m in dryers if "ledig" in m.get("Text1", "").lower()),
            "machines": [
                {"number": m.get("MachineNumber"), "name": m.get("UnitName"), "status": m.get("Text1")}
                for m in dryers
            ],
        }


class MieleLogicMachineStatusSensor(RestoreEntity, SensorEntity):
    """Sensor for individual machine status with countdown persistence."""

    _attr_has_entity_name = True

    def __init__(self, coordinator, config_entry, machine_number, machine_name, machine_type):
        self.coordinator = coordinator
        self._machine_number = machine_number
        self._machine_name = machine_name
        self._machine_type = machine_type
        self._countdown_started = None
        self._countdown_duration = None

        clean_name = (
            machine_name.lower()
            .replace(" ", "_")
            .replace("æ", "ae")
            .replace("ø", "oe")
            .replace("å", "aa")
        )
        self._attr_unique_id = f"{config_entry.entry_id}_{clean_name}_{machine_number}_status"
        self._attr_name = f"{machine_name} {machine_number} Status"
        self._attr_device_info = coordinator.device_info

        name_lower = machine_name.lower()
        if any(k in name_lower for k in ("klatvask", "storvask", "vask")):
            self._attr_icon = "mdi:washing-machine"
        elif any(k in name_lower for k in ("tørre", "dryer")):
            self._attr_icon = "mdi:tumble-dryer"
        elif machine_type in ["51", "85"]:
            self._attr_icon = "mdi:washing-machine"
        elif machine_type == "58":
            self._attr_icon = "mdi:tumble-dryer"
        else:
            self._attr_icon = "mdi:washing-machine"

    async def async_added_to_hass(self):
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state and last_state.attributes:
            if "countdown_started" in last_state.attributes:
                try:
                    self._countdown_started = datetime.fromisoformat(
                        last_state.attributes["countdown_started"]
                    )
                    self._countdown_duration = last_state.attributes.get("countdown_duration_minutes")
                except (ValueError, KeyError) as err:
                    _LOGGER.warning("Failed to restore countdown data: %s", err)

    @property
    def native_value(self):
        machine_data = self._get_machine_data()
        if not machine_data:
            return "unknown"
        status = machine_data.get("Text1", "Unknown")
        reservation_info = machine_data.get("ReservationInfo", "")
        if reservation_info and reservation_info.strip():
            return f"{status} {reservation_info}"
        if "lukket indtil" in status.lower():
            opening_time = self.coordinator.config_entry.data.get("opening_time", "07:00")
            return f"{status} kl. {opening_time}"
        return status

    @property
    def extra_state_attributes(self):
        machine_data = self._get_machine_data()
        if not machine_data:
            return {}

        name_lower = self._machine_name.lower()
        if any(k in name_lower for k in ("klatvask", "storvask", "vask")):
            machine_type_name, corrected_type = "Washer", "51"
        elif any(k in name_lower for k in ("tørre", "dryer")):
            machine_type_name, corrected_type = "Dryer", "58"
        elif self._machine_type in ["51", "85"]:
            machine_type_name, corrected_type = "Washer", self._machine_type
        elif self._machine_type == "58":
            machine_type_name, corrected_type = "Dryer", self._machine_type
        else:
            machine_type_name, corrected_type = "Unknown", self._machine_type

        status_text = machine_data.get("Text1", "").lower()
        is_available = "ledig" in status_text or "available" in status_text
        is_reserved = "reserveret" in status_text or "reserved" in status_text
        is_running = "resttid" in status_text or "remaining" in status_text
        is_closed = "lukket" in status_text or "closed" in status_text

        time_remaining_minutes = None
        if is_running:
            time_remaining_minutes = self._parse_time_remaining(status_text)
            if time_remaining_minutes is not None:
                now = datetime.now(ZoneInfo("UTC"))
                if (
                    self._countdown_started is None
                    or self._countdown_duration is None
                    or abs(self._countdown_duration - time_remaining_minutes) > 5
                ):
                    self._countdown_started = now
                    self._countdown_duration = time_remaining_minutes

        calculated_remaining = None
        if self._countdown_started and self._countdown_duration:
            now = datetime.now(ZoneInfo("UTC"))
            elapsed = (now - self._countdown_started).total_seconds() / 60
            calculated_remaining = max(0, int(self._countdown_duration - elapsed))
            if calculated_remaining == 0:
                self._countdown_started = None
                self._countdown_duration = None

        attributes = {
            "machine_number": self._machine_number,
            "unit_name": self._machine_name,
            "machine_type": corrected_type,
            "machine_type_name": machine_type_name,
            "is_available": is_available,
            "is_reserved": is_reserved,
            "is_running": is_running,
            "is_closed": is_closed,
            "status_text": machine_data.get("Text1", ""),
            "reservation_info": machine_data.get("ReservationInfo", ""),
            "color_code": machine_data.get("ColorCode", ""),
            "symbol_code": machine_data.get("SymbolCode", ""),
        }
        if time_remaining_minutes is not None:
            attributes["time_remaining_minutes"] = time_remaining_minutes
        if calculated_remaining is not None:
            attributes["calculated_remaining_minutes"] = calculated_remaining
        if self._countdown_started:
            attributes["countdown_started"] = self._countdown_started.isoformat()
            attributes["countdown_duration_minutes"] = self._countdown_duration
        return attributes

    def _parse_time_remaining(self, status_text: str) -> int | None:
        match = re.search(r'(\d+)\s*min', status_text, re.IGNORECASE)
        if match:
            minutes = int(match.group(1))
            hour_match = re.search(r'(\d+)\s*time', status_text, re.IGNORECASE)
            if hour_match:
                minutes += int(hour_match.group(1)) * 60
            return minutes
        return None

    def _get_machine_data(self):
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        for machine in machine_states:
            if machine.get("MachineNumber") == self._machine_number:
                return machine
        return None
