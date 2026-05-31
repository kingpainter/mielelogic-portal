# MieleLogic — Home Assistant Integration

[![Version](https://img.shields.io/badge/version-2.5.1-blue.svg)](https://github.com/kingpainter/mielelogic/releases)
[![CI](https://github.com/kingpainter/mielelogic/actions/workflows/validate.yml/badge.svg)](https://github.com/kingpainter/mielelogic/actions/workflows/validate.yml)
[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2026.1%2B-blue.svg)](https://www.home-assistant.io/)

Home Assistant integration til MieleLogic vaskehus-systemer. Book vasketider, overvåg maskiner i realtid og modtag notifikationer direkte på mobilen — alt fra Home Assistant.

> **Krav:** Home Assistant Core 2026.1.0 eller nyere.

---

## Hvad kan det?

**Booking** — Book Klatvask eller Storvask direkte fra et panel i sidebaren. Vælg dato fra en 7-dages strip der viser hvilke dage der har ledige tider. Tidsblok-chips viser ledig/optaget i realtid. Bekræftelse sker via et elegant in-panel overlay — ingen native browser-dialoger.

**Kalender-sync** — Bookinger synkroniseres automatisk til din primære kalender. Ved booking via panelet kan du vælge at tilføje bookingen til én eller flere sekundære kalendere (f.eks. et familiemedlems kalender) via klikbare chips i booking-formularen.

**Maskinestatus** — Se i realtid om maskinerne er ledige, i gang, reserverede eller lukkede. Aktive bookinger viser en live countdown-timer.

**Notifikationer** — Push-beskeder på mobilen ved booking og som påmindelser. Booking-notifikationen indeholder en "Aflys booking"-knap — du kan aflyse direkte fra notifikationen uden at åbne appen. Beskedskabeloner kan tilpasses med variabler.

**Admin** — Driftsbesked til alle brugere og mulighed for at spærre for nye bookinger midlertidigt.

**Statistik** — Se de seneste 30 dages afsluttede bookinger med brugernavn og varighed.

**Panel-indstillinger** — Sidebar-titel, ikon, admin-only adgang og panel til/fra kan ændres via Options Flow — uden genstart.

---

## Screenshots

| Panel — Oversigt | Panel — Notifikationer |
|---|---|
| ![Panel Booking](screenshots/booking-panel.png) | ![Notification Tab](screenshots/notification-tab.png) |

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
3. Konfigurer maskiner, tidslots og kalender
4. Panelet vises automatisk i sidebaren

---

## Konfiguration (Options Flow)

Indstillinger → Integrationer → MieleLogic → Konfigurer:

| Menupunkt | Beskrivelse |
|---|---|
| **Credentials** | Opdater login-oplysninger |
| **Calendar** | Primær kalender (auto-sync) + sekundære kalendere (valgfrie per booking) |
| **Opening Hours** | Åbnings- og lukketider for vaskehuset |
| **Machines** | Primær maskine for Klatvask og Storvask |
| **Time Slots** | Tilføj/slet tidsblokke per vaskehus |
| **Panel** | Sidebar-titel, ikon, til/fra, admin-only adgang |

Alle ændringer træder i kraft med det samme — ingen genstart nødvendig (undtagen Python-filer).

---

## Kalender-integration

**Primær kalender** konfigureres i Options Flow og synkroniseres automatisk — både ved bookinger oprettet på MieleLogic-portalen og ved bookinger via panelet.

**Sekundære kalendere** vises som chips i booking-formularen under "TILFØJ TIL KALENDER". De er ikke valgt som standard — brugeren aktiverer dem aktivt per booking. Sekundære events slettes automatisk ved aflysning.

---

## Notifikationer

Booking-notifikationen indeholder:
- **"Aflys booking"** — destructive action-knap. Aflys direkte fra notifikationen på iOS og Android.
- **"Åbn panel"** — åbner MieleLogic-panelet direkte.
- Lyd og deep link på alle notifikationstyper.

Beskedskabeloner understøtter variablerne: `{vaskehus}`, `{time}`, `{date}`, `{duration}`, `{machine}`.

---

## Design

Panelet følger **Indeklima Designer** design-sproget:

- **Accent-farver:** Blå `#3b82f6` / Cyan `#06b6d4`
- **Typografi:** DM Sans (tekst) + DM Mono (tal/kode)
- **Layout:** Fast topbar + scrollbart indhold
- **Cards:** 18px border-radius, subtle borders og hover-effekter
- **Responsivt:** Tab-labels skjules på mobil, reduceret padding
- **Skeleton loading:** Shimmer-animerede placeholder-cards ved initial load
- **In-panel toast:** Feedback vises som slide-in toast (ikke forstyrrende HA persistent notifications)

---

## Versionskrav

| Komponent | Minimumversion |
|---|---|
| Home Assistant Core | **2026.1.0** |
| HA Companion App (notifikationer + cancel action) | Seneste |
| Python | 3.11+ |

---

## Filstruktur

```
custom_components/mielelogic/
├── __init__.py                    # v2.5.0 — runtime_data, notification action listener
├── manifest.json                  # dependencies: http, frontend, panel_custom
├── const.py                       # CONF_PRIMARY_CALENDAR, CONF_SECONDARY_CALENDARS
├── config_flow.py                 # 6 options trin inkl. primær/sekundær kalender
├── coordinator.py                 # API polling + primær kalender auto-sync
├── diagnostics.py
├── sensor.py                      # EntityDescription pattern (Gold tier)
├── binary_sensor.py               # EntityDescription pattern (Gold tier)
├── calendar.py
├── services.py                    # Response support enabled
├── panel.py                       # Energy Hub registration pattern
├── time_manager.py
├── booking_manager.py             # make_booking(extra_calendars), sekundær kalender sync
├── websocket.py                   # 18 WebSocket-kommandoer
├── storage.py                     # secondary_calendar_synced, booking metadata
├── notification_manager.py        # Deep link, lyd, cancel action button
├── strings.json
├── frontend/
│   ├── entrypoint.js              # Font preload (DM Sans/Mono)
│   ├── panel.js                   # v2.5.0 — vanilla HTMLElement, shadow DOM
│   └── mielelogic-booking-card.js
└── translations/
    ├── da.json
    └── en.json
```

---

## WebSocket API (18 kommandoer)

```
Booking:        get_slots · make_booking · cancel_booking · get_bookings · get_status · get_machines
Kalender:       get_calendars · get_week_availability
Notifikationer: get_devices · save_devices · get_notifications · save_notification · test_notification · reset_notification
Admin:          get_admin · save_admin · get_history · cleanup_history
```

---

## Fejlfinding

**Panel vises ikke**
Ryd browsercache (Ctrl+Shift+R). Tjek at panelet er aktiveret: Indstillinger → Integrationer → MieleLogic → Konfigurer → Panel.

**Notifikationer virker ikke**
Panel → Notifikationer → Kontroller at enheder er valgt og notifikationer er aktiveret.

**Cancel fra notifikation virker ikke**
Kræver HA Companion App i seneste version. Tjek HA-loggen for `MIELELOGIC_CANCEL_`-events.

**Kalender-fejl ved opstart**
Kræver Home Assistant 2026.1.0+.

**Sekundære chips vises ikke**
Konfigurer sekundære kalendere under Indstillinger → Integrationer → MieleLogic → Konfigurer → Calendar.

---

## Kendte begrænsninger

- Kun én vaskehus-instans understøttes (multi-vaskehus planlagt til v3.0.0)
- Panel kræver internet til DM Sans font (Google Fonts)

---

## Roadmap

Se [CHANGELOG.md](CHANGELOG.md) for fuld versionshistorik.

- **v2.5.1** ✅ — Bugfix: `_renderWeekStrip` crash på booking-kort, CI/CD workflow
- **v2.5.0** ✅ — Multi-kalender, runtime_data migration, sekundær kalender-tracking
- **v2.4.0** ✅ — Cancel fra push-notifikation, countdown-timer, rige notifikationer
- **v2.3.0** ✅ — 7-dages dag-strip med ledig/optaget-indikator
- **v2.2.0** ✅ — Inline booking/cancel bekræftelse, skeleton loading
- **v2.1.0** ✅ — Performance, in-panel toast, klikbare chips, exponential backoff
- **v2.0.0** ✅ — Energy Hub panel-registrering, Indeklima Designer redesign
- **Næste** — Gold Tier tests, HACS/brands

---

## Licens

MIT — se [LICENSE.md](LICENSE.md)

---

**Seneste version:** 2.5.1 — 31. maj 2026  
**Udvikler:** KingPainter
