# Installation Guide - v1.4.5

## 🎯 v1.4.5 - Naming Consistency Fix

**What's New:**
- ✅ Fixed inconsistent naming throughout codebase
- ✅ Device name: "MieleLogic" (not "MieleLogic Portal")
- ✅ Entity prefix: `sensor.mielelogic_*` (not `_portal_`)
- ✅ All documentation matches reality
- ✅ No breaking changes!

---

## 📦 Files to Install

### Core Integration (5 files):
1. `__init___v1_4_5.py` → `__init__.py`
2. `config_flow_v1_4_5.py` → `config_flow.py`
3. `coordinator_v1_4_5.py` → `coordinator.py`
4. `const_v1_4_5.py` → `const.py`
5. `manifest_v1_4_5.json` → `manifest.json`

### Services (1 file):
6. `services_v1_4_5.py` → `services.py`

### Package (1 file - optional if already installed):
7. `mielelogic_booking_v1_4_5.yaml` → `mielelogic_booking.yaml`

**Total:** 7 files

---

## 🚀 Quick Install (5 minutter)

### Step 1: Download Files

**Download fra outputs:**
- All 6 integration files (listed above)
- Package file (if not already installed)

### Step 2: Copy to Custom Components

**Windows path:**
```
C:\path\to\homeassistant\config\custom_components\mielelogic\
```

**Copy files:**
```
custom_components/mielelogic/
├── __init__.py                 (from __init___v1_4_5.py)
├── config_flow.py              (from config_flow_v1_4_5.py)
├── coordinator.py              (from coordinator_v1_4_5.py)
├── const.py                    (from const_v1_4_5.py)
├── manifest.json               (from manifest_v1_4_5.json)
└── services.py                 (from services_v1_4_5.py)
```

