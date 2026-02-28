# VERSION = "1.9.1"
import logging
import aiohttp
import voluptuous as vol
from datetime import datetime
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


# Default time slots
DEFAULT_STORVASK_SLOTS = [
    {"start": "07:00", "end": "09:00"},
    {"start": "09:00", "end": "12:00"},
    {"start": "12:00", "end": "14:00"},
    {"start": "14:00", "end": "17:00"},
    {"start": "17:00", "end": "19:00"},
    {"start": "19:00", "end": "21:00"},
]

DEFAULT_KLATVASK_SLOTS = [
    {"start": "07:00", "end": "09:00"},
    {"start": "09:00", "end": "11:00"},
    {"start": "11:00", "end": "13:00"},
    {"start": "13:00", "end": "15:00"},
    {"start": "15:00", "end": "17:00"},
    {"start": "17:00", "end": "19:00"},
    {"start": "19:00", "end": "21:00"},
]


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

                # Create entry with defaults
                return self.async_create_entry(
                    title="MieleLogic",
                    data={
                        CONF_USERNAME: user_input[CONF_USERNAME],
                        CONF_PASSWORD: user_input[CONF_PASSWORD],
                        CONF_CLIENT_ID: user_input[CONF_CLIENT_ID],
                        CONF_LAUNDRY_ID: user_input[CONF_LAUNDRY_ID],
                        CONF_CLIENT_SECRET: user_input.get(CONF_CLIENT_SECRET),
                        "sync_to_calendar": None,  # Default: disabled
                        "opening_time": user_input.get("opening_time", "07:00"),
                        "closing_time": user_input.get("closing_time", "21:00"),
                        # NEW v1.4.6: Vaskehus configuration
                        "klatvask_primary_machine": 1,
                        "storvask_primary_machine": 4,
                        "klatvask_slots": DEFAULT_KLATVASK_SLOTS,
                        "storvask_slots": DEFAULT_STORVASK_SLOTS,
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
    """Handle options flow for MieleLogic - FIVE OPTIONS."""

    async def async_step_init(self, user_input=None):
        """Show menu: credentials, calendar, laundry hours, machine config, time slots."""
        return self.async_show_menu(
            step_id="init",
            menu_options=["credentials", "calendar", "laundry_hours", "machine_config", "time_slots"],
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

    async def async_step_machine_config(self, user_input=None):
        """Configure primary machines for each vaskehus."""
        errors = {}

        if user_input is not None:
            try:
                # Update machine configuration
                new_data = dict(self.config_entry.data)
                new_data["klatvask_primary_machine"] = user_input["klatvask_machine"]
                new_data["storvask_primary_machine"] = user_input["storvask_machine"]

                self.hass.config_entries.async_update_entry(
                    self.config_entry, data=new_data
                )
                return self.async_create_entry(title="", data={})

            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        # Current settings
        current_klatvask = self.config_entry.data.get("klatvask_primary_machine", 1)
        current_storvask = self.config_entry.data.get("storvask_primary_machine", 4)

        return self.async_show_form(
            step_id="machine_config",
            data_schema=vol.Schema({
                vol.Required(
                    "klatvask_machine",
                    default=current_klatvask
                ): vol.In({1: "Maskine 1", 2: "Maskine 2"}),
                vol.Required(
                    "storvask_machine",
                    default=current_storvask
                ): vol.In({3: "Maskine 3", 4: "Maskine 4", 5: "Maskine 5"}),
            }),
            errors=errors,
            description_placeholders={
                "current_klatvask": str(current_klatvask),
                "current_storvask": str(current_storvask),
            },
        )

    async def async_step_time_slots(self, user_input=None):
        """Configure time slots menu."""
        if user_input is not None:
            action = user_input.get("action", "")
            
            if action == "edit_storvask":
                return await self.async_step_edit_storvask_slots()
            elif action == "edit_klatvask":
                return await self.async_step_edit_klatvask_slots()
            elif action == "done":
                return self.async_create_entry(title="", data={})

        # Get current slots
        storvask_slots = self.config_entry.data.get("storvask_slots", [])
        klatvask_slots = self.config_entry.data.get("klatvask_slots", [])

        return self.async_show_form(
            step_id="time_slots",
            data_schema=vol.Schema({
                vol.Required("action"): vol.In({
                    "edit_storvask": f"Rediger Storvask ({len(storvask_slots)} blokke)",
                    "edit_klatvask": f"Rediger Klatvask ({len(klatvask_slots)} blokke)",
                    "done": "Gem og luk",
                }),
            }),
        )

    async def async_step_edit_storvask_slots(self, user_input=None):
        """Edit Storvask time slots."""
        if user_input is not None:
            action = user_input.get("action", "")
            
            if action == "add_new":
                return await self.async_step_add_storvask_slot()
            elif action.startswith("delete_"):
                # Delete slot
                slot_index = int(action.split("_")[1])
                slots = list(self.config_entry.data.get("storvask_slots", []))
                if 0 <= slot_index < len(slots):
                    del slots[slot_index]
                    
                    new_data = dict(self.config_entry.data)
                    new_data["storvask_slots"] = slots
                    self.hass.config_entries.async_update_entry(
                        self.config_entry, data=new_data
                    )
                # Refresh same screen
                return await self.async_step_edit_storvask_slots()
            elif action == "back":
                return await self.async_step_time_slots()

        # Build current slots display
        slots = self.config_entry.data.get("storvask_slots", [])
        
        # Build action menu
        actions = {}
        for i, slot in enumerate(slots):
            duration = self._calculate_duration(slot["start"], slot["end"])
            actions[f"delete_{i}"] = f"🗑️ {slot['start']}-{slot['end']} ({duration})"
        
        actions["add_new"] = "➕ Tilføj ny tidsblok"
        actions["back"] = "⬅️ Tilbage"

        return self.async_show_form(
            step_id="edit_storvask_slots",
            data_schema=vol.Schema({
                vol.Required("action"): vol.In(actions),
            }),
        )

    async def async_step_edit_klatvask_slots(self, user_input=None):
        """Edit Klatvask time slots."""
        if user_input is not None:
            action = user_input.get("action", "")
            
            if action == "add_new":
                return await self.async_step_add_klatvask_slot()
            elif action.startswith("delete_"):
                # Delete slot
                slot_index = int(action.split("_")[1])
                slots = list(self.config_entry.data.get("klatvask_slots", []))
                if 0 <= slot_index < len(slots):
                    del slots[slot_index]
                    
                    new_data = dict(self.config_entry.data)
                    new_data["klatvask_slots"] = slots
                    self.hass.config_entries.async_update_entry(
                        self.config_entry, data=new_data
                    )
                # Refresh same screen
                return await self.async_step_edit_klatvask_slots()
            elif action == "back":
                return await self.async_step_time_slots()

        # Build current slots display
        slots = self.config_entry.data.get("klatvask_slots", [])
        
        # Build action menu
        actions = {}
        for i, slot in enumerate(slots):
            duration = self._calculate_duration(slot["start"], slot["end"])
            actions[f"delete_{i}"] = f"🗑️ {slot['start']}-{slot['end']} ({duration})"
        
        actions["add_new"] = "➕ Tilføj ny tidsblok"
        actions["back"] = "⬅️ Tilbage"

        return self.async_show_form(
            step_id="edit_klatvask_slots",
            data_schema=vol.Schema({
                vol.Required("action"): vol.In(actions),
            }),
        )

    async def async_step_add_storvask_slot(self, user_input=None):
        """Add new Storvask time slot."""
        errors = {}

        if user_input is not None:
            try:
                start = user_input["start_time"]
                end = user_input["end_time"]
                
                # Validate time format
                self._validate_time_format(start)
                self._validate_time_format(end)
                
                if start >= end:
                    errors["end_time"] = "end_before_start"
                else:
                    # Get existing slots
                    slots = list(self.config_entry.data.get("storvask_slots", []))
                    new_slot = {"start": start, "end": end}
                    
                    # Check for overlap
                    if self._check_slot_overlap(new_slot, slots):
                        errors["base"] = "slot_overlap"
                    else:
                        # Add slot
                        slots.append(new_slot)
                        
                        # Sort by start time
                        slots.sort(key=lambda s: s["start"])
                        
                        new_data = dict(self.config_entry.data)
                        new_data["storvask_slots"] = slots
                        self.hass.config_entries.async_update_entry(
                            self.config_entry, data=new_data
                        )
                        
                        return await self.async_step_edit_storvask_slots()
                    
            except ValueError:
                errors["base"] = "invalid_time_format"
            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="add_storvask_slot",
            data_schema=vol.Schema({
                vol.Required("start_time", default="07:00"): str,
                vol.Required("end_time", default="09:00"): str,
            }),
            errors=errors,
        )

    async def async_step_add_klatvask_slot(self, user_input=None):
        """Add new Klatvask time slot."""
        errors = {}

        if user_input is not None:
            try:
                start = user_input["start_time"]
                end = user_input["end_time"]
                
                # Validate time format
                self._validate_time_format(start)
                self._validate_time_format(end)
                
                if start >= end:
                    errors["end_time"] = "end_before_start"
                else:
                    # Get existing slots
                    slots = list(self.config_entry.data.get("klatvask_slots", []))
                    new_slot = {"start": start, "end": end}
                    
                    # Check for overlap
                    if self._check_slot_overlap(new_slot, slots):
                        errors["base"] = "slot_overlap"
                    else:
                        # Add slot
                        slots.append(new_slot)
                        
                        # Sort by start time
                        slots.sort(key=lambda s: s["start"])
                        
                        new_data = dict(self.config_entry.data)
                        new_data["klatvask_slots"] = slots
                        self.hass.config_entries.async_update_entry(
                            self.config_entry, data=new_data
                        )
                        
                        return await self.async_step_edit_klatvask_slots()
                    
            except ValueError:
                errors["base"] = "invalid_time_format"
            except Exception as err:
                _LOGGER.exception("Unexpected exception: %s", err)
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="add_klatvask_slot",
            data_schema=vol.Schema({
                vol.Required("start_time", default="07:00"): str,
                vol.Required("end_time", default="09:00"): str,
            }),
            errors=errors,
        )

    def _calculate_duration(self, start: str, end: str) -> str:
        """Calculate duration between two times."""
        try:
            start_dt = datetime.strptime(start, "%H:%M")
            end_dt = datetime.strptime(end, "%H:%M")
            
            duration_minutes = int((end_dt - start_dt).total_seconds() / 60)
            hours = duration_minutes // 60
            minutes = duration_minutes % 60
            
            if minutes == 0:
                return f"{hours}t"
            else:
                return f"{hours}t {minutes}min"
        except Exception:
            return "?"

    def _validate_time_format(self, time_str: str):
        """Validate time format HH:MM."""
        try:
            datetime.strptime(time_str, "%H:%M")
        except ValueError:
            raise ValueError(f"Invalid time format: {time_str}")

    def _check_slot_overlap(self, new_slot: dict, existing_slots: list) -> bool:
        """Check if new slot overlaps with any existing slot.
        
        Returns True if overlap detected, False otherwise.
        
        Overlap occurs when:
        - new_start < existing_end AND new_end > existing_start
        
        Example overlaps:
        - New: 08:00-10:00, Existing: 07:00-09:00 → Overlap (08:00 < 09:00 and 10:00 > 07:00)
        - New: 09:00-11:00, Existing: 09:00-11:00 → Overlap (exact match)
        
        Example non-overlaps:
        - New: 09:00-11:00, Existing: 07:00-09:00 → OK (adjacent, 09:00 == 09:00 is boundary)
        """
        try:
            new_start = datetime.strptime(new_slot["start"], "%H:%M")
            new_end = datetime.strptime(new_slot["end"], "%H:%M")
            
            for slot in existing_slots:
                slot_start = datetime.strptime(slot["start"], "%H:%M")
                slot_end = datetime.strptime(slot["end"], "%H:%M")
                
                # Check for overlap: new slot starts before existing ends
                # AND new slot ends after existing starts
                # Note: We allow adjacent slots (end == start is OK)
                if new_start < slot_end and new_end > slot_start:
                    _LOGGER.warning(
                        "⚠️ Overlap detected: %s-%s overlaps with %s-%s",
                        new_slot["start"],
                        new_slot["end"],
                        slot["start"],
                        slot["end"],
                    )
                    return True  # Overlap detected
            
            return False  # No overlap
        
        except Exception as err:
            _LOGGER.error("Error checking slot overlap: %s", err)
            return False  # Don't block on error


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
