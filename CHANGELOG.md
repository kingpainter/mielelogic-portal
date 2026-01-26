# Changelog - v1.3.3

## [1.3.3] - 2026-01-26

### 🐛 Bug Fix - External Calendar Sync

**Problem:**
- Calendar events created 1 hour later than reservation time
- Event names too long: "Klatvask #1 [MieleLogic]"

**Solution:**
- ✅ Fixed timezone conversion (UTC → Denmark timezone)
- ✅ Simplified event names: "Klatvask Reserveret" / "Storvask Reserveret"

### 🔧 Changes

**coordinator.py (v1.3.3):**
```python
# Before:
summary = "Klatvask #1 [MieleLogic]"
start_date_time: start_time.isoformat()  # UTC time (wrong!)

# After:
summary = "Klatvask Reserveret"
start_date_time: start_time_denmark.isoformat()  # Denmark time (correct!)
```

**Impact:**
- Calendar events now show correct time (matches MieleLogic app)
- Simpler event names: "Klatvask Reserveret" or "Storvask Reserveret"
- No more "[MieleLogic]" tag (cleaner appearance)

### ✅ Example

**Reservation in MieleLogic app:**
- Machine: Klatvask #1
- Time: 19:00 - 20:30 (Denmark time)

**Calendar event (Before v1.3.3):**
- Summary: "Klatvask #1 [MieleLogic]"
- Time: 20:00 - 21:30 ❌ (1 hour late!)

**Calendar event (After v1.3.3):**
- Summary: "Klatvask Reserveret"
- Time: 19:00 - 20:30 ✅ (correct!)

### 🎯 Upgrade Instructions

**If you have v1.3.2 with calendar sync enabled:**

1. **Update Files:**
   - Copy new `coordinator.py` to `/custom_components/mielelogic/`
   - Copy new `const.py` to `/custom_components/mielelogic/`
   - Copy new `manifest.json` to `/custom_components/mielelogic/`

2. **Restart Home Assistant:**
   - Settings → System → Restart Home Assistant

3. **Clean Old Events (Optional):**
   - Old events with wrong times will remain in calendar
   - You can delete them manually
   - New events will have correct times

4. **Verify Fix:**
   - Make a new reservation in MieleLogic app
   - Wait 5 minutes (or restart coordinator)
   - Check external calendar:
     - Time should match MieleLogic app ✅
     - Name should be "Klatvask Reserveret" or "Storvask Reserveret" ✅

### 📝 Technical Details

**Timezone Conversion:**
```python
# Parse API time (UTC)
start_time = self._parse_datetime(start_str)  # UTC

# Convert to Denmark timezone
denmark_tz = ZoneInfo("Europe/Copenhagen")
start_time_denmark = start_time.astimezone(denmark_tz)

# Create event with Denmark time
start_date_time: start_time_denmark.isoformat()
```

**Event Summary:**
```python
# Machine name from API: "Klatvask" or "Storvask"
summary = f"{machine_name} Reserveret"

# Results:
# "Klatvask Reserveret"  (for Klatvask #1 or #2)
# "Storvask Reserveret"  (for Storvask #3, #4, #5)
```

**Duplicate Detection:**
```python
# Check if event exists (same name + time)
already_exists = any(
    event.get("summary") == summary
    and self._parse_datetime(event.get("start")).astimezone(denmark_tz) == start_time_denmark
    for event in existing_events
)
```

### ⚠️ Breaking Changes

**Minor:** Event summary format changed
- Old format: "Klatvask #1 [MieleLogic]"
- New format: "Klatvask Reserveret"

**Impact:**
- Old events with wrong times will NOT be updated
- New events will use new format and correct time
- Automations using event name need to be updated (if any)

**Recommendation:** Delete old events manually and let new ones be created

### 🎊 Benefits

1. **Correct Times** - Events match reservation times exactly
2. **Simpler Names** - "Klatvask Reserveret" easier to read
3. **Cleaner Calendar** - No more "[MieleLogic]" tag clutter
4. **Better UX** - Calendar matches user expectations

### 📦 Files Changed

**Modified Files (3):**
1. `coordinator.py` (v1.3.3 - timezone fix + simpler names)
2. `const.py` (v1.3.3 - version bump)
3. `manifest.json` (v1.3.3 - version bump)

**Unchanged Files:**
- `__init__.py` (v1.3.0)
- `binary_sensor.py` (v1.3.0)
- `calendar.py` (v1.3.0)
- `config_flow.py` (v1.3.2)
- `sensor.py` (v1.3.2)
- `translations/da.json` (v1.3.2)
- `translations/en.json` (v1.3.2)

### 🚀 Next Steps

**v1.3.3 (Planned):**
- Weekend-specific opening hours
- Holiday calendar support

**v1.4.0 (Planned):**
- Services: make/cancel reservations
- Two-way calendar sync

---

**Version:** 1.3.3  
**Release Type:** Patch (Bug Fix)  
**Breaking Changes:** Minor (event name format)  
**Migration Required:** No (but manual cleanup of old events recommended)

**Status:** Ready to Deploy! 🎉
