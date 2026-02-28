# MieleLogic Integration for Home Assistant

[![Version](https://img.shields.io/badge/version-1.9.1-blue.svg)](https://github.com/kingpainter/mielelogic/releases)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2026.1%2B-blue.svg)](https://www.home-assistant.io/)

Professional Home Assistant integration for MieleLogic laundry services with **integrated panel** 🎛️, **real-time notifications** 🔔, **user tracking** 👤, smart booking by house name (Klatvask/Storvask) 🧺, and comprehensive automation support.

**NEW in v1.9.1:** Live machine status bubbles + reliable card border! 🫧  
**NEW in v1.7.0:** Production-ready code with clean logging! 🧹  
**NEW in v1.5.0:** NO package files needed - professional integrated panel! 🎛️

---

## 📸 Screenshots

### 🎛️ Panel — Booking (Desktop)
![Panel Booking](screenshots/booking-panel.png)

### 📱 Lovelace Card — Mobil
![Booking Card](screenshots/booking-card.png)

### 🫧 Maskinestatus
![Machine Status](screenshots/machine-status.png)

### 🔔 Notifikationer
![Notification Tab](screenshots/notification-tab.png)

---

## ✨ Key Features

### 🎛️ Integrated Panel (v1.5.0+)
- **Professional UI** - Custom sidebar panel, no package files needed!
- **Tab Navigation** - Booking and Notifications in one place
- **Real-time Updates** - Auto-refresh every 30 seconds
- **Responsive Design** - Perfect on mobile, tablet, and desktop
- **Smart Layouts** - 1 booking = centered, 2 bookings = side-by-side
- **User Tracking** - See who created each booking 👤
- **Machine Status** - Live bubble overview of all washers/dryers 🫧

### 🔔 Notification System (v1.5.1+)
- **Device Manager** - Select which mobile apps receive notifications
- **Automatic Notifications** - Auto-send on booking create/cancel
- **4 Smart Notifications**:
  - 🧺 15-minute reminder before booking starts
  - ⏰ 5-minute remaining warning
  - ✅ Booking created confirmation (auto-sent)
  - ❌ Booking canceled notification (auto-sent)
- **Test Functionality** - Send test messages to verify setup
- **Persistent Storage** - Settings survive restarts

### 🧺 Smart Booking
- **Vaskehus-Based** - Book by house name (Klatvask/Storvask) not machine numbers
- **Fixed Time Slots** - Configure standard booking blocks
- **Calendar Integration** - Visual overview with house names
- **Duplicate Prevention** - Advanced tracking prevents duplicate calendar events
- **Instant Feedback** - Booking appears immediately in panel

### 🏆 Enterprise Quality
- **Home Assistant 2026.1+ Ready** - Uses modern calendar services
- **Gold Tier Components** - Professional panel + notification system
- **Zero Dependencies** - No package files, no automations needed
- **Cache Management** - Intelligent API call optimization
- **Production Logging** - Clean logs with debug available when needed

---

## 🚀 What's New

### v1.9.1 (2026-02-28) - Machine Status + UI Fixes 🫧

**Live Machine Status:**
- 🫧 Bubble icons show all washers/dryers at a glance
- 🟢 Green = Ledig · 🟠 Orange = I gang · 🔵 Blue = Reserveret · ⚫ Grey = Lukket
- Appears between header and booking form
- Tooltip with full status on hover

**Card Border Fixed:**
- Reliable border that stays consistent regardless of content
- Hover effects no longer bleed outside card boundary
- Booking section visually consistent with form fields

**Panel Reactivity Fixed:**
- Tab switching now works correctly (was missing reactive properties)
- Notification edit modal opens and closes properly
- "Multiple versions of Lit" console warning eliminated

### v1.7.0 (2026-02-27) - Production Polish 🧹
- **Clean Logging** - Removed verbose debug logs
- **Better Error Messages** - Production-ready log levels
- **Code Quality** - All files version-bumped consistently
- **Stability** - Refined and tested for production use

### v1.6.0 (2026-02-27) - User Tracking Fixed 🎯
- **User Tracking Display** - Shows "📱 Via Panel" under bookings
- **Key Normalization** - Fixed datetime format mismatch
- **Reliable Metadata** - Consistent storage/retrieval across formats

### v1.5.2 (2026-02-23) - Calendar & Notifications 🎊
- **Duplicate Prevention** - Nuclear option tracking (WORKS!)
- **Automatic Notifications** - Auto-send on booking/cancel
- **Conditional Calendar** - Only one calendar active at a time
- **User Tracking Backend** - Metadata storage implemented

### v1.5.1 (2026-02-22) - Notification UI 🔔

**Complete Notification Management:**
- ✨ Notification tab in panel with full UI
- 📱 Device selector for choosing mobile apps
- 🔔 Toggle notifications on/off individually
- ✉️ Test button for each notification
- 💾 Persistent configuration storage

**User Experience:**
- Navigate between Booking and Notifications tabs
- Select devices with checkboxes
- Enable/disable notifications with toggles
- Send test messages with one click
- Settings survive Home Assistant restarts

### v1.5.0 (2026-02-22) - Integrated Panel 🎛️

**NO Package Files Needed:**
- ✅ Professional custom panel in sidebar
- ✅ WebSocket API for real-time communication
- ✅ Notification backend ready (UI in v1.5.1)
- ✅ Auto-refresh with error recovery
- ✅ Cache clearing for instant updates

**Responsive Design:**
- 📱 5 breakpoints (mobile/tablet/desktop)
- 🔄 98% width in landscape mode
- 🎨 Smart booking layout (1 centered, 2 side-by-side)
- 👆 Touch-optimized for iOS
- 🖥️ Retina display support

**Performance:**
- ⚡ 60-second coordinator polling (was 300s)
- 🔄 Force refresh after booking/cancel
- 🗑️ Cache clearing for instant sync
- 📊 ~1500 API calls/day (optimal)

---

## 📋 Requirements

### Critical Requirements
- **Home Assistant 2026.1.0 or newer** (REQUIRED)
- MieleLogic account with active laundry access
- Your laundry ID (found in MieleLogic app URL)

### Why HA 2026.1+?
- Calendar services (`calendar.create_event`, `calendar.get_events`)
- Modern WebSocket command structure
- Service response support
- Frontend panel architecture

---

## 📥 Installation

### Method 1: HACS (Recommended - Coming Soon)
1. Open HACS → Integrations
2. Click "+" → Search "MieleLogic"
3. Click "Download"
4. Restart Home Assistant
5. Go to Settings → Add Integration → "MieleLogic"

### Method 2: Manual Installation
1. Download latest release from [GitHub Releases](https://github.com/kingpainter/mielelogic/releases)
2. Extract and copy `mielelogic` folder to `custom_components/`
3. Restart Home Assistant
4. Go to Settings → Add Integration → "MieleLogic"

### Method 3: Git Clone (Development)
```bash
cd /config/custom_components/
git clone https://github.com/kingpainter/mielelogic.git
cd mielelogic
rm -rf .git .github
# Restart Home Assistant
```

---

## ⚙️ Configuration

### Initial Setup

**Settings → Devices & Services → Add Integration → MieleLogic**

Enter your credentials:
```
Username:        your_mielelogic_username
Password:        your_password
Client ID:       YV1ZAQ7BTE9IT2ZBZXLJ (default)
Laundry ID:      your_laundry_id (e.g., 3444)
Client Secret:   (leave blank)
Opening Time:    07:00
Closing Time:    21:00
```

**Default configuration is applied automatically:**
- Klatvask → Machine 1
- Storvask → Machine 4
- Time slots configured

### Configure Panel

**Panel appears in sidebar: Settings → MieleLogic (🧺 icon)**

**Two tabs:**
1. **📅 Booking** - Make and manage reservations
2. **🔔 Notifikationer** - Configure notifications

### Configure Notifications (v1.5.1)

**Navigate to: Panel → Notifikationer Tab**

**Step 1: Select Devices**
```
📱 Mobile Enheder
☐ iPhone (Flemming)
☐ iPad Pro
☐ Android Phone

[💾 Gem Enheder]
```

**Step 2: Enable Notifications**
```
🔔 Notifikationer

☑️ 🧺 Vasketid om 15 minutter    [✉️ Test]
    Din {vaskehus} booking starter kl. {time}

☑️ ⏰ 5 minutter tilbage         [✉️ Test]
    {vaskehus} er færdig om 5 minutter

☑️ ✅ Booking bekræftet           [✉️ Test]
    {vaskehus} booket {date} kl. {time}

☐ ❌ Booking annulleret           [✉️ Test]
    {vaskehus} booking slettet
```

**Step 3: Test Notifications**
- Click ✉️ Test button
- Notification sent to selected devices
- Verify message arrives

### Configure Machines

**Settings → MieleLogic → Configure → Configure Machines**

Map each vaskehus to its machine:
```
Klatvask primary machine:  [1 ▼]  # Choose 1 or 2
Storvask primary machine:  [4 ▼]  # Choose 3, 4, or 5
```

### Configure Time Slots

**Settings → MieleLogic → Configure → Configure Time Slots**

**Default Slots:**
- **Storvask** (6 slots): 07:00-09:00, 09:00-12:00, 12:00-14:00, 14:00-17:00, 17:00-19:00, 19:00-21:00
- **Klatvask** (7 slots): 07:00-09:00, 09:00-11:00, 11:00-13:00, 13:00-15:00, 15:00-17:00, 17:00-19:00, 19:00-21:00

**Features:**
- Add unlimited time slots
- Delete slots with 🗑️ button
- Auto-sorted by start time
- Duration calculated automatically

---

## 🎯 Usage

### Booking via Panel

**Panel → Booking Tab**

```
1. Select vaskehus:  [Klatvask ▼]
2. Select time:      [09:00-11:00 (2t) ▼]
3. Select date:      [23-02-2026]
4. Click:            [📅 BOOK NU]
5. ✅ Booking appears instantly!
```

### Managing Bookings

**View bookings:**
- 0 bookings → "📭 Ingen aktive bookinger"
- 1 booking → Centered card display
- 2 bookings → Side-by-side grid

**Delete booking:**
- Click 🗑️ button
- Confirm deletion
- Booking disappears instantly

### Entities Created

#### Sensors (4 total)
```
sensor.mielelogic_reservations           # Your bookings
sensor.mielelogic_account_balance        # Prepaid balance
sensor.mielelogic_machine_status         # All machines
sensor.mielelogic_vaskehus_config        # Configuration
```

#### Binary Sensors (6 total)
```
binary_sensor.mielelogic_has_reservation
binary_sensor.mielelogic_reservation_starting_soon
binary_sensor.mielelogic_reservation_ending_soon
binary_sensor.mielelogic_low_balance
binary_sensor.mielelogic_available_machine
binary_sensor.mielelogic_all_machines_busy
```

#### Calendar (1)
```
calendar.mielelogic_reservations         # Visual timeline
```

### Services

#### Make Reservation
```yaml
service: mielelogic.make_reservation
data:
  machine_number: 1
  start_time: "2026-02-23 14:00:00"
  duration: 120
```

#### Cancel Reservation
```yaml
service: mielelogic.cancel_reservation
data:
  machine_number: 1
  start_time: "2026-02-23 14:00:00"
  end_time: "2026-02-23 16:00:00"
```

---

## 🤖 Automation Examples

### Notification Reminder (Built-in v1.5.1!)
```yaml
# Now built into panel!
# Just enable in Notifikationer tab
# No automation needed
```

### Cancel if Sick
```yaml
automation:
  - alias: "Cancel laundry if sick"
    trigger:
      - platform: state
        entity_id: input_boolean.im_sick
        to: "on"
    condition:
      - condition: state
        entity_id: binary_sensor.mielelogic_has_reservation
        state: "on"
    action:
      - service: mielelogic.cancel_reservation
        data:
          machine_number: 1  # Adjust per your setup
```

### Low Balance Alert
```yaml
automation:
  - alias: "Low balance notification"
    trigger:
      - platform: state
        entity_id: binary_sensor.mielelogic_low_balance
        to: "on"
    action:
      - service: notify.mobile_app
        data:
          title: "💰 Lav saldo!"
          message: >
            Kun {{ states('sensor.mielelogic_account_balance') }} kr tilbage.
            Husk at fylde op!
```

---

## 🔧 Troubleshooting

### Panel Not Appearing

**Symptom:** No 🧺 icon in sidebar

**Fix:**
1. Verify HA version ≥ 2026.1.0
2. Check logs for panel registration errors
3. Restart Home Assistant
4. Clear browser cache (Ctrl+Shift+R)

### Notifications Not Working

**Symptom:** Test button works but no real notifications

**Debug:**
1. Panel → Notifikationer → Check devices selected
2. Panel → Notifikationer → Enable notifications with toggle
3. Check Home Assistant Companion app installed on mobile
4. Verify app has notification permissions

**Common Issues:**
- No devices selected → Select at least one device
- Notification disabled → Enable with toggle switch
- Test works but real doesn't → Backend triggers not implemented (future)

### External Delete Not Syncing

**Symptom:** Booking deleted on mielelogic.com still shows in panel

**Expected Behavior:** Syncs within 60-90 seconds

**If longer:**
1. Check coordinator polling: Should be 60s (not 300s)
2. Check logs for API errors
3. Manually reload integration if needed

### Booking Not Appearing

**Symptom:** Created booking doesn't show instantly

**Fix:**
1. Check v1.5.0+ installed (has cache clearing)
2. Check logs for WebSocket errors
3. Verify booking actually created on mielelogic.com

### Calendar Service Errors

**Symptom:** "Service calendar.create_event not found"

**Fix:**
- **Upgrade to HA 2026.1.0+** (REQUIRED)
- Integration uses modern calendar services
- Not available in older HA versions

---

## 📊 Architecture

### Data Flow (v1.5.0+)
```
Panel (frontend/panel.js)
    ↓ WebSocket
websocket.py (13 commands)
    ↓ Managers
time_manager.py / booking_manager.py / notification_manager.py
    ↓ Services / Storage
services.py / storage.py
    ↓ API
MieleLogic API
```

### Storage Pattern
```
.storage/mielelogic.panel_config
{
  "devices": ["notify.mobile_app_iphone"],
  "notifications": {
    "reminder_15min": {
      "enabled": true,
      "title": "🧺 Vasketid om 15 minutter",
      "message": "Din {vaskehus} booking starter kl. {time}"
    }
  }
}
```

### File Structure (v1.5.1)
```
custom_components/mielelogic/
├── __init__.py              # Integration setup
├── manifest.json            # Metadata (v1.5.1)
├── const.py                 # Constants (v1.5.1)
│
├── config_flow.py           # Configuration UI
├── coordinator.py           # Data updates
├── diagnostics.py           # Debug export
│
├── sensor.py                # 4 sensors
├── binary_sensor.py         # 6 binary sensors
├── calendar.py              # Calendar integration
│
├── services.py              # Make/cancel services
├── panel.py                 # Panel registration (v1.5.0)
├── time_manager.py          # Time slot logic (v1.5.0)
├── booking_manager.py       # Booking operations (v1.5.0)
├── websocket.py             # WebSocket API (v1.5.0)
├── storage.py               # Persistent storage (v1.5.0)
├── notification_manager.py  # Send notifications (v1.5.0)
│
├── frontend/                # Panel UI
│   ├── entrypoint.js        # Entry point
│   ├── panel.js             # Panel UI (v1.5.1)
│   └── mielelogic-booking-card.js  # Lovelace card (v1.9.1)
│
└── translations/
    ├── da.json              # Danish
    └── en.json              # English
```

---

## 🗺️ Roadmap

### ~~v1.5.2~~ ✅ Done
- [x] Only one active calendar (MieleLogic OR external, not both)
- [x] Show which HA user created booking
- [x] Automatic notifications on booking/cancel
- [x] Live machine status overview (v1.9.1)

### v1.6.0 - Weekend-Specific Hours
- [ ] Different opening hours for weekends
- [ ] Holiday calendar support
- [ ] Extended reservation service

**Priority:** Low  
**ETA:** 1-2 months

### v2.0.0 - Production Polish
- [ ] Multi-laundry support
- [ ] Historical data tracking
- [ ] Two-way calendar sync
- [ ] Advanced automation triggers
- [ ] Rate limiting with repair issues

**Priority:** Low  
**ETA:** 3-6 months

---

## 🤝 Contributing

Contributions welcome!

1. Fork repository
2. Create feature branch
3. Test thoroughly
4. Submit pull request

### Development Setup
- Python 3.11+
- Home Assistant 2026.1+
- MieleLogic test account
- Git via GitHub Desktop

---

## 📞 Support

### Issues
Report bugs: [GitHub Issues](https://github.com/kingpainter/mielelogic/issues)

### Discussion
- GitHub Discussions
- Home Assistant Community Forum (coming soon)

### Contact
- **Developer:** KingPainter
- **GitHub:** [@kingpainter](https://github.com/kingpainter)
- **Language:** Danish/English

---

## 📜 License

MIT License - see [LICENSE.md](LICENSE.md)

---

## 🙏 Credits

- [Home Assistant](https://www.home-assistant.io/)
- [MieleLogic API](https://mielelogic.com/)
- [Anthropic Claude](https://www.anthropic.com/) for development assistance

---

## 📚 Documentation

- [CHANGELOG.md](CHANGELOG.md) - Full version history
- [Installation Guide](INSTALLATION_GUIDE_v1_5_0.md) - Detailed setup
- [Release Notes](v1_5_0_RELEASE_NOTES.md) - v1.5.0 details

---

**Current Version:** 1.9.1  
**Released:** 28. februar 2026  
**Status:** Production Ready - Machine Status + Reliable UI! 🎉

Made with ❤️ by KingPainter
