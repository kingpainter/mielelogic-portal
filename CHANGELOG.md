# Changelog

All notable changes to the MieleLogic Home Assistant integration will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-01-21

### ✨ Added - Calendar Integration & Automation Blueprints

#### 1. **Calendar Platform** - Visual Reservation Overview
Reservations now appear in Home Assistant calendar for easy visual overview and calendar-based automations.

**Calendar Entity:**
- `calendar.mielelogic_vaskeri_3444_reservations`
  - Shows all upcoming reservations as calendar events
  - Updates automatically every 5 minutes (coordinator refresh)
  - Event details include machine name, number, duration, and type
  - Can be used in automations with `calendar` trigger platform

**Features:**
- Visual overview in HA Calendar sidebar
- Event details: Summary, description, start/end times
- Timezone-aware (handles both UTC and timezone-naive API responses)
- Integration with calendar automations (trigger on event start/end)

**Example Automation:**
```yaml
# Trigger when reservation starts
trigger:
  - platform: calendar
    entity_id: calendar.mielelogic_vaskeri_3444_reservations
    event: start
    offset: "-00:15:00"  # 15 minutes before
action:
  - service: notify.mobile_app
    data:
      message: "Din reservation starter om 15 minutter!"
```

#### 2. **Automation Blueprints** - Pre-Made Automations
Four ready-to-use automation blueprints make it easy to get started without writing YAML.

**Available Blueprints:**

**a) 15-Minute Reservation Reminder** ⭐
- Notification 15 minutes before reservation starts
- Uses `binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon`
- Customizable message with {{minutes}} and {{machine}} variables
- Perfect for not missing your time slot

**b) Washer Available Alert** ⭐
- Notification when washer becomes available
- Only triggers if you DON'T have a reservation
- Optional quiet hours (no notifications at night)
- Shows count of available washers

**c) Reservation Starting Now** 📅
- Critical notification when reservation starts
- Uses calendar integration
- Adjustable timing (0, -5, -15, -30 minutes)
- Optional iOS critical alert (bypasses Do Not Disturb)

**d) Low Balance Warning** 💰
- Alert when account balance drops below threshold
- Customizable threshold (default: 50 DKK)
- Configurable notification frequency (avoid spam)
- Direct link to MieleLogic website

**Blueprint Location:**
```
custom_components/mielelogic/blueprints/automation/
├── reservation_reminder_15min.yaml
├── washer_available_alert.yaml
├── reservation_starting_now.yaml
└── low_balance_warning.yaml
```

**Usage:**
1. Copy blueprints to `/config/blueprints/automation/mielelogic/`
2. Restart Home Assistant
3. Settings → Automations & Scenes → Blueprints
4. Create automation → Use Blueprint → Select MieleLogic blueprint

### 🐛 Fixed

#### Timezone Handling in Binary Sensors and Calendar
- **Issue:** API returns datetime strings without timezone info (e.g., `2026-01-24T19:00:00`)
- **Error:** "can't compare offset-naive and offset-aware datetimes"
- **Fix:** Added smart `_parse_datetime()` helper function that handles both formats:
  - With timezone: `2026-01-24T19:00:00Z` or `2026-01-24T19:00:00+00:00`
  - Without timezone: `2026-01-24T19:00:00` (assumes UTC)

**Files Fixed:**
- `calendar.py` - All datetime parsing methods
- `binary_sensor.py` - Reservation timing calculations

**Impact:** Calendar events and binary sensors now work correctly regardless of API datetime format.

### 📁 Changed - File Structure

**New Files:**
```
custom_components/mielelogic/
├── calendar.py                           # NEW - Calendar platform (~160 lines)
└── blueprints/                           # NEW - Automation blueprints
    └── automation/
        ├── reservation_reminder_15min.yaml
        ├── washer_available_alert.yaml
        ├── reservation_starting_now.yaml
        ├── low_balance_warning.yaml
        └── README.md                     # Blueprint documentation
```

**Updated Files:**
```
custom_components/mielelogic/
├── __init__.py                          # v1.3.0 - Added "calendar" platform
├── const.py                             # v1.3.0 - Version bump
├── manifest.json                        # v1.3.0 - Version bump
├── binary_sensor.py                     # v1.3.0 - Timezone fix
└── translations/
    ├── da.json                          # v1.3.0 - Calendar entity name
    └── en.json                          # v1.3.0 - Calendar entity name
```

### 🎯 Migration Notes

**GOOD NEWS:** v1.3.0 is 100% backward compatible with v1.2.0!

- All existing sensors continue to work
- All existing automations continue to work
- New features are additive only
- Binary sensor timezone fix is non-breaking

**New Entity:**
```
calendar.mielelogic_vaskeri_3444_reservations
```

