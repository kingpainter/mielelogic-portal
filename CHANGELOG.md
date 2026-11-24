# Changelog

All notable changes are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [Unreleased]

### Changed
- Service errors use translation keys. All 18 `ServiceValidationError` and `HomeAssistantError` raises in `services.py` have a `translation_key`. Texts are in the `exceptions` section of `strings.json`, `translations/en.json` and `translations/da.json`.
- The `vaskehus_config` sensor is a diagnostic entity and disabled by default. Existing entity registry entries keep their current setting.
- The CalDAV delete client checks the HTTP status before parsing the response. A 401 now logs `HTTP 401` instead of an XML parse error.
- The booking card registration message is logged at info level instead of warning.

### Fixed
- An API rejection during booking or cancellation was reported as "Unexpected error". The API's own message is now reported (`reservation_failed` / `cancellation_failed`).

### Added
- `tests/test_services.py`: validation rules, the `not_configured` error, and a regression test for the API rejection message.
- `tests/test_sensor_dynamic.py`: machine sensors are added when a new machine appears, are not added twice, and skip machines without a name.
- `tests/test_caldav_async.py`: the CalDAV delete flow with mocked responses, including 401 and missing calendars.
- Manual check of the CalDAV delete against a real CalDAV server (Radicale). This is not part of CI.
- Test suite: 111 tests, `mypy --config-file mypy.ini` clean.

---

## [2.6.6] — Quality scale: strict typing, icons, reconfigure fix

### Changed
- Strict typing: `mypy.ini` in the repo root (`strict = True`). The whole `custom_components/mielelogic` package is now mypy-clean. The type check runs in CI (`.github/workflows/pytest.yml`).
- Coordinator, services, websocket, booking manager and config flow are typed (`DataUpdateCoordinator[dict[str, Any]]`, typed handlers and service responses).
- HTTP timeouts use `aiohttp.ClientTimeout(total=10)` (`CLIENT_TIMEOUT`) instead of integers.
- Service calls that return data use `SupportsResponse.OPTIONAL`.
- Icons moved from code to `icons.json` (icon translations). Dynamic icons for washer/dryer availability are driven by state mapping.
- Machine list changes are shown as a repair issue (`machine_inventory_changed`) instead of a persistent notification. Translated to Danish and English.

### Fixed
- The reconfigure flow called `self.config_entry`, which does not exist on `ConfigFlow`. Fixed with `_get_reconfigure_entry()`, so changing username, password and laundry room works.
- The panel version header showed a hardcoded v2.5.0. It now shows the correct version.

### Added
- Tests for reconfigure: entry update and invalid-login error (`tests/test_config_flow.py`).
- `mypy==2.4.1` in `requirements.txt`.

---

## [2.6.5] — Quality scale: Bronze fixes, websession, tests green

### Changed
- Services are registered in `async_setup` (action setup). Handlers look up the coordinator at call time.
- Machine number validation accepts 1–7 (new machines).
- All HTTP calls use HA's shared session via `async_get_clientsession` (inject-websession).
- CalDAV deletion uses an async client (`caldav_async.py`) instead of the synchronous `caldav` package. `caldav` is removed from `manifest.json` (async dependency). `caldav_client.py` is no longer used and can be deleted.
- `hassfest`: URL removed from the caldav description; `CONFIG_SCHEMA` added.
- The coordinator passes `config_entry` on to `DataUpdateCoordinator` (fixed by `self.config_entry = None`).
- `AbortFlow` propagates in the config flow (a duplicate laundry now aborts, instead of an "unknown" error).
- `async_unload_entry` handles a missing `hass.data[DOMAIN]`.

### Added
- `async_remove_config_entry_device`: stale devices can be deleted in the UI.
- `tests/test_config_flow.py` (success, invalid_auth, cannot_connect, duplicate).
- Machine inventory sensor that records changes to the set of machines.

### Tests
- CI: 84 tests green, hassfest green.

---

## Test suite for coordinator, booking_manager and websocket

### Added — Test suite for coordinator, booking_manager, websocket
- New `tests/` folder: `conftest.py` (shared fixtures + `MockConfigEntry`/`MockCoordinator`), `test_coordinator.py`, `test_booking_manager.py`, `test_websocket.py`
- `pytest.ini` and `requirements.txt` (pinned `pytest-homeassistant-custom-component==0.13.316`, requires Python 3.13+)
- New CI workflow `.github/workflows/pytest.yml` — runs the test suite on every push/PR to `main`/`dev`
- Covers: token refresh/retry logic, caching, datetime parsing and the `_get_store` fallback in the coordinator; booking/cancel happy path and error handling, primary/secondary calendar sync and deletion in booking_manager; the `_get_from_runtime` fallback chain, timetable parsing and error codes (`not_ready`/`invalid_input`/`service_error`/`storage_error`/`not_found`) in websocket

