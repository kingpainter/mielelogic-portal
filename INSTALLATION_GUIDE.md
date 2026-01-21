# MieleLogic v1.2.0 - Installation Guide

## 🎉 Quick Summary
All v1.2.0 features are **COMPLETE**! The integration now includes:
- ✅ 6 binary sensors for easy automations
- ✅ Enhanced sensor attributes with structured data
- ✅ Response caching (90% API load reduction)
- ✅ 100% backward compatible with v1.1.0

**Upgrade from v1.1.0:** Drop-in replacement, no breaking changes!

---

## 📂 File Structure

```
custom_components/mielelogic/
├── __init__.py                    # v1.2.0 - Added binary_sensor platform
├── binary_sensor.py               # v1.2.0 - NEW! 6 automation sensors
├── config_flow.py                 # v1.2.0
├── const.py                       # v1.2.0
├── coordinator.py                 # v1.2.0 - Caching system
├── sensor.py                      # v1.2.0 - Enhanced attributes
├── manifest.json                  # v1.2.0
├── translations/                  # v1.2.0
│   ├── da.json                    # Danish + binary sensors
│   └── en.json                    # English + binary sensors
├── CHANGELOG.md                   # Full v1.2.0 notes
├── v1.2.0_RELEASE_STATUS.md       # Technical details
└── v1.2.0_ROADMAP.md              # Development roadmap
```

---

## 🚀 Installation Steps

### Step 1: Backup (Optional but Recommended)
```bash
cd /config/custom_components/
cp -r mielelogic mielelogic_v1.1.0_backup
```

### Step 2: Copy New Files
1. Copy ALL files from this download to:
   ```
   /config/custom_components/mielelogic/
   ```

2. **IMPORTANT**: Verify new `binary_sensor.py` file exists:
   ```bash
   ls /config/custom_components/mielelogic/binary_sensor.py
   # Should exist and be ~12KB
   ```

### Step 3: Restart Home Assistant
- Settings → System → Restart Home Assistant

### Step 4: Verify in UI
1. Go to Settings → Devices & Services
2. Find "MieleLogic" integration
3. Click on device: **"MieleLogic Vaskeri 3444"**
4. Should now see **12-16 entities** (up from 6-10):
   - 6 regular sensors (Reservations, Washer Status, Dryer Status, Account, Machines)
   - **6 NEW binary sensors** (Has Reservation, Starting Soon, Washer Available, etc.)

### Step 5: Check Logs (Optional)
Check that caching is working:
```
Settings → System → Logs
Search for: "Cache HIT" or "Cache MISS"

Expected output:
[INFO] ✅ Cache HIT for reservations_3444 (age: 5.2s)
[INFO] Data fetch complete: reservations=2, machines=5, balance=125.50 DKK
```

### Step 6: (Optional) Simplify Automations
If you have complex template-based automations from pre-v1.1.0, you can now simplify them using binary sensors. See examples below.

---

## 🆕 What's New in v1.2.0

### 1. Binary Sensors (6 New Entities)

**Reservation Status:**
- `binary_sensor.mielelogic_vaskeri_3444_has_reservation`
- `binary_sensor.mielelogic_vaskeri_3444_has_washer_reservation`
- `binary_sensor.mielelogic_vaskeri_3444_has_dryer_reservation` ⚠️

**Timing:**
- `binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon` (15 min warning)

**Availability:**
- `binary_sensor.mielelogic_vaskeri_3444_washer_available`
- `binary_sensor.mielelogic_vaskeri_3444_dryer_available` ⚠️

⚠️ **Note om Tørretumbler Sensorer:**
Dryer-relaterede sensorer (`has_dryer_reservation`, `dryer_available`, `dryer_status`) kræver at tørretumblerne er tilsluttet MieleLogic API'et. Hvis dit vaskeri kun har vaskemaskiner, vil disse sensorer vise "off" / "Idle" og kan ignoreres.

De er inkluderet for:
- **Fremtidssikring**: Hvis vaskeriet senere tilslutter tørretumblere
- **Andre vaskerier**: Andre brugere med tørretumbler-adgang
- **API kompabilitet**: MieleLogic API understøtter MachineType "58" (Dryer)

### 2. Enhanced Sensor Attributes

**Reservations Sensor:**
```yaml
sensor.mielelogic_vaskeri_3444_reservations:
  state: 2
  attributes:
    total_count: 2
    washer_count: 1        # NEW
    dryer_count: 1         # NEW
    reservations_today: 2  # NEW
    next_reservation:      # NEW - Structured!
      machine_name: "Klatvask"
      start_time: "2026-01-20T14:00:00Z"
      duration_minutes: 90
```

**Machine Sensors:**
```yaml
sensor.mielelogic_vaskeri_3444_klatvask_1:
  attributes:
    machine_type_name: "Washer"  # NEW
    is_available: true           # NEW
    is_reserved: false           # NEW
    is_running: false            # NEW
```

### 3. Response Caching
- First request: Fetches from API
- Subsequent requests (within 60s): Returns cached data
- **Result:** 90% fewer API calls on HA restart

---

## 🧪 Testing Checklist

After installation, verify:

- [ ] Device "MieleLogic Vaskeri 3444" appears
- [ ] 6 new binary sensors visible
- [ ] Binary sensors turn on/off correctly
- [ ] Enhanced attributes show in Developer Tools → States
- [ ] Logs show "Cache HIT" messages
- [ ] Existing automations still work

---

## 💡 Usage Examples