**Optional Setup:**
- Import blueprints to `/config/blueprints/automation/mielelogic/`
- Restart HA to make blueprints available
- Create automations from blueprints via UI

### 📊 Performance

**Calendar:**
- No new API calls (uses existing coordinator data)
- Updates every 5 minutes with coordinator
- Minimal performance impact

**Blueprints:**
- Pure YAML templates (no runtime overhead)
- Use existing sensors (no extra API calls)
- Instant notification delivery

### 🧪 Testing Checklist

- [x] Calendar entity appears under device
- [x] Events show in HA Calendar with correct times
- [x] Timezone parsing works for both formats
- [x] Binary sensors no longer throw timezone errors
- [x] All 4 blueprints import successfully
- [x] Blueprints create working automations
- [x] Notifications delivered correctly
- [x] Calendar triggers work in automations

### 📖 Usage Examples

**Example 1: Calendar-Based Reminder**
```yaml
automation:
  - alias: Reservation om 15 minutter
    trigger:
      - platform: calendar
        entity_id: calendar.mielelogic_vaskeri_3444_reservations
        event: start
        offset: "-00:15:00"
    action:
      - service: notify.mobile_app_flemming_mobil
        data:
          title: "🧺 Vaskehus Påmindelse"
          message: "{{ trigger.calendar_event.summary }} starter om 15 minutter!"
```

**Example 2: Using Blueprint (No YAML!)**
1. Settings → Automations & Scenes → Create Automation
2. Use Blueprint → "MieleLogic - 15 Minute Reservation Reminder"
3. Configure notification service
4. Save - Done! 🎉

### 🎯 Quality Metrics

**Code Quality:**
- ✅ All files updated to v1.3.0
- ✅ Timezone handling robust and tested
- ✅ Calendar follows HA best practices
- ✅ Blueprints validated and working
- ✅ 100% backward compatible

**User Experience:**
- ✅ Visual calendar overview (no YAML needed)
- ✅ Pre-made automations (import & use)
- ✅ No breaking changes
- ✅ Clear documentation

### 🚀 What's Next?

**v1.3.1 (Planned):**
- CalDAV sync (sync to Apple Calendar, Google Calendar, etc.)
- Native mobile notifications via calendar
- Siri integration

**v1.4.0 (Planned):**
- Services: `make_reservation`, `cancel_reservation`
- Advanced automation capabilities
- Historical data tracking

---

## [1.2.0] - 2026-01-20

### ✨ Added - Major Automation Features

#### 1. **Binary Sensors** - Automation-Friendly States
Six new binary sensors make automations 10x easier by eliminating complex templates:

**Has Reservation Sensors:**
- `binary_sensor.mielelogic_vaskeri_3444_has_reservation`
  - `on`: User has at least one reservation
  - `off`: No reservations
  - Attributes: `count`, `reservation_ids`

- `binary_sensor.mielelogic_vaskeri_3444_has_washer_reservation`
  - `on`: Has washer reservation
  - Attributes: `count`, `machines` (list of reserved washers)

- `binary_sensor.mielelogic_vaskeri_3444_has_dryer_reservation`
  - `on`: Has dryer reservation
  - Attributes: `count`, `machines` (list of reserved dryers)

**Reservation Timing:**
- `binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon`
  - `on`: Reservation starts within 15 minutes
  - `off`: No reservation starting soon
  - Attributes: 
    - `count`: Number of upcoming reservations
    - `upcoming_reservations`: List with machine name, start time, minutes until start
    - `next_start_in_minutes`: Minutes until next reservation

**Machine Availability:**
- `binary_sensor.mielelogic_vaskeri_3444_washer_available`
  - `on`: At least one washer is available
  - `off`: All washers occupied
  - Attributes: `total_washers`, `available_count`, `available_machines`

- `binary_sensor.mielelogic_vaskeri_3444_dryer_available`
  - `on`: At least one dryer is available
  - Attributes: `total_dryers`, `available_count`, `available_machines`

⚠️ **Note:** Dryer-related sensors (`has_dryer_reservation`, `dryer_available`, `dryer_status`) require that dryers are connected to the MieleLogic API. If your laundry only has washing machines, these sensors will show "off" / "Idle" and can be ignored.

**Example Automation (Before vs After):**
```yaml
# BEFORE v1.2.0 (complex template):
trigger:
  - platform: template
    value_template: >
      {% set reservations = state_attr('sensor.mielelogic_reservations', 'Reservations') %}
      {% if reservations %}
        {% for res in reservations %}
          {% set start = as_timestamp(res.Start) %}
          {% if ((start - now().timestamp()) / 60) | int == 15 %}
            true
          {% endif %}
        {% endfor %}
      {% endif %}

# AFTER v1.2.0 (simple binary sensor):
trigger:
  - platform: state
    entity_id: binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon
    to: 'on'
action:
  - service: notify.mobile_app
    data:
      message: "Din reservation starter om {{ state_attr('binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon', 'next_start_in_minutes') }} minutter!"
```

