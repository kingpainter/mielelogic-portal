# MieleLogic v1.5.0 - Integrated Panel Release

## 🎉 Major Release: Unified Panel Interface

**Release Date:** February 22, 2026  
**Version:** 1.5.0  
**Breaking Changes:** None - Fully backward compatible!

---

## ✨ What's New

### 🎯 Integrated Custom Panel

**The biggest improvement in MieleLogic history!**

All booking functionality is now integrated directly into the Home Assistant sidebar - **no more separate dashboards or package files needed**!

**Access:** Sidebar → MieleLogic

**Features:**
- ✅ **Dropdown that ALWAYS works** - No automation dependencies
- ✅ **Auto-updating time slots** - Changes instantly when you switch vaskehus
- ✅ **Live booking status** - See balance and booking count
- ✅ **One-click booking** - Select, confirm, done!
- ✅ **One-click cancellation** - Delete bookings instantly
- ✅ **Beautiful modern UI** - Professional design
- ✅ **Fully responsive** - Works on mobile and desktop

---

## 📦 New Architecture

### New Files:

```
custom_components/mielelogic/
├── panel.py              ✨ Panel registration
├── time_manager.py       ✨ Time slot management
├── booking_manager.py    ✨ Booking operations
├── websocket.py          ✨ WebSocket API
└── frontend/
    ├── entrypoint.js     ✨ Frontend entry
    └── panel.js          ✨ Panel UI (complete interface)
```

### Updated Files:

```
custom_components/mielelogic/
├── __init__.py           📝 Updated - Panel + WebSocket registration
├── manifest.json         📝 Updated - Frontend support added
└── const.py              📝 Updated - Version 1.5.0
```

**All other files unchanged** - Full backward compatibility! ✅

---

## 🚀 Installation

### New Installation:

1. Copy entire `custom_components/mielelogic/` folder to your HA `custom_components/` directory
2. Restart Home Assistant
3. Add integration: Settings → Devices & Services → Add Integration → MieleLogic
4. Configure your credentials
5. **Panel automatically appears in sidebar!** 🎉

### Upgrade from v1.4.x:

1. **Backup** your current installation
2. Copy new files to `custom_components/mielelogic/`:
   - `__init__.py` (replace)
   - `manifest.json` (replace)
   - `const.py` (replace)
   - `panel.py` (new)
   - `time_manager.py` (new)
   - `booking_manager.py` (new)
   - `websocket.py` (new)
   - `frontend/` folder (new - entire folder)
3. Restart Home Assistant
4. **Panel automatically appears!** No configuration needed!

**Note:** Package files (`mielelogic_booking.yaml`) are now optional - the panel replaces them!

---

## 🎨 Panel Features

### Main Interface:

**📅 Booking Form:**
- Vaskehus dropdown (Klatvask/Storvask)
- Time slot dropdown (auto-updates on vaskehus change)
- Date picker
- Book button with confirmation

**📊 Status Display:**
- Account balance
- Current bookings / Max allowed
- Visual indicators

**📋 Active Bookings:**
- List of all your bookings
- Shows vaskehus name, date/time, duration
- One-click delete with confirmation

---

## 🔧 Technical Details

### WebSocket API:

**5 new commands for panel communication:**

1. **`mielelogic/get_slots`** - Get time slots for vaskehus
2. **`mielelogic/make_booking`** - Create booking
3. **`mielelogic/cancel_booking`** - Cancel booking
4. **`mielelogic/get_bookings`** - Get current bookings
5. **`mielelogic/get_status`** - Get account status

### Time Management:

**TimeSlotManager** handles:
- Slot formatting and labeling
- Duration calculations
- Machine → Vaskehus mapping
- Config slot loading with fallbacks

### Booking Management:

**BookingManager** handles:
- Service call wrapping
- Error handling
- Booking status queries
- Account information

---

## 🎯 Migration Guide

### From Package-Based Setup:

**Before v1.5.0:**
```
1. Configure in Settings
2. Add package file
3. Create dashboard
4. Setup automations
5. Hope dropdown works 🤞
```

**With v1.5.0:**
```
1. Configure in Settings
2. Done! Panel ready to use 🎉
```

**You can:**
- ✅ Keep using old dashboards if you want
- ✅ Keep package files (they still work)
- ✅ Use both panel AND dashboards
- ✅ Migrate gradually

**No breaking changes!** Everything is additive.

---

## 📝 Complete File Checklist

