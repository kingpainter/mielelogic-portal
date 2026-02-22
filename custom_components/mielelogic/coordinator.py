# VERSION = "1.4.7"
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.helpers.device_registry import DeviceInfo

from .const import (
    DOMAIN,
    CONF_USERNAME,
    CONF_PASSWORD,
    CONF_CLIENT_ID,
    CONF_LAUNDRY_ID,
    CONF_CLIENT_SECRET,
    API_BASE_URL,
    AUTH_URL,
)

_LOGGER = logging.getLogger(__name__)


class MieleLogicDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching MieleLogic data from the API."""

    def __init__(self, hass: HomeAssistant, config_entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        self.config_entry = config_entry
        self.username = config_entry.data[CONF_USERNAME]
        self.password = config_entry.data[CONF_PASSWORD]
        self.client_id = config_entry.data[CONF_CLIENT_ID]
        self.laundry_id = config_entry.data[CONF_LAUNDRY_ID]
        self.client_secret = config_entry.data.get(CONF_CLIENT_SECRET)
        
        # NEW: Calendar sync settings
        self.sync_to_calendar = config_entry.data.get("sync_to_calendar")

        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None

        # Response caching (60s TTL)
        self._cache = {}
        self._cache_ttl = timedelta(seconds=60)

        # Device info for all entities
        self.device_info = DeviceInfo(
            identifiers={(DOMAIN, f"{self.username}_{self.laundry_id}")},
            name="MieleLogic",
            manufacturer="MieleLogic",
            model="Laundry Service",
            sw_version="v7",
        )

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=300),  # 5 minutes
        )

    async def _async_update_data(self):
        """Fetch data from MieleLogic API and optionally sync to calendar."""
        try:
            # 1. Ensure we have a valid token (ALWAYS required)
            await self._ensure_token()

            # 2. Fetch data from MieleLogic API (ALWAYS required)
            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Origin": "https://mielelogic.com",
                "Referer": "https://mielelogic.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }

            async with aiohttp.ClientSession() as session:
                # Fetch all endpoints with caching
                reservations = await self._fetch_with_cache(
                    session,
                    f"{API_BASE_URL}/reservations?laundry={self.laundry_id}",
                    f"reservations_{self.laundry_id}",
                    headers,
                )

                machine_states = await self._fetch_with_cache(
                    session,
                    f"{API_BASE_URL}/Country/DA/Laundry/{self.laundry_id}/laundrystates?language=da",
                    f"machine_states_{self.laundry_id}",
                    headers,
                )

                account_details = await self._fetch_with_cache(
                    session,
                    f"{API_BASE_URL}/accounts/Details",
                    "account_details",
                    headers,
                )

            data = {
                "reservations": reservations,
                "machine_states": machine_states,
                "account_details": account_details,
            }

            # 3. Optionally sync to external calendar (OPTIONAL, can fail gracefully)
            if self.sync_to_calendar:
                try:
                    await self._sync_to_external_calendar(data)
                    _LOGGER.debug("✅ Calendar sync completed successfully")
                except Exception as err:
                    _LOGGER.error(
                        "❌ Calendar sync to %s failed, continuing anyway: %s",
                        self.sync_to_calendar,
                        err,
                        exc_info=True,  # Include full traceback for debugging
                    )
                    # DON'T fail entire update if calendar sync fails!
                    # This ensures sensors still update even if external calendar is unavailable

            return data

        except aiohttp.ClientError as err:
            _LOGGER.error("Network error fetching data: %s", err)
            raise UpdateFailed(f"Network error: {err}") from err
        except Exception as err:
            _LOGGER.error("Unexpected error fetching data: %s", err)
            raise UpdateFailed(f"Unexpected error: {err}") from err

    async def _sync_to_external_calendar(self, data):
        """Sync MieleLogic reservations to external calendar."""
        target_calendar = self.sync_to_calendar

        # 1. Check if target calendar exists
        calendar_state = self.hass.states.get(target_calendar)
        if not calendar_state:
            _LOGGER.warning(
                "Target calendar %s not found - sync disabled. "
                "Update calendar settings in Options Flow.",
                target_calendar,
            )
            return

        _LOGGER.debug("Syncing reservations to %s", target_calendar)

        # 2. Get current MieleLogic reservations
        reservations = data.get("reservations", {}).get("Reservations", [])
        if not reservations:
            _LOGGER.debug("No reservations to sync")
            return

        # 3. Get existing events from target calendar (via calendar.get_events service)
        now = datetime.now(ZoneInfo("UTC"))
        end_date = now + timedelta(days=30)  # Look 30 days ahead

        try:
            # Call calendar.get_events service to get existing events
            response = await self.hass.services.async_call(
                "calendar",
                "get_events",
                {
                    "entity_id": target_calendar,
                    "start_date_time": now.isoformat(),
                    "end_date_time": end_date.isoformat(),
                },
                blocking=True,
                return_response=True,
            )

            existing_events = response.get(target_calendar, {}).get("events", [])
            _LOGGER.debug("Found %d existing events in target calendar", len(existing_events))

        except Exception as err:
            _LOGGER.warning("Failed to get existing events from %s: %s", target_calendar, err)
            existing_events = []

        # 4. Sync logic: Create missing events
        for reservation in reservations:
            try:
                start_str = reservation.get("Start")
                end_str = reservation.get("End")
                machine_name = reservation.get("MachineName", "Unknown")
                machine_number = reservation.get("MachineNumber", "")

                if not start_str or not end_str:
                    continue

                # Parse datetime with timezone handling
                start_time = self._parse_datetime(start_str)
                end_time = self._parse_datetime(end_str)
                
                # Datetime is already in Denmark timezone from _parse_datetime
                # No conversion needed!

                # NEW v1.4.6: Use vaskehus name instead of machine name
                vaskehus_name = self._get_vaskehus_name(machine_number)
                summary = f"{vaskehus_name} booket"

                # Check if event already exists (match on summary + start time)
                already_exists = any(
                    event.get("summary") == summary
                    and self._parse_datetime(event.get("start")) == start_time
                    for event in existing_events
                )

                if already_exists:
                    _LOGGER.debug("Event '%s' already exists, skipping", summary)
                    continue

                # Create new event in target calendar
                duration = reservation.get("Duration", 0)
                description = f"MieleLogic Reservation\n"
                description += f"Vaskehus: {vaskehus_name}\n"
                description += f"Maskine: {machine_name} #{machine_number}\n"
                description += f"Varighed: {duration} minutter"

                await self.hass.services.async_call(
                    "calendar",
                    "create_event",
                    {
                        "entity_id": target_calendar,
                        "summary": summary,
                        "start_date_time": start_time.isoformat(),
                        "end_date_time": end_time.isoformat(),
                        "description": description,
                    },
                    blocking=False,
                )

                _LOGGER.info("✅ Created calendar event: %s", summary)

            except Exception as err:
                _LOGGER.warning(
                    "Failed to sync reservation %s: %s",
                    reservation.get("ReservationId"),
                    err,
                )
                continue

    def _parse_datetime(self, datetime_str: str) -> datetime:
        """Parse datetime string - handle both with and without timezone.
        
        IMPORTANT: MieleLogic API returns naive datetimes in Europe/Copenhagen local time,
        NOT in UTC! This is critical for correct time display.
        """
        if not datetime_str:
            raise ValueError("Empty datetime string")

        # Check if datetime has timezone info
        if "Z" in datetime_str or "+" in datetime_str or datetime_str.count("-") > 2:
            # Has timezone info
            return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        else:
            # No timezone info - API returns Europe/Copenhagen local time
            return datetime.fromisoformat(datetime_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    
    def _get_vaskehus_name(self, machine_number: int) -> str:
        """Get vaskehus name from machine number.
        
        NEW v1.4.6: Maps machine number to vaskehus name for display.
        Returns "Klatvask", "Storvask", or "Maskine X" (fallback).
        """
        klatvask_machine = self.config_entry.data.get("klatvask_primary_machine", 1)
        storvask_machine = self.config_entry.data.get("storvask_primary_machine", 4)
        
        if machine_number == klatvask_machine:
            return "Klatvask"
        elif machine_number == storvask_machine:
            return "Storvask"
        else:
            return f"Maskine {machine_number}"

    # ===== CACHING METHODS (from v1.2.0) =====

    def _get_cache_key(self, endpoint: str) -> str:
        """Generate cache key for endpoint."""
        return endpoint.split("/")[-1].split("?")[0]

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid."""
        if cache_key not in self._cache:
            return False

        cached = self._cache[cache_key]
        age = datetime.now(ZoneInfo("UTC")) - cached["timestamp"]
        return age < self._cache_ttl

    def _get_from_cache(self, cache_key: str) -> dict | None:
        """Get data from cache if valid."""
        if self._is_cache_valid(cache_key):
            cached = self._cache[cache_key]
            age = (datetime.now(ZoneInfo("UTC")) - cached["timestamp"]).total_seconds()
            _LOGGER.info("✅ Cache HIT for %s (age: %.1fs)", cache_key, age)
            return cached["data"]

        _LOGGER.debug("❌ Cache MISS for %s", cache_key)
        return None

    def _save_to_cache(self, cache_key: str, data: dict):
        """Save data to cache with timestamp."""
        self._cache[cache_key] = {
            "data": data,
            "timestamp": datetime.now(ZoneInfo("UTC")),
        }
        _LOGGER.debug("💾 Cached data for %s", cache_key)

    async def _fetch_with_cache(
        self, session: aiohttp.ClientSession, url: str, cache_key: str, headers: dict
    ) -> dict:
        """Fetch data with caching."""
        # Check cache first
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        # Cache miss - fetch from API
        _LOGGER.info("Fetching from API: %s", url)
        async with session.get(url, headers=headers, timeout=10) as response:
            if response.status == 401:
                _LOGGER.warning("Token expired during fetch, refreshing...")
                await self._refresh_token()
                # Retry with new token
                headers["Authorization"] = f"Bearer {self.access_token}"
                async with session.get(url, headers=headers, timeout=10) as retry_response:
                    retry_response.raise_for_status()
                    data = await retry_response.json()
            else:
                response.raise_for_status()
                data = await response.json()

        # Save to cache
        self._save_to_cache(cache_key, data)
        return data

    # ===== TOKEN MANAGEMENT (from v1.2.0) =====

    async def _ensure_token(self):
        """Ensure we have a valid token."""
        if self.access_token and self.token_expiry:
            # Check if token is still valid (with 60 second buffer)
            if datetime.now(ZoneInfo("UTC")) < (self.token_expiry - timedelta(seconds=60)):
                return

        # Token missing or expired - get new one
        await self._refresh_token()

    async def _refresh_token(self):
        """Refresh access token using refresh_token or password grant."""
        # Try refresh_token grant first (efficient)
        if self.refresh_token:
            try:
                await self._token_request_refresh_grant()
                _LOGGER.info("Token refreshed using refresh_token grant")
                return
            except Exception as err:
                _LOGGER.warning(
                    "Refresh token grant failed: %s, falling back to password grant", err
                )

        # Fall back to password grant
        await self._token_request_password_grant()
        _LOGGER.info("Token refreshed using password grant")

    async def _token_request_refresh_grant(self):
        """Request new token using refresh_token grant."""
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
        }

        if self.client_secret:
            data["client_secret"] = self.client_secret

        await self._make_token_request(data)

    async def _token_request_password_grant(self):
        """Request new token using password grant."""
        data = {
            "grant_type": "password",
            "username": self.username,
            "password": self.password,
            "client_id": self.client_id,
            "scope": "DA",
        }

        if self.client_secret:
            data["client_secret"] = self.client_secret

        await self._make_token_request(data)

    async def _make_token_request(self, data: dict):
        """Make token request to auth endpoint."""
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://mielelogic.com",
            "Referer": "https://mielelogic.com/",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(AUTH_URL, data=data, headers=headers, timeout=10) as response:
                response.raise_for_status()
                result = await response.json()

                self.access_token = result["access_token"]
                self.refresh_token = result.get("refresh_token")  # May be None
                expires_in = result.get("expires_in", 900)
                self.token_expiry = datetime.now(ZoneInfo("UTC")) + timedelta(seconds=expires_in)

                _LOGGER.debug(
                    "Token acquired, expires in %d seconds (refresh_token: %s)",
                    expires_in,
                    "available" if self.refresh_token else "not available",
                )