#### 2. **Enhanced Sensor Attributes** - Better Data for Automations
All sensors now provide structured, automation-friendly attributes:

**Reservations Sensor:**
```yaml
attributes:
  total_count: 2
  washer_count: 1
  dryer_count: 1
  reservations_today: 2
  next_reservation:
    machine_name: "Klatvask"
    machine_number: "1"
    start_time: "2026-01-20T14:00:00Z"
    end_time: "2026-01-20T15:30:00Z"
    duration_minutes: 90
  raw_data: [...]  # Full API response (backwards compatible)
```

**Machine Status Sensors:**
```yaml
attributes:
  machine_number: "1"
  unit_name: "Kælder"
  machine_type: "51"
  machine_type_name: "Washer"  # NEW: Human-readable
  is_available: true            # NEW: Boolean flag
  is_reserved: false            # NEW: Boolean flag
  is_running: false             # NEW: Boolean flag
  status_text: "Ledig"
  reservation_info: ""
  color_code: "0"
  symbol_code: "0"
```

Benefits:
- No more complex Jinja templates
- Use simple conditions: `{% if state_attr(..., 'is_available') %}`
- Structured data perfect for dashboards

#### 3. **Response Caching** - 90% API Load Reduction
Intelligent caching system with 60-second TTL (Time-To-Live):

**How It Works:**
- First request: Fetches from API, caches response
- Subsequent requests (within 60s): Returns cached data
- Cache automatically expires after 60 seconds
- Dramatically reduces API load on Home Assistant restarts

**Example Log Output:**
```
[DEBUG] Cache MISS for reservations_3444
[INFO] Fetching from API: https://api.mielelogic.com/v7/reservations?laundry=3444
[DEBUG] 💾 Cached data for reservations_3444

[5 seconds later]
[INFO] ✅ Cache HIT for reservations_3444 (age: 5.2s)
```

**Impact:**
- HA Restart: 3 API calls instead of 20+
- Protects against rate limiting (429 errors)
- Faster entity updates (no network delay)
- Graceful degradation (cache miss = normal fetch)

### 🔧 Changed - Improvements

#### Updated Coordinator Architecture
- **Smart caching** with helper methods:
  - `_get_cache_key()`: Generates unique cache keys
  - `_is_cache_valid()`: Checks cache freshness
  - `_get_from_cache()`: Retrieves cached data
  - `_save_to_cache()`: Stores data with timestamp
  - `_fetch_with_cache()`: Unified fetch method with caching

- **Simplified `_async_update_data()`**: Reduced from 100+ lines to 50 lines
- **Better logging**: Cache hits/misses clearly indicated with emojis
- **No breaking changes**: Maintains backward compatibility

#### Enhanced Platform Loading
- `__init__.py` now loads both `sensor` and `binary_sensor` platforms
- Better error logging on platform setup

### 🐛 Fixed
- Reduced API hammering on Home Assistant restart
- Better datetime handling in sensor attributes
- More robust error handling in binary sensors

### 📊 Performance Improvements

**Before v1.2.0:**
- HA Restart: 20-30 API calls in first minute
- Risk of rate limiting on frequent restarts
- Complex templates needed for automations

**After v1.2.0:**
- HA Restart: 3 API calls (1 per endpoint)
- 90% reduction in API load
- Simple binary sensor automations
- Sub-second cache responses

---

## [1.1.0] - 2026-01-20

### ✨ Added - Major Features
- **Device Organization**: All sensors now grouped under a parent device (`MieleLogic Vaskeri {laundry_id}`)
- **Options Flow**: Users can now update credentials without deleting the integration
- **Enhanced Token Refresh**: Smart token management with fallback strategy
- **Translations System**: Proper translations structure (Danish & English)

### 🔧 Changed - Improvements
- **Modern Entity Naming**: All entities use `has_entity_name = True`
- **Enhanced Sensor Metadata**: Proper device classes and units
- **Improved Token Management**: Refresh token logic refactored

---

## [1.0.5] - 2026-01-13

### Initial Alpha Release
- Basic OAuth2 authentication with password grant
- Token refresh mechanism
- Three API endpoints: reservations, machine states, account details
- Four global sensors + dynamic per-machine sensors
- Config flow with Danish error messages
- Extensive debug logging

---

**Full Changelog**: https://github.com/yourusername/mielelogic
