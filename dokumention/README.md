# MieleLogic Integration for Home Assistant

[![Version](https://img.shields.io/badge/version-1.4.6-blue.svg)](https://github.com/kingpainter/mielelogic-portal/releases)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)

Home Assistant custom integration for MieleLogic laundry service monitoring with **vaskehus-based booking** 🧺, real-time machine status, reservation tracking, calendar integration, and automation support.

**NEW in v1.4.6:** Book laundry by house name (Klatvask/Storvask) instead of confusing machine numbers! ⭐

---

## Table of Contents

- [Features](#features)
- [What's New in v1.4.6](#whats-new-in-v146)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Services](#services)
- [Automation](#automation)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Support](#support)

---

## Features

### Core Functionality
- ✅ **Real-time machine status** - Monitor all washing machines in your laundry
- ✅ **Reservation tracking** - See your upcoming bookings
- ✅ **Account balance** - Track your prepaid laundry balance
- ✅ **Calendar integration** - Visual overview in HA Calendar
- ✅ **External calendar sync** - Sync to Google Calendar, CalDAV, etc.
- ✅ **Automation support** - 6 binary sensors + 4 automation blueprints
- ✅ **Opening hours** - Configure when laundry opens/closes

### NEW in v1.4.6 - Vaskehus Abstraction! ⭐
- ✅ **Book by house name** - "Klatvask" or "Storvask" instead of machine numbers
- ✅ **Fixed time slots** - Configure standard booking blocks (e.g., 07:00-09:00)
- ✅ **Smart machine mapping** - System knows which machine to use
- ✅ **Calendar displays house names** - "Klatvask booket" not "Maskine 1"
- ✅ **Intuitive dashboard** - Select house → date → time slot → book!

### Services (v1.4.5+)
- ✅ **Make reservations** - `mielelogic.make_reservation`
- ✅ **Cancel reservations** - `mielelogic.cancel_reservation`
- ✅ **Full validation** - Time, duration, max reservations checked
- ✅ **Automatic retry** - Handles token expiry gracefully

### Quality & Reliability
- ✅ **Silver+ tier** - Home Assistant quality scale compliant
- ✅ **Response caching** - 90% API call reduction
- ✅ **Smart token refresh** - Automatic re-authentication
- ✅ **Timezone-aware** - Correct handling of Danish time
- ✅ **Diagnostics** - Built-in troubleshooting data export

---

## What's New in v1.4.6

### 🎯 Problem: Users Think in Houses, Not Machines
**Before v1.4.6:**
```
User thinks: "I want to book the small laundry"
System shows: "Book Machine 1"  ❌ Confusing!
Calendar shows: "Maskine 1 booket"
```

**After v1.4.6:**
```
User thinks: "I want to book the small laundry"
System shows: "Book Klatvask"  ✅ Perfect!
Calendar shows: "Klatvask booket"  ✅ Clear!
```

### ⚙️ Configuration: Machine Mapping
Tell the system which machine represents each house:

**Settings → MieleLogic → Configure → Configure Machines**
```
Klatvask primary machine: [1 ▼]  # Machine 1 or 2
Storvask primary machine: [4 ▼]  # Machine 3, 4, or 5
```

When you book "Klatvask", the system automatically uses Machine 1. Simple! ✅

### ⏰ Configuration: Time Slots
Configure fixed booking blocks for each house:

**Settings → MieleLogic → Configure → Configure Time Slots**

**Default Slots:**
- **Storvask** (6 slots): 07:00-09:00, 09:00-12:00, 12:00-14:00, 14:00-17:00, 17:00-19:00, 19:00-21:00
- **Klatvask** (7 slots): 07:00-09:00, 09:00-11:00, 11:00-13:00, 13:00-15:00, 15:00-17:00, 17:00-19:00, 19:00-21:00

**Features:**
- Add unlimited time slots
- Delete slots dynamically
- Auto-sorted by start time
- Duration calculated automatically

### 📅 Booking Flow (New!)
```
1. Select house:    [Klatvask ▼]
2. Select date:     [12/02/2026]
3. Select slot:     [09:00-11:00 (2t) ▼]
4. Click:           Book Klatvask
5. ✅ "Klatvask booket kl. 09:00"
```

Behind the scenes:
- System looks up: Klatvask → Machine 1
- Parses slot: "09:00-11:00 (2t)" → start=09:00, duration=120 min
- Calls service with machine number
- Calendar shows: "Klatvask booket" ✅

### 📊 What Changed (Technical)

**Backend (Phase 1):**
- ✅ Machine configuration in Options Flow
- ✅ Time slots configuration in Options Flow
- ✅ Add/delete slots dynamically
- ✅ Default configuration applied automatically
- ✅ Full Danish + English translations

**Frontend (Phase 2):**
- ✅ Dashboard vaskehus selector
- ✅ Dynamic slot dropdown
- ✅ Calendar shows house names
- ✅ Template sensors for display
- ✅ Vaskehus-based cancellation

**Files Updated:**
- `config_flow.py` - Machine + slots configuration
- `coordinator.py` - Calendar house names
- `calendar.py` - Calendar house names
- `mielelogic_booking.yaml` - Complete rewrite with vaskehus abstraction
- `da.json` + `en.json` - New translations

### ⚠️ Breaking Changes
**NONE!** ✅

v1.4.6 is fully backward compatible:
- Existing bookings work unchanged
- Old services still work
- Entity IDs unchanged
- No migration required

---

## Installation

### Prerequisites
- Home Assistant 2024.1.0 or newer
- MieleLogic account with active laundry access
- Your laundry ID (found in MieleLogic app URL)

### Method 1: HACS (Recommended - Coming Soon)
1. Open HACS in Home Assistant
2. Go to "Integrations"
3. Click "+" and search for "MieleLogic"
4. Click "Download"
5. Restart Home Assistant
6. Continue to [Configuration](#configuration)

### Method 2: Manual Installation
1. **Download** the latest release from GitHub
2. **Copy** the `mielelogic` folder to `custom_components/mielelogic`
3. **Restart** Home Assistant
4. Continue to [Configuration](#configuration)

### Method 3: Git Clone (Development)
```bash
cd /config/custom_components/
git clone https://github.com/kingpainter/mielelogic-portal.git mielelogic
# Remove unnecessary files
cd mielelogic
rm -rf .git .github .gitignore
# Restart Home Assistant
```

---

## Configuration

### Initial Setup

1. **Add Integration**
   - Go to: Settings → Devices & Services → Add Integration
   - Search: "MieleLogic"
   - Click: "MieleLogic"

2. **Enter Credentials**
   ```
   Username:        your_username
   Password:        your_password
   Client ID:       YV1ZAQ7BTE9IT2ZBZXLJ (default)
   Laundry ID:      your_laundry_id (e.g., 3444)
   Client Secret:   (optional, leave blank)
   Opening Time:    07:00 (when laundry opens)
   Closing Time:    21:00 (when laundry closes)
   ```

3. **Default Configuration Applied** ⭐ NEW v1.4.6
   - Klatvask machine: 1
   - Storvask machine: 4
   - Storvask slots: 6 default blocks
   - Klatvask slots: 7 default blocks

4. **Click: Submit**

### Configure Machines ⭐ NEW v1.4.6

**Settings → Devices & Services → MieleLogic → Configure → Configure Machines**

**Map each house to its primary machine:**
```
Klatvask primary machine:  [1 ▼]  # Choose Machine 1 or 2
Storvask primary machine:  [4 ▼]  # Choose Machine 3, 4, or 5
```

**What this does:**
- When you book "Klatvask", system uses Machine 1
- When you book "Storvask", system uses Machine 4
- Calendar shows house names, not machine numbers

### Configure Time Slots ⭐ NEW v1.4.6

**Settings → Devices & Services → MieleLogic → Configure → Configure Time Slots**

**Main Menu:**
```
┌────────────────────────────────────┐
│  Rediger Storvask (6 blokke)      │
│  Rediger Klatvask (7 blokke)      │
│  Gem og luk                        │
└────────────────────────────────────┘
```

**Edit Slots:**
```
┌────────────────────────────────────┐
│  🗑️ 07:00-09:00 (2t)              │
│  🗑️ 09:00-12:00 (3t)              │
│  🗑️ 12:00-14:00 (2t)              │
│  ➕ Tilføj ny tidsblok            │
│  ⬅️ Tilbage                        │
└────────────────────────────────────┘
```

**Features:**
- Add unlimited time slots
- Delete slots with 🗑️ button
- Auto-sorted by start time
- Duration calculated automatically
- Same start time can have multiple durations

### Configure Calendar Sync (Optional)

**Settings → Devices & Services → MieleLogic → Configure → Configure Calendar Sync**

**Sync to external calendar:**
```
Enable sync:        ✓ Enabled
Target calendar:    [calendar.google ▼]
```

**Features:**
- One-way sync: MieleLogic → External calendar
- Automatic duplicate detection
- Shows house names in external calendar too! ⭐
- Graceful degradation if sync fails

### Configure Opening Hours

**Settings → Devices & Services → MieleLogic → Configure → Configure Opening Hours**

```
Opening time:    [07:00]
Closing time:    [21:00]
```

**Used for:**
- "Lukket indtil kl. 07:00" status display
- Service validation (can't book outside hours)
- Dashboard availability indicators

---

## Usage

### Entities Created

#### Sensors (4 total)
```
sensor.mielelogic_reservations           # Your bookings
sensor.mielelogic_account_balance        # Prepaid balance
sensor.mielelogic_klatvask_1_status      # Per-machine status
sensor.mielelogic_klatvask_2_status      # (etc.)
sensor.mielelogic_stor_vask_3_status
sensor.mielelogic_stor_vask_4_status
sensor.mielelogic_stor_vask_5_status
```

#### Binary Sensors (6 total)
```
binary_sensor.mielelogic_has_reservation              # Any active?
binary_sensor.mielelogic_has_washer_reservation       # Washer booked?
binary_sensor.mielelogic_has_dryer_reservation        # Dryer booked?
binary_sensor.mielelogic_reservation_starting_soon    # Starts <15 min?
binary_sensor.mielelogic_washer_available             # Washer free?
binary_sensor.mielelogic_dryer_available              # Dryer free?
```

#### Calendar (1 total)
```
calendar.mielelogic_reservations         # All bookings as events
```

### Vaskehus-Based Booking ⭐ NEW v1.4.6

**Package Installation:**
1. Copy `mielelogic_booking.yaml` to `config/packages/`
2. Ensure packages enabled in `configuration.yaml`:
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
3. Restart Home Assistant

**New Entities:**
```
input_select.mielelogic_booking_vaskehus  # Klatvask/Storvask
input_select.mielelogic_booking_slot      # Time slot dropdown
input_datetime.mielelogic_booking_date    # Date picker
sensor.mielelogic_vaskehus_config         # Config helper
sensor.mielelogic_naeste_booking_display  # Next booking with house name
```

**Dashboard Example:**
```yaml
type: vertical-stack
cards:
  # Vaskehus Selector
  - type: custom:mushroom-select-card
    entity: input_select.mielelogic_booking_vaskehus
    icon: mdi:washing-machine
    name: Vælg Vaskehus
  
  # Date Picker
  - type: custom:mushroom-date-card
    entity: input_datetime.mielelogic_booking_date
    icon: mdi:calendar
    name: Vælg Dato
  
  # Slot Selector
  - type: custom:mushroom-select-card
    entity: input_select.mielelogic_booking_slot
    icon: mdi:clock-outline
    name: Vælg Tidsblok
  
  # Book Button
  - type: custom:mushroom-template-card
    primary: Book {{ states('input_select.mielelogic_booking_vaskehus') }}
    icon: mdi:check-circle
    icon_color: green
    tap_action:
      action: call-service
      service: script.mielelogic_book_vaskehus
```

**User Experience:**
1. Select: Klatvask or Storvask
2. Pick: Date (today or future)
3. Choose: Time slot (populated from config)
4. Click: Book button
5. ✅ Confirmation: "Klatvask booket kl. 09:00"

**Calendar Display:**
```
📅 Klatvask booket
   12/02/2026 09:00-11:00
   
📅 Storvask booket
   04/02/2026 19:00-21:00
```

### Machine Status Dashboard

**Color Legend:**
- 🟢 **Green** - You have reservation (machine is reserved for you)
- 🟠 **Orange** - Machine available (but you don't have reservation)
- 🔵 **Blue** - Machine running (someone using it)
- 🔴 **Red** - Laundry closed (outside opening hours)
- ⚫ **Grey** - Other states

**Example Card:**
```yaml
type: custom:mushroom-template-card
entity: sensor.mielelogic_klatvask_1_status
primary: Klatvask 1
secondary: "{{ states('sensor.mielelogic_klatvask_1_status') }}"
icon: mdi:washing-machine
badge_icon: >-
  {% if state_attr('sensor.mielelogic_klatvask_1_status', 'is_available') %}
    mdi:check-circle
  {% endif %}
badge_color: green
color: >-
  {% set is_reserved = state_attr('sensor.mielelogic_klatvask_1_status', 'is_reserved') %}
  {% set we_have_reservation = is_state('binary_sensor.mielelogic_has_washer_reservation', 'on') %}
  
  {% if is_reserved and we_have_reservation %}
    green
  {% elif state_attr('sensor.mielelogic_klatvask_1_status', 'is_available') %}
    orange
  {% elif state_attr('sensor.mielelogic_klatvask_1_status', 'is_running') %}
    blue
  {% else %}
    grey
  {% endif %}
```

---

## Services

### mielelogic.make_reservation

**Create a laundry booking programmatically.**

**Usage:**
```yaml
service: mielelogic.make_reservation
data:
  machine_number: 1           # Required: 1-5
  start_time: "2026-01-30 19:00:00"  # Required: Future time
  duration: 120               # Optional: Minutes (default: 120)
  # OR
  end_time: "2026-01-30 21:00:00"    # Optional: Alternative to duration
```

**Validation:**
- ✅ Machine number: 1-5
- ✅ Start time: Must be in future
- ✅ Start time: Must be within opening hours
- ✅ End time: Must be after start time
- ✅ Duration: 30-180 minutes
- ✅ Max reservations: Checks current count

**Example: Book Tonight**
```yaml
service: mielelogic.make_reservation
data:
  machine_number: 1
  start_time: "{{ now().replace(hour=19, minute=0, second=0) }}"
  duration: 120
```

**Example: Book Tomorrow Morning**
```yaml
service: mielelogic.make_reservation
data:
  machine_number: 4
  start_time: "{{ (now() + timedelta(days=1)).replace(hour=10, minute=0, second=0) }}"
  duration: 180
```

### mielelogic.cancel_reservation

**Cancel an existing booking.**

**Usage:**
```yaml
service: mielelogic.cancel_reservation
data:
  machine_number: 1
  start_time: "2026-01-30 19:00:00"  # Must match exactly
  end_time: "2026-01-30 21:00:00"    # Must match exactly
```

**Validation:**
- ✅ Reservation must exist
- ✅ Times must match exactly (with 60s tolerance)

**Example: Cancel Next Reservation**
```yaml
service: mielelogic.cancel_reservation
data:
  machine_number: >
    {{ state_attr('sensor.mielelogic_reservations', 'next_reservation').machine_number }}
  start_time: >
    {{ state_attr('sensor.mielelogic_reservations', 'next_reservation').start_time }}
  end_time: >
    {{ state_attr('sensor.mielelogic_reservations', 'next_reservation').end_time }}
```

### Vaskehus-Based Services ⭐ NEW v1.4.6

**Package provides wrapper scripts:**

**script.mielelogic_book_vaskehus**
```yaml
service: script.mielelogic_book_vaskehus
# Uses input_select states to determine:
# - Which house (Klatvask/Storvask)
# - Which slot (09:00-11:00)
# - Which date
# Then calls mielelogic.make_reservation with correct machine
```

**script.mielelogic_cancel_vaskehus**
```yaml
service: script.mielelogic_cancel_vaskehus
# Cancels first reservation
# Shows house name in notification
```

---

## Automation

### Blueprint Examples

**1. Reservation Reminder (15 min before)**
```yaml
# Installed automatically via blueprint
automation:
  - alias: "Vaskemaskine: Påmindelse 15 min før"
    use_blueprint:
      path: mielelogic/reservation_reminder_15min.yaml
      input:
        reminder_time: 15
        notify_service: notify.mobile_app
```

**2. Washer Available Alert**
```yaml
automation:
  - alias: "Vaskemaskine: Ledig nu!"
    use_blueprint:
      path: mielelogic/washer_available_alert.yaml
      input:
        notify_service: notify.mobile_app
```

**3. Reservation Starting Now**
```yaml
automation:
  - alias: "Vaskemaskine: Starter nu"
    use_blueprint:
      path: mielelogic/reservation_starting_now.yaml
      input:
        notify_service: notify.mobile_app
```

**4. Low Balance Warning**
```yaml
automation:
  - alias: "Vaskemaskine: Lav saldo"
    use_blueprint:
      path: mielelogic/low_balance_warning.yaml
      input:
        balance_threshold: 50
        notify_service: notify.mobile_app
```

### Custom Automation Examples

**Book Automatically Every Sunday Night**
```yaml
automation:
  - alias: "Auto-book Sunday laundry"
    trigger:
      - platform: time
        at: "20:00:00"
    condition:
      - condition: time
        weekday: sun
    action:
      - service: mielelogic.make_reservation
        data:
          machine_number: 1
          start_time: "{{ (now() + timedelta(days=1)).replace(hour=19, minute=0) }}"
          duration: 120
```

**Notification When Reservation Starts**
```yaml
automation:
  - alias: "Laundry starting notification"
    trigger:
      - platform: state
        entity_id: binary_sensor.mielelogic_reservation_starting_soon
        to: "on"
    action:
      - service: notify.mobile_app
        data:
          title: "🧺 Din vasketur starter snart!"
          message: >
            {{ state_attr('binary_sensor.mielelogic_reservation_starting_soon', 'next_start_in_minutes') }} minutter til start
```

**Cancel Reservation if Sick**
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
      - service: script.mielelogic_cancel_vaskehus
```

---

## Troubleshooting

### Time Slots Don't Populate

**Symptom:** `input_select.mielelogic_booking_slot` shows "Vælg først vaskehus..."

**Fix:**
```
1. Developer Tools → Services
2. Service: automation.trigger
3. Entity: automation.mielelogic_populate_slots
4. Click: Call Service
```

### Calendar Shows Wrong Times

**Problem:** Events show UTC time instead of Denmark time

**Solution:** 
- ✅ Fixed in v1.3.0
- Upgrade to latest version
- Delete old calendar events (will auto-recreate with correct timezone)

### Service Call Fails

**Symptom:** Error when calling `mielelogic.make_reservation`

**Debug:**
```yaml
# Check config sensor exists:
Developer Tools → States → sensor.mielelogic_vaskehus_config

# Should show attributes:
- klatvask_machine: 1
- storvask_machine: 4
- klatvask_slots: [list]
- storvask_slots: [list]
```

**Fix:**
- Ensure config_flow changes from v1.4.6 installed
- Restart HA after copying files

### "Template Error" in Logs

**Symptom:** Template warnings about missing attributes

**Cause:** Safe defaults not used

**Fix:**
- ✅ Fixed in v1.3.2+
- Use `.get()` with defaults: `config.get("opening_time", "07:00")`

### Authentication Fails

**Symptom:** "Invalid credentials" error

**Checks:**
1. ✅ Username correct? (e.g., "kongemaleren")
2. ✅ Password correct?
3. ✅ Laundry ID correct? (e.g., 3444)
4. ✅ Client ID default? (YV1ZAQ7BTE9IT2ZBZXLJ)

**API Test:**
```bash
curl -X POST https://sec.mielelogic.com/v7/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&username=YOUR_USER&password=YOUR_PASS&client_id=YV1ZAQ7BTE9IT2FBZXLJ&scope=DA"
```

### Token Refresh Issues

**Symptom:** "Token expired" errors

**Check Logs:**
```
Settings → System → Logs → Search "mielelogic"
```

**Look for:**
- ✅ "Token refreshed using refresh_token grant" (efficient)
- ✅ "Token refreshed using password grant" (fallback)
- ❌ "Token expired during fetch" (should retry automatically)

**Fix:**
- Usually auto-resolves (automatic retry)
- If persists, delete integration and re-add

### Rate Limiting

**Symptom:** API returns 429 (Too Many Requests)

**Current Behavior:**
- Logs warning
- Waits for next update cycle
- No user notification (yet)

**Future:** v2.0.0 will show repair issue in UI

### Diagnostics

**Download diagnostic data:**
```
Settings → Devices & Services → MieleLogic → ⋮ → Download diagnostics
```

**Contains:**
- Configuration (passwords redacted)
- API responses (account numbers redacted)
- Entity states
- Cache status
- Token status
- Integration version

**Share with support** for troubleshooting!

---

## FAQ

### Q: Can I have multiple laundries?
**A:** Not yet. Single laundry per HA instance in v1.4.6. Multi-laundry support planned for v2.0.0.

### Q: Why don't I have dryer sensors?
**A:** Your laundry doesn't have dryers connected to MieleLogic API. Only washers are available.

### Q: Can I book more than 3 hours?
**A:** No. API enforces max 180 minutes (3 hours) per reservation. Make multiple bookings if needed.

### Q: How do I reset to default time slots?
**A:** Delete all slots, restart HA. Defaults will be re-applied automatically.

### Q: Can I extend an active reservation?
**A:** Not yet. Service `mielelogic.extend_reservation` planned for v1.5.0. For now, cancel and rebook.

### Q: Calendar sync stopped working?
**A:** Check external calendar still exists. If deleted, disable sync in Options Flow and re-enable with new calendar.

### Q: What happens if laundry is closed?
**A:** Machines show: "Lukket indtil kl. 07:00" (red status). Booking services validate opening hours.

### Q: Can I customize time slot format?
**A:** No. Format is fixed: "HH:MM-HH:MM (Xt)" where X is hours. Duration auto-calculated.

---

## Roadmap

### v1.5.0 - Extended Reservation (Next!)
**Goal:** Extend active reservations without canceling

- [ ] Service: `mielelogic.extend_reservation`
- [ ] Validation: Only extend active/upcoming
- [ ] API research: PATCH vs PUT endpoint
- [ ] Package integration for UI

**Priority:** Medium  
**ETA:** 2-3 weeks

### v1.6.0 - Weekend-Specific Hours
**Goal:** Different opening hours for weekends

- [ ] Add weekend hours to config
- [ ] Update sensor logic (check day of week)
- [ ] Holiday calendar support (optional)
- [ ] Update Options Flow UI

**Priority:** Low  
**ETA:** 1-2 months

### v2.0.0 - Production Ready
**Goal:** Handle all edge cases

- [ ] Rate limiting with repair issues
- [ ] Entity cleanup on machine removal
- [ ] Multi-laundry support
- [ ] Historical data tracking
- [ ] Configurable cache TTL
- [ ] Sync status sensor
- [ ] Two-way calendar sync

**Priority:** Low (polish)  
**ETA:** 3-6 months

---

## Development

### Contributing
Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Test thoroughly
4. Submit pull request with clear description

### Tech Stack
- **Language:** Python 3.11+
- **Framework:** Home Assistant Core 2024+
- **API:** MieleLogic REST API v7
- **Auth:** OAuth2 password grant
- **Quality:** Silver+ tier compliant

### Testing
- Manual testing on live HA instance
- Real MieleLogic account (laundry_id: 3444)
- Windows 11 development environment
- Git via GitHub Desktop

### Code Style
- Follow Home Assistant style guide
- Type hints where applicable
- Comprehensive logging
- Error handling with try/except
- Safe config access (.get() with defaults)

---

## Support

### Issues
Report bugs or request features on GitHub:
https://github.com/kingpainter/mielelogic-portal/issues

### Discussion
Join the conversation:
- Home Assistant Community Forum (coming soon)
- GitHub Discussions

### Contact
- **Developer:** KingPainter
- **GitHub:** @kingpainter
- **Language:** Danish/English

---

## Credits

### Built With
- [Home Assistant](https://www.home-assistant.io/)
- [MieleLogic API](https://mielelogic.com/)
- [aiohttp](https://docs.aiohttp.org/)

### Special Thanks
- Home Assistant community for testing
- MieleLogic for API access
- Claude (Anthropic) for development assistance

---

## License

MIT License - see [LICENSE.md](LICENSE.md) for details.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for full version history.

---

**Current Version:** 1.4.6  
**Last Updated:** 30. januar 2026  
**Status:** Production Ready - Vaskehus Abstraction Complete! 🎉

---

Made with ❤️ by KingPainter
