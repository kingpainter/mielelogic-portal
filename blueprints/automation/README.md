# MieleLogic Home Assistant Integration

[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/yourusername/mielelogic)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024%2B-blue.svg)](https://www.home-assistant.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Home Assistant custom integration for MieleLogic laundry service monitoring with reservation tracking, machine status, account balance, and calendar integration.

---

## 🎉 Features

### v1.3.0 - Calendar Integration & Automation Blueprints

#### 📅 Calendar Integration
- **Visual Overview** - See all reservations in HA Calendar
- **Calendar Entity** - `calendar.mielelogic_vaskeri_3444_reservations`
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
1. Download latest release from [Releases](https://github.com/yourusername/mielelogic/releases)
2. Copy `custom_components/mielelogic/` to your HA config directory
3. Restart Home Assistant
4. Add integration via UI

---

## ⚙️ Configuration

### Required Information
- **Username** - Your MieleLogic account username
- **Password** - Your MieleLogic account password
- **Client ID** - OAuth2 client ID (default: `YV1ZAQ7BTE9IT2ZBZXLJ`)
- **Laundry ID** - Your laundry facility ID (e.g., `3444`)
- **Client Secret** - Optional OAuth2 client secret

### Quick Start
```yaml
# Configuration via UI only
# Settings → Devices & Services → Add Integration → MieleLogic
```

---

## 📱 Entities Created

### Calendar (1 entity)
- `calendar.mielelogic_vaskeri_3444_reservations` 📅 **NEW in v1.3.0!**

### Sensors (6-10 entities)
- `sensor.mielelogic_vaskeri_3444_reservations`
- `sensor.mielelogic_vaskeri_3444_account_balance`
- `sensor.mielelogic_vaskeri_3444_washer_status` ⚠️*
- `sensor.mielelogic_vaskeri_3444_dryer_status` ⚠️*
- `sensor.mielelogic_vaskeri_3444_<machine_name>_<number>_status` (per machine)

### Binary Sensors (6 entities)
- `binary_sensor.mielelogic_vaskeri_3444_has_reservation`
- `binary_sensor.mielelogic_vaskeri_3444_has_washer_reservation`
- `binary_sensor.mielelogic_vaskeri_3444_has_dryer_reservation` ⚠️*
- `binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon`
- `binary_sensor.mielelogic_vaskeri_3444_washer_available`
- `binary_sensor.mielelogic_vaskeri_3444_dryer_available` ⚠️*

**⚠️ Dryer Sensors:** Requires dryers connected to MieleLogic API (MachineType "58"). If your laundry only has washing machines, these sensors will show "off"/"Idle" and can be safely ignored. See [FAQ](#-faq) for details.

---

## 💡 Example Automations

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
        entity_id: binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon
        to: 'on'
    action:
      - service: notify.mobile_app
        data:
          title: "🧺 Vaskehus Påmindelse"
          message: >
            Din reservation starter om 
            {{ state_attr('binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon', 'next_start_in_minutes') }} 
            minutter!
```

#### Calendar-Based Reminder (NEW in v1.3.0!)
```yaml
automation:
  - alias: Reservation om 15 minutter
    trigger:
      - platform: calendar
        entity_id: calendar.mielelogic_vaskeri_3444_reservations
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
        entity_id: binary_sensor.mielelogic_vaskeri_3444_washer_available
        to: 'on'
    condition:
      - condition: state
        entity_id: binary_sensor.mielelogic_vaskeri_3444_has_reservation
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
1. Settings → Devices & Services → MieleLogic
2. Click on device
3. Click dryer sensor → Settings icon
4. Select "Hide"

### Q: How do I know if my dryer sensors will work?
**A:** Check the MieleLogic API response for machines with `"MachineType": "58"`. If you only see types "51" or "85" (washers), dryer sensors won't have data.

### Q: Can I remove dryer sensors from the code?
**A:** Not recommended. They don't cause issues and provide future compatibility. If desired, simply hide them in the UI.

### Q: What about my manual tumbler timer?
**A:** The `timer.torretumbler_timer` in your automations is a **manual timer** you control via `input_select` - it's completely independent of the dryer sensors and will continue working as before.

### Q: How do I use the calendar integration?
**A:** After installing v1.3.0, the calendar entity appears automatically. Navigate to Calendar in the sidebar to see your reservations as events. You can also use calendar triggers in automations.

### Q: Do blueprints require extra setup?
**A:** Yes, copy the blueprint files to `/config/blueprints/automation/mielelogic/` and restart HA. Then they'll appear in Settings → Automations & Scenes → Blueprints.

---

## 🔧 Development

### Version History
- **v1.3.0** (2026-01-21) - Calendar integration, automation blueprints, timezone fixes
- **v1.2.0** (2026-01-20) - Binary sensors, enhanced attributes, response caching
- **v1.1.0** (2026-01-20) - HA 2024+ compliance, device organization, options flow
- **v1.0.5** (2026-01-13) - Initial alpha release

### Roadmap
- **v1.3.1** (Planned) - CalDAV sync (Apple Calendar, Google Calendar)
- **v1.4.0** (Planned) - Services (make/cancel reservations), advanced automation

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## 📄 Documentation

- [Installation Guide](INSTALLATION_GUIDE.md)
- [Changelog](CHANGELOG.md)
- [Blueprints README](blueprints/README.md)
- [v1.3.0 Release Status](v1_3_0_RELEASE_STATUS.md)

---

## 🙏 Credits

Developed by **KingPainter** for Home Assistant

**API Provider:** [MieleLogic](https://mielelogic.com)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🐛 Issues & Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/mielelogic/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/mielelogic/discussions)
- **Email:** support@example.com

---

**⭐ If you find this integration helpful, please star the repo!**
