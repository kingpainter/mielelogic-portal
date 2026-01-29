# Changelog v1.4.5 - Naming Consistency Fix

## [1.4.5] - 2026-01-30

### 🎯 Purpose: Fix Naming Inconsistency

**Problem:** Inconsistent naming throughout codebase and documentation
- Code said: "MieleLogic Portal" (in some places)
- Manifest said: "MieleLogic"
- Docs expected: `sensor.mielelogic_portal_*`
- Reality was: `sensor.mielelogic_*`

**Solution:** Standardize on "MieleLogic" (without "Portal") everywhere!

---

## 🔧 Code Changes

### Fixed Files (5):

1. **config_flow.py** (line 49)
   ```python
   # BEFORE:
   title="MieleLogic Portal"
   
   # AFTER:
   title="MieleLogic"
   ```

2. **coordinator.py** (line 51)
   ```python
   # BEFORE:
   name="MieleLogic Portal"
   
   # AFTER:
   name="MieleLogic"
   ```

3. **const.py**
   ```python
   VERSION = "1.4.5"  # Updated from 1.4.4
   ```

4. **manifest.json**
   ```json
   "version": "1.4.5"  // Updated from 1.4.4
   ```

5. **__init__.py**
   ```python
   # VERSION = "1.4.5"  # Updated from 1.4.4
   ```

---

## 📝 Documentation Changes

### Updated All Entity References:

**BEFORE (v1.4.4 and earlier):**
```yaml
sensor.mielelogic_portal_reservations  ❌
binary_sensor.mielelogic_portal_has_reservation  ❌
calendar.mielelogic_portal_reservations  ❌
```

**AFTER (v1.4.5):**
```yaml
sensor.mielelogic_reservations  ✅
binary_sensor.mielelogic_has_reservation  ✅
calendar.mielelogic_reservations  ✅
```

---

## ✅ Consistency Achieved

### Now Everything Matches:

```
DOMAIN:           mielelogic          ✅
Integration Name: MieleLogic          ✅
Device Name:      MieleLogic          ✅
Entity Prefix:    mielelogic_         ✅
Documentation:    mielelogic_         ✅
Package:          mielelogic_         ✅
```

---

## 🎯 Entity Names (Official)

### Calendar (1):
- `calendar.mielelogic_reservations`

### Sensors (6-10):
- `sensor.mielelogic_reservations`
- `sensor.mielelogic_account_balance`
- `sensor.mielelogic_washer_status`
- `sensor.mielelogic_dryer_status`
- `sensor.mielelogic_klatvask_1_status`
- `sensor.mielelogic_klatvask_2_status`
- `sensor.mielelogic_stor_vask_3_status`
- `sensor.mielelogic_stor_vask_4_status`
- `sensor.mielelogic_stor_vask_5_status`

### Binary Sensors (6):
- `binary_sensor.mielelogic_has_reservation`
- `binary_sensor.mielelogic_has_washer_reservation`
- `binary_sensor.mielelogic_has_dryer_reservation`
- `binary_sensor.mielelogic_reservation_starting_soon`
- `binary_sensor.mielelogic_washer_available`
- `binary_sensor.mielelogic_dryer_available`

---

## 📦 Package File

**Already Correct!** ✅

The package file `mielelogic_booking_v1_4_4_OLD_NAMING.yaml` already used correct naming:
```yaml
sensor.mielelogic_reservations  ✅
```

**Renamed to:** `mielelogic_booking_v1_4_5.yaml`

---

## 🚀 Migration from v1.4.4

### If You Have v1.4.4 Installed:

**Good News:** No migration needed! ✅

**Why?**
- Your entities already have correct names (`sensor.mielelogic_*`)
- This update just fixes the inconsistency in code
- No entity IDs change!

**Steps:**
1. Install v1.4.5 files (5 updated files)
2. Restart Home Assistant
3. Done! Everything works the same!

---

## 🎊 Benefits

### Before v1.4.5:
- ❌ Confusing documentation (expected "_portal_")
- ❌ Inconsistent naming in code
- ❌ New users confused about entity names
- ❌ Package didn't match docs

### After v1.4.5:
- ✅ Consistent naming everywhere
- ✅ Clear documentation
- ✅ Code matches reality
- ✅ Package matches entities

---

## 📋 Files Changed

### Core Integration (5 files):
1. `__init__.py` - Version comment
2. `config_flow.py` - Integration title
3. `coordinator.py` - Device name
4. `const.py` - Version constant
5. `manifest.json` - Version field

### Services (1 file):
6. `services.py` - Version comment

### Package (1 file):
7. `mielelogic_booking.yaml` - Already correct, just renamed

**Total:** 7 files updated

---

## ⚠️ Breaking Changes

**None!** ✅

This is a **non-breaking** update:
- Entity IDs stay the same
- Device name display changes slightly (loses " Portal")
- But functionality identical
- Automations work unchanged
- Dashboard works unchanged
- Package works unchanged

---

## 🧪 Testing

### Verified:
- ✅ Entity names match pattern `sensor.mielelogic_*`
- ✅ No `_portal_` in entity names
- ✅ Device shows as "MieleLogic" (not "MieleLogic Portal")
- ✅ Integration title is "MieleLogic"
- ✅ All documentation matches reality
- ✅ Package file works correctly
- ✅ Services work (make/cancel)
- ✅ Dashboard works
- ✅ Automations work

---

## 📖 Updated Documentation

### Files Updated:
- README.md - All entity examples
- INSTALLATION guides - Entity naming
- Package examples - Already correct
- Project instructions - Naming section
- All tutorials - Entity references

---

## 💡 Why "MieleLogic" (not "MieleLogic Portal")?

**Reasons:**
1. ✅ Matches `domain: "mielelogic"`
2. ✅ Matches `manifest name: "MieleLogic"`
3. ✅ Shorter and cleaner
4. ✅ Matches API provider name
5. ✅ What users actually have installed
6. ✅ Consistent with industry naming

---

## 🎯 Version Summary

**v1.4.5** = v1.4.4 + Naming Consistency Fix

**Features:** (same as v1.4.4)
- ✅ Make reservation service
- ✅ Cancel reservation service  
- ✅ Dashboard package
- ✅ Input helpers
- ✅ Timezone handling
- ✅ Debug logging

**Plus:**
- ✅ Consistent naming everywhere! ⭐ NEW!

---

## 🚀 Installation

**From v1.4.4:**
1. Copy 5 updated core files
2. Copy 1 updated services.py
3. Restart HA
4. Done! (no config changes needed)

**Fresh Install:**
1. Copy all 12 integration files
2. Copy package file
3. Restart HA
4. Setup via UI
5. Done!

---

## 📞 Support

**Questions about naming?**
- Check entity list in Developer Tools → States
- All entities should be `sensor.mielelogic_*` (no `_portal_`)
- If you see `_portal_`, you have old version

**Issues?**
- Entity names wrong? Check you installed v1.4.5
- Package not working? Check sensor name in package
- Dashboard broken? Update entity references

---

**Version:** 1.4.5  
**Release Date:** 30. januar 2026  
**Type:** Patch (Naming Fix)  
**Breaking Changes:** None ✅  
**Migration Required:** No ✅

**Status:** Ready for Release! 🎉
