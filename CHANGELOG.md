# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
