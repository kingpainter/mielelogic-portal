# MieleLogic Integration for Home Assistant

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/kingpainter/mielelogic/releases)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2026.1%2B-blue.svg)](https://www.home-assistant.io/)
[![Quality Scale](https://img.shields.io/badge/Quality%20Scale-Gold%20🏆-gold.svg)](quality_scale.yaml)

Professional Home Assistant integration for MieleLogic laundry services with **integrated panel** 🎛️, **real-time notifications** 🔔, **user tracking** 👤, **admin controls** ⚙️, smart booking by house name (Klatvask/Storvask) 🧺, and comprehensive automation support.

**NEW in v2.0.0:** Admin tab, booking statistics, real user tracking, Gold tier compliance! 🏆  
**NEW in v1.9.1:** Live machine status bubbles + reliable card border! 🫧  
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
- **4 Tabs** - Booking, Notifikationer, Admin og Statistik
- **Real-time Updates** - Auto-refresh every 30 seconds
- **Responsive Design** - Perfect on mobile, tablet, and desktop
- **User Tracking** - See who created each booking 👤
- **Machine Status** - Live bubble overview of all washers/dryers 🫧
- **Opening Hours** - Automatic closed state when laundry is closed

### ⚙️ Admin Controls (v2.0.0)
- **Driftsbesked** - Show info message to all users in booking card
- **Booking Spærring** - Lock booking with custom message
- **Persistent** - Settings survive restarts

### 📊 Booking Statistics (v2.0.0)
- **30-Day History** - View all completed bookings
- **User Attribution** - See who made each booking
- **Cleanup** - Remove metadata older than 30 days

### 🔔 Notification System (v1.5.1+)
- **Device Manager** - Select which mobile apps receive notifications
- **Automatic Notifications** - Auto-send on booking create/cancel
- **Rich Notifications** - Deep links + "Åbn Panel" action button
- **Customizable Templates** - Edit title and message per notification
- **4 Smart Notifications**:
  - 🧺 15-minute reminder before booking starts
  - ⏰ 5-minute remaining warning
  - ✅ Booking created confirmation (auto-sent)
  - ❌ Booking canceled notification (auto-sent)

### 🧺 Smart Booking
- **Vaskehus-Based** - Book by house name (Klatvask/Storvask) not machine numbers
- **Colour-Coded Button** - 🟢 No bookings · 🔵 1 booking · 🟡 Max reached
- **Calendar Integration** - Visual overview with house names
- **Duplicate Prevention** - Advanced tracking prevents duplicate calendar events
- **Opening Hours** - Locked button when laundry is closed

### 🏆 Gold Tier Quality
- **Home Assistant 2026.1+ Ready** - Modern calendar services
- **EntityDescription** - Proper dataclass pattern for all sensors
- **Full Translations** - Danish + English including entity states
- **Reconfiguration Flow** - Change credentials via Settings → Reconfigure
- **Zero Dependencies** - No package files, no automations needed
- **Production Logging** - Clean logs with debug available when needed

---

## 🚀 What's New

### v2.0.0 (2026-02-28) - Admin + Gold Tier 🏆

**Admin Tab:**
- ⚙️ New Admin tab in panel
- 📢 Driftsbesked — info message shown in booking card header
- 🔒 Booking spærring — lock bookings with custom message
- Persistent storage for all admin settings

**Statistics Tab:**
- 📊 New Statistik tab with 30-day booking history
- Shows vaskehus, date, time, duration and user per booking
- 🧹 Cleanup button for old metadata

**User Tracking Fixed:**
- 👤 Now shows real HA username (e.g. "Flemming") not "Via Panel"
- Fixed `connection.context` callable pattern

**Booking Card Improvements:**
- Colour-coded book button (green/blue/yellow)
- Info banner for admin messages
- Opening hours awareness (closed state on all machines)
- Machine bubbles respect opening hours

**Gold Tier Compliance:**
- `entity_translations` ✅ Full state translations for washer/dryer sensors
- `has_entity_description` ✅ EntityDescription dataclasses in sensor.py + binary_sensor.py
- `translations` ✅ Complete da.json + en.json
- `reconfiguration_flow` ✅ `async_step_reconfigure` in ConfigFlow

### v1.9.1 (2026-02-28) - Machine Status + UI Fixes 🫧

- 🫧 Live machine status bubbles between header and booking form
- 🟢 Green = Ledig · 🟠 Orange = I gang · 🔵 Blue = Reserveret · ⚫ Grey = Lukket
- Fixed card border (ha-card → div.card-root)
- Fixed panel tab switching (missing reactive properties)
- Fixed "Multiple versions of Lit" console warning
- Fixed notification tab "not ready" error

### v1.8.0 (2026-02-28) - Rich Notifications 🔔

- Deep links — tap notification opens MieleLogic panel
- "Åbn Panel" action button on every notification
- iOS: Sound, badge, subtitle / Android: Channel, importance
- Customizable templates with variable system
- Reset to defaults button

### v1.7.0 (2026-02-27) - Production Polish 🧹
- Clean logging — removed verbose debug logs
- Production-ready log levels

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

```
Username:        your_mielelogic_username
Password:        your_password
Client ID:       YV1ZAQ7BTE9IT2ZBZXLJ (default)
Laundry ID:      your_laundry_id (e.g., 3444)
Client Secret:   (leave blank)
Opening Time:    07:00
Closing Time:    21:00
```

### Reconfigure (v2.0.0)

Change credentials or laundry ID without reinstalling:

**Settings → Integrations → MieleLogic → ⋮ → Reconfigure**

- Pre-filled with current values
- Validates credentials before saving
- Automatically reloads integration

### Panel Tabs

**Panel appears in sidebar (🧺 icon)**

| Tab | Purpose |
|-----|---------|
| 📅 Booking | Make and manage reservations |
| 🔔 Notifikationer | Configure notifications + devices |
| ⚙️ Admin | Driftsbesked + booking spærring |
| 📊 Statistik | 30-day booking history |

### Admin Controls (v2.0.0)

**Panel → ⚙️ Admin Tab**

**Driftsbesked:**
```
Write a message for all users...
e.g. "Vaskehuset rengøres fredag d. 3/3 kl. 10-12"
→ Shown as yellow info-banner in booking card
```

**Booking Spærring:**
```
Toggle: 🔓 Booking åben / 🔒 Booking spærret
Besked: "Vaskehuset er under rengøring"
→ Book button becomes grey with your message
```

### Configure Notifications

**Panel → 🔔 Notifikationer Tab**

**Variable System:**
```
{vaskehus}   → "Klatvask" eller "Storvask"
{time}       → "14:30"
{date}       → "28-05-2026"
{duration}   → "120 minutter"
{machine}    → "Maskine 1"
```

### Configure Machines

**Settings → MieleLogic → Configure → Configure Machines**

```
Klatvask primary machine:  [1 ▼]
Storvask primary machine:  [4 ▼]
```

---

## 🎯 Usage

### Booking via Panel

```
1. Select vaskehus:  [Klatvask ▼]
2. Select time:      [09:00-11:00 (2t) ▼]
3. Select date:      [28-02-2026]
4. Click book button
5. ✅ Booking appears instantly!
```

**Book button states:**
- 🟢 `✅ Ingen bookinger – book nu`
- 🔵 `📅 1 booking – book endnu en`
- 🟡 `🚫 Max bookinger nået (2/2)`
- ⬛ `🔒 [Admin besked]` (admin lock)
- ⬛ `🔒 Lukket – åbner kl. 07:00` (outside opening hours)

### Entities Created

#### Sensors (5 total)
```
sensor.mielelogic_reservations           # Booking count
sensor.mielelogic_account_balance        # Prepaid balance
sensor.mielelogic_vaskehus_config        # Configuration status
sensor.mielelogic_washer_status          # Washer availability
sensor.mielelogic_dryer_status           # Dryer availability
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

```yaml
service: mielelogic.make_reservation
data:
  machine_number: 1
  start_time: "2026-02-23 14:00:00"
  duration: 120
```

```yaml
service: mielelogic.cancel_reservation
data:
  machine_number: 1
  start_time: "2026-02-23 14:00:00"
  end_time: "2026-02-23 16:00:00"
```

---

## 🔧 Troubleshooting

### Panel Not Appearing
1. Verify HA version ≥ 2026.1.0
2. Check logs for panel registration errors
3. Restart Home Assistant + clear browser cache (Ctrl+Shift+R)

### Notifications Not Working
1. Panel → Notifikationer → Check devices selected
2. Panel → Notifikationer → Enable notifications with toggle
3. Verify HA Companion app installed with notification permissions

### User Shows as "Via Panel"
Ensure v2.0.0+ is installed — older versions had a bug where `connection.context` was not called correctly.

### Booking Locked Unexpectedly
Panel → ⚙️ Admin → Verify "Booking spærring" is not enabled.

### Calendar Service Errors
Upgrade to HA 2026.1.0+ — required for calendar services.

---

## 📊 Architecture

### WebSocket Commands (17 total)
```
Booking:       get_slots, make_booking, cancel_booking, get_bookings, get_status, get_machines
Notifications: get_devices, save_devices, get_notifications, save_notification, test_notification, reset_notification
Admin:         get_admin, save_admin
Statistics:    get_history, cleanup_history
```

### File Structure (v2.0.0)
```
custom_components/mielelogic/
├── __init__.py              # Integration setup
├── manifest.json            # Metadata
├── const.py                 # Constants
├── config_flow.py           # Config + reconfigure flow
├── coordinator.py           # Data updates
├── diagnostics.py           # Debug export
├── sensor.py                # 5 sensors (EntityDescription)
├── binary_sensor.py         # 6 binary sensors (EntityDescription)
├── calendar.py              # Calendar integration
├── services.py              # Make/cancel services
├── panel.py                 # Panel registration
├── time_manager.py          # Time slot logic
├── booking_manager.py       # Booking + user tracking
├── websocket.py             # 17 WebSocket commands
├── storage.py               # Persistent storage (admin + history)
├── notification_manager.py  # Rich notifications
├── frontend/
│   ├── entrypoint.js
│   ├── panel.js             # 4-tab panel UI
│   └── mielelogic-booking-card.js
└── translations/
    ├── da.json
    └── en.json
```

---

## 🗺️ Roadmap

### v2.0.0 ✅ Done
- [x] Admin tab (driftsbesked + booking spærring)
- [x] Statistik tab (30-day booking history)
- [x] Real user tracking (HA username)
- [x] Gold tier: entity_translations, has_entity_description, translations, reconfiguration_flow

### v2.1.0 - Gold Tier Complete
- [ ] `brands` submission to HA brands repo
- [ ] `config_flow_test` — automated tests
- [ ] `integration_test_coverage` — comprehensive test suite

### v3.0.0 - Future
- [ ] Calendar event cleanup on booking cancel
- [ ] Cancel booking directly from notification

---

## 📜 License

MIT License - see [LICENSE.md](LICENSE.md)

---

## 🙏 Credits

- [Home Assistant](https://www.home-assistant.io/)
- [MieleLogic API](https://mielelogic.com/)
- [Anthropic Claude](https://www.anthropic.com/) for development assistance

---

**Current Version:** 2.0.0  
**Released:** 28. februar 2026  
**Status:** Production Ready — Gold Tier 🏆

Made with ❤️ by KingPainter
