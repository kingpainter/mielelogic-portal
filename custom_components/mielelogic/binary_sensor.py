# VERSION = "2.0.0"
"""
MieleLogic binary sensor platform.

v2.0.0 Update:
  - Refactored to use BinarySensorEntityDescription dataclasses (Gold tier)
  - Entity names now driven by translation keys
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorDeviceClass,
    BinarySensorEntityDescription,
)
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_datetime(datetime_str: str) -> datetime:
    """Parse datetime string — handles naive (Copenhagen local) and aware datetimes."""
    if not datetime_str:
        raise ValueError("Empty datetime string")
    if "Z" in datetime_str or "+" in datetime_str or datetime_str.count("-") > 2:
        return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
    return datetime.fromisoformat(datetime_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))


# ── Entity Descriptions ────────────────────────────────────────────────────────

@dataclass(frozen=True, kw_only=True)
class MieleLogicBinarySensorEntityDescription(BinarySensorEntityDescription):
    """Describe a MieleLogic binary sensor entity."""


BINARY_SENSOR_DESCRIPTIONS: tuple[MieleLogicBinarySensorEntityDescription, ...] = (
    MieleLogicBinarySensorEntityDescription(
        key="has_reservation",
        translation_key="has_reservation",
        icon="mdi:calendar-check",
    ),
    MieleLogicBinarySensorEntityDescription(
        key="has_washer_reservation",
        translation_key="has_washer_reservation",
        icon="mdi:washing-machine",
    ),
    MieleLogicBinarySensorEntityDescription(
        key="has_dryer_reservation",
        translation_key="has_dryer_reservation",
        icon="mdi:tumble-dryer",
    ),
    MieleLogicBinarySensorEntityDescription(
        key="reservation_starting_soon",
        translation_key="reservation_starting_soon",
        device_class=BinarySensorDeviceClass.RUNNING,
        icon="mdi:clock-alert",
    ),
    MieleLogicBinarySensorEntityDescription(
        key="washer_available",
        translation_key="washer_available",
        device_class=BinarySensorDeviceClass.POWER,
    ),
    MieleLogicBinarySensorEntityDescription(
        key="dryer_available",
        translation_key="dryer_available",
        device_class=BinarySensorDeviceClass.POWER,
    ),
)


# ── Setup ──────────────────────────────────────────────────────────────────────

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up MieleLogic binary sensor platform."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]["coordinator"]
    desc_map = {d.key: d for d in BINARY_SENSOR_DESCRIPTIONS}

    sensors = [
        MieleLogicHasReservationBinarySensor(coordinator, config_entry, desc_map["has_reservation"]),
        MieleLogicHasWasherReservationBinarySensor(coordinator, config_entry, desc_map["has_washer_reservation"]),
        MieleLogicHasDryerReservationBinarySensor(coordinator, config_entry, desc_map["has_dryer_reservation"]),
        MieleLogicReservationStartingSoonBinarySensor(coordinator, config_entry, desc_map["reservation_starting_soon"]),
        MieleLogicWasherAvailableBinarySensor(coordinator, config_entry, desc_map["washer_available"]),
        MieleLogicDryerAvailableBinarySensor(coordinator, config_entry, desc_map["dryer_available"]),
    ]

    async_add_entities(sensors)
    _LOGGER.debug("Added %d binary sensors for MieleLogic", len(sensors))


# ── Base class ─────────────────────────────────────────────────────────────────

class MieleLogicBinarySensorBase(BinarySensorEntity):
    """Base class for MieleLogic binary sensors using EntityDescription."""

    _attr_has_entity_name = True

    def __init__(self, coordinator, config_entry, description: MieleLogicBinarySensorEntityDescription):
        self.coordinator = coordinator
        self.entity_description = description
        self._attr_unique_id = f"{config_entry.entry_id}_{description.key}"
        self._attr_device_info = coordinator.device_info


# ── Binary sensor implementations ─────────────────────────────────────────────

class MieleLogicHasReservationBinarySensor(MieleLogicBinarySensorBase):
    """Binary sensor — True if user has any active reservations."""

    @property
    def is_on(self) -> bool:
        return len(self.coordinator.data.get("reservations", {}).get("Reservations", [])) > 0

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return {
            "count": len(reservations),
            "reservation_ids": [r.get("ReservationId") for r in reservations],
        }


class MieleLogicHasWasherReservationBinarySensor(MieleLogicBinarySensorBase):
    """Binary sensor — True if user has a washer reservation."""

    @property
    def is_on(self) -> bool:
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return any(
            "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]
            for r in reservations
        )

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        washer_res = [
            r for r in reservations
            if "Washer" in r.get("MachineName", "") or r.get("MachineType") in ["51", "85"]
        ]
        return {"count": len(washer_res), "machines": [r.get("MachineName") for r in washer_res]}


class MieleLogicHasDryerReservationBinarySensor(MieleLogicBinarySensorBase):
    """Binary sensor — True if user has a dryer reservation."""

    @property
    def is_on(self) -> bool:
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        return any(
            "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"
            for r in reservations
        )

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        dryer_res = [
            r for r in reservations
            if "Dryer" in r.get("MachineName", "") or r.get("MachineType") == "58"
        ]
        return {"count": len(dryer_res), "machines": [r.get("MachineName") for r in dryer_res]}


class MieleLogicReservationStartingSoonBinarySensor(MieleLogicBinarySensorBase):
    """Binary sensor — True if a reservation starts within 15 minutes."""

    @property
    def is_on(self) -> bool:
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        now = datetime.now(ZoneInfo("UTC"))
        threshold = now + timedelta(minutes=15)
        for reservation in reservations:
            try:
                start_str = reservation.get("Start")
                if not start_str:
                    continue
                start_time = _parse_datetime(start_str)
                if now < start_time <= threshold:
                    return True
            except (ValueError, TypeError) as err:
                _LOGGER.warning("Failed to parse reservation start time '%s': %s", reservation.get("Start"), err)
        return False

    @property
    def extra_state_attributes(self):
        reservations = self.coordinator.data.get("reservations", {}).get("Reservations", [])
        now = datetime.now(ZoneInfo("UTC"))
        threshold = now + timedelta(minutes=15)
        upcoming = []
        for reservation in reservations:
            try:
                start_str = reservation.get("Start")
                if not start_str:
                    continue
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
        upcoming.sort(key=lambda r: r["minutes_until_start"])
        return {
            "count": len(upcoming),
            "upcoming_reservations": upcoming,
            "next_start_in_minutes": upcoming[0]["minutes_until_start"] if upcoming else None,
        }


class MieleLogicWasherAvailableBinarySensor(MieleLogicBinarySensorBase):
    """Binary sensor — True if at least one washer is available."""

    @property
    def is_on(self) -> bool:
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        return any(
            m.get("MachineType") in ["51", "85"]
            and ("ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower())
            for m in machine_states
        )

    @property
    def icon(self):
        return "mdi:washing-machine" if self.is_on else "mdi:washing-machine-off"

    @property
    def extra_state_attributes(self):
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
                {"number": m.get("MachineNumber"), "name": m.get("UnitName"), "status": m.get("Text1")}
                for m in available
            ],
        }


class MieleLogicDryerAvailableBinarySensor(MieleLogicBinarySensorBase):
    """Binary sensor — True if at least one dryer is available."""

    @property
    def is_on(self) -> bool:
        machine_states = self.coordinator.data.get("machine_states", {}).get("MachineStates", [])
        return any(
            m.get("MachineType") == "58"
            and ("ledig" in m.get("Text1", "").lower() or "available" in m.get("Text1", "").lower())
            for m in machine_states
        )

    @property
    def icon(self):
        return "mdi:tumble-dryer" if self.is_on else "mdi:tumble-dryer-off"

    @property
    def extra_state_attributes(self):
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
                {"number": m.get("MachineNumber"), "name": m.get("UnitName"), "status": m.get("Text1")}
                for m in available
            ],
        }
