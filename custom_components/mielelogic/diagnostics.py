# VERSION = "1.7.0"
"""Diagnostics support for MieleLogic integration.

Provides diagnostic information for troubleshooting, including:
- Configuration (sanitized, no passwords)
- Coordinator data (API responses)
- Entity states
- Cache status
"""
from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN, CONF_PASSWORD, CONF_CLIENT_SECRET

# Keys to redact from diagnostics
TO_REDACT = {
    CONF_PASSWORD,
    CONF_CLIENT_SECRET,
    "access_token",
    "refresh_token",
    "AccountNumber",
    "CustomerNumber",
}


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant, entry: ConfigEntry
) -> dict[str, Any]:
    """Return diagnostics for a config entry.
    
    This function collects diagnostic information that can help troubleshoot
    issues with the MieleLogic integration. All sensitive data (passwords,
    tokens, account numbers) are automatically redacted.
    """
    coordinator = hass.data[DOMAIN][entry.entry_id]

    # Get all sensor states
    entities = {}
    for entity_id in hass.states.async_entity_ids(DOMAIN):
        state = hass.states.get(entity_id)
        if state:
            entities[entity_id] = {
                "state": state.state,
                "attributes": dict(state.attributes),
            }

    # Build diagnostics data
    diagnostics_data = {
        "config_entry": {
            "entry_id": entry.entry_id,
            "version": entry.version,
            "domain": entry.domain,
            "title": entry.title,
            "data": async_redact_data(entry.data, TO_REDACT),
        },
        "coordinator": {
            "last_update_success": coordinator.last_update_success,
            "update_interval": str(coordinator.update_interval),
            "data_available": coordinator.data is not None,
        },
        "api_data": {
            "reservations": _redact_reservations(
                coordinator.data.get("reservations", {})
            ),
            "machine_states": _redact_machine_states(
                coordinator.data.get("machine_states", {})
            ),
            "account_details": async_redact_data(
                coordinator.data.get("account_details", {}), TO_REDACT
            ),
        },
        "cache_status": {
            "cache_keys": list(coordinator._cache.keys()) if hasattr(coordinator, '_cache') else [],
            "cache_count": len(coordinator._cache) if hasattr(coordinator, '_cache') else 0,
        },
        "token_status": {
            "has_access_token": coordinator.access_token is not None,
            "has_refresh_token": coordinator.refresh_token is not None,
            "token_expiry": str(coordinator.token_expiry) if coordinator.token_expiry else None,
        },
        "entities": entities,
        "integration_version": "1.3.2",
    }

    return diagnostics_data


def _redact_reservations(reservations_data: dict) -> dict:
    """Redact sensitive information from reservations data.
    
    Keeps structure and machine info, but removes any personal identifiers.
    """
    if not reservations_data:
        return {}

    redacted = {
        "count": len(reservations_data.get("Reservations", [])),
        "reservations": [],
    }

    for reservation in reservations_data.get("Reservations", []):
        redacted["reservations"].append({
            "MachineName": reservation.get("MachineName"),
            "MachineNumber": reservation.get("MachineNumber"),
            "MachineType": reservation.get("MachineType"),
            "Start": reservation.get("Start"),
            "End": reservation.get("End"),
            "Duration": reservation.get("Duration"),
            # Redact ReservationId (might contain personal info)
            "ReservationId": "REDACTED" if reservation.get("ReservationId") else None,
        })

    return redacted


def _redact_machine_states(machine_states_data: dict) -> dict:
    """Redact sensitive information from machine states data.
    
    Keeps machine status and availability, structure intact.
    """
    if not machine_states_data:
        return {}

    redacted = {
        "count": len(machine_states_data.get("MachineStates", [])),
        "machine_states": [],
    }

    for machine in machine_states_data.get("MachineStates", []):
        redacted["machine_states"].append({
            "MachineNumber": machine.get("MachineNumber"),
            "UnitName": machine.get("UnitName"),
            "MachineType": machine.get("MachineType"),
            "Text1": machine.get("Text1"),
            "ReservationInfo": machine.get("ReservationInfo"),
            "ColorCode": machine.get("ColorCode"),
            "SymbolCode": machine.get("SymbolCode"),
        })

    return redacted
