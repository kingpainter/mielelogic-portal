# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.1] - 2026-02-28

### Fixed - Booking Card UI 🎨
- **Card Border** - Replaced `ha-card` custom element with plain `div.card-root` for reliable, consistent border rendering across all states
- **Hover Effect** - Booking items now use `inset box-shadow` instead of `border`/`outline` — hover highlight can no longer bleed outside card border
- **Booking Section Layout** - Booking list wrapped in `bookings-block` container matching `form-block` style for visual consistency
- **Notification Tab** - Fixed `_get_store()` lookup in `websocket.py` — notification tab was always returning "not ready" due to wrong dict lookup pattern

### Fixed - Panel Reactivity 🔧
- **Tab Switching** - `currentTab`, `editingNotificationId`, `editTitle`, `editMessage` added to LitElement `static get properties()` — tabs and edit modal now re-render correctly on state change
- **Lit Import** - Changed from `lit-element@2.4.0` (unpkg) to `lit@2` — eliminates "Multiple versions of Lit" console warning
- **Notifications Object** - Uses spread operator (`{ ...notifications, [id]: ... }`) to trigger LitElement reactivity on notification updates

### Added - Machine Status Block ✨
- **Live Machine Overview** - New bubble status block between header and booking form shows all washers/dryers as coloured icons
- **State Colours** - 🟢 Ledig · 🟠 I gang · 🔵 Reserveret · ⚫ Lukket
- **Machine Type Icons** - 🫧 for washers, ♨️ for dryers
- **Tooltip** - Hover shows full machine name and status text from Miele API
- **Responsive** - Horizontally scrollable on small screens with hidden scrollbar

### Technical
- `websocket.py` v1.9.1 — `_get_store()` now iterates config entry dict like other manager lookups
- `panel.js` v1.5.1 — Lit import fixed, 4 missing reactive properties added, notifications use spread for reactivity
- `mielelogic-booking-card.js` v1.9.1 — `ha-card` → `div.card-root`, inset hover shadow, `bookings-block` wrapper, `_loadMachines()` + `_renderMachines()` added

---

## [1.7.0] - 2026-02-27

### Changed - Code Quality 🧹
- **Cleaned Debug Logging** - Removed verbose 🔍 DEBUG logs from v1.6.0 debugging session
- **Better Production Logs** - Essential info at INFO level, details at DEBUG level
- **Reduced Log Spam** - Cleaner log files for production use

### Technical
- Simplified logging in booking_manager.py, websocket.py, storage.py
- Maintained essential error and warning messages
- Debug logs still available when log level set to debug

## [1.6.0] - 2026-02-27

### Fixed - User Tracking Display 🎯
- **Key Format Mismatch** - Fixed datetime key normalization
  - Save used: "2026-05-23 17:00:00" (space)
  - Get used: "2026-05-23T17:00:00" (T separator)
  - Solution: Normalize both formats to consistent keys
- **User Tracking Now Works** - Displays "📱 Via Panel" under all bookings
- **Metadata Retrieval** - Reliable lookup across different datetime formats

### Added - Debug Logging (Temporary)
- Comprehensive logging for troubleshooting (removed in v1.7.0)
- Full trace through save/retrieve workflow
- Helpful for future debugging sessions

## [1.5.2] - 2026-02-23

### Added - User Tracking 👤
- **Booking Metadata** - Track which Home Assistant user created each booking
- **Display in Panel** - Shows "👤 Username" under each booking
- **Automatic Cleanup** - Old booking metadata cleaned up after 7 days
- **Privacy Friendly** - Only stores username, not sensitive data

### Added - Automatic Notifications 📨
- **Booking Created** - Automatically sends notification when booking is made
- **Booking Canceled** - Automatically sends notification when booking is deleted
- Works with notification settings from panel (must be enabled + devices selected)

### Changed - Calendar Improvements 📅
- **Conditional Calendar Registration** - Only one calendar active at a time
  - If external sync disabled → MieleLogic calendar visible
  - If external sync enabled → MieleLogic calendar hidden, only external calendar shows
  - Prevents duplicate calendar confusion
- **Improved Logging** - Clear messages about which calendar mode is active

### Fixed
- Calendar duplication when external sync enabled
- User confusion with two identical calendars showing same events
- Booking/cancellation notifications not being sent automatically

### Technical
- `storage.py` - Added booking metadata storage system
- `booking_manager.py` - Captures user context, sends notifications on booking/cancel
- `websocket.py` - Includes user metadata in booking responses  
- `panel.js` - Displays created_by username in booking cards
- `calendar.py` - Conditional entity registration based on `coordinator.sync_to_calendar`
- `__init__.py` - Pass notification_manager to booking_manager
- Version bumped to 1.5.2

---

## [1.5.1] - 2026-02-22

### Added - Notification UI ✨
- **Notification Tab** in panel with complete UI for managing notifications
- **Device Selector** - Choose which mobile apps receive notifications
- **4 Default Notifications** ready to use:
  - 15-minute reminder before booking starts
  - 5-minute remaining warning
  - Booking created confirmation
  - Booking canceled notification
- **Test Notifications** - Send test messages to verify configuration
- **Toggle System** - Enable/disable individual notifications
- **Persistent Storage** - Notification settings survive restarts

### Changed
- **Panel Navigation** - Added tab system (Booking / Notifikationer)
- **Version** bumped to 1.5.1

