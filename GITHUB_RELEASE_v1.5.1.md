# 🔔 MieleLogic v1.5.1 - Notification System Complete

**Release Date:** February 22, 2026  
**Type:** Feature Release  
**Breaking Changes:** None  

---

## 🎉 What's New

### Complete Notification Management UI

v1.5.1 adds the missing piece from v1.5.0 - a beautiful, functional notification management interface!

**New Features:**
- 📱 **Device Selector** - Choose which mobile apps receive notifications
- 🔔 **4 Smart Notifications** ready to use:
  - 15-minute reminder before booking starts
  - 5-minute remaining warning  
  - Booking created confirmation
  - Booking canceled notification
- ✉️ **Test Functionality** - Send test messages with one click
- 🎛️ **Toggle System** - Enable/disable notifications individually
- 💾 **Persistent Storage** - Settings survive restarts

### Tab Navigation

The panel now has two tabs:
- **📅 Booking** - Make and manage reservations (v1.5.0)
- **🔔 Notifikationer** - Configure notifications (v1.5.1)

---

## 📸 Screenshots

### Notification Tab - Device Selection
```
📱 Mobile Enheder
Vælg hvilke enheder der skal modtage notifikationer

☑️ iPhone (Flemming)
☐ iPad Pro
☐ Android Phone

[💾 Gem Enheder]
```

### Notification Tab - Management
```
🔔 Notifikationer
Aktiver og test notifikationer

☑️ 🧺 Vasketid om 15 minutter    [✉️ Test]
    Din Klatvask booking starter kl. 14:30

☑️ ⏰ 5 minutter tilbage         [✉️ Test]
    Klatvask er færdig om 5 minutter

☑️ ✅ Booking bekræftet           [✉️ Test]
    Klatvask booket 22-02-2026 kl. 14:30

☐ ❌ Booking annulleret           [✉️ Test]
    Klatvask booking slettet
```

---

## 🚀 Quick Start

### For New Users

1. **Install Integration**
   - Settings → Integrations → Add Integration → "MieleLogic"
   - Enter credentials

2. **Open Panel**
   - Sidebar → MieleLogic (🧺 icon)

3. **Configure Notifications**
   - Click "🔔 Notifikationer" tab
   - Select your mobile devices
   - Click "💾 Gem Enheder"
   - Enable desired notifications with toggle
   - Click "✉️ Test" to verify

### For v1.5.0 Users

**Upgrade is seamless:**

1. Replace files with v1.5.1
2. Restart Home Assistant
3. Open panel → New "Notifikationer" tab appears
4. Configure devices and notifications

No migration needed! Your existing booking setup continues working.

---

## ✅ What Works

### Fully Functional
- ✅ Device selection and saving
- ✅ Notification toggle (enable/disable)
- ✅ Test notification sending
- ✅ Persistent storage (survives restart)
- ✅ WebSocket communication
- ✅ Mobile app detection

### Backend Ready, UI Complete
- ✅ 4 default notification templates
- ✅ Variable replacement ({vaskehus}, {time}, etc.)
- ✅ Service integration
- ✅ Storage system

### Coming in Future Updates
- ⏳ Automatic notification triggers (15-min reminder automation)
- ⏳ Custom notification templates
- ⏳ Notification history
- ⏳ Delivery status tracking

---

## 📦 Installation

### Requirements
- **Home Assistant 2026.1.0+** (REQUIRED)
- MieleLogic account with active laundry access
- Home Assistant Companion app on mobile device

### Method 1: Manual Installation
1. Download `mielelogic_v1.5.1.zip` from this release
2. Extract to `custom_components/mielelogic/`
3. Restart Home Assistant
4. Configure via UI

### Method 2: Git Clone
```bash
cd /config/custom_components/
git clone -b v1.5.1 https://github.com/kingpainter/mielelogic.git
# Restart Home Assistant
```

---

## 🔧 Technical Details

### New Files (v1.5.1)
- `frontend/panel.js` - Updated with notification tab UI
- `const.py` - Version bumped to 1.5.1
- `manifest.json` - Version bumped to 1.5.1

### Modified Components
- **Panel JavaScript:**
  - Added tab system (Booking / Notifikationer)
  - Added device selector UI
  - Added notification list rendering
  - Added toggle handlers
  - Added test notification functionality
  - Comprehensive CSS for notification UI

### WebSocket API (from v1.5.0)
```python
# Used by notification tab:
mielelogic/get_devices      # Get available and configured devices
mielelogic/save_devices     # Save device selection
mielelogic/get_notifications # Get notification configs
mielelogic/save_notification # Update notification settings
mielelogic/test_notification # Send test message
```

