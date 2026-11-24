"""Tests for the MieleLogic config flow (config-flow-test-coverage rule)."""
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.mielelogic.config_flow import CannotConnect, InvalidAuth
from custom_components.mielelogic.const import DOMAIN

USER_INPUT = {
    "username": "test@example.com",
    "password": "secret",
    "client_id": "test-client",
    "laundry_id": "3444",
}

CREDENTIALS_PATCH = "custom_components.mielelogic.config_flow.MieleLogicConfigFlow._test_credentials"
SETUP_PATCH = "custom_components.mielelogic.async_setup_entry"


@pytest.fixture(autouse=True)
def _mark_manifest_dependencies_loaded(hass):
    """The manifest depends on frontend and panel_custom; mark them loaded so
    HA's dependency check passes without setting up the real components."""
    hass.config.components.update({"frontend", "panel_custom"})


async def _start_flow(hass):
    """Start a user flow and return the initial form result."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] == FlowResultType.FORM
    assert result["step_id"] == "user"
    return result


async def test_user_flow_creates_entry(hass, enable_custom_integrations):
    """A valid login creates a config entry with the expected data."""
    with patch(CREDENTIALS_PATCH, new=AsyncMock(return_value=None)), patch(
        SETUP_PATCH, return_value=True
    ):
        result = await _start_flow(hass)
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], USER_INPUT
        )

    assert result["type"] == FlowResultType.CREATE_ENTRY
    assert result["title"] == "MieleLogic"
    assert result["data"]["username"] == USER_INPUT["username"]
    assert result["data"]["laundry_id"] == USER_INPUT["laundry_id"]
    assert result["data"]["klatvask_primary_machine"] == 1
    assert result["data"]["storvask_primary_machine"] == 4


async def test_user_flow_invalid_auth_shows_error(hass, enable_custom_integrations):
    """Wrong credentials keep the form open with an invalid_auth error."""
    with patch(CREDENTIALS_PATCH, new=AsyncMock(side_effect=InvalidAuth)):
        result = await _start_flow(hass)
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], USER_INPUT
        )

    assert result["type"] == FlowResultType.FORM
    assert result["errors"]["base"] == "invalid_auth"


async def test_user_flow_cannot_connect_shows_error(hass, enable_custom_integrations):
    """Network failure keeps the form open with a cannot_connect error."""
    with patch(CREDENTIALS_PATCH, new=AsyncMock(side_effect=CannotConnect)):
        result = await _start_flow(hass)
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], USER_INPUT
        )

    assert result["type"] == FlowResultType.FORM
    assert result["errors"]["base"] == "cannot_connect"


async def test_user_flow_duplicate_laundry_aborts(hass, enable_custom_integrations):
    """The same username + laundry_id cannot be configured twice."""
    with patch(CREDENTIALS_PATCH, new=AsyncMock(return_value=None)), patch(
        SETUP_PATCH, return_value=True
    ):
        first = await _start_flow(hass)
        await hass.config_entries.flow.async_configure(first["flow_id"], USER_INPUT)

        second = await _start_flow(hass)
        result = await hass.config_entries.flow.async_configure(
            second["flow_id"], USER_INPUT
        )

    assert result["type"] == FlowResultType.ABORT
    assert result["reason"] == "already_configured"


RECONFIGURE_INPUT = {
    "username": "test@example.com",
    "password": "new-secret",
    "client_id": "test-client",
    "laundry_id": "5555",
}


def _existing_entry() -> MockConfigEntry:
    """A configured entry (laundry 3444) that reconfigure should update."""
    return MockConfigEntry(
        domain=DOMAIN,
        title="MieleLogic",
        unique_id="test@example.com_3444",
        data={
            **USER_INPUT,
            "klatvask_primary_machine": 1,
            "storvask_primary_machine": 4,
        },
    )


async def _start_reconfigure(hass, entry):
    """Start the reconfigure flow for an existing entry and return the form."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={"source": config_entries.SOURCE_RECONFIGURE, "entry_id": entry.entry_id},
    )
    assert result["type"] == FlowResultType.FORM
    assert result["step_id"] == "reconfigure"
    return result


async def test_reconfigure_updates_entry(hass, enable_custom_integrations):
    """Reconfigure changes credentials and laundry ID, and keeps other settings."""
    entry = _existing_entry()
    entry.add_to_hass(hass)

    with patch(CREDENTIALS_PATCH, new=AsyncMock(return_value=None)), patch(
        SETUP_PATCH, return_value=True
    ):
        result = await _start_reconfigure(hass, entry)
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], RECONFIGURE_INPUT
        )

    assert result["type"] == FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    assert entry.data["password"] == "new-secret"
    assert entry.data["laundry_id"] == "5555"
    # Settings that are not part of the reconfigure form are preserved
    assert entry.data["klatvask_primary_machine"] == 1
    assert entry.data["storvask_primary_machine"] == 4


async def test_reconfigure_invalid_auth_shows_error(hass, enable_custom_integrations):
    """Wrong credentials keep the reconfigure form open and change nothing."""
    entry = _existing_entry()
    entry.add_to_hass(hass)

    with patch(CREDENTIALS_PATCH, new=AsyncMock(side_effect=InvalidAuth)):
        result = await _start_reconfigure(hass, entry)
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"], RECONFIGURE_INPUT
        )

    assert result["type"] == FlowResultType.FORM
    assert result["errors"]["base"] == "invalid_auth"
    assert entry.data["laundry_id"] == "3444"
