# MieleLogic v1.4.7 - Phase 1 Fixes

**Date:** 30. januar 2026  
**Status:** ✅ READY TO DEPLOY

---

## 📦 Modified Files in This Folder

### Core Files (8 files):
1. **__init__.py** - VERSION updated to 1.4.7, emoji fixes
2. **calendar.py** - VERSION updated to 1.4.7
3. **config_flow.py** - VERSION updated to 1.4.7
4. **const.py** - VERSION updated to 1.4.7
5. **coordinator.py** - Emoji fixes (4 locations), calendar sync error handling
6. **sensor.py** - Danish character fixes (æ, ø, å)
7. **services.py** - Emoji fixes (7 locations), VERSION updated
8. **manifest.json** - version updated to "1.4.7"

---

## 🔧 How to Deploy

### Option 1: Copy Individual Files (Recommended)
```bash
# On your Windows machine:
# 1. Download this folder
# 2. Copy each file to: custom_components/mielelogic/
# 3. Restart Home Assistant
```

### Option 2: Replace Entire Integration
```bash
# Backup first!
mv custom_components/mielelogic custom_components/mielelogic.backup

# Copy new files
cp -r mielelogic_v1.4.7/* custom_components/mielelogic/

# Restart Home Assistant
```

---

## ✅ What's Fixed

### 1. Emoji Encoding (15+ locations)
- All corrupted emojis now display correctly
- Logs show proper: 🔵🔴✅❌💾
- Danish characters work: æ, ø, å

### 2. Calendar Sync
- Enhanced error handling
- Full stack traces for debugging
- Won't crash coordinator on failure

### 3. Version Consistency
- All files show VERSION = "1.4.7"
- manifest.json updated
- Ready for release

---

## 🧪 Testing Checklist

After deployment, verify:

- [ ] Home Assistant restarts without errors
- [ ] Check logs for clean emoji display
- [ ] Calendar sync still works (if enabled)
- [ ] Services work: make_reservation, cancel_reservation
- [ ] All sensors update correctly
- [ ] No encoding warnings in logs

---

## 📝 Notes

**Unchanged Files:**
- binary_sensor.py (still v1.3.0 - no changes needed)
- diagnostics.py (still v1.3.2 - no changes needed)
- translations/ (no changes in Phase 1)

**Next Phase:**
- Phase 2 will add overlap detection, better errors, service returns
- Estimated 2-3 hours of work

---

**Questions?** Check the full ERROR_AND_UPDATE_PLAN.md for details!
