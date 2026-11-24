# VERSION = "2.6.6"
"""Tests for dynamically added machine status sensors.

A machine number that appears in a later coordinator update gets its
sensor without a reload, and each machine is added exactly once.
"""
from __future__ import annotations

from unittest.mock import MagicMock

from custom_components.mielelogic.const import DOMAIN
from custom_components.mielelogic.sensor import (
    MieleLogicMachineStatusSensor,
    async_setup_entry,
)


def _machine(number: int, name: str, machine_type: str = "51") -> dict:
    return {"MachineNumber": number, "UnitName": name, "MachineType": machine_type}


def _set_machines(coord: MagicMock, machines: list[dict]) -> None:
    coord.data = {
        "machine_states": {"MachineStates": machines},
        "reservations": {"Reservations": [], "MaxUserReservations": 2},
        "account_balance": {"Balance": 0},
    }


async def test_new_machine_is_added_without_reload() -> None:
    """A machine that appears in a later update gets a sensor via the listener."""
    coord = MagicMock()
    _set_machines(coord, [_machine(1, "Vaskemaskine 1")])

    entry = MagicMock(entry_id="entry-1")
    hass = MagicMock()
    hass.data = {DOMAIN: {"entry-1": {"coordinator": coord}}}

    add_entities = MagicMock()
    await async_setup_entry(hass, entry, add_entities)

    # The listener is registered once and fires on every coordinator update
    coord.async_add_listener.assert_called_once()
    listener = coord.async_add_listener.call_args.args[0]

    # Initial setup adds the base sensors, then the machine that was already there
    initial = add_entities.call_args_list[1].args[0]
    assert sum(isinstance(e, MieleLogicMachineStatusSensor) for e in initial) == 1

    # Machine 2 shows up in a later update
    add_entities.reset_mock()
    _set_machines(coord, [_machine(1, "Vaskemaskine 1"), _machine(2, "Vaskemaskine 2")])
    listener()

    add_entities.assert_called_once()
    new = add_entities.call_args.args[0]
    assert len(new) == 1
    assert isinstance(new[0], MieleLogicMachineStatusSensor)


async def test_machine_is_not_added_twice() -> None:
    """Repeated coordinator updates with the same machines add nothing new."""
    coord = MagicMock()
    _set_machines(coord, [_machine(1, "Vaskemaskine 1")])

    entry = MagicMock(entry_id="entry-1")
    hass = MagicMock()
    hass.data = {DOMAIN: {"entry-1": {"coordinator": coord}}}

    add_entities = MagicMock()
    await async_setup_entry(hass, entry, add_entities)
    listener = coord.async_add_listener.call_args.args[0]

    add_entities.reset_mock()
    listener()
    listener()
    add_entities.assert_not_called()


async def test_machine_without_name_is_skipped() -> None:
    """A machine entry without a usable name does not create a sensor."""
    coord = MagicMock()
    _set_machines(coord, [_machine(5, "")])

    entry = MagicMock(entry_id="entry-1")
    hass = MagicMock()
    hass.data = {DOMAIN: {"entry-1": {"coordinator": coord}}}

    add_entities = MagicMock()
    await async_setup_entry(hass, entry, add_entities)

    machine_sensors = [
        e
        for call in add_entities.call_args_list
        for e in call.args[0]
        if isinstance(e, MieleLogicMachineStatusSensor)
    ]
    assert machine_sensors == []