### Storage Format
```json
{
  "devices": [
    "notify.mobile_app_iphone",
    "notify.mobile_app_ipad"
  ],
  "notifications": {
    "reminder_15min": {
      "enabled": true,
      "title": "🧺 Vasketid om 15 minutter",
      "message": "Din {vaskehus} booking starter kl. {time}"
    }
  }
}
```

---

## 🎯 What Changed Since v1.5.0

### Added
- Tab navigation system in panel
- Device selector with checkboxes
- Notification list with toggles
- Test notification buttons
- Persistent configuration UI
- CSS styling for notification components
- State management for notification data
- WebSocket data loading methods

### Changed
- Panel now has two tabs instead of single view
- Version bumped to 1.5.1 in all files

### Fixed
- None (no bugs reported in v1.5.0)

---

## 📊 Complete Feature Matrix

### v1.5.1 Features
| Feature | Status | Notes |
|---------|--------|-------|
| Integrated Panel | ✅ Complete | Sidebar panel, no package files |
| Booking Tab | ✅ Complete | Make/cancel reservations |
| Notification Tab | ✅ Complete | Full UI for device & notification management |
| Device Selection | ✅ Complete | Checkbox list with save |
| Notification Toggles | ✅ Complete | Enable/disable individual notifications |
| Test Notifications | ✅ Complete | Send test messages |
| Persistent Storage | ✅ Complete | Settings survive restarts |
| Responsive Design | ✅ Complete | Mobile/tablet/desktop optimized |
| Real-time Updates | ✅ Complete | Auto-refresh every 30s |
| Smart Layouts | ✅ Complete | 1 booking centered, 2 side-by-side |
| WebSocket API | ✅ Complete | 13 commands total |

### Notification System
| Notification | Status | Trigger |
|--------------|--------|---------|
| 15-min reminder | ✅ Backend ready | Manual (automation needed) |
| 5-min remaining | ✅ Backend ready | Manual (automation needed) |
| Booking created | ✅ Backend ready | Manual (automation needed) |
| Booking canceled | ✅ Backend ready | Manual (automation needed) |

---

## 🐛 Known Issues

### None Reported
v1.5.0 was stable, v1.5.1 adds only UI - no backend changes.

If you encounter issues, please report on [GitHub Issues](https://github.com/kingpainter/mielelogic/issues).

---

## 🔄 Migration Guide

### From v1.5.0 → v1.5.1
**Zero changes required!**

1. Replace files
2. Restart HA
3. New "Notifikationer" tab appears automatically
4. Configure devices (optional)

Your existing:
- ✅ Bookings continue working
- ✅ Machine config preserved
- ✅ Time slots preserved
- ✅ Calendar integration unchanged

### From v1.4.6 → v1.5.1
**Seamless upgrade!**

1. Backup current installation (optional but recommended)
2. Replace all files with v1.5.1
3. Restart Home Assistant
4. Panel appears in sidebar
5. Optional: Delete `config/packages/mielelogic_booking.yaml` (no longer needed)

**What changes:**
- NO package file needed anymore
- Booking now via panel instead of dashboard
- Notifications available

**What stays the same:**
- All entities continue working
- Services unchanged
- Entity IDs preserved
- Config preserved

---

## 📝 Release Files

### Included in Release
```
mielelogic_v1.5.1.zip contains:
├── __init__.py
├── manifest.json (v1.5.1)
├── const.py (v1.5.1)
├── config_flow.py
├── coordinator.py
├── diagnostics.py
├── sensor.py
├── binary_sensor.py
├── calendar.py
├── services.py
├── panel.py
├── time_manager.py
├── booking_manager.py
├── websocket.py
├── storage.py
├── notification_manager.py
├── frontend/
│   ├── entrypoint.js
│   └── panel.js (v1.5.1)
└── translations/
    ├── da.json
    └── en.json
```

### Documentation
- CHANGELOG.md - Full version history
- README.md - Complete usage guide
- INSTALLATION_GUIDE_v1_5_0.md - Setup instructions

---

## 🙏 Thanks

Special thanks to:
- Home Assistant community for testing
- Beta testers for feedback on v1.5.0
- Claude (Anthropic) for development assistance

---

## 🔗 Links

- **Repository:** https://github.com/kingpainter/mielelogic
- **Issues:** https://github.com/kingpainter/mielelogic/issues
- **Documentation:** [README.md](README.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)

---

## 🎊 What's Next?

### v1.5.2 - Calendar Improvements
- Only one active calendar
- Better sync (delete mielelogic → delete calendar)
- Show which HA user created booking
- Default calendar selection

**Expected:** 1-2 weeks

---

**Enjoy your notifications!** 🔔

Made with ❤️ by KingPainter