**Unchanged files (don't need to copy):**
- `binary_sensor.py` (v1.3.0)
- `calendar.py` (v1.3.0)
- `sensor.py` (v1.3.2.1)
- `diagnostics.py` (v1.3.2)
- `translations/da.json` (v1.3.2)
- `translations/en.json` (v1.3.2)

### Step 3: Copy Package (if needed)

**If you haven't installed package yet:**
```
C:\path\to\homeassistant\config\packages\mielelogic_booking.yaml
```

**Copy:**
```
mielelogic_booking_v1_4_5.yaml → mielelogic_booking.yaml
```

### Step 4: Restart Home Assistant

```
Settings → System → Restart Home Assistant
```

**Vent ~30 sekunder**

### Step 5: Verify Installation

**Check version:**
```
Settings → Devices & Services → MieleLogic
→ Integration version should show "1.4.5"
```

**Check device name:**
```
Settings → Devices & Services → MieleLogic → Device
→ Device name: "MieleLogic" ✅ (not "MieleLogic Portal")
```

**Check entity names:**
```
Developer Tools → States → Search "mielelogic"
→ All entities: sensor.mielelogic_* ✅ (no "_portal_")
```

### Step 6: Test Everything

**Test 1: Services Work**
```
Developer Tools → Services → mielelogic.make_reservation
→ Test booking
→ Expected: ✅ Booking created!
```

**Test 2: Cancel Works**
```
Dashboard → Annuller Booking button
→ Expected: ✅ First booking cancelled!
```

**Test 3: Package Works**
```
Dashboard → Book Vaskemaskine
→ Expected: ✅ Booking created via dashboard!
```

---

## ✅ Success Criteria

- [x] Integration version: 1.4.5
- [x] Device name: "MieleLogic" (no "Portal")
- [x] Entity names: `sensor.mielelogic_*` (no "_portal_")
- [x] Services work (make + cancel)
- [x] Package scripts work
- [x] Dashboard works
- [x] No errors in logs

---

## 🔄 Upgrade from v1.4.4

**Good News:** Super easy upgrade! ✅

### What Changed:
- Device display name: "MieleLogic Portal" → "MieleLogic"
- Code consistency fixes
- **Entity IDs:** NO CHANGE! ✅

### Migration Steps:

**Step 1: Install 6 Files**
```
Copy 6 updated files to custom_components/mielelogic/
```

**Step 2: Restart HA**
```
Settings → System → Restart
```

**Step 3: Done!** ✅

**No config changes needed!**  
**No dashboard changes needed!**  
**No package changes needed!**

**Time:** 2 minutter! ⚡

---

## 🆕 Fresh Install (New Users)

### Step 1: Download All Files

**Core Integration (12 files):**
1. `__init___v1_4_5.py` → `__init__.py`
2. `binary_sensor.py` (from project)
3. `calendar.py` (from project)
4. `config_flow_v1_4_5.py` → `config_flow.py`
5. `coordinator_v1_4_5.py` → `coordinator.py`
6. `sensor.py` (from project)
7. `services_v1_4_5.py` → `services.py`
8. `const_v1_4_5.py` → `const.py`
9. `manifest_v1_4_5.json` → `manifest.json`
10. `diagnostics.py` (from project)
11. `translations/da.json` (from project)
12. `translations/en.json` (from project)

**Package (1 file):**
13. `mielelogic_booking_v1_4_5.yaml` → `mielelogic_booking.yaml`

### Step 2: Install Integration Files

**Copy to:**
```
C:\path\to\homeassistant\config\custom_components\mielelogic\
```

**Directory structure:**
```
custom_components/mielelogic/
├── __init__.py
├── binary_sensor.py
├── calendar.py
├── config_flow.py
├── coordinator.py
├── sensor.py
├── services.py
├── const.py
├── manifest.json
├── diagnostics.py
└── translations/
    ├── da.json
    └── en.json
```

### Step 3: Install Package

**Copy to:**
```
C:\path\to\homeassistant\config\packages\mielelogic_booking.yaml
```

**Ensure packages enabled in configuration.yaml:**
```yaml
homeassistant:
  packages: !include_dir_named packages
```

### Step 4: Restart HA

```
Settings → System → Restart Home Assistant
```

### Step 5: Setup Integration

```
Settings → Devices & Services → Add Integration
→ Search: "MieleLogic"
→ Click: MieleLogic

Setup:
├── Username: [your username]
├── Password: [your password]
├── Client ID: YV1ZAQ7BTE9IT2FBZXLJ
├── Laundry ID: [your laundry id, e.g., 3444]
├── Opening time: 07:00 (or your hours)
└── Closing time: 21:00 (or your hours)

Click: Submit
```

### Step 6: Configure Options (Optional)

**Calendar sync (optional):**
```
Settings → Devices & Services → MieleLogic → Configure
→ Configure calendar sync
→ Enable + select target calendar
```

### Step 7: Setup Input Helpers

**Create 3 input helpers:**

**1. input_datetime.mielelogic_start_time**
```yaml
name: Start Time
has_time: true
has_date: false
```

**2. input_number.mielelogic_duration**
```yaml
name: Duration (minutes)
min: 30
max: 180
step: 15
```

**3. input_number.mielelogic_machine_number**
```yaml
name: Machine Number
min: 1
max: 5
step: 1
```

### Step 8: Reload Everything

```
Developer Tools → YAML
→ Reload: All YAML Configuration
```

### Step 9: Test!

**Create first booking:**
```
Dashboard → Book Vaskemaskine
→ Set time, duration, machine
→ Click: Book Nu!
→ Expected: ✅ Booking created!
```

---

## 📊 Entity Overview (v1.4.5)

### Complete List:

```yaml
# Calendar (1)
calendar.mielelogic_reservations

# Sensors (6-10)
sensor.mielelogic_reservations
sensor.mielelogic_account_balance
sensor.mielelogic_washer_status
sensor.mielelogic_dryer_status
sensor.mielelogic_klatvask_1_status
sensor.mielelogic_klatvask_2_status
sensor.mielelogic_stor_vask_3_status
sensor.mielelogic_stor_vask_4_status
sensor.mielelogic_stor_vask_5_status

# Binary Sensors (6)
binary_sensor.mielelogic_has_reservation
binary_sensor.mielelogic_has_washer_reservation
binary_sensor.mielelogic_has_dryer_reservation
binary_sensor.mielelogic_reservation_starting_soon
binary_sensor.mielelogic_washer_available
binary_sensor.mielelogic_dryer_available
```

**Note:** ALL entity IDs use `mielelogic_` (no `_portal_`)! ✅

---

## ⚠️ Troubleshooting

### Issue 1: Entities Still Have "_portal_"

**Symptom:** Entities show as `sensor.mielelogic_portal_reservations`

**Cause:** Old integration not properly updated

**Fix:**
1. Delete integration: Settings → Devices & Services → MieleLogic → Delete
2. Restart HA
3. Reinstall v1.4.5 files
4. Restart HA again
5. Setup integration fresh

---

### Issue 2: Package Script Fails

**Symptom:** `TypeError: object of type 'NoneType' has no len()`

**Cause:** Package using wrong entity name

**Fix:**
1. Check entity name: Developer Tools → States → `sensor.mielelogic_reservations`
2. If exists: Package should work
3. If not exists: Install integration first!
4. Reload scripts: Developer Tools → YAML → Scripts

---

### Issue 3: Device Shows "MieleLogic Portal"

**Symptom:** Device name still shows "MieleLogic Portal"

**Cause:** v1.4.5 not properly installed

**Fix:**
1. Verify coordinator.py has line 51: `name="MieleLogic"`
2. Restart HA
3. Check device name again
4. If still wrong: Delete integration + reinstall

---

## 💡 Tips

### Tip 1: Check Version
```
Settings → Devices & Services → MieleLogic
→ Should show version "1.4.5"
```

### Tip 2: Verify Entity Names
```
Developer Tools → States → Search "mielelogic"
→ All should be "mielelogic_" (no "_portal_")
```

### Tip 3: Test Services First
```
Developer Tools → Services → mielelogic.make_reservation
→ Test manually before using dashboard
```

---

## 🎊 After Installation

**You should have:**
- ✅ Integration version 1.4.5
- ✅ Device: "MieleLogic"
- ✅ 17+ entities (all `sensor.mielelogic_*`)
- ✅ Services: make_reservation + cancel_reservation
- ✅ Package: booking dashboard
- ✅ Everything working!

**Test checklist:**
- [ ] Can make reservation (via service)
- [ ] Can make reservation (via dashboard)
- [ ] Can cancel reservation (via service)
- [ ] Can cancel reservation (via dashboard)
- [ ] Entity names correct (no "_portal_")
- [ ] Device name correct ("MieleLogic")
- [ ] No errors in logs

---

## 📞 Need Help?

**Check logs:**
```
Settings → System → Logs → Search "mielelogic"
```

**Send diagnostics:**
```
Settings → Devices & Services → MieleLogic → Device
→ ⋮ → Download diagnostics
→ Share with support
```

**Common issues:**
- Entity names wrong → Reinstall integration
- Services fail → Check logs for API errors
- Package fails → Check entity names in package match your system

---

**Version:** 1.4.5  
**Release Date:** 30. januar 2026  
**Installation Time:** 5 minutter (upgrade) / 15 minutter (fresh)  
**Breaking Changes:** None ✅

**Good luck!** 🚀