### Core Integration (Existing - Keep):
- [ ] `__init__.py` - **UPDATE to v1.5.0**
- [ ] `manifest.json` - **UPDATE to v1.5.0**
- [ ] `const.py` - **UPDATE to v1.5.0**
- [ ] `config_flow.py` - Keep as-is
- [ ] `coordinator.py` - Keep as-is
- [ ] `sensor.py` - Keep as-is
- [ ] `binary_sensor.py` - Keep as-is
- [ ] `calendar.py` - Keep as-is
- [ ] `services.py` - Keep as-is
- [ ] `diagnostics.py` - Keep as-is
- [ ] `translations/da.json` - Keep as-is
- [ ] `translations/en.json` - Keep as-is

### Panel System (New - Add):
- [ ] `panel.py` - **NEW**
- [ ] `time_manager.py` - **NEW**
- [ ] `booking_manager.py` - **NEW**
- [ ] `websocket.py` - **NEW**
- [ ] `frontend/entrypoint.js` - **NEW**
- [ ] `frontend/panel.js` - **NEW**

---

## ✅ Testing Checklist

After installation:

### Panel Accessibility:
- [ ] Panel appears in sidebar as "MieleLogic"
- [ ] Panel opens without errors
- [ ] UI loads and displays correctly

### Dropdown Functionality:
- [ ] Vaskehus dropdown shows Klatvask/Storvask
- [ ] Changing vaskehus updates time slots immediately
- [ ] Time slots show correct format (e.g., "07:00-09:00 (2t)")
- [ ] Klatvask shows 7 x 2-hour slots
- [ ] Storvask shows 6 slots (mix of 2t and 3t)

### Booking Workflow:
- [ ] Select vaskehus → slots update
- [ ] Select time slot
- [ ] Select date
- [ ] Click "BOOK NU"
- [ ] Confirmation dialog appears
- [ ] Booking succeeds
- [ ] Booking appears in "Mine Bookinger"
- [ ] Notification shows success

### Cancel Workflow:
- [ ] Click 🗑️ on a booking
- [ ] Confirmation dialog appears
- [ ] Booking is canceled
- [ ] Booking removed from list
- [ ] Notification shows success

### Status Display:
- [ ] Balance shows correct amount
- [ ] Booking count correct (X / 2)
- [ ] "Book" button disabled if max bookings reached

### Error Handling:
- [ ] Booking in past shows helpful error
- [ ] Max bookings shows clear message
- [ ] Network errors handled gracefully

---

## 🐛 Known Issues

### Fixed in v1.5.0:
- ✅ Dropdown not populating (automation dependency removed)
- ✅ Time slots not changing on vaskehus switch
- ✅ Emoji encoding errors
- ✅ Calendar sync crashes

### Still Present (Minor):
- ⚠️ Panel uses external CDN for Lit Element (requires internet)
- ⚠️ Panel doesn't support multiple MieleLogic integrations (rarely needed)

---

## 🎓 Developer Notes

### Architecture Decisions:

**Why WebSocket API?**
- Real-time communication
- Efficient data transfer
- No polling needed
- Standard HA pattern

**Why Separate Managers?**
- Separation of concerns
- Testable components
- Reusable logic
- Clean architecture

**Why Lit Element?**
- Lightweight
- Web Components standard
- Good HA integration
- Reactive updates

### Extension Points:

**To add new features:**

1. **New WebSocket command:**
   - Add handler in `websocket.py`
   - Register in `async_register_websocket_commands()`
   - Call from `panel.js`

2. **New time slot logic:**
   - Update `TimeSlotManager` methods
   - No frontend changes needed

3. **New booking rules:**
   - Update `BookingManager` methods
   - Errors propagate to UI automatically

---

## 📊 Performance Impact

**Load Time:**
- Panel: ~200ms first load (CDN)
- Subsequent loads: Instant (cached)

**API Calls:**
- On panel open: 3 calls (slots, bookings, status)
- On booking: 1 call
- On cancel: 1 call

**Memory:**
- Panel: ~2MB JavaScript
- No background polling
- Cleans up on close

---

## 🚀 Roadmap

### v1.6.0 (Next):
- Offline support
- Bundle Lit Element (no CDN)
- Multiple integration support
- Advanced filtering

### v2.0.0 (Future):
- Extend reservation from panel
- Booking history
- Usage statistics
- Cost tracking

---

## 💬 Support

**Issues:** https://github.com/kingpainter/mielelogic/issues  
**Developer:** KingPainter  
**License:** MIT

---

## 🎉 Thank You!

This release represents a massive improvement in user experience. The integrated panel eliminates all the complexity of packages, automations, and dashboards.

**Everything just works now!** 🚀

Enjoy your new MieleLogic panel! 😊
