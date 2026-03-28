# MieleLogic v1.9.1 - Project Instructions

## 🎯 Current Status: v1.9.1 - Vanilla JS Panel + UI Redesign

**Version:** 1.9.1  
**Status:** Production Ready  
**Requirements:** Home Assistant 2026.1+ (CRITICAL)

---

## 🚨 CRITICAL REQUIREMENTS

### Home Assistant Version
**MINIMUM:** Home Assistant Core 2026.1.0+

**Why this matters:**
- Calendar services (`calendar.create_event`, `calendar.get_events`) require 2026+
- Custom panel architecture uses modern frontend APIs
- WebSocket command structure updated for 2026
- Service response support requires recent HA versions
- Rich notification actions require modern HA Companion app

---

## 📦 v1.9.1 Feature Summary

### New in v1.9.1:

#### 🔧 Panel rewritten to Vanilla JS
- **No LitElement** — Pure `HTMLElement` with shadow DOM
- **No CDN dependency** — No import from `unpkg.com`
- **Same architecture as Heat Manager and Indeklima**
- **Real app icon** — Original gold washer icon embedded as base64 PNG

#### 🎨 UI Redesign (Heat Manager / Indeklima design language)
- **Dark theme** — `#0d0d0d` background, thin `#1e1e1e` borders
- **UPPERCASE LETTER-SPACING** section labels in `#333`
- **Horizontal tabs** — Oversigt / Notifikationer / Historik / Konfiguration
- **Icon header** — App icon top-left, "Opdater" button top-right
- **Vaskehus toggle** — Two buttons with SVG icons
- **Booking rows** — Compact with coloured left accent stripe

#### 🫧 Live Machine Status Block
- Coloured bubble icons for all washers/dryers
- State colours: 🟢 Ledig · 🟠 I gang · 🔵 Reserveret · ⚫ Lukket
- WebSocket: `mielelogic/get_machines`

#### 🎨 Card Border Fix
- Replaced `ha-card` with plain `div.card-root`
- Hover uses `inset box-shadow` only

#### 🔧 Notification Tab Fix
- `_get_store()` in `websocket.py` now correctly iterates config entry dict

### Continuing from v2.0.0:

#### ⚙️ Admin Tab
- Operator message displayed at top of booking overview
- Booking lock toggle with custom message
- Persistent storage across restarts

#### 📊 Statistics Tab
- Last 30 days of completed bookings
- Per-booking: vaskehus, date, time, duration, username

#### 🔔 Rich Notifications
- Deep links — tap notification → opens MieleLogic panel
- "Åbn Panel" action button
- Customizable templates with variable system
- iOS: sound, badge, subtitle / Android: channel, importance

#### 👤 User Tracking
- Shows HA username on bookings

---

## 📁 File Structure v1.9.1

```
custom_components/mielelogic/
├── __init__.py                    # v1.9.1
├── manifest.json                  # v1.9.1 - "version": "1.9.1"
├── const.py                       # v1.9.1 - VERSION = "1.9.1"
├── config_flow.py                 # v1.4.6
├── coordinator.py                 # v1.7.0
├── diagnostics.py                 # v1.3.2
├── sensor.py                      # v1.7.0
├── binary_sensor.py               # v1.7.0
├── calendar.py                    # v1.7.0
├── services.py                    # v1.7.0
├── panel.py                       # v1.9.1 - Logo static path + add_extra_js_url
├── time_manager.py                # v1.7.0
├── booking_manager.py             # v1.7.0
├── websocket.py                   # v1.9.1 - _get_store() fix
├── storage.py                     # v1.8.0
├── notification_manager.py        # v1.8.0
├── frontend/
│   ├── entrypoint.js
│   ├── panel.js                   # v1.9.1 - Vanilla HTMLElement (NO LitElement)
│   └── mielelogic-booking-card.js # v1.9.1
└── translations/
    ├── da.json
    └── en.json
```

---

## 🎯 Development Rules v1.9.1

### 1. Version Consistency
```python
VERSION = "1.9.1"     ← In const.py (and top comment of every .py file)
"version": "1.9.1"    ← In manifest.json
```

### 2. Panel Architecture — Vanilla JS (CRITICAL)
```javascript
// panel.js — NO LitElement, NO CDN imports
// Same pattern as Heat Manager (0.3.0) and Indeklima (2.4.0)

class MieleLogicPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._tab  = "booking";
    // ... state vars
  }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (first) this._init();
  }

  connectedCallback() {
    // inject style + initial DOM
    this._interval = setInterval(() => this._loadAll(), 30000);
  }

  disconnectedCallback() { clearInterval(this._interval); }

  _render() {
    const page = this.shadowRoot.querySelector(".page");
    page.innerHTML = this._html();
    this._bindEvents(page);
  }
}

if (!customElements.get("mielelogic-panel")) {
  customElements.define("mielelogic-panel", MieleLogicPanel);
}
```

**Rules:**
- State is stored as `this._varName` properties
- `_render()` rebuilds innerHTML and rebinds events
- Use `data-action`, `data-field`, `data-tab` attributes for event binding
- CSS lives in `_css()` method returning a string
- HTML lives in `_html()` and section methods returning strings

