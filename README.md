# MieleLogic Home Assistant Integration

[![Version](https://img.shields.io/badge/version-1.3.3-blue.svg)](https://github.com/kingpainter/mielelogic-portal)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024%2B-blue.svg)](https://www.home-assistant.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Home Assistant custom integration for MieleLogic laundry service monitoring with reservation tracking, machine status, account balance, calendar integration, and automation blueprints.

---

## 🎉 Features

### v1.3.3 - Calendar Time & Name Fix ⭐ NEW!

#### 🐛 Bug Fixes
- **Correct calendar times** - Events now show exact reservation time (Denmark timezone)
- **Simplified event names** - "Klatvask Reserveret" instead of "Klatvask #1 [MieleLogic]"
- **Fixed timezone issue** - No more 1 hour offset in external calendar sync

**Example:**
```
Before v1.3.3:
  Event: "Klatvask #1 [MieleLogic]"
  Time: 20:00 - 21:30  ❌ (1 hour late!)

After v1.3.3:
  Event: "Klatvask Reserveret"
  Time: 19:00 - 20:30  ✅ (correct!)
```

### v1.3.2 - Opening Hours & Enhanced Options

#### 🕐 Opening Hours Configuration
- **Configure laundry hours** - Set when your laundry opens/closes
- **Enhanced display** - "Lukket indtil kl. 07:00" shows opening time
- **Smart priority** - Shows most relevant info (reservation > hours > status)
- **Easy setup** - Configure during initial setup or via Options Flow
- **Default times** - Sensible defaults (07:00 - 21:00)

#### ⚙️ 3-Option Menu in Options Flow
- **Update credentials** - Change login details without affecting other settings
- **Configure calendar sync** - Enable/disable external calendar sync
- **Configure opening hours** - Set laundry opening/closing times
- **Independent options** - Each setting is separate and safe

#### 🏢 Professional Branding
- **Integration name** - "MieleLogic Portal" (cleaner, no laundry ID)
- **Device name** - "MieleLogic Portal"

### v1.3.1 - Optional Calendar Sync

#### 📅 External Calendar Sync (Optional)
- **Sync to CalDAV** - Automatically sync reservations to Apple Calendar, Google Calendar, etc.
- **Target any calendar** - Choose from available HA calendar entities
- **Duplicate prevention** - Smart detection prevents duplicate events
- **Graceful degradation** - Sync failures don't break main integration
- **Easy configuration** - Enable/disable via Options Flow

### v1.3.0 - Calendar Integration & Blueprints

#### 📅 Calendar Integration
- **Visual Overview** - See all reservations in HA Calendar
- **Calendar Entity** - `calendar.mielelogic_portal_reservations`
- **Event Details** - Machine name, duration, start/end times
- **Automation Triggers** - Use calendar events in automations
- **Timezone Aware** - Handles all datetime formats correctly

#### 📘 Automation Blueprints (Pre-Made Automations!)
- **15-Minute Reminder** - Never miss your reservation
- **Washer Available** - Get notified when machines are free
- **Reservation Starting** - Critical alerts with calendar
- **Low Balance Warning** - Don't run out of credits
- **One-Click Import** - No YAML editing required!

#### ✨ Binary Sensors for Easy Automations
- **Has Reservation** - Simple on/off states
- **Reservation Starting Soon** - 15-minute warning
- **Washer Available** - At least one washer free
- **Dryer Available** - At least one dryer free ⚠️*

#### 📊 Enhanced Sensor Attributes
- **Next reservation** - Structured data with machine name, time, duration
- **Machine counts** - Washer/dryer counts, today's reservations
- **Boolean flags** - `is_available`, `is_reserved`, `is_running`

#### 🚀 Performance Optimization
- **90% API load reduction** - Intelligent caching with 60s TTL
- **3 API calls** on HA restart (down from 20-30)
- **Sub-second responses** - Cached data served instantly

---

## 📦 Installation

### HACS (Recommended)
1. Open HACS
2. Go to Integrations
3. Click "+" and search for "MieleLogic"
4. Install
5. Restart Home Assistant
6. Add integration via UI (Settings → Devices & Services → Add Integration)

### Manual Installation
1. Download latest release from [Releases](https://github.com/kingpainter/mielelogic-portal/releases)
2. Copy `custom_components/mielelogic/` to your HA config directory
3. Restart Home Assistant
4. Add integration via UI

---

## ⚙️ Configuration

### Initial Setup

**Required Information:**
- **Username** - Your MieleLogic account username
- **Password** - Your MieleLogic account password
- **Client ID** - OAuth2 client ID (default: `YV1ZAQ7BTE9IT2FBZXLJ`)
- **Laundry ID** - Your laundry facility ID (e.g., `3444`)

**Optional Information:**
- **Client Secret** - Optional OAuth2 client secret
- **Opening Time** - When laundry opens (default: 07:00)
- **Closing Time** - When laundry closes (default: 21:00)

### Options Flow

After installation, configure additional features via Options Flow:

```
Settings → Devices & Services → MieleLogic Portal → Configure

Choose from:
1. Update credentials
2. Configure calendar sync
3. Configure opening hours
```

### Quick Start
```yaml
# Configuration via UI only
# Settings → Devices & Services → Add Integration → MieleLogic
```

---

## 📱 Entities Created

### Calendar (1 entity)
- `calendar.mielelogic_portal_reservations` 📅 (v1.3.0+)

### Sensors (6-10 entities)
- `sensor.mielelogic_portal_reservations`
- `sensor.mielelogic_portal_account_balance`
- `sensor.mielelogic_portal_washer_status` ⚠️*
- `sensor.mielelogic_portal_dryer_status` ⚠️*
- `sensor.mielelogic_portal_<machine_name>_<number>_status` (per machine)

### Binary Sensors (6 entities)
- `binary_sensor.mielelogic_portal_has_reservation`
- `binary_sensor.mielelogic_portal_has_washer_reservation`
- `binary_sensor.mielelogic_portal_has_dryer_reservation` ⚠️*
- `binary_sensor.mielelogic_portal_reservation_starting_soon`
- `binary_sensor.mielelogic_portal_washer_available`
- `binary_sensor.mielelogic_portal_dryer_available` ⚠️*

**⚠️ Dryer Sensors:** Requires dryers connected to MieleLogic API (MachineType "58"). If your laundry only has washing machines, these sensors will show "off"/"Idle" and can be safely ignored. See [FAQ](#-faq) for details.

---

## 💡 Example Usage

### v1.3.3 Features - Fixed Calendar Sync

#### Correct Calendar Times
```yaml
# Reservation in MieleLogic app:
Time: 19:00 - 20:30

# Calendar event (external calendar):
Event: "Klatvask Reserveret"
Time: 19:00 - 20:30  ✅ (matches exactly!)
```

#### Configure External Calendar Sync
```
Settings → Devices & Services → MieleLogic Portal
→ Configure → Configure calendar sync
→ ☑ Enable calendar sync
→ Target: calendar.kun_flemming
→ Save

Result: Reservations appear in your external calendar with correct times!
```

### v1.3.2 Features

#### Opening Hours Display
```yaml
# Machine status during closed hours:
sensor.mielelogic_klatvask_1_status: "Lukket indtil kl. 07:00"

# Machine with reservation:
sensor.mielelogic_klatvask_1_status: "Ledig indtil kl. 21:00"

# Machine in use:
sensor.mielelogic_klatvask_2_status: "Resttid: 55 min"
```

#### Configure Opening Hours
```
Settings → Devices & Services → MieleLogic Portal
→ Configure → Configure opening hours
→ Opening: 07:00
→ Closing: 21:00
→ Save
```

### Using Blueprints (Easy Way!) 📘

**Step 1:** Import blueprints to `/config/blueprints/automation/mielelogic/`  
**Step 2:** Restart Home Assistant  
**Step 3:** Settings → Automations → Create Automation → Use Blueprint  
**Step 4:** Configure and save - Done! 🎉

**Available Blueprints:**
- 15-Minute Reservation Reminder
- Washer Available Alert
- Reservation Starting Now (Calendar-based)
- Low Balance Warning

See [blueprints/README.md](blueprints/README.md) for details.

---

### Manual Automations (Advanced)

#### 15-Minute Reservation Reminder (Binary Sensor)
```yaml
automation:
  - alias: Vaskehus Påmindelse
    trigger:
      - platform: state
        entity_id: binary_sensor.mielelogic_portal_reservation_starting_soon
        to: 'on'
    action:
      - service: notify.mobile_app
        data:
          title: "🧺 Vaskehus Påmindelse"
          message: >
            Din reservation starter om 
            {{ state_attr('binary_sensor.mielelogic_portal_reservation_starting_soon', 'next_start_in_minutes') }} 
            minutter!
```

#### Calendar-Based Reminder (v1.3.0+)
```yaml
automation:
  - alias: Reservation om 15 minutter
    trigger:
      - platform: calendar
        entity_id: calendar.mielelogic_portal_reservations
        event: start
        offset: "-00:15:00"  # 15 minutes before
    action:
      - service: notify.mobile_app_flemming_mobil
        data:
          title: "🧺 Vaskehus Påmindelse"
          message: "{{ trigger.calendar_event.summary }} starter om 15 minutter!"
```

#### Washer Available Notification
```yaml
automation:
  - alias: Vasker Ledig
    trigger:
      - platform: state
        entity_id: binary_sensor.mielelogic_portal_washer_available
        to: 'on'
    condition:
      - condition: state
        entity_id: binary_sensor.mielelogic_portal_has_reservation
        state: 'off'
    action:
      - service: notify.mobile_app
        data:
          message: "✅ Der er vaskere ledige!"
```

---

## 🤔 FAQ

### Q: Why are there dryer sensors if I only have washing machines?
**A:** The integration supports the full MieleLogic API which includes dryers (MachineType "58"). If your laundry doesn't have dryers connected to the API, these sensors will simply show "off" or "Idle" states. They're included for:
- **Future-proofing** - If your laundry adds dryers later
- **Other users** - Other facilities with dryer access
- **API compatibility** - Full support for all MieleLogic features

You can hide unused sensors in the UI:
1. Settings → Devices & Services → MieleLogic Portal
2. Click on device
3. Click dryer sensor → Settings icon
4. Select "Hide"

### Q: How do I configure opening hours?
**A:** 
- **During setup:** Enter opening/closing times in initial config flow
- **After setup:** Options Flow → Configure opening hours
- **Default:** 07:00 - 21:00 (change to match your laundry)

### Q: My calendar events show wrong times?
**A:** Update to v1.3.3! This version fixes the timezone issue:
- Old events will remain with wrong times (delete manually)
- New events will have correct Denmark timezone
- Matches your MieleLogic app exactly

### Q: How does external calendar sync work?
**A:** (v1.3.1+)
- Enable in Options Flow → Configure calendar sync
- Select target calendar (e.g., CalDAV)
- Reservations sync automatically every 5 minutes
- Events named "Klatvask Reserveret" or "Storvask Reserveret"
- One-way sync: MieleLogic → External calendar

### Q: Can I sync to multiple calendars?
**A:** Currently only one target calendar is supported. Multi-calendar sync is planned for future version.

### Q: How do I use the calendar integration?
**A:** After installing v1.3.0+, the calendar entity appears automatically. Navigate to Calendar in the sidebar to see your reservations as events. You can also use calendar triggers in automations.

### Q: Do blueprints require extra setup?
**A:** Yes, copy the blueprint files to `/config/blueprints/automation/mielelogic/` and restart HA. Then they'll appear in Settings → Automations & Scenes → Blueprints.

---

## 🔧 Development

### Version History
- **v1.3.3** (2026-01-26) - Calendar time & name fix (Denmark timezone)
- **v1.3.2** (2026-01-24) - Opening hours configuration, enhanced Options Flow
- **v1.3.1** (2026-01-24) - External calendar sync (optional)
- **v1.3.0** (2026-01-21) - Calendar integration, automation blueprints
- **v1.2.0** (2026-01-20) - Binary sensors, enhanced attributes, caching
- **v1.1.0** (2026-01-20) - HA 2024+ compliance, device organization
- **v1.0.5** (2026-01-13) - Initial alpha release

### Roadmap
- **v1.3.4** (Planned) - Weekend-specific opening hours
- **v1.4.0** (Planned) - Services (make/cancel reservations)

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## 📄 Documentation

- [Installation Guide](v1_3_3_INSTALLATION.md)
- [Changelog v1.3.3](CHANGELOG_v1_3_3.md)
- [Blueprints README](blueprints/README.md)
- [Opening Hours Feature](OPENING_HOURS_FEATURE.md)

---

## 🙏 Credits

Developed by **KingPainter** for Home Assistant

**API Provider:** [MieleLogic](https://mielelogic.com)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🛠 Issues & Support

- **Issues:** [GitHub Issues](https://github.com/kingpainter/mielelogic-portal/issues)
- **Discussions:** [GitHub Discussions](https://github.com/kingpainter/mielelogic-portal/discussions)

---

**⭐ If you find this integration helpful, please star the repo!**
