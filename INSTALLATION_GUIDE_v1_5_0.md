# MieleLogic v1.5.0 - Quick Installation Guide

## 📦 Files Included

### New Files (Add to integration):
1. `panel.py`
2. `time_manager.py`
3. `booking_manager.py`
4. `websocket.py`
5. `frontend/entrypoint.js` (create folder!)
6. `frontend/panel.js`

### Updated Files (Replace existing):
7. `__init__.py`
8. `manifest.json`
9. `const.py`

### Keep As-Is (Don't touch):
- `config_flow.py`
- `coordinator.py`
- `sensor.py`
- `binary_sensor.py`
- `calendar.py`
- `services.py`
- `diagnostics.py`
- `translations/da.json`
- `translations/en.json`

---

## 🚀 Windows Installation Steps

### Step 1: Locate Your Integration

Navigate to:
```
\\HOMEASSISTANT\config\custom_components\mielelogic\
```

Or if using Samba:
```
\\192.168.x.x\config\custom_components\mielelogic\
```

### Step 2: Backup Current Version

1. Copy entire `mielelogic` folder
2. Rename copy to `mielelogic.v1.4.7.backup`
3. Keep it safe!

### Step 3: Create Frontend Folder

Inside `mielelogic` folder, create new folder:
```
mielelogic/frontend/
```

### Step 4: Add New Files

Copy these files INTO `mielelogic` folder:
- `panel.py`
- `time_manager.py`
- `booking_manager.py`
- `websocket.py`

Copy these files INTO `mielelogic/frontend/` folder:
- `entrypoint.js`
- `panel.js`

### Step 5: Replace Existing Files

Replace these 3 files:
- `__init__.py`
- `manifest.json`
- `const.py`

### Step 6: Verify File Structure

Your folder should look like:
```
custom_components/mielelogic/
├── __init__.py              ← REPLACED
├── manifest.json            ← REPLACED
├── const.py                 ← REPLACED
├── config_flow.py           (unchanged)
├── coordinator.py           (unchanged)
├── sensor.py                (unchanged)
├── binary_sensor.py         (unchanged)
├── calendar.py              (unchanged)
├── services.py              (unchanged)
├── diagnostics.py           (unchanged)
├── panel.py                 ← NEW
├── time_manager.py          ← NEW
├── booking_manager.py       ← NEW
├── websocket.py             ← NEW
├── frontend/                ← NEW FOLDER
│   ├── entrypoint.js        ← NEW
│   └── panel.js             ← NEW
└── translations/
    ├── da.json              (unchanged)
    └── en.json              (unchanged)
```

### Step 7: Restart Home Assistant

**Settings → System → Restart**

Wait for restart to complete (~1 minute)

### Step 8: Verify Panel Appears

1. Open sidebar
2. Look for "🧺 MieleLogic" entry
3. Click it
4. Panel should load!

---

## ✅ Quick Test

### Test 1: Panel Loads
- [ ] Sidebar shows MieleLogic
- [ ] Click opens panel
- [ ] No errors in browser console (F12)

### Test 2: Dropdowns Work
- [ ] Vaskehus dropdown shows options
- [ ] Changing vaskehus updates time slots
- [ ] Time slots show correct labels

### Test 3: Booking Works
- [ ] Select Storvask
- [ ] Select 09:00-12:00 (3t)
- [ ] Select tomorrow's date
- [ ] Click BOOK NU
- [ ] Confirm
- [ ] Check if booking appears

### Test 4: Cancel Works
- [ ] See booking in list
- [ ] Click 🗑️
- [ ] Confirm
- [ ] Booking removed

---

## 🐛 Troubleshooting

### Panel Doesn't Appear in Sidebar

**Check logs:**
```
Settings → System → Logs
Search for: "mielelogic"
```

**Look for:**
- "✅ MieleLogic panel registered"
- "✅ WebSocket commands registered"

**If missing:**
- Check file permissions
- Verify frontend folder exists
- Restart again

### Panel Shows Blank Page

**Check browser console (F12):**
- Look for 404 errors
- Check frontend/panel.js loaded

**Common causes:**
- Frontend files in wrong location
- manifest.json not updated
- Browser cache (Ctrl+Shift+R to refresh)

### Dropdowns Don't Populate

**Check WebSocket in logs:**
- Look for WebSocket errors
- Verify integration is configured

**Try:**
- Refresh panel (Ctrl+R)
- Restart HA
- Check internet connection (Lit Element from CDN)

### "Integration Not Found" Error

**Causes:**
- Integration not setup yet
- Config entry missing

**Fix:**
- Settings → Integrations
- Add MieleLogic integration
- Configure credentials

---

## 🔄 Rollback (If Needed)

If something goes wrong:

1. Delete `mielelogic` folder
2. Rename `mielelogic.v1.4.7.backup` to `mielelogic`
3. Restart Home Assistant

Your old setup will be restored!

---

## 💡 Pro Tips

### Tip 1: Keep Package Files

The old `mielelogic_booking.yaml` package still works!

You can use:
- ✅ Panel for quick bookings
- ✅ Dashboard for detailed view
- ✅ Both at same time!

### Tip 2: Browser Cache

If panel looks weird:
- Press `Ctrl + Shift + R` to hard refresh
- Or clear browser cache

### Tip 3: Mobile Access

Panel works great on mobile!
- Use HA Companion App
- Or mobile web browser
- Fully responsive design

---

## 📞 Getting Help

**Check logs first:**
```
Settings → System → Logs
Filter: "mielelogic"
```

**Common log messages:**

✅ Good:
```
✅ MieleLogic v1.5.0 setup complete with integrated panel
✅ MieleLogic panel registered in sidebar
✅ WebSocket commands registered for panel
```

❌ Problems:
```
Error loading frontend module
Panel registration failed
WebSocket command error
```

**If you see errors:**
1. Copy full error message
2. Check file locations
3. Verify all files present
4. Try restart

---

## 🎉 Success!

When everything works, you should see:

1. **Sidebar:** MieleLogic entry with washing machine icon
2. **Panel:** Beautiful booking interface
3. **Dropdowns:** Working perfectly (no automation needed!)
4. **Bookings:** Fast and reliable

**Enjoy your new integrated panel!** 🚀