### 3. App Icon
```javascript
// Icon is embedded as base64 PNG — no external file needed
// Original mielelogic.png resized to 52x52, saved as data URI
// Inside _htmlTopbar():
<div class="app-icon">
  <img src="data:image/png;base64,..." style="width:52px;height:52px;border-radius:16px;object-fit:cover" />
</div>
```

**CSS for .app-icon:**
```css
.app-icon {
  width: 52px; height: 52px; border-radius: 16px;
  overflow: hidden; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.app-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
```

### 4. File Writing Rule (IMPORTANT)
> **Files larger than ~15KB must be created as a download — never attempt to write them directly to server/repo via tools.**

This avoids truncation, placeholder bugs, and partial writes. The user downloads the file and places it manually.

### 5. Data Structure Pattern
```python
# __init__.py setup:
hass.data[DOMAIN][entry_id] = {
    "coordinator": coordinator,
    "time_manager": time_manager,
    "booking_manager": booking_manager,
    "notification_manager": notification_manager,
    "store": store,
}

# WebSocket helper:
def _get_store(hass):
    domain_data = hass.data.get(DOMAIN, {})
    for key, value in domain_data.items():
        if isinstance(value, dict) and "store" in value:
            return value["store"]
    return None
```

### 6. WebSocket Commands (15 total)
```python
# Booking:
mielelogic/get_slots · make_booking · cancel_booking · get_bookings · get_status · get_machines

# Notifications:
mielelogic/get_devices · save_devices · get_notifications · save_notification · test_notification · reset_notification

# Admin:
mielelogic/get_admin · save_admin

# Statistics:
mielelogic/get_history · cleanup_history
```

### 7. Card Architecture
```javascript
// mielelogic-booking-card.js
// NEVER use <ha-card> — use plain div.card-root
.card-root {
  background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
  border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, rgba(255,255,255,0.12));
  border-radius: var(--ha-card-border-radius, 12px);
  box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.3));
  overflow: hidden;
}

// Hover: inset box-shadow ONLY (never border/outline — bleeds outside overflow:hidden)
.booking-card:hover { box-shadow: inset 0 0 0 2px #03a9f4; }
```

### 8. Design Language
```
Background:      #0d0d0d / #111
Borders:         #1e1e1e / #2a2a2a
Section labels:  UPPERCASE, letter-spacing: 0.9px, color: #333
Active tab:      color: #f0f0f0, border-bottom: 2px solid #f0f0f0
Primary text:    #e8e8e8
Muted text:      #555
Primary button:  background: #e8e8e8, color: #0d0d0d (inverts on hover)
```

### 9. Rich Notification Structure
```python
notification_data = {
    "title": "Storvask booket",
    "message": "28-05-2026 kl. 19:00",
    "data": {
        "url": "/mielelogic-panel/mielelogic",
        "clickAction": "/mielelogic-panel/mielelogic",
        "actions": [{"action": "view_panel", "title": "Åbn Panel", "uri": "/mielelogic-panel/mielelogic"}],
        "subtitle": "28-05-2026 kl. 19:00",
        "channel": "MieleLogic",
        "importance": "high",
    }
}
```

### 10. Template Variables
```
{vaskehus} → "Klatvask" / "Storvask"
{time}     → "14:30"
{date}     → "28-05-2026"
{duration} → "120 minutter"
{machine}  → "Maskine 1"
```

---

## 🧪 Testing Checklist v1.9.1

- [ ] Panel loads without console errors (no LitElement warnings)
- [ ] App icon shows correctly (gold washer)
- [ ] Tab switching works (Oversigt ↔ Notifikationer ↔ Historik ↔ Konfiguration)
- [ ] Booking card found in Lovelace "Add card" picker (search "mielelogic")
- [ ] Card border consistent with and without bookings
- [ ] Machine status bubbles show correct colours
- [ ] Notification tab loads (not "not ready")
- [ ] Booking created → push notification with "Åbn Panel" button
- [ ] Admin driftsbesked shows in booking overview
- [ ] History tab shows completed bookings

---

## 🐛 Fixed Issues

- ✅ Panel duplicate registration (v1.5.0)
- ✅ Calendar services not found (v1.5.0)
- ✅ Duplicate calendar events (v1.5.2)
- ✅ User tracking display (v1.6.0)
- ✅ Verbose debug logs (v1.7.0)
- ✅ Notification tab "not ready" (v1.9.1)
- ✅ Card border inconsistency (v1.9.1)
- ✅ Multiple Lit versions warning (v1.9.1) — removed LitElement entirely
- ✅ CDN dependency (v1.9.1) — panel now fully offline-capable

## ⚠️ Known Remaining Issues

- Calendar events not deleted on booking cancel → v2.1.0
- Single integration only → v3.0.0

---

## 🎯 Roadmap

- **v2.1.0** — Calendar cleanup, Gold Tier tests, brands submission
- **v3.0.0** — Multi-laundry, cancel from notification, graphical stats

---

## 💡 Quick Reference

| Item | Value |
|---|---|
| Version | 1.9.1 |
| HA Requirement | 2026.1.0+ |
| Quality Tier | Gold |
| Panel Type | Vanilla HTMLElement (shadow DOM) |
| Icon | Embedded base64 PNG |
| GitHub | https://github.com/kingpainter/mielelogic |
| Developer | KingPainter |

**Last Updated:** 28. marts 2026
