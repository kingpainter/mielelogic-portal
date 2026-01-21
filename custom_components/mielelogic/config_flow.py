# VERSION = "1.1.0"
import logging
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.core import callback
import aiohttp
from datetime import timedelta, datetime
from zoneinfo import ZoneInfo

from .const import (
    DOMAIN,
    CONF_USERNAME,
    CONF_PASSWORD,
    CONF_CLIENT_ID,
    CONF_LAUNDRY_ID,
    CONF_CLIENT_SECRET,
    AUTH_URL,
)

_LOGGER = logging.getLogger(__name__)

class MieleLogicConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for MieleLogic."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return MieleLogicOptionsFlowHandler(config_entry)

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Handle the initial step."""
        errors = {}
        if user_input is not None:
            try:
                _LOGGER.debug(
                    "Attempting authentication with username='%s', client_id='%s', laundry_id='%s', client_secret_provided=%s",
                    user_input[CONF_USERNAME],
                    user_input[CONF_CLIENT_ID],
                    user_input[CONF_LAUNDRY_ID],
                    "yes" if CONF_CLIENT_SECRET in user_input else "no",
                )
                auth_result = await self._authenticate(
                    username=user_input[CONF_USERNAME],
                    password=user_input[CONF_PASSWORD],
                    client_id=user_input[CONF_CLIENT_ID],
                    client_secret=user_input.get(CONF_CLIENT_SECRET, ""),
                )
                _LOGGER.debug("Authentication successful: access_token received, expires_in=%s", auth_result.get("expires_in"))
                entry_data = {
                    CONF_USERNAME: user_input[CONF_USERNAME],
                    CONF_PASSWORD: user_input[CONF_PASSWORD],
                    CONF_CLIENT_ID: user_input[CONF_CLIENT_ID],
                    CONF_LAUNDRY_ID: user_input[CONF_LAUNDRY_ID],
                    CONF_CLIENT_SECRET: user_input.get(CONF_CLIENT_SECRET, ""),
                    "access_token": auth_result["access_token"],
                    "refresh_token": auth_result.get("refresh_token"),
                    "expires_at": (
                        datetime.now(ZoneInfo("UTC")) + timedelta(seconds=auth_result.get("expires_in", 900))
                    ).isoformat(),
                }
                return self.async_create_entry(
                    title=user_input.get(CONF_NAME, "MieleLogic"),
                    data=entry_data,
                )
            except aiohttp.ClientResponseError as err:
                _LOGGER.error("Authentication failed: HTTP %s, %s", err.status, err.message)
                if err.status == 400 and "invalid_grant" in err.message:
                    errors["base"] = "invalid_auth"
                    _LOGGER.error(
                        "Invalid grant error (bad credentials). Possible causes: "
                        "1) Wrong username (try 'kongemaleren' with lowercase), "
                        "2) Incorrect or expired password (reset via mielelogic.com), "
                        "3) Invalid client_id (verify YV1ZAQ7BTE9IT2ZBZXLJ), "
                        "4) Rate limit (wait 30 min), "
                        "5) Incorrect scope (using 'DA'), "
                        "6) Account locked. Verify login on mielelogic.com."
                    )
                elif err.status == 401:
                    errors["base"] = "invalid_auth"
                elif err.status == 400:
                    errors["base"] = "bad_request"
                elif err.status in (500, 502, 503):
                    errors["base"] = "server_error"
                else:
                    errors["base"] = "unknown"
            except aiohttp.ClientConnectionError as err:
                _LOGGER.error("Connection error: %s", err)
                errors["base"] = "cannot_connect"
            except Exception as err:
                _LOGGER.error("Unexpected error: %s", err)
                errors["base"] = "unknown"

        # Show the configuration form
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_USERNAME, default="kongemaleren"): str,
                    vol.Required(CONF_PASSWORD): str,
                    vol.Required(CONF_CLIENT_ID, default="YV1ZAQ7BTE9IT2ZBZXLJ"): str,
                    vol.Required(CONF_LAUNDRY_ID, default="3444"): str,
                    vol.Optional(CONF_CLIENT_SECRET): str,
                    vol.Optional(CONF_NAME, default="MieleLogic"): str,
                }
            ),
            errors=errors,
        )

    async def _authenticate(self, username: str, password: str, client_id: str, client_secret: str = None) -> dict:
        """Authenticate with the MieleLogic API."""
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
        }
        data = {
            "grant_type": "password",
            "username": username.strip(),
            "password": password.strip(),
            "client_id": client_id.strip(),
            "scope": "DA",
        }
        if client_secret:
            data["client_secret"] = client_secret.strip()

        _LOGGER.debug("Auth request: headers=%s, data=%s", headers, {k: v for k, v in data.items() if k != "password"})

        try:
            session = async_get_clientsession(self.hass)
            async with session.post(AUTH_URL, headers=headers, data=data) as response:
                response_text = await response.text()
                _LOGGER.debug("Authentication response: HTTP %s, %s", response.status, response_text)
                if response.status != 200:
                    raise aiohttp.ClientResponseError(
                        response.request_info,
                        response.history,
                        status=response.status,
                        message=response_text,
                    )
                return await response.json()
        except aiohttp.ClientError as err:
            _LOGGER.error("Error during authentication: %s", err)
            raise


class MieleLogicOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for MieleLogic."""

    def __init__(self, config_entry):
        """Initialize options flow."""
        self._config_entry = config_entry

    async def async_step_init(self, user_input=None):
        """Manage the options."""
        errors = {}
        
        if user_input is not None:
            # Test new credentials
            try:
                _LOGGER.debug(
                    "Options flow: Testing new credentials for username='%s', client_id='%s'",
                    user_input[CONF_USERNAME],
                    user_input[CONF_CLIENT_ID],
                )
                auth_result = await self._authenticate(
                    username=user_input[CONF_USERNAME],
                    password=user_input[CONF_PASSWORD],
                    client_id=user_input[CONF_CLIENT_ID],
                    client_secret=user_input.get(CONF_CLIENT_SECRET, ""),
                )
                _LOGGER.debug("Options flow: Authentication successful")
                
                # Update config entry with new credentials and tokens
                new_data = {
                    **self._config_entry.data,
                    CONF_USERNAME: user_input[CONF_USERNAME],
                    CONF_PASSWORD: user_input[CONF_PASSWORD],
                    CONF_CLIENT_ID: user_input[CONF_CLIENT_ID],
                    CONF_CLIENT_SECRET: user_input.get(CONF_CLIENT_SECRET, ""),
                    "access_token": auth_result["access_token"],
                    "refresh_token": auth_result.get("refresh_token"),
                    "expires_at": (
                        datetime.now(ZoneInfo("UTC")) + timedelta(seconds=auth_result.get("expires_in", 900))
                    ).isoformat(),
                }
                
                self.hass.config_entries.async_update_entry(
                    self._config_entry,
                    data=new_data,
                )
                
                # Reload the integration to apply new credentials
                _LOGGER.info("Options flow: Reloading integration with new credentials")
                await self.hass.config_entries.async_reload(self._config_entry.entry_id)
                
                return self.async_create_entry(title="", data={})
                
            except aiohttp.ClientResponseError as err:
                _LOGGER.error("Options flow: Authentication failed: HTTP %s, %s", err.status, err.message)
                if err.status == 400 or err.status == 401:
                    errors["base"] = "invalid_auth"
                elif err.status in (500, 502, 503):
                    errors["base"] = "server_error"
                else:
                    errors["base"] = "unknown"
            except aiohttp.ClientConnectionError as err:
                _LOGGER.error("Options flow: Connection error: %s", err)
                errors["base"] = "cannot_connect"
            except Exception as err:
                _LOGGER.error("Options flow: Unexpected error: %s", err)
                errors["base"] = "unknown"

        # Show form with current values as defaults
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_USERNAME, default=self._config_entry.data.get(CONF_USERNAME, "")): str,
                vol.Required(CONF_PASSWORD): str,
                vol.Required(CONF_CLIENT_ID, default=self._config_entry.data.get(CONF_CLIENT_ID, "YV1ZAQ7BTE9IT2ZBZXLJ")): str,
                vol.Optional(CONF_CLIENT_SECRET, default=self._config_entry.data.get(CONF_CLIENT_SECRET, "")): str,
            }),
            errors=errors,
            description_placeholders={
                "laundry_id": self._config_entry.data.get(CONF_LAUNDRY_ID, ""),
            },
        )

    async def _authenticate(self, username: str, password: str, client_id: str, client_secret: str = None) -> dict:
        """Authenticate with the MieleLogic API."""
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7",
            "Connection": "keep-alive",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
        }
        data = {
            "grant_type": "password",
            "username": username.strip(),
            "password": password.strip(),
            "client_id": client_id.strip(),
            "scope": "DA",
        }
        if client_secret:
            data["client_secret"] = client_secret.strip()

        try:
            session = async_get_clientsession(self.hass)
            async with session.post(AUTH_URL, headers=headers, data=data) as response:
                response_text = await response.text()
                _LOGGER.debug("Options flow auth response: HTTP %s", response.status)
                if response.status != 200:
                    raise aiohttp.ClientResponseError(
                        response.request_info,
                        response.history,
                        status=response.status,
                        message=response_text,
                    )
                return await response.json()
        except aiohttp.ClientError as err:
            _LOGGER.error("Options flow: Error during authentication: %s", err)
            raise