### Technical
- Added `loadNotificationData()` method for loading devices and notification configs
- Added `handleDeviceToggle()` for device selection management
- Added `saveDevices()`, `toggleNotification()`, `testNotification()` methods
- Comprehensive CSS styling for notification UI
- WebSocket integration fully functional

---

## [1.5.0] - 2026-02-22

### Added - Integrated Panel 🚀
- **Custom Panel** - NO package files needed anymore!
- **WebSocket API** - 13 commands for real-time communication
- **Notification Backend** - Complete system ready for UI (delivered in v1.5.1)
- **Panel Registration** - Following Secure Me/Alarmo pattern
- **Auto-Refresh** - Panel updates every 30 seconds with smart error handling
- **Cache Management** - Clear cache on booking/cancel for instant updates

### Added - Responsive Design 📱
- **5 Breakpoints** - Portrait, landscape, tablet, desktop optimization
- **Full-Width Landscape** - 98% width utilization in landscape mode
- **Smart Booking Layout**:
  - 1 booking = centered (max 500px)
  - 2 bookings = side-by-side grid
  - Mobile = stacked (always)
- **Touch Optimized** - Smooth scrolling on iOS
- **High-DPI Support** - Retina display optimization

### Changed - Performance
- **Polling Interval** reduced from 300s to 60s
- **Force Refresh** after booking/cancel operations
- **Cache Clearing** before coordinator refresh
- **Panel Refresh** with error recovery (stops after 3+ consecutive errors)

### Fixed
- **Panel Duplicate Registration** - Check before registering
- **Calendar Services** - Graceful fallback for HA < 2026.1
- **WebSocket Errors** - Proper error handling when connection closes
- **External Booking Delete** - Now syncs within 60-90 seconds

### Technical
- New files: `panel.py`, `time_manager.py`, `booking_manager.py`, `websocket.py`, `storage.py`, `notification_manager.py`
- New folder: `frontend/` with `entrypoint.js` and `panel.js`
- Data structure: Coordinator + managers in dict pattern (Secure Me style)
- Platform access: `coordinator = hass.data[DOMAIN][entry_id]["coordinator"]`
- WebSocket commands: booking (5) + notifications (5) + future expansion
- Version updated across all 14 Python files

### Breaking Changes
None! 100% backward compatible with v1.4.6.

### Migration
1. Backup your current v1.4.6 installation
2. Copy all new files to `custom_components/mielelogic/`
3. Restart Home Assistant
4. Panel appears automatically in sidebar
5. Optional: Delete old `config/packages/mielelogic_booking.yaml`

### Requirements
- **Home Assistant 2026.1.0+** (CRITICAL)
- Calendar services require HA 2026+ for full functionality

---

## [1.4.6] - 2026-01-30

### Added - Vaskehus Abstraction
- **Machine Configuration** - Select primary machine per vaskehus
- **Time Slots Configuration** - Unlimited custom time slots
- **Calendar Vaskehus Names** - Shows "Klatvask booket" not "Maskine 1"
- **Booking Package** - Complete vaskehus-based booking dashboard
- **Enhanced Options Flow** - 5-option menu (was 3)

### Changed
- Time slots now configurable via Options Flow
- Machine mapping configurable per vaskehus
- Calendar displays vaskehus names everywhere
- Package file uses vaskehus abstraction

---

## [1.4.5] - 2026-01-30

### Added - Services
- `mielelogic.make_reservation` service
- `mielelogic.cancel_reservation` service
- Service response support (`supports_response="optional"`)
- Manual booking dashboard package

### Changed
- Naming consistency: "MieleLogic" everywhere (not "Portal")
- Entity prefix: `sensor.mielelogic_*`
- Device name: "MieleLogic"

### Fixed
- Timezone-aware service calls
- Service validation errors

---

## [1.3.2] - 2026-01-24

### Added
- Opening hours configuration
- Enhanced sensor display ("Lukket indtil kl. 07:00")
- Safe config defaults

### Fixed
- Config access crashes on missing data

---

## [1.3.1] - 2026-01-24

### Added
- External calendar sync (CalDAV/Google Calendar)
- Menu-based Options Flow (2 options)

---

## [1.3.0] - 2026-01-21

### Added
- Calendar integration (`calendar.mielelogic_reservations`)
- 4 automation blueprints
- Timezone fix for binary sensors

---

## [1.2.0] - 2026-01-20

### Added
- 6 binary sensors for automation
- Enhanced attributes with structured data
- Response caching (60s TTL, 90% API reduction)

---

## [1.1.0] - 2026-01-20

### Added - Silver Tier Foundation
- Device organization with DeviceInfo
- Modern entity naming (has_entity_name = True)
- Options flow for configuration
- Smart token refresh (refresh_token → password grant fallback)

---

## [1.0.5] - 2026-01-13

### Added - Initial Release
- Basic authentication and data fetching
- Flat sensor structure
- OAuth2 password grant flow

---

## Legend

- 🚀 Major new feature
- ✨ Minor new feature  
- 🔧 Bug fix
- 📱 UI/UX improvement
- ⚡ Performance improvement
- 🔒 Security improvement
- 📝 Documentation
- 🎨 Visual/styling changes

---

**Maintainer:** KingPainter  
**Repository:** https://github.com/kingpainter/mielelogic  
**License:** MIT
