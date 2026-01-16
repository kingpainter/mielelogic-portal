# VERSION = "1.1.0"
import aiohttp
import asyncio
import logging
from datetime import timedelta, datetime
from zoneinfo import ZoneInfo
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.device_registry import DeviceInfo
from .const import DOMAIN, VERSION, CONF_LAUNDRY_ID, CONF_USERNAME, CONF_PASSWORD, CONF_CLIENT_ID, CONF_CLIENT_SECRET, AUTH_URL

_LOGGER = logging.getLogger(__name__)

class MieleLogicDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching MieleLogic data."""

    def __init__(self, hass: HomeAssistant, config_entry):
        """Initialize the coordinator."""
        self.hass = hass
        self.config_entry = config_entry
        if CONF_LAUNDRY_ID not in config_entry.data:
            _LOGGER.error("Missing '%s' in config entry data: %s", CONF_LAUNDRY_ID, config_entry.data)
            raise ValueError(f"Configuration entry missing required key: {CONF_LAUNDRY_ID}")
        self.laundry_id = config_entry.data[CONF_LAUNDRY_ID]
        self.access_token = config_entry.data.get("access_token")
        self.expires_at = None
        if config_entry.data.get("expires_at"):
            try:
                self.expires_at = datetime.fromisoformat(config_entry.data["expires_at"].replace("Z", "+00:00"))
                _LOGGER.debug("Parsed expires_at from config: %s", self.expires_at)
            except ValueError as err:
                _LOGGER.error("Invalid expires_at format in config: %s, error: %s", config_entry.data["expires_at"], err)
                self.expires_at = None
        
        # Create device info for all sensors to link to
        self.device_info = DeviceInfo(
            identifiers={(DOMAIN, f"laundry_{self.laundry_id}")},
            name=f"MieleLogic Vaskeri {self.laundry_id}",
            manufacturer="MieleLogic",
            model="Laundry Management System",
            sw_version=VERSION,
            configuration_url="https://mielelogic.com",
        )
        _LOGGER.debug("Created device info for laundry %s", self.laundry_id)
        
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=5),
        )

    async def _refresh_token(self):
        """Refresh access token using refresh_token if available, else password grant."""
        refresh_token = self.config_entry.data.get("refresh_token")
        
        # Strategy: Try refresh_token first (if available), fallback to password grant
        if refresh_token:
            _LOGGER.info("Token refresh: Attempting with refresh_token (efficient method)")
            try:
                await self._refresh_using_refresh_token(refresh_token)
                _LOGGER.info("Token refresh: SUCCESS using refresh_token")
                return  # Success! Exit early
            except Exception as err:
                _LOGGER.warning(
                    "Token refresh: refresh_token method FAILED (%s), falling back to password grant", 
                    err
                )
                # Continue to fallback below
        else:
            _LOGGER.debug("Token refresh: No refresh_token available, using password grant")
        
        # Fallback: Password grant (current reliable method)
        _LOGGER.info("Token refresh: Using password grant (fallback method)")
        try:
            await self._refresh_using_password_grant()
            _LOGGER.info("Token refresh: SUCCESS using password grant")
        except Exception as err:
            _LOGGER.error("Token refresh: CRITICAL - Both methods failed: %s", err)
            raise UpdateFailed(f"Token refresh failed: {err}")

    async def _refresh_using_refresh_token(self, refresh_token: str):
        """Attempt token refresh using refresh_token grant."""
        _LOGGER.debug("Token refresh: Preparing refresh_token request")
        
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
            "grant_type": "refresh_token",
            "refresh_token": refresh_token.strip(),
            "client_id": self.config_entry.data[CONF_CLIENT_ID].strip(),
        }
        
        if self.config_entry.data.get(CONF_CLIENT_SECRET):
            data["client_secret"] = self.config_entry.data[CONF_CLIENT_SECRET].strip()
        
        _LOGGER.debug("Token refresh: Sending refresh_token request to %s", AUTH_URL)
        
        try:
            session = async_get_clientsession(self.hass)
            async with session.post(AUTH_URL, headers=headers, data=data) as response:
                response_text = await response.text()
                response_headers = dict(response.headers)
                
                _LOGGER.debug(
                    "Token refresh (refresh_token): HTTP %s, headers=%s, body=%s",
                    response.status,
                    response_headers,
                    response_text[:200] if len(response_text) > 200 else response_text
                )
                
                if response.status != 200:
                    # Don't raise UpdateFailed here - let caller handle fallback
                    raise Exception(
                        f"refresh_token grant failed: HTTP {response.status}, "
                        f"body={response_text[:100]}"
                    )
                
                auth_result = await response.json()
                
                # Verify we got required fields
                if "access_token" not in auth_result:
                    raise Exception("refresh_token response missing access_token field")
                
                # Update tokens in memory and storage
                self._update_tokens_in_memory(auth_result)
                await self._save_tokens_to_config(auth_result)
                
                _LOGGER.info("Token refresh (refresh_token): Tokens updated successfully")
                
        except aiohttp.ClientError as err:
            _LOGGER.warning("Token refresh (refresh_token): Network error: %s", err)
            raise
        except Exception as err:
            _LOGGER.warning("Token refresh (refresh_token): Error: %s", err)
            raise

    async def _refresh_using_password_grant(self):
        """Refresh token using password grant (reliable fallback method)."""
        _LOGGER.debug("Token refresh: Preparing password grant request")
        
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
            "username": self.config_entry.data[CONF_USERNAME].strip(),
            "password": self.config_entry.data[CONF_PASSWORD].strip(),
            "client_id": self.config_entry.data[CONF_CLIENT_ID].strip(),
            "scope": "DA",
        }
        
        if self.config_entry.data.get(CONF_CLIENT_SECRET):
            data["client_secret"] = self.config_entry.data[CONF_CLIENT_SECRET].strip()
        
        _LOGGER.debug("Token refresh: Sending password grant request to %s", AUTH_URL)
        
        try:
            session = async_get_clientsession(self.hass)
            async with session.post(AUTH_URL, headers=headers, data=data) as response:
                response_text = await response.text()
                response_headers = dict(response.headers)
                
                _LOGGER.debug(
                    "Token refresh (password grant): HTTP %s, headers=%s",
                    response.status,
                    response_headers
                )
                
                if response.status != 200:
                    raise UpdateFailed(
                        f"Password grant failed: HTTP {response.status}, "
                        f"headers={response_headers}, body={response_text[:100]}"
                    )
                
                auth_result = await response.json()
                
                # Verify we got required fields
                if "access_token" not in auth_result:
                    raise UpdateFailed("Password grant response missing access_token field")
                
                # Update tokens in memory and storage
                self._update_tokens_in_memory(auth_result)
                await self._save_tokens_to_config(auth_result)
                
                _LOGGER.info("Token refresh (password grant): Tokens updated successfully")
                
        except aiohttp.ClientError as err:
            _LOGGER.error("Token refresh (password grant): Network error: %s", err)
            raise UpdateFailed(f"Network error during password grant: {err}")

    def _update_tokens_in_memory(self, auth_result: dict):
        """Update access token and expiry in memory."""
        self.access_token = auth_result["access_token"]
        expires_in = auth_result.get("expires_in", 900)
        self.expires_at = datetime.now(ZoneInfo("UTC")) + timedelta(seconds=expires_in)
        
        _LOGGER.debug(
            "Tokens updated in memory: expires_in=%s seconds, expires_at=%s",
            expires_in,
            self.expires_at
        )

    async def _save_tokens_to_config(self, auth_result: dict):
        """Save tokens to config entry storage."""
        new_data = {
            **self.config_entry.data,
            "access_token": auth_result["access_token"],
            "refresh_token": auth_result.get("refresh_token"),  # May be None
            "expires_at": self.expires_at.isoformat(),
        }
        
        # Use async_update_entry (non-blocking)
        self.hass.config_entries.async_update_entry(
            self.config_entry,
            data=new_data,
        )
        
        _LOGGER.debug(
            "Tokens saved to config: has_refresh_token=%s",
            "yes" if auth_result.get("refresh_token") else "no"
        )

    async def _async_update_data(self):
        """Fetch data from MieleLogic API."""
        # Check if token needs refresh (60 second buffer before expiry)
        if not self.access_token or (self.expires_at and datetime.now(ZoneInfo("UTC")) >= self.expires_at - timedelta(seconds=60)):
            _LOGGER.debug(
                "Token check: now=%s, expires_at=%s, needs_refresh=%s", 
                datetime.now(ZoneInfo("UTC")), 
                self.expires_at,
                not self.access_token or (self.expires_at and datetime.now(ZoneInfo("UTC")) >= self.expires_at - timedelta(seconds=60))
            )
            await self._refresh_token()

        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        }
        data = {"reservations": {}, "machine_states": {}, "account_details": {}}

        try:
            async with aiohttp.ClientSession() as session:
                # Reservationskald
                url = f"https://api.mielelogic.com/v7/reservations?laundry={self.laundry_id}"
                _LOGGER.debug("Fetching reservations data from %s with headers=%s", url, headers)
                async with session.get(url, headers=headers) as response:
                    response_text = await response.text()
                    response_headers = dict(response.headers)
                    _LOGGER.debug("Reservations response: HTTP %s, headers=%s, body=%s", response.status, response_headers, response_text)
                    if response.status == 401:
                        _LOGGER.warning("Received HTTP 401, attempting to refresh token")
                        await self._refresh_token()
                        headers["Authorization"] = f"Bearer {self.access_token}"
                        async with session.get(url, headers=headers) as retry_response:
                            retry_text = await retry_response.text()
                            retry_headers = dict(retry_response.headers)
                            _LOGGER.debug("Retry response: HTTP %s, headers=%s, body=%s", retry_response.status, retry_headers, retry_text)
                            if retry_response.status != 200:
                                raise UpdateFailed(f"Error fetching data after token refresh: HTTP {retry_response.status}, headers={retry_headers}, body={retry_text}")
                            data["reservations"] = await retry_response.json()
                    elif response.status != 200:
                        raise UpdateFailed(f"Error fetching reservations: HTTP {response.status}, headers={response_headers}, body={response_text}")
                    else:
                        data["reservations"] = await response.json()
                        if not data["reservations"].get("ResultOK", False):
                            _LOGGER.error("API error in reservations: %s, headers=%s, body=%s", data["reservations"].get("ResultText", "Unknown error"), response_headers, response_text)
                            raise UpdateFailed(f"API error in reservations: {data['reservations'].get('ResultText', 'Unknown error')}, headers={response_headers}, body={response_text}")

                # Maskinstatus-kald
                machine_url = f"https://api.mielelogic.com/v7/Country/DA/Laundry/{self.laundry_id}/laundrystates?language=da"
                _LOGGER.debug("Fetching machine states from %s with headers=%s", machine_url, headers)
                async with session.get(machine_url, headers=headers) as machine_response:
                    machine_text = await machine_response.text()
                    machine_headers = dict(machine_response.headers)
                    _LOGGER.debug("Machine states response: HTTP %s, headers=%s, body=%s", machine_response.status, machine_headers, machine_text)
                    if machine_response.status == 401:
                        await self._refresh_token()
                        headers["Authorization"] = f"Bearer {self.access_token}"
                        async with session.get(machine_url, headers=headers) as retry_response:
                            retry_text = await retry_response.text()
                            retry_headers = dict(retry_response.headers)
                            if retry_response.status != 200:
                                raise UpdateFailed(f"Error fetching machine states: HTTP {retry_response.status}, headers={retry_headers}, body={retry_text}")
                            data["machine_states"] = await retry_response.json()
                    elif machine_response.status != 200:
                        raise UpdateFailed(f"Error fetching machine states: HTTP {machine_response.status}, headers={machine_headers}, body={machine_text}")
                    else:
                        data["machine_states"] = await machine_response.json()
                        if not data["machine_states"].get("ResultOK", False):
                            raise UpdateFailed(f"API error in machine states: {data['machine_states'].get('ResultText', 'Unknown error')}, headers={machine_headers}, body={machine_text}")

                # Kontodetaljer-kald
                account_url = "https://api.mielelogic.com/v7/accounts/Details"
                _LOGGER.debug("Fetching account details from %s with headers=%s", account_url, headers)
                async with session.get(account_url, headers=headers) as account_response:
                    account_text = await account_response.text()
                    account_headers = dict(account_response.headers)
                    _LOGGER.debug("Account details response: HTTP %s, headers=%s, body=%s", account_response.status, account_headers, account_text)
                    if account_response.status == 401:
                        await self._refresh_token()
                        headers["Authorization"] = f"Bearer {self.access_token}"
                        async with session.get(account_url, headers=headers) as retry_response:
                            retry_text = await retry_response.text()
                            retry_headers = dict(retry_response.headers)
                            if retry_response.status != 200:
                                raise UpdateFailed(f"Error fetching account details: HTTP {retry_response.status}, headers={retry_headers}, body={retry_text}")
                            data["account_details"] = await retry_response.json()
                    elif account_response.status != 200:
                        raise UpdateFailed(f"Error fetching account details: HTTP {account_response.status}, headers={account_headers}, body={account_text}")
                    else:
                        data["account_details"] = await account_response.json()
                        if not data["account_details"].get("ResultOK", False):
                            raise UpdateFailed(f"API error in account details: {data['account_details'].get('ResultText', 'Unknown error')}, headers={account_headers}, body={account_text}")

                return data
        except aiohttp.ClientError as err:
            _LOGGER.error("Error fetching data: %s", err)
            raise UpdateFailed(f"Error communicating with API: {err}")