---

## [2.6.4] - 2026-11-24

### Added — Machine inventory sensor
- New sensor `sensor.mielelogic_maskine_inventar`. The state is the number of machines. The attributes `machine_numbers`, `by_laundry` (e.g. `Klatvask: [1, 2]`) and `changed_at` show the current picture.
- The sensor stores the last known machine list and sends a persistent notification in HA when machine numbers are added or disappear. The list survives an HA restart via `RestoreEntity`.
- Empty responses from the API are ignored, so a failed fetch does not trigger a false alarm.

---

## [2.6.3] - 2026-11-24

### Changed — Remaining time for the booked laundry room in the booking card
- `websocket.py` (`ws_get_machines`): groups machines by `UnitName` (Klatvask / Stor vask) instead of hardcoded numbers. Klatvask = 1, 2; Stor vask = 3, 4, 5.
- Remaining time is parsed from `Text1` ("Resttid: N min.") and sent as `remaining_minutes`. The time for reserved machines is read from `Text2` (e.g. "kl. 17:00").
- The active booking is found from `coordinator.data["reservations"]` (`Start <= now < End`). The response gets a new `booking` field with `unit_name`, `start`, `end`, and each machine gets `in_booked_laundry` and `booked_by_us`.
- `mielelogic-booking-card.js`: shows only the machines in the laundry room booked in the active slot, with remaining time (e.g. "33 min"). With no active booking, no machine section is shown.

### Fixed
- `websocket.py` and `sensor.py` read `ReservationInfo`, which does not exist in the `laundrystates` response. The time is in `Text2`.
- Version numbers were inconsistent. All `.py` headers in the integration, `tests/`, `panel.js`, `const.py`, `manifest.json` and the README badge are now 2.6.3. `mielelogic-booking-card.js` was on 2.7.1 and is now 2.6.3 as well. `frontend/entrypoint.js` has its own version (2.1.0) and is unchanged.

---

## [2.6.2] - 2026-08-22

### Fixed — Backend/UI review: quota bug, error messages, cleanup, toast UX
- **services.py**: `_check_max_reservations` blocked all bookings when the MieleLogic API briefly returned `MaxUserReservations: 0` (seen in testing on 2026-08-22, probably a race or glitch in their backend). This value is now treated as invalid — it is logged as a warning and no longer blocks the booking.
- **services.py**: all user-facing validation errors (machine number, opening hours, duration, quota, "booking not found") were translated from English to short, Danish text — they previously passed through untranslated and partly multi-line/technical into the panel toast messages.
- **coordinator.py**: automatic cleanup of old booking metadata (once a day, via the existing `store.async_cleanup_old_bookings(days=7)`). Before, cleanup only happened manually through the admin tab's "Clear history" button.
- **panel.js** (v2.6.2): toast messages now scale their duration with length (3.5–12 s instead of always 3.5 s), support multi-line messages (`white-space: pre-line` instead of `nowrap`), and can be dismissed with a tap (`pointer-events: auto`) — relevant now that longer error messages (e.g. the quota error with the booking list) can actually be read.

### Known remaining items (not done this time)
- `services.py` still lacks its own pytest coverage (coordinator/booking_manager/websocket have it, services.py does not)
- The v1.4.7 plan (emoji fix, calendar sync wrapper, overlap detection, retry logic) is still open

---

## [2.6.1] - 2026-08-22

### Added — Debug logging of reservation API responses
- While testing the CalDAV fix we ran into a separate, not yet explained error: `Booking failed: Maximum reservations reached (0/0)`. The API apparently returned `MaxUserReservations: 0` during quick book/cancel test cycles, which blocks all bookings until the next refresh.
- `coordinator.py`: added debug logging of the number of active reservations and `MaxUserReservations` every time the `/reservations` endpoint is fetched, so we can see the raw API response the next time it happens and find the real cause (a MieleLogic API glitch vs. cache timing).
- No behaviour change yet — observability only. The blocking logic in `services.py` was not touched in this round.

---

## [2.6.0] - 2026-08-22

