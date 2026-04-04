# MieleLogic — Home Assistant Integration

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/kingpainter/mielelogic/releases)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2026.1%2B-blue.svg)](https://www.home-assistant.io/)

Home Assistant integration til MieleLogic vaskehus-systemer. Book vasketider, overvåg maskiner i realtid og modtag notifikationer direkte på mobilen — alt fra Home Assistant.

> **Krav:** Home Assistant Core 2026.1.0 eller nyere.

---

## Hvad kan det?

**Booking** — Book Klatvask eller Storvask direkte fra et panel i sidebaren eller fra et Lovelace-kort. Systemet bruger stednavne fremfor maskinnumre, så det er intuitivt for alle i ejendommen.

**Maskinestatus** — Se i realtid om maskinerne er ledige, i gang, reserverede eller lukkede. Vises som farvede ikoner øverst i booking-kortet.

**Notifikationer** — Modtag push-beskeder på mobilen ved booking, aflysning og som påmindelser. Beskedskabelonerne kan tilpasses med variabler som `{vaskehus}`, `{time}`, `{date}`.

**Kalender** — Bookinger synkroniseres automatisk til Home Assistants kalender med vaskehusnavne fremfor maskinnumre.

**Admin** — Driftsbesked til alle brugere og mulighed for at spærre for nye bookinger midlertidigt.

**Statistik** — Se de seneste 30 dages afsluttede bookinger med brugernavn og varighed.

**Panel-indstillinger** — Sidebar-titel, ikon, admin-only adgang og panel til/fra kan ændres via Options Flow — uden genstart.

---

## Screenshots

| Panel — Oversigt | Panel — Notifikationer |
|---|---|
| ![Panel Booking](screenshots/booking-panel.png) | ![Notification Tab](screenshots/notification-tab.png) |

| Lovelace Card | Maskinestatus |
|---|---|
| ![Booking Card](screenshots/booking-card.png) | ![Machine Status](screenshots/machine-status.png) |

---

## Installation

### Via HACS (anbefalet)

1. Åbn HACS → Integrationer → Tilpassede repositories
2. Tilføj: `https://github.com/kingpainter/mielelogic`
3. Søg efter "MieleLogic" og installer
4. Genstart Home Assistant

### Manuel installation

1. Download seneste release fra GitHub
2. Kopier mappen `custom_components/mielelogic/` til din HA `config/custom_components/`
3. Genstart Home Assistant

### Opsætning

1. Indstillinger → Enheder og tjenester → Tilføj integration → søg "MieleLogic"
2. Indtast dine MieleLogic loginoplysninger
3. Konfigurer maskiner og tidslots
4. Panelet vises automatisk i sidebaren

### Lovelace-kort

Tilføj til dit dashboard:

```yaml
type: custom:mielelogic-booking-card
```

---

## Konfiguration (Options Flow)

Indstillinger → Integrationer → MieleLogic → Konfigurer:

| Menupunkt | Beskrivelse |
|---|---|
| **Credentials** | Opdater login-oplysninger |
| **Calendar** | Aktiver/deaktiver synkronisering til ekstern kalender |
| **Opening Hours** | Åbnings- og lukketider for vaskehuset |
| **Machines** | Primær maskine for Klatvask og Storvask |
| **Time Slots** | Tilføj/slet tidsblokke per vaskehus |
| **Panel** | Sidebar-titel, ikon, til/fra, admin-only adgang |

Alle ændringer træder i kraft med det samme — ingen genstart nødvendig.

---

## Design

Fra v2.0.0 følger panelet **Indeklima Designer** design-sproget, som deles på tværs af alle Flemming's HA-integrationer:

- **Accent-farver:** Blå `#3b82f6` / Cyan `#06b6d4`
- **Typografi:** DM Sans (tekst) + DM Mono (tal/kode)
- **Layout:** Fast topbar + scrollbart indhold
- **Cards:** 18px border-radius, subtle borders og hover-effekter
- **Responsivt:** Tab-labels skjules på mobil, reduceret padding

---

## Versionskrav

| Komponent | Minimumversion |
|---|---|
| Home Assistant Core | **2026.1.0** |
| HA Companion App (notifikationer) | Seneste |
| Python | 3.11+ |

---

## Filstruktur

```
custom_components/mielelogic/
├── __init__.py                    # Setup + update listener
├── manifest.json                  # dependencies: http, frontend, panel_custom
├── const.py                       # Panel constants (CONF_SIDEBAR_TITLE, etc.)
├── config_flow.py                 # 6 options menu items (incl. Panel)
├── coordinator.py                 # API polling + calendar sync
├── diagnostics.py
├── sensor.py                      # EntityDescription pattern (Gold tier)
├── binary_sensor.py               # EntityDescription pattern (Gold tier)
├── calendar.py
├── services.py                    # Response support enabled
├── panel.py                       # Energy Hub registration pattern
├── time_manager.py
├── booking_manager.py
├── websocket.py                   # 16 WebSocket commands
├── storage.py
├── notification_manager.py
├── strings.json                   # Primary translation source
├── frontend/
│   ├── entrypoint.js
│   ├── panel.js                   # Indeklima Designer — vanilla HTMLElement
│   └── mielelogic-booking-card.js
└── translations/
    ├── da.json
    └── en.json
```

---

## Panel-arkitektur

Panelet er skrevet i **vanilla HTMLElement** (shadow DOM) — samme arkitektur som Heat Manager og Indeklima. Panel-registrering følger **Energy Hub-metoden** med parameteriseret sidebar:

```python
# panel.py — parameterized registration
await async_register_panel(
    hass,
    sidebar_title=options.get(CONF_SIDEBAR_TITLE, "MieleLogic"),
    sidebar_icon=options.get(CONF_SIDEBAR_ICON, "mdi:washing-machine"),
    require_admin=options.get(CONF_REQUIRE_ADMIN, False),
)
```

Live reload via `_async_update_listener` — ændringer i Options Flow genindlæser panelet uden HA-genstart.

---

## WebSocket API

16 WebSocket-kommandoer:

```
Booking:        get_slots · make_booking · cancel_booking · get_bookings · get_status · get_machines
Notifikationer: get_devices · save_devices · get_notifications · save_notification · test_notification · reset_notification
Admin:          get_admin · save_admin
Statistik:      get_history · cleanup_history
```

---

## Kendte begrænsninger

- Kun én vaskehus-instans understøttes (multi-vaskehus planlagt til v3.0.0)
- Panel kræver internet (DM Sans font via Google Fonts)

---

## Fejlfinding

**Panel vises ikke**
Ryd browsercache (Ctrl+Shift+R). Panelet registreres ved HA-genstart. Tjek at panelet er aktiveret: Indstillinger → Integrationer → MieleLogic → Konfigurer → Panel.

**Notifikationer virker ikke**
Panel → Notifikationer → Kontroller at enheder er valgt og notifikationer er aktiveret.

**Kalender-fejl ved opstart**
Kræver Home Assistant 2026.1.0+.

---

## Roadmap

Se [STATUS.md](STATUS.md) for detaljeret plan.

- **v2.0.0** ✅ — Energy Hub panel-registrering, Indeklima Designer redesign, Panel Options Flow
- **v2.1.0** — Kalender-cleanup ved aflysning, cancel fra notification, Gold tier tests
- **v3.0.0** — Multi-vaskehus, historik-udvidelse

---

## Licens

MIT — se [LICENSE.md](LICENSE.md)

---

**Seneste version:** 2.0.0 — 4. april 2026
**Udvikler:** KingPainter
