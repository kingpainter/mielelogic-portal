# VERSION = "1.3.2"
import logging
import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError

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

    async def async_step_user(self, user_input=None):
        """Handle the initial step - ONLY credentials, NO calendar."""
        errors = {}

        if user_input is not None:
            try:
                # Validate credentials by attempting authentication
                await self._test_credentials(
                    user_input[CONF_USERNAME],
                    user_input[CONF_PASSWORD],
                    user_input[CONF_CLIENT_ID],
                    user_input.get(CONF_CLIENT_SECRET),
                )

                # Check if already configured
                await self.async_set_unique_id(
                    f"{user_input[CONF_USERNAME]}_{user_input[CONF_LAUNDRY_ID]}"
                )
                self._abort_if_unique_id_configured()

                # Create entry with calendar sync disabled by default
                return self.async_create_entry(
                    title="MieleLogic Portal",
                    data={
                        CONF_USERNAME: user_input[CONF_USERNAME],
                        CONF_PASSWORD: user_input[CONF_PASSWORD],
                        CONF_CLIENT_ID: user_input[CONF_CLIENT_ID],
                        CONF_LAUNDRY_ID: user_input[CONF_LAUNDRY_ID],
                        CONF_CLIENT_SECRET: user_input.get(CONF_CLIENT_SECRET),
                        "sync_to_calendar": None,  # Default: disabled
                        "opening_time": user_input.get("opening_time", "07:00"),
                        "closing_time": user_input.get("closing_time", "21:00"),
                    },
                )

            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except BadRequest:
                errors["base"] = "bad_request"
            except ServerError:
                errors["base"] = "server_error"
            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        # Show form with credentials + opening hours
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_USERNAME): str,
                    vol.Required(CONF_PASSWORD): str,
                    vol.Required(
                        CONF_CLIENT_ID, default="YV1ZAQ7BTE9IT2ZBZXLJ"
                    ): str,
                    vol.Required(CONF_LAUNDRY_ID): str,
                    vol.Optional(CONF_CLIENT_SECRET): str,
                    vol.Optional("opening_time", default="07:00"): str,
                    vol.Optional("closing_time", default="21:00"): str,
                }
            ),
            errors=errors,
        )

    async def _test_credentials(
        self, username: str, password: str, client_id: str, client_secret: str = None
    ):
        """Validate credentials by attempting to get a token."""
        data = {
            "grant_type": "password",
            "username": username,
            "password": password,
            "client_id": client_id,
            "scope": "DA",
        }

        if client_secret:
            data["client_secret"] = client_secret

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    AUTH_URL, data=data, headers=headers, timeout=10
                ) as response:
                    if response.status == 400:
                        error_text = await response.text()
                        if "invalid_grant" in error_text:
                            raise InvalidAuth
                        raise BadRequest
                    elif response.status == 401:
                        raise InvalidAuth
                    elif response.status >= 500:
                        raise ServerError
                    elif response.status != 200:
                        raise CannotConnect

                    result = await response.json()
                    if "access_token" not in result:
                        raise InvalidAuth

        except aiohttp.ClientError as err:
            _LOGGER.error("Network error during authentication: %s", err)
            raise CannotConnect from err
        except Exception as err:
            _LOGGER.error("Unexpected error during authentication: %s", err)
            raise

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Get the options flow for this handler."""
        return MieleLogicOptionsFlowHandler()


class MieleLogicOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for MieleLogic - THREE SEPARATE OPTIONS."""

    async def async_step_init(self, user_input=None):
        """Show menu: credentials, calendar, or laundry hours."""
        return self.async_show_menu(
            step_id="init",
            menu_options=["credentials", "calendar", "laundry_hours"],
        )

    async def async_step_credentials(self, user_input=None):
        """Update login credentials - SEPARATE from calendar."""
        errors = {}

        if user_input is not None:
            try:
                # Validate new credentials
                await self._test_credentials(
                    user_input[CONF_USERNAME],
                    user_input[CONF_PASSWORD],
                    user_input[CONF_CLIENT_ID],
                    user_input.get(CONF_CLIENT_SECRET),
                )

                # Update ONLY credentials, keep existing calendar settings
                new_data = dict(self.config_entry.data)
                new_data[CONF_USERNAME] = user_input[CONF_USERNAME]
                new_data[CONF_PASSWORD] = user_input[CONF_PASSWORD]
                new_data[CONF_CLIENT_ID] = user_input[CONF_CLIENT_ID]
                
                if CONF_CLIENT_SECRET in user_input:
                    new_data[CONF_CLIENT_SECRET] = user_input[CONF_CLIENT_SECRET]

                # DON'T touch calendar settings!
                self.hass.config_entries.async_update_entry(
                    self.config_entry, data=new_data
                )

                return self.async_create_entry(title="", data={})

            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except CannotConnect:
                errors["base"] = "cannot_connect"
            except ServerError:
                errors["base"] = "server_error"
            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        # Get current data with safe defaults
        current_username = self.config_entry.data.get(CONF_USERNAME, "")
        current_client_id = self.config_entry.data.get(CONF_CLIENT_ID, "YV1ZAQ7BTE9IT2ZBZXLJ")
        current_client_secret = self.config_entry.data.get(CONF_CLIENT_SECRET, "")

        # Show form with current credentials
        return self.async_show_form(
            step_id="credentials",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_USERNAME,
                        default=current_username,
                    ): str,
                    vol.Required(CONF_PASSWORD): str,
                    vol.Required(
                        CONF_CLIENT_ID,
                        default=current_client_id,
                    ): str,
                    vol.Optional(
                        CONF_CLIENT_SECRET,
                        default=current_client_secret,
                    ): str,
                }
            ),
            errors=errors,
            description_placeholders={
                "username": current_username or "unknown",
            },
        )

    async def async_step_calendar(self, user_input=None):
        """Configure calendar sync - SEPARATE from credentials."""
        errors = {}

        if user_input is not None:
            try:
                # Update ONLY calendar settings, keep existing credentials
                new_data = dict(self.config_entry.data)

                if user_input.get("enable_sync"):
                    calendar_entity = user_input.get("calendar_entity")
                    
                    # Validate calendar entity exists
                    if calendar_entity and not self.hass.states.get(calendar_entity):
                        errors["base"] = "calendar_not_found"
                    else:
                        new_data["sync_to_calendar"] = calendar_entity
                else:
                    # Disable sync
                    new_data["sync_to_calendar"] = None

                if not errors:
                    # DON'T touch credentials!
                    self.hass.config_entries.async_update_entry(
                        self.config_entry, data=new_data
                    )
                    return self.async_create_entry(title="", data={})

            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        # Get all calendar entities (exclude MieleLogic's own calendar)
        all_calendars = [
            entity_id
            for entity_id in self.hass.states.async_entity_ids("calendar")
            if "mielelogic" not in entity_id.lower()
        ]

        # Current settings with safe defaults
        current_calendar = self.config_entry.data.get("sync_to_calendar")
        sync_enabled = bool(current_calendar)

        # Build schema dynamically based on available calendars
        schema_dict = {
            vol.Optional("enable_sync", default=sync_enabled): bool,
        }

        if all_calendars:
            # Add dropdown only if calendars exist
            default_cal = current_calendar if current_calendar in all_calendars else (all_calendars[0] if all_calendars else "")
            schema_dict[vol.Optional(
                "calendar_entity",
                default=default_cal
            )] = vol.In(all_calendars)

        return self.async_show_form(
            step_id="calendar",
            data_schema=vol.Schema(schema_dict),
            errors=errors,
            description_placeholders={
                "current_calendar": current_calendar or "None",
                "num_calendars": str(len(all_calendars)),
            },
        )

    async def async_step_laundry_hours(self, user_input=None):
        """Configure laundry opening/closing hours."""
        errors = {}

        if user_input is not None:
            try:
                # Update ONLY laundry hours, keep everything else
                new_data = dict(self.config_entry.data)
                new_data["opening_time"] = user_input.get("opening_time", "07:00")
                new_data["closing_time"] = user_input.get("closing_time", "21:00")

                # Update entry
                self.hass.config_entries.async_update_entry(
                    self.config_entry, data=new_data
                )
                return self.async_create_entry(title="", data={})

            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        # Current settings
        current_opening = self.config_entry.data.get("opening_time", "07:00")
        current_closing = self.config_entry.data.get("closing_time", "21:00")

        return self.async_show_form(
            step_id="laundry_hours",
            data_schema=vol.Schema({
                vol.Optional("opening_time", default=current_opening): str,
                vol.Optional("closing_time", default=current_closing): str,
            }),
            errors=errors,
            description_placeholders={
                "current_opening": current_opening,
                "current_closing": current_closing,
            },
        )

    async def _test_credentials(
        self, username: str, password: str, client_id: str, client_secret: str = None
    ):
        """Validate credentials by attempting to get a token."""
        data = {
            "grant_type": "password",
            "username": username,
            "password": password,
            "client_id": client_id,
            "scope": "DA",
        }

        if client_secret:
            data["client_secret"] = client_secret

        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    AUTH_URL, data=data, headers=headers, timeout=10
                ) as response:
                    if response.status == 400:
                        error_text = await response.text()
                        if "invalid_grant" in error_text:
                            raise InvalidAuth
                        raise BadRequest
                    elif response.status == 401:
                        raise InvalidAuth
                    elif response.status >= 500:
                        raise ServerError
                    elif response.status != 200:
                        raise CannotConnect

                    result = await response.json()
                    if "access_token" not in result:
                        raise InvalidAuth

        except aiohttp.ClientError as err:
            _LOGGER.error("Network error during authentication: %s", err)
            raise CannotConnect from err


class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""


class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""


class BadRequest(HomeAssistantError):
    """Error to indicate bad request."""


class ServerError(HomeAssistantError):
    """Error to indicate server error."""