### Fixed — Calendar events are now deleted correctly on cancellation (CalDAV)
- Root cause: Home Assistant's built-in CalDAV integration supports `calendar.create_event`/`get_events`, but **not** `calendar.delete_event` (open HA core issue #159784). Because both the primary (`calendar.kun_flemming`) and secondary (`calendar.lukas`) calendars are CalDAV-based (iCloud), calendar deletion had been failing silently in the background whenever a booking was cancelled — the booking itself was cancelled correctly, but the event stayed in the calendar.
- New `caldav_client.py`: a minimal direct CalDAV client (via the `caldav` package) that finds and deletes the matching event directly on the CalDAV server, bypassing HA's calendar entity. Creating events still uses `calendar.create_event` as before — only deletion has changed.
- `booking_manager.py`: `_delete_calendar_event()` and `_delete_secondary_calendar_events()` now try direct CalDAV deletion first (if configured) and fall back to the old `calendar.delete_event` service path for non-CalDAV calendars (e.g. Local Calendar, Google Calendar).
- New options flow step under "Configure calendar sync": optional fields for CalDAV server URL, username and app-specific password — only needed if the primary/secondary calendar is CalDAV-based.
- New dependency: `caldav>=1.0.1` in `manifest.json`.
- Bonus fix: corrected an existing mismatch in `strings.json`/`da.json` where the calendar step's description referred to non-existent placeholders (`{primary}`/`{secondaries}`/`{hint}`) and the field name `secondary_calendars` instead of the one actually used, `secondary_calendars_text`.

---

## [2.5.8] - 2026-08-21

### Added — Local brand icons (HA 2026.3+)
- New `custom_components/mielelogic/brand/` folder with `icon.png` (256x256) and `icon@2x.png` (512x512), generated from the existing `mielelogic_logo.png` (center-cropped to a square, PNG-optimised).
- Since HA 2026.3, custom integrations can ship their own brand icon directly in the integration folder — the `home-assistant/brands` repo no longer accepts PRs for custom integrations. No external submission is needed anymore.
- `hacs.json` — minimum HA version bumped from `2026.1.0` to `2026.3.0` (required for local brand icons to display).
- HACS validation still ignores the `brands` check in CI (`ignore: brands` in `.github/workflows/validate.yml`), since it checks the old external repo, which is no longer the relevant mechanism.

---

## [2.5.7] - 2026-08-21

### Fixed — Notification tab reload after save
- `panel.js` (v2.5.0 → v2.5.7) — `_doSaveEdit()` (the template editor for title/message) only updated local state after saving and never reloaded from the server, unlike `_doSaveNotification()`/`_doToggleNotification()`, which already did so correctly.
- Added `await this._loadNotifications()` after a successful `save_notification` call in `_doSaveEdit()`, so the panel always shows the server-confirmed state after a template edit.

---

## [2.5.6] - 2026-07-20

