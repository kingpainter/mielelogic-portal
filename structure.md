# MieleLogic — File Structure v2.0.0

```
custom_components/mielelogic/
│
├── 📄 __init__.py                    # v2.0.0 - Setup + Panel + WebSocket
├── 📄 manifest.json                  # v2.0.0 - version: "2.0.0"
├── 📄 const.py                       # v2.0.0 - VERSION = "2.0.0"
│
├── 🔧 config_flow.py                 # v2.0.0 - + async_step_reconfigure (Gold tier)
├── 🔄 coordinator.py                 # v1.7.0 - Unchanged
├── 🔍 diagnostics.py                 # v1.3.2 - Unchanged
│
├── 📊 sensor.py                      # v2.0.0 - EntityDescription dataclasses (Gold tier)
├── 🔘 binary_sensor.py               # v2.0.0 - EntityDescription dataclasses (Gold tier)
├── 📅 calendar.py                    # v1.7.0 - Unchanged
│
├── 🛠️ services.py                    # v1.7.0 - Unchanged
│
├── ✨ panel.py                       # v1.7.0 - Panel registration
├── ⏰ time_manager.py                # v1.7.0 - Time slot management
├── 📝 booking_manager.py             # v2.0.0 - Real user tracking fix
├── 🔌 websocket.py                   # v2.0.0 - 17 commands (+ admin + history)
├── 💾 storage.py                     # v2.0.0 - + admin_settings + booking_history
├── 🔔 notification_manager.py        # v1.8.0 - Rich notifications
│
├── 📁 frontend/
│   ├── 📄 entrypoint.js              # v1.5.0 - Unchanged
│   ├── 📄 panel.js                   # v2.0.0 - 4 tabs (+ Admin + Statistik)
│   └── 📄 mielelogic-booking-card.js # v2.0.0 - Info banner + locked state + machine hours
│
└── 📁 translations/
    ├── 📄 da.json                    # v2.0.0 - State translations + reconfigure + encoding fix
    └── 📄 en.json                    # v2.0.0 - State translations + reconfigure
```

---

## Version History per File

| File | Version | Key Change |
|------|---------|-----------|
| `__init__.py` | v2.0.0 | Version bump |
| `manifest.json` | v2.0.0 | version: "2.0.0" |
| `const.py` | v2.0.0 | VERSION = "2.0.0" |
| `config_flow.py` | v2.0.0 | + async_step_reconfigure |
| `coordinator.py` | v1.7.0 | Calendar service checks |
| `diagnostics.py` | v1.3.2 | Unchanged |
| `sensor.py` | v2.0.0 | EntityDescription dataclasses |
| `binary_sensor.py` | v2.0.0 | EntityDescription dataclasses |
| `calendar.py` | v1.7.0 | Dict access pattern |
| `services.py` | v1.7.0 | Response support |
| `panel.py` | v1.7.0 | Panel + card registration |
| `time_manager.py` | v1.7.0 | Time slot management |
| `booking_manager.py` | v2.0.0 | Real HA username lookup |
| `websocket.py` | v2.0.0 | 17 commands, admin in get_status |
| `storage.py` | v2.0.0 | admin_settings + get_booking_history |
| `notification_manager.py` | v1.8.0 | Rich notifications |
| `frontend/entrypoint.js` | v1.5.0 | Unchanged |
| `frontend/panel.js` | v2.0.0 | Admin + Statistik tabs |
| `frontend/mielelogic-booking-card.js` | v2.0.0 | Info banner + locked + hours |
| `translations/da.json` | v2.0.0 | State translations + encoding fix |
| `translations/en.json` | v2.0.0 | State translations + reconfigure |

---

## WebSocket Commands (17 total)

### Booking (6)
```
mielelogic/get_slots
mielelogic/make_booking
mielelogic/cancel_booking
mielelogic/get_bookings
mielelogic/get_status        ← includes opening_time, closing_time, is_open, admin settings
mielelogic/get_machines
```

### Notifications (6)
```
mielelogic/get_devices
mielelogic/save_devices
mielelogic/get_notifications
mielelogic/save_notification
mielelogic/test_notification
mielelogic/reset_notification
```

### Admin (2) — NEW v2.0.0
```
mielelogic/get_admin
mielelogic/save_admin
```

### Statistics (2) — NEW v2.0.0
```
mielelogic/get_history
mielelogic/cleanup_history
```

---

## Storage Structure (.storage/mielelogic.panel_config)

```json
{
  "devices": ["notify.mobile_app_iphone"],
  "bookings": {
    "machine_1_2026-05-14 07:00:00": {
      "created_by": "Flemming",
      "created_at": "2026-02-28T20:43:59",
      "machine": 1,
      "start_time": "2026-05-14 07:00:00",
      "vaskehus": "Klatvask",
      "duration": 120,
      "calendar_event_id": null
    }
  },
  "notifications": {
    "reminder_15min": {
      "enabled": true,
      "title": "🧺 Vasketid om 15 minutter",
      "message": "Din {vaskehus} booking starter kl. {time}"
    }
  },
  "admin": {
    "booking_locked": false,
    "lock_message": "Booking er midlertidigt spærret",
    "info_message": ""
  }
}
```

---

## Gold Tier Status

| Rule | Status | Version |
|------|--------|---------|
| `entity_translations` | ✅ Done | v2.0.0 |
| `has_entity_description` | ✅ Done | v2.0.0 |
| `translations` | ✅ Done | v2.0.0 |
| `reconfiguration_flow` | ✅ Done | v2.0.0 |
| `brands` | ❌ Todo | v2.1.0 |
| `config_flow_test` | ❌ Todo | v2.1.0 |
| `integration_test_coverage` | ❌ Todo | v2.1.0 |

**Current:** Gold tier in progress (4/7 rules complete)
