# VERSION = "1.9.2"
import logging
import asyncio
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

# Retry configuration for API calls
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]  # Exponential backoff in seconds


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
        
        # Calendar sync settings
        self.sync_to_calendar = config_entry.data.get("sync_to_calendar")

        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None
        
        # Track last sync time to prevent rapid duplicate syncs
        self._last_sync_time = None
        self._min_sync_interval = 5

        # In-memory duplicate guard (populated from persistent store on first sync)
        self._created_events: set = set()
        self._created_events_loaded = False

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
            update_interval=timedelta(seconds=60),
        )

    async def _fetch_with_retry(self, fetch_func, description: str):
        """Fetch data with retry logic and exponential backoff."""
        last_error = None
        
        for attempt in range(MAX_RETRIES):
            try:
                result = await fetch_func()
                if attempt > 0:
                    _LOGGER.info("✅ %s succeeded on attempt %d/%d", description, attempt + 1, MAX_RETRIES)
                return result
            
            except aiohttp.ClientError as err:
                last_error = err
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_DELAYS[attempt]
                    _LOGGER.warning("⚠️ %s failed (attempt %d/%d): %s. Retrying in %ds...", description, attempt + 1, MAX_RETRIES, err, delay)
                    await asyncio.sleep(delay)
                else:
                    _LOGGER.error("❌ %s failed after %d attempts: %s", description, MAX_RETRIES, err)
            
            except Exception as err:
                _LOGGER.error("❌ %s unexpected error: %s", description, err, exc_info=True)
                raise
        
        raise last_error

    async def _async_update_data(self):
        """Fetch data from MieleLogic API with retry logic and graceful degradation."""
        try:
            await self._ensure_token()

            headers = {
                "Authorization": f"Bearer {self.access_token}",
                "Origin": "https://mielelogic.com",
                "Referer": "https://mielelogic.com/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            }

            data = {}
            
            # Fetch reservations (own bookings)
            try:
                async def fetch_reservations():
                    async with aiohttp.ClientSession() as session:
                        return await self._fetch_with_cache(
                            session,
                            f"{API_BASE_URL}/reservations?laundry={self.laundry_id}",
                            f"reservations_{self.laundry_id}",
                            headers,
                        )
                data["reservations"] = await self._fetch_with_retry(fetch_reservations, "Fetch reservations")
            except Exception as err:
                _LOGGER.error("❌ Reservations unavailable: %s", err)
                data["reservations"] = {"Reservations": [], "MaxUserReservations": 2, "error": str(err)}
            
            # Fetch machine states (real-time status)
            try:
                async def fetch_machine_states():
                    async with aiohttp.ClientSession() as session:
                        return await self._fetch_with_cache(
                            session,
                            f"{API_BASE_URL}/Country/DA/Laundry/{self.laundry_id}/laundrystates?language=da",
                            f"machine_states_{self.laundry_id}",
                            headers,
                        )
                data["machine_states"] = await self._fetch_with_retry(fetch_machine_states, "Fetch machine states")
            except Exception as err:
                _LOGGER.error("❌ Machine states unavailable: %s", err)
                data["machine_states"] = {"MachineStates": [], "error": str(err)}

            # ✨ v1.9.2: Fetch timetable — ALL bookings for the laundry (all users)
            # Used to mark timeslots as booked/available regardless of who booked them.
            # Endpoint: GET /v7/country/DA/laundry/{laundry_id}/timetable
            try:
                async def fetch_timetable():
                    async with aiohttp.ClientSession() as session:
                        return await self._fetch_with_cache(
                            session,
                            f"{API_BASE_URL}/country/DA/laundry/{self.laundry_id}/timetable",
                            f"timetable_{self.laundry_id}",
                            headers,
                        )
                data["timetable"] = await self._fetch_with_retry(fetch_timetable, "Fetch timetable")
                _LOGGER.debug("📅 Timetable fetched: %s", type(data["timetable"]))
            except Exception as err:
                _LOGGER.warning("⚠️ Timetable unavailable (non-critical): %s", err)
                data["timetable"] = {}
            
            # Fetch account details (non-critical)
            try:
                async def fetch_account_details():
                    async with aiohttp.ClientSession() as session:
                        return await self._fetch_with_cache(
                            session,
                            f"{API_BASE_URL}/accounts/Details",
                            "account_details",
                            headers,
                        )
                data["account_details"] = await self._fetch_with_retry(fetch_account_details, "Fetch account details")
            except Exception as err:
                _LOGGER.error("❌ Account details unavailable: %s", err)
                data["account_details"] = {"Balance": 0.0, "error": str(err)}

            # Optionally sync to external calendar
            if self.sync_to_calendar:
                try:
                    await self._sync_to_external_calendar(data)
                    _LOGGER.debug("✅ Calendar sync completed successfully")
                except Exception as err:
                    _LOGGER.error("❌ Calendar sync to %s failed, continuing anyway: %s", self.sync_to_calendar, err, exc_info=True)

            return data

        except Exception as err:
            _LOGGER.error("❌ Critical error in coordinator update: %s", err, exc_info=True)
            raise UpdateFailed(f"Critical error: {err}") from err

    async def _sync_to_external_calendar(self, data):
        """Sync MieleLogic reservations to external calendar (throttled)."""
        now = datetime.now()
        if self._last_sync_time:
            time_since_last = (now - self._last_sync_time).total_seconds()
            if time_since_last < self._min_sync_interval:
                _LOGGER.debug("⏱️ Skipping calendar sync - only %.1fs since last sync", time_since_last)
                return
        
        self._last_sync_time = now
        await self._do_sync_to_external_calendar(data)
    
    def _get_store(self):
        """Get the MieleLogicStore from hass.data."""
        from .const import DOMAIN
        domain_data = self.hass.data.get(DOMAIN, {})
        for key, value in domain_data.items():
            if isinstance(value, dict) and "store" in value:
                return value["store"]
        return None

    async def _do_sync_to_external_calendar(self, data):
        """Internal sync implementation."""
        target_calendar = self.sync_to_calendar

        from homeassistant.helpers import entity_registry as er
        entity_reg = er.async_get(self.hass)
        calendar_entity = entity_reg.async_get(target_calendar)
        
        if not calendar_entity:
            calendar_state = self.hass.states.get(target_calendar)
            if not calendar_state:
                _LOGGER.warning("Target calendar %s not found - sync disabled.", target_calendar)
                return

        _LOGGER.debug("Syncing reservations to %s", target_calendar)

        reservations = data.get("reservations", {}).get("Reservations", [])
        if not reservations:
            _LOGGER.debug("No reservations to sync")
            return

        now = datetime.now(ZoneInfo("UTC"))
        end_date = now + timedelta(days=30)

        existing_events = []
        try:
            if not self.hass.services.has_service("calendar", "get_events"):
                _LOGGER.debug("Calendar service 'get_events' not available")
            else:
                response = await self.hass.services.async_call(
                    "calendar", "get_events",
                    {"entity_id": target_calendar, "start_date_time": now.isoformat(), "end_date_time": end_date.isoformat()},
                    blocking=True, return_response=True,
                )
                existing_events = response.get(target_calendar, {}).get("events", [])
                _LOGGER.debug("Found %d existing events in target calendar", len(existing_events))
        except Exception as err:
            _LOGGER.warning("Could not get existing events from %s: %s", target_calendar, err)

        store = self._get_store()
        if not self._created_events_loaded and store:
            self._created_events = store.get_calendar_synced_events()
            self._created_events_loaded = True
            _LOGGER.debug("📅 Loaded %d persistent calendar sync records", len(self._created_events))

        for reservation in reservations:
            try:
                start_str = reservation.get("Start")
                end_str = reservation.get("End")
                machine_name = reservation.get("MachineName", "Unknown")
                machine_number = reservation.get("MachineNumber", 0)

                if not start_str or not end_str:
                    continue

                start_cph = self._parse_datetime(start_str)
                end_cph   = self._parse_datetime(end_str)
                start_utc = start_cph.astimezone(ZoneInfo("UTC"))
                end_utc   = end_cph.astimezone(ZoneInfo("UTC"))

                vaskehus_name = self._get_vaskehus_name(machine_number)
                summary = f"{vaskehus_name} booket"

                permanent_key = (machine_number, start_str)
                if permanent_key in self._created_events:
                    continue

                already_exists = any(
                    event.get("summary") == summary and self._times_match(event.get("start"), start_cph)
                    for event in existing_events
                )
                if already_exists:
                    self._created_events.add(permanent_key)
                    if store:
                        await store.async_add_calendar_synced_event(machine_number, start_str)
                    continue

                if not self.hass.services.has_service("calendar", "create_event"):
                    continue

                duration = reservation.get("Duration", 0)
                description = (
                    f"MieleLogic Reservation\n"
                    f"Vaskehus: {vaskehus_name}\n"
                    f"Maskine: {machine_name} #{machine_number}\n"
                    f"Varighed: {duration} minutter"
                )

                await self.hass.services.async_call(
                    "calendar", "create_event",
                    {"entity_id": target_calendar, "summary": summary, "start_date_time": start_utc.isoformat(), "end_date_time": end_utc.isoformat(), "description": description},
                    blocking=True,
                )

                self._created_events.add(permanent_key)
                if store:
                    await store.async_add_calendar_synced_event(machine_number, start_str)

                _LOGGER.info("✅ Created calendar event: %s at %s (UTC)", summary, start_utc)

            except Exception as err:
                _LOGGER.warning("Could not sync reservation %s: %s", reservation.get("ReservationId"), err)
                continue

    def _times_match(self, event_start, expected: datetime) -> bool:
        if not event_start:
            return False
        try:
            event_dt = self._parse_datetime(event_start)
            return event_dt.astimezone(ZoneInfo("UTC")) == expected.astimezone(ZoneInfo("UTC"))
        except Exception:
            return False

    def _parse_datetime(self, datetime_str: str) -> datetime:
        """Parse datetime string — MieleLogic returns naive CPH local time."""
        if not datetime_str:
            raise ValueError("Empty datetime string")
        if "Z" in datetime_str or "+" in datetime_str or datetime_str.count("-") > 2:
            return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        else:
            return datetime.fromisoformat(datetime_str).replace(tzinfo=ZoneInfo("Europe/Copenhagen"))
    
    def _get_vaskehus_name(self, machine_number: int) -> str:
        """Get vaskehus name from machine number."""
        klatvask_machine = self.config_entry.data.get("klatvask_primary_machine", 1)
        storvask_machine = self.config_entry.data.get("storvask_primary_machine", 4)
        if machine_number == klatvask_machine:
            return "Klatvask"
        elif machine_number == storvask_machine:
            return "Storvask"
        else:
            return f"Maskine {machine_number}"

    # ===== CACHING =====

    def _get_cache_key(self, endpoint: str) -> str:
        return endpoint.split("/")[-1].split("?")[0]

    def _is_cache_valid(self, cache_key: str) -> bool:
        if cache_key not in self._cache:
            return False
        age = datetime.now(ZoneInfo("UTC")) - self._cache[cache_key]["timestamp"]
        return age < self._cache_ttl

    def _get_from_cache(self, cache_key: str):
        if self._is_cache_valid(cache_key):
            cached = self._cache[cache_key]
            age = (datetime.now(ZoneInfo("UTC")) - cached["timestamp"]).total_seconds()
            _LOGGER.info("✅ Cache HIT for %s (age: %.1fs)", cache_key, age)
            return cached["data"]
        _LOGGER.debug("❌ Cache MISS for %s", cache_key)
        return None

    def _save_to_cache(self, cache_key: str, data):
        self._cache[cache_key] = {"data": data, "timestamp": datetime.now(ZoneInfo("UTC"))}
        _LOGGER.debug("💾 Cached data for %s", cache_key)

    def clear_cache(self):
        self._cache = {}
        _LOGGER.debug("🗑️ Cache cleared")

    async def _fetch_with_cache(self, session: aiohttp.ClientSession, url: str, cache_key: str, headers: dict):
        """Fetch data with caching."""
        cached_data = self._get_from_cache(cache_key)
        if cached_data is not None:
            return cached_data

        _LOGGER.info("Fetching from API: %s", url)
        async with session.get(url, headers=headers, timeout=10) as response:
            if response.status == 401:
                _LOGGER.warning("Token expired during fetch, refreshing...")
                await self._refresh_token()
                headers["Authorization"] = f"Bearer {self.access_token}"
                async with session.get(url, headers=headers, timeout=10) as retry_response:
                    retry_response.raise_for_status()
                    data = await retry_response.json()
            else:
                response.raise_for_status()
                data = await response.json()

        self._save_to_cache(cache_key, data)
        return data

    # ===== TOKEN MANAGEMENT =====

    async def _ensure_token(self):
        if self.access_token and self.token_expiry:
            if datetime.now(ZoneInfo("UTC")) < (self.token_expiry - timedelta(seconds=60)):
                return
        await self._refresh_token()

    async def _refresh_token(self):
        if self.refresh_token:
            try:
                await self._token_request_refresh_grant()
                _LOGGER.info("Token refreshed using refresh_token grant")
                return
            except Exception as err:
                _LOGGER.warning("Refresh token grant failed: %s, falling back to password grant", err)
        await self._token_request_password_grant()
        _LOGGER.info("Token refreshed using password grant")

    async def _token_request_refresh_grant(self):
        data = {"grant_type": "refresh_token", "refresh_token": self.refresh_token, "client_id": self.client_id}
        if self.client_secret:
            data["client_secret"] = self.client_secret
        await self._make_token_request(data)

    async def _token_request_password_grant(self):
        data = {"grant_type": "password", "username": self.username, "password": self.password, "client_id": self.client_id, "scope": "DA"}
        if self.client_secret:
            data["client_secret"] = self.client_secret
        await self._make_token_request(data)

    async def _make_token_request(self, data: dict):
        headers = {"Content-Type": "application/x-www-form-urlencoded", "Origin": "https://mielelogic.com", "Referer": "https://mielelogic.com/"}
        async with aiohttp.ClientSession() as session:
            async with session.post(AUTH_URL, data=data, headers=headers, timeout=10) as response:
                response.raise_for_status()
                result = await response.json()
                self.access_token = result["access_token"]
                self.refresh_token = result.get("refresh_token")
                expires_in = result.get("expires_in", 900)
                self.token_expiry = datetime.now(ZoneInfo("UTC")) + timedelta(seconds=expires_in)
                _LOGGER.debug("Token acquired, expires in %d seconds", expires_in)