### Example 1: Simple 15-Minute Warning
**BEFORE v1.2.0 (Complex Template):**
```yaml
automation:
  - alias: Vaskehus Reminder
    trigger:
      - platform: time_pattern
        minutes: /1
    condition:
      - condition: template
        value_template: >
          {% set reservations = state_attr('sensor.mielelogic_reservations', 'Reservations') %}
          {% if reservations %}
            {% for res in reservations %}
              {% set start = as_timestamp(res.Start) %}
              {% set now = now().timestamp() %}
              {% if ((start - now) / 60) | int == 15 %}
                true
              {% endif %}
            {% endfor %}
          {% endif %}
```

**AFTER v1.2.0 (Simple Binary Sensor):**
```yaml
automation:
  - alias: Vaskehus Reminder
    trigger:
      - platform: state
        entity_id: binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon
        to: 'on'
    action:
      - service: notify.mobile_app_flemming_mobil
        data:
          title: "🧺 Vaskehus Påmindelse"
          message: >
            Din reservation starter om 
            {{ state_attr('binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon', 'next_start_in_minutes') }} 
            minutter!
```

### Example 2: Washer Available Notification
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
      - service: notify.mobile_app_flemming_mobil
        data:
          title: "✅ Vasker Tilgængelig"
          message: >
            Der er nu {{ state_attr('binary_sensor.mielelogic_vaskeri_3444_washer_available', 'available_count') }} 
            vaskere ledige!
```

### Example 3: Dashboard Card
```yaml
type: entities
title: Vaskehus Status
entities:
  - entity: binary_sensor.mielelogic_vaskeri_3444_has_reservation
    name: Har Reservation
  - entity: binary_sensor.mielelogic_vaskeri_3444_washer_available
    name: Vasker Ledig
  - entity: binary_sensor.mielelogic_vaskeri_3444_reservation_starting_soon
    name: Starter Snart
  - type: attribute
    entity: sensor.mielelogic_vaskeri_3444_reservations
    attribute: next_reservation
    name: Næste Reservation
```

---

## ⚠️ Important Notes

### No Breaking Changes!
v1.2.0 is 100% backward compatible with v1.1.0:
- ✅ All existing sensors work unchanged
- ✅ All existing automations work unchanged
- ✅ Entity IDs remain the same
- ✅ New features are purely additive

### Cache Behavior
- Cache TTL: 60 seconds
- Cache applies per-endpoint (independent)
- No manual cleanup needed
- Graceful degradation (cache miss = normal fetch)

### Performance
After upgrade you should see:
- Faster entity updates (cache < 0.1s vs API ~2s)
- Fewer API calls in logs
- No 429 rate limit errors

---

## 🤔 Frequently Asked Questions (FAQ)

### Q: Jeg har kun vaskemaskiner - hvad med dryer sensors?
**A:** Perfekt! Dryer-sensors (`has_dryer_reservation`, `dryer_available`, `dryer_status`) vil vise "off" / "Idle" og kan ignoreres. De er inkluderet for fremtidssikring og kompatibilitet med andre vaskerier der har tørretumbler-adgang.

Du kan eventuelt skjule dem i UI:
1. Settings → Devices & Services → MieleLogic
2. Klik på device
3. Klik på dryer-sensor → Settings icon
4. Vælg "Hide"

### Q: Hvorfor er der tørretumbler timer i mine automations?
**A:** Den timer (`timer.torretumbler_timer`) er en **manuel timer** du selv starter via input_select - IKKE baseret på API data. Den har ingen relation til de nye dryer sensors.

### Q: Vil dryer sensors virke hvis vaskeriet tilføjer tørretumblere?
**A:** Ja! Hvis vaskeriet senere tilslutter tørretumblere til MieleLogic API'et (MachineType "58"), vil alle dryer sensors automatisk begynde at vise korrekt data - ingen kode-ændringer nødvendige!

### Q: Kan jeg slette dryer sensors?
**A:** Teknisk set ja, men det anbefales IKKE da:
1. De skader ikke (viser bare "off")
2. Fremtidssikring hvis vaskeriet opgraderer
3. Kode-kompleksitet at vedligeholde 2 versioner

---

## 🐛 Troubleshooting

### Problem: Binary sensors not appearing
**Solution:** 
1. Check that `binary_sensor.py` exists
2. Restart HA
3. Check logs for errors

### Problem: Cache not working (too many API calls)
**Solution:** 
1. Check logs for "Cache HIT" vs "Cache MISS"
2. Wait 60 seconds between checks
3. Restart may temporarily bypass cache

### Problem: Attributes not showing enhanced data
**Solution:** 
1. Verify version is 1.2.0 (check manifest.json)
2. Developer Tools → States → Check sensor attributes
3. Reload integration if needed

---

## 📚 Documentation Files

- **CHANGELOG.md** - Full v1.2.0 release notes with examples
- **v1.2.0_RELEASE_STATUS.md** - Technical implementation details
- **v1.2.0_ROADMAP.md** - Development roadmap and feature planning
- **INSTALLATION_GUIDE.md** - This file

---

## 🎯 Next Features (v1.3.0 Preview)

Coming soon:
- 📅 Calendar integration (reservations as calendar events)
- 🔔 Notification services (built-in reservation reminders)
- 🛠️ Services: make/cancel/extend reservations
- 📘 Automation blueprints (pre-made automations)

---

## ✅ Success!

If you can see:
- ✅ 12-16 entities under device
- ✅ Binary sensors turn on/off
- ✅ Logs show "Cache HIT"
- ✅ Enhanced attributes in Developer Tools

**You're all set!** 🎉

Enjoy your v1.2.0 upgrade with simpler automations and better performance!

---

**Release:** v1.2.0  
**Date:** 20. januar 2026  
**Developer:** KingPainter
**Status:** Production Ready