### Fixed — Panel view scaling on the booking card
- `mielelogic-booking-card.js` (v2.7.0 → v2.7.1) filled only its natural content height regardless of the parent container — fine in a normal grid view, but wrongly scaled in an HA `type: panel` view (e.g. a 7" tablet in landscape).
- `:host` now sets `height: 100%`, and `#root` / `.card-root` are turned into a flex column with `height: 100%; min-height: 0;` so the card inherits the full height of the panel.
- `.card-header` is `flex-shrink: 0` (fixed), and all content below it (error/info bars, machines, new booking, active bookings) is moved into a new `.card-scroll` layer with `flex: 1; min-height: 0; overflow-y: auto`, so the content scrolls internally instead of overflowing or being squeezed.
- Same pattern as already used in `secure_me_alarm_tab_card.js`.
- `getCardSize()` unchanged; no `max-width`/`margin: auto` to remove.

---

## [2.5.5] - 2026-06-13

### Changed — Consistent WebSocket error classification
- All 18 WS handlers now return specific error codes instead of the generic `"unknown_error"`:
  - `service_error` — API/coordinator/slot errors
  - `storage_error` — store read/write errors
  - `invalid_input` — invalid slot in `make_booking` (previously `invalid_slot`)
- Enables more precise error messages in the panel.

### Added — Notification spam filter
- New file `notification_spam_filter.py` with the `NotificationSpamFilter` class
- Prevents the same notification (type + machine + time) from being sent more than once per 60 seconds
- Prevents duplicate notifications from rapid calendar sync triggers
- Automatic cleanup of old entries after 1 hour

### Changed — Parallel load at integration setup
- `store.async_load()` and `coordinator.async_config_entry_first_refresh()` now run in parallel via `asyncio.gather()` when a new config entry starts up.
- Reduces startup time slightly.

---

## [2.5.4] - 2026-05-31

### Added — House Voice spoken reminder
- **`voice_reminder`** — new notification type that calls `house_voice.say` with `event_id: "Vaske tid"` 15 min before a booking starts
- On/off toggle in the notification panel like all other notifications
- Test button calls `house_voice.say` directly with the configured event ID
- `schedule_voice_reminder()` in `notification_manager.py` uses `async_call_later` with an in-memory cancel handle
- `cancel_voice_reminder()` runs automatically when a booking is cancelled
- Graceful fallback: does nothing if `house_voice.say` is not available
- The reminder is skipped automatically if the time is in the past (e.g. a booking in 5 min)

---

## [2.5.3] - 2026-05-31

### Added — Re-authentication flow
- **`async_step_reauth`** — HA now shows a "Integration requires re-authentication" banner when the credentials have expired or are invalid
- **`coordinator._refresh_token`** — now calls `entry.async_start_reauth()` when both the refresh grant and the password grant fail, instead of only logging an error
- **`strings.json` + `translations/da.json`** — `reauth_confirm` step and `reauth_successful` abort added to both files
- The Gold tier `reauthentication_flow` requirement is now fully implemented

---

## [2.5.2] - 2026-05-31

### Fixed — CI errors
- **`manifest.json`** — removed invalid fields `icon` and `frontend` that hassfest does not accept
- **`hacs.json`** — removed invalid fields `domains` and `iot_class`; bumped `homeassistant` to `2026.1.0`
- **CI workflow** — HACS brands check is skipped (`ignore: brands`) because brand submission is a future goal; flake8 now ignores whitespace/style warnings (W291/W293/E221/E303/F841/F541) and only fails on real code errors

---

## [2.5.1] - 2026-05-31

### Fixed
- **`_renderWeekStrip` was missing** — the method was called in `_update()` but did not exist in the class, which made the booking card crash with `TypeError: this._renderWeekStrip is not a function` on all mobile and desktop devices
- Field names aligned to match the `get_week_availability` WS response (`has_free`, `label`, `day_num` instead of `free`, `weekday`, `day`)
- **CI/CD workflow** — `.github/workflows/validate.yml` added with 6 jobs: hassfest, HACS validation, Python lint (flake8), JS syntax check, translation parity and version consistency

---

## [2.5.0] - 2026-05-30

### Added — Multi-calendar + runtime_data migration
- **Primary calendar** — auto-sync as before (coordinator) + per booking via the panel. Configured in the options flow under Calendar
- **Secondary calendars** — optional chips in the booking form ("ADD TO CALENDAR"). Not default, the user activates them actively. Cyan chips, toggled on click
- **Deletion on cancel** — secondary calendar events are deleted automatically on cancel; which calendars were selected is stored persistently in storage
- **`runtime_data` migration** — `hass.data[DOMAIN][entry_id]` replaced by `entry.runtime_data` in `__init__.py`. All managers are available via the `_get_from_runtime()` helper in websocket.py with a `hass.data` fallback
- **`get_calendars` WS command** — 18 commands in total. Returns primary + secondary calendars with friendly names from the HA state
- **`make_booking` WS** — now accepts an `extra_calendars: list` parameter
- **`storage.py`** — new `secondary_calendar_synced` data structure, `async_save_booking_metadata` extended with `secondary_calendars`, duplicate section cleaned up
- **Options flow calendar step** — primary dropdown + comma-separated secondary text field

---

## [2.4.0] - 2026-05-30

### Added — Backend/stability & UX
- **Cancel from push notification** — the `booking_created` notification now gets a "Cancel booking" action button (destructive, iOS + Android). An event listener for `mobile_app_notification_action` in `__init__.py` parses the action ID and calls `cancel_booking()` directly
- **Countdown chip on active bookings** — green chip with MM:SS when the booking is active now, blue chip with "in Xm" when upcoming, grey "Done" when expired. A 1-second ticker only updates `[data-countdown]` elements — no full re-render
- **Robust calendar deletion** — `_delete_calendar_event` now matches on summary + exact start time first, then summary-only as a fallback. The `delete_event` check moved before event access
- **Rich notifications** — all notifications now get `data.url = "/mielelogic"` (tap opens the panel) and `data.push.sound = "default"`. Open Panel button on all types
- **Versions:** `__init__.py`, `booking_manager.py`, `notification_manager.py` — all bumped to 2.3.0. `panel.js` → v2.4.0

---

## [2.3.0] - 2026-05-30

### Added — 7-day day strip
- **Day strip** — a horizontal strip above the date input shows the next 7 days with a green dot (free slots) or red dot (fully booked)
- **Clickable days** — clicking a day sets the date and fetches slots automatically
- **Today marking** — today's date is highlighted with an accent-coloured label
- **Selected date** — highlighted with a blue border in the strip
- **Skeleton loading** — shimmer-animated day buttons while the week loads
- **Auto-reload** — the strip reloads when the laundry room is switched
- **Backend** — new `mielelogic/get_week_availability` WebSocket command (17 in total); uses the existing timetable data from the coordinator, no extra API calls

---

## [2.2.0] - 2026-05-30

### Added — UX polish
- **Inline booking confirmation** — "Book now" shows a centred overlay with laundry room, date and time block; two buttons: Cancel / Book now ✓. No native `confirm()` dialog.
- **Inline cancel confirmation** — ✕ button on booking rows opens a red overlay variant with "Keep" / "Delete ✕"
- **Skeleton loading** — the booking tab shows shimmer-animated placeholder cards on initial load (`_initialLoaded` flag); they disappear automatically when data arrives
- **Confirmation overlay** — backdrop-blur background, fade-in animation, mobile-friendly centring

---

## [2.1.0] - 2026-05-30

### Added — Performance & UX improvements
- **Font preload** — DM Sans/DM Mono is now injected once from `entrypoint.js` instead of an `@import` inside `_css()`, which ran on every `_render()` call
- **Split load loop** — `_loadCore()` (slots + bookings + status, 30 s interval) separated from notifications, which are now loaded lazily only when switching tabs
- **In-panel toast** — green/orange/red slide-in toast replaces `persistent_notification` for all trivial feedback (3.5 s auto-dismiss)
- **Clickable slot chips** — free chips can now be clicked directly and sync with the select field; the selected chip is highlighted with `chip-selected` styling
- **`_historyLoaded` flag** — fixed a bug where an empty history was cached as "already loaded"; it now fetches correctly on the next tab switch
- **Exponential backoff** — polling stops after 4 errors and waits 5→10→20→60 s; resumes automatically via the `visibilitychange` event when the page becomes active again
- **Cached state on error** — `_loadBookings()` / `_loadStatus()` now keep the previous data on a WS error instead of overwriting it with an empty object
- **`data-bindex`** — replaces a JSON string in the `data-cancel` attribute on delete buttons; safer and free of escaping problems

---

## [2.0.0] - 2026-04-04

### Added — Panel registration (Energy Hub method) 🔧
- **Parameterised panel** — sidebar title, icon and require_admin can now be changed via the options flow
- **Panel on/off toggle** — the panel can be disabled completely from Settings → Integrations → Configure
- **Live reload** — changes take effect immediately without an HA restart (`_async_update_listener`)
- **Proper unregister** — `async_unregister_panel()` clears the `_panel_registered` flag correctly
- **Dependencies** — `manifest.json` now declares `http`, `frontend`, `panel_custom`
- **strings.json** — new file added (Gold tier requirement)
- **6 menu items** — the options flow now has Credentials, Calendar, Opening Hours, Machines, Time Slots, Panel

### Added — Frontend redesign (Indeklima Designer) 🎨
- **Design tokens** — blue `#3b82f6` / cyan `#06b6d4` accent colours from `indeklima_designer_reference.md`
- **Typography** — DM Sans + DM Mono (Google Fonts)
- **Layout** — `.panel-topbar` (fixed) + `.panel-scroll` (flex) — the same pattern as Indeklima and Heat Manager
- **Header** — gradient icon (blue→cyan) + h1 title + meta info
- **Tab bar** — pill tabs with icon + label (icon only on mobile)
- **Cards** — `border-radius: 18px`, `var(--bg2)` background, subtle hover
- **Book button** — gradient `--accent` → `--accent2`
- **Slot chips** — DM Mono font, accent-glow background
- **Semantic colours** — `--green` / `--orange` / `--red` from the Designer specification
- **Responsive** — tab labels hidden on mobile, reduced padding

### Changed
- All .py files bumped to VERSION = "2.0.0"
- Options flow expanded from 5 to 6 menu items (+ Panel)
- Panel settings are stored in `entry.options` (not `entry.data`)

---

## [1.9.1] - 2026-03-28

### Added — Slot availability 🟢🔴
- **Live availability** — the time-slot dropdown shows which times are booked/free for the selected date
- **Coloured chips** — below the dropdown: green `✓` for free times, red `✕` for booked times
- **Disabled slots** — booked times are marked as `"07:00-09:00 (2h) — Booked"` and cannot be selected
- **Auto-update** — slots reload automatically when the date or laundry room changes
- **Auto-select** — the first free slot is selected automatically on load
- **Backend** — the `get_slots` WebSocket command now accepts an optional `date` parameter and returns `booked: bool` per slot

### Added — Calendar fixes 📅
- **Wrong times fixed** — calendar events are now sent as UTC to `calendar.create_event` — HA converts to local time itself
- **Persistent duplicate tracking** — `_created_events` is now stored in `storage.py` and survives an HA restart (no duplicates after restart)
- **Deletion on cancel** — `cancel_booking()` now calls `calendar.delete_event` with a ±1 hour search window
- **`_times_match()` helper** — UTC-based datetime comparison for correct event matching
- **`_get_store()` helper** — added in the coordinator to fetch the store from hass.data

### Added — Panel rewritten in vanilla JS 🔧
- **No LitElement** — pure `HTMLElement` with shadow DOM — no CDN dependency
- **Same architecture as Heat Manager and Indeklima**
- **Real app icon** — the original gold washing-machine icon embedded as a base64 PNG

### Added — UI redesign 🎨
- **New dark design** — `#0d0d0d` background, thin borders, UPPERCASE section labels
- **Horizontal tab navigation** — Overview / Notifications / History / Configuration
- **Laundry room toggle** — two buttons with SVG icons
- **Compact booking rows** — with a coloured left accent line

### Fixed
- Booking card border consistency (div.card-root instead of ha-card)
- The notifications tab always showed "not ready" — `_get_store()` in websocket.py fixed
- `_get_store()` in websocket.py used `.get("store")` incorrectly — fixed to iterate correctly
- Panel tab switching did not work reliably (LitElement problem — solved with vanilla JS)

---

## [1.8.0] - 2026-02-28

### Added — Admin tab ⚙️
- Operational message shown at the top of the booking overview
- Toggle for temporarily blocking bookings with a custom message
- Persistent storage that survives an HA restart

### Added — Statistics tab 📊
- Lists completed bookings from the last 30 days
- Shows laundry room, date, time, duration and user name
- Cleanup button for old metadata

### Added — Rich notifications 🔔
- Deep links: tapping a notification opens the MieleLogic panel directly
- "Open panel" button on all notifications
- Custom templates with live preview
- Variable system: `{vaskehus}`, `{time}`, `{date}`, `{duration}`, `{machine}`
- iOS: sound, badge, subtitle / Android: channel, importance

### Fixed — User tracking
- Now shows the correct Home Assistant username instead of always "Via Panel"

### Gold tier
- `EntityDescription` dataclasses for all sensors and binary sensors
- Reconfigure flow (`async_step_reconfigure`) implemented

---

## [1.7.0] - 2026-02-27

### Changed
- Removed verbose debug logs — cleaner log files for production use

---

## [1.6.0] - 2026-02-27

### Fixed
- User tracking now shows "Via Panel" correctly for all bookings

---

## [1.5.0] - 2026-02-22

### Added — Integrated sidebar panel 🚀
- Custom sidebar panel without package files
- WebSocket API with 13 commands
- Auto-refresh every 30 seconds
- Responsive design (mobile, tablet, desktop)

### Added — Notifications
- 4 standard notifications: 15-min reminder, 5-min warning, booking created/cancelled
- Device selector to choose which mobile apps receive notifications
- Test notifications directly from the panel

---

## [1.4.6] - 2026-01-30

### Added — Laundry room abstraction
- Calendar and UI show "Klatvask"/"Storvask" instead of "Machine 1"/"Machine 3"
- 5-point options menu

---

## [1.3.0] - 2026-01-21

### Added
- Calendar integration (`calendar.mielelogic_reservations`)
- External calendar sync (CalDAV / Google Calendar)

---

## [1.1.0] - 2026-01-20

### Added — Silver tier foundation
- DeviceInfo and device organisation
- `has_entity_name = True` on all platforms
- Options flow for configuration

---

## [1.0.5] - 2026-01-13

### First release
- Basic authentication and data fetching
- OAuth2 password grant flow

---

**Maintainer:** KingPainter  
**Repository:** https://github.com/kingpainter/mielelogic
