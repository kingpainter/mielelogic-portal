# 🚀 MieleLogic v1.4.7 Deployment Guide

**Version:** 1.4.7  
**Date:** 30. januar 2026  
**Status:** ✅ READY TO DEPLOY  
**Phases Completed:** 1 + 2 (Critical Fixes + Error Handling)

---

## 📦 Files in This Package

### Modified Files (11 total):

**Core Integration (8 files):**
1. `__init__.py` - VERSION 1.4.7, emoji fixes
2. `calendar.py` - VERSION 1.4.7
3. `config_flow.py` - VERSION 1.4.7, overlap detection
4. `const.py` - VERSION 1.4.7
5. `coordinator.py` - Emoji fixes, calendar sync wrapper, retry logic
6. `sensor.py` - Danish character fixes (æ, ø, å)
7. `services.py` - Emoji fixes, improved errors, return values
8. `manifest.json` - version "1.4.7"

**Translations (2 files):**
9. `da.json` - Added "slot_overlap" error
10. `en.json` - Added "slot_overlap" error

**Documentation:**
11. `README_PHASE1.md` - Phase 1 deployment notes

---

## ✅ What's Fixed

### Phase 1 - Critical Bug Fixes:
- ✅ **15+ emoji encoding errors** fixed (🔵🔴✅❌💾)
- ✅ **Danish characters** fixed (æ, ø, å)
- ✅ **Calendar sync error wrapper** (won't crash coordinator)
- ✅ **VERSION consistency** (all files show 1.4.7)

### Phase 2 - Error Handling:
- ✅ **Overlap detection** for time slots
- ✅ **Improved error messages** with actionable suggestions
- ✅ **Service return values** (use in scripts/automations)
- ✅ **API retry logic** with exponential backoff (1s, 2s, 4s)
- ✅ **Graceful degradation** (partial data vs total failure)

---

## 🔧 Deployment Steps (Windows)

### Step 1: Backup Current Version ⚠️
```powershell
# In Home Assistant config folder:
cd config\custom_components

# Backup existing version:
Rename-Item mielelogic mielelogic.v1.4.6.backup
```

### Step 2: Copy New Files
```powershell
# Copy all files from this folder to:
config\custom_components\mielelogic\

# Make sure these files are copied:
- __init__.py
- calendar.py
- config_flow.py
- const.py
- coordinator.py
- sensor.py
- services.py
- manifest.json
- translations\da.json
- translations\en.json
```

**Important:** 
- Don't copy `README_PHASE1.md` or `DEPLOYMENT_GUIDE.md` to integration folder
- Keep `binary_sensor.py` and `diagnostics.py` from your existing installation

### Step 3: Restart Home Assistant
```
Settings → System → Restart
```

### Step 4: Check Logs
Look for these signs in logs:

**✅ Good Signs:**
```
[mielelogic] ✅ Config migration complete - all required keys present
[mielelogic] 🔵 Making reservation: Machine 1 from ...
[mielelogic] ✅ Cache HIT for reservations (age: 12.3s)
[mielelogic] ✅ MieleLogic services registered: make_reservation, cancel_reservation
```

**❌ Bad Signs:**
```
[mielelogic] Error loading integration
[mielelogic] ModuleNotFoundError
[mielelogic] SyntaxError
```

If you see bad signs → Restore backup immediately!

---

## 🧪 Testing Checklist

### After Deployment, Test:

#### Basic Functionality:
- [ ] Home Assistant starts without errors
- [ ] MieleLogic integration loads
- [ ] All sensors appear (reservations, account, machine status)
- [ ] Binary sensors work
- [ ] Calendar shows events

#### Phase 1 Fixes:
- [ ] Check logs - emojis display correctly (🔵🔴✅❌💾)
- [ ] No encoding errors in logs
- [ ] Calendar sync doesn't crash (if enabled)
- [ ] Danish characters show correctly in sensor names

#### Phase 2 Features:
- [ ] **Test Overlap Detection:**
  - Settings → MieleLogic → Configure → Time Slots
  - Edit Storvask → Add slot: 08:00-10:00
  - If existing 07:00-09:00 → Should get overlap error ✅

- [ ] **Test Improved Errors:**
  - Try booking in past → Should suggest tomorrow
  - Try booking before opening → Should suggest opening time
  - Fill max reservations → Should list existing bookings

- [ ] **Test Service Returns:**
  ```yaml
  # Developer Tools → Services
  service: mielelogic.make_reservation
  response_variable: result
  data:
    machine_number: 1
    start_time: "2026-02-01 10:00:00"
    duration: 120
  
  # Check: result contains reservation_id, message, etc.
  ```

- [ ] **Test Retry Logic:**
  - Watch logs during normal operation
  - Look for cache HIT/MISS messages
  - If network hiccup → Should see retry attempts

---

## 🔄 Rollback Plan

If anything goes wrong:

### Quick Rollback:
```powershell
# Delete new version:
Remove-Item -Recurse config\custom_components\mielelogic

# Restore backup:
Rename-Item mielelogic.v1.4.6.backup mielelogic

# Restart Home Assistant
```

---

## 📊 Expected Improvements

### Stability:
- **Before:** Calendar sync crash = entire integration fails
- **After:** Calendar sync crash = integration continues ✅

- **Before:** Network error = integration fails
- **After:** 3 retries with backoff, then graceful degradation ✅

### User Experience:
- **Before:** "Start time must be in the future"
- **After:** "Booking failed: Start time (14:00) is in the past. Try booking for tomorrow at 14:00 instead." ✅

- **Before:** Can create overlapping time slots
- **After:** Overlap detection prevents conflicts ✅

### Developer Experience:
- **Before:** Services return nothing
- **After:** Services return useful data for scripts ✅

---

## 🆘 Troubleshooting

### Problem: Integration won't load
**Solution:** Check logs for specific error. Most likely:
- Missing file → Re-copy all files
- Syntax error → Make sure files weren't corrupted during copy
- Restore backup and try again

### Problem: Emojis still corrupted in logs
**Solution:** 
- Make sure you copied the NEW files (not old ones)
- Check file sizes match (coordinator.py should be ~20KB)
- Restart Home Assistant fully (not just reload)

### Problem: Services don't return data
**Solution:**
- This is expected if you're using old automations
- Update scripts to use `response_variable` to capture return data
- Old scripts still work (they just ignore the return value)

### Problem: Overlap detection too strict
**Solution:**
- This is intentional! Adjacent slots are OK (09:00-11:00 and 11:00-13:00)
- Overlapping slots are blocked (08:00-10:00 and 09:00-11:00)
- If you need to change a slot, delete the old one first

---

## 📝 Notes

**Files NOT Modified:**
- `binary_sensor.py` (still v1.3.0 - no changes needed)
- `diagnostics.py` (still v1.3.2 - no changes needed)
- Blueprint files (unchanged)
- Package files (unchanged)

**What's Next:**
- Phase 3 (optional): Config flow help text, UI improvements
- Or you're done! v1.4.7 is production-ready

---

## 🎯 Success Criteria

Your deployment is successful if:
1. ✅ Home Assistant starts without errors
2. ✅ Logs show proper emojis (🔵🔴✅❌💾)
3. ✅ All sensors update correctly
4. ✅ Services work (make + cancel reservations)
5. ✅ Overlap detection prevents bad slots
6. ✅ Error messages are helpful

---

**Questions?** Check:
- PHASE_1_COMPLETE.md for detailed Phase 1 changes
- PHASE_2_COMPLETE.md for detailed Phase 2 changes
- ERROR_AND_UPDATE_PLAN.md for full development plan

**Ready to Deploy!** 🚀
