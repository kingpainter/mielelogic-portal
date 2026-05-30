# Changelog

Alle bemærkelsesværdige ændringer dokumenteres her.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [2.3.0] - 2026-05-30

### Tilføjet — 7-dages dag-strip
- **Dag-strip** — Vandret strip over dato-input viser de næste 7 dage med grøn dot (ledige tider) eller rød dot (fuldt booket)
- **Klikbare dage** — Klik på en dag sætter datoen og henter slots automatisk
- **I dag-markering** — Dags dato fremhæves med accent-farvet label
- **Valgt dato** — Highlightes med blå border i strippen
- **Skeleton loading** — Shimmer-animerede dag-knapper mens ugen loades
- **Auto-reload** — Strippen genindlæses når vaskehus skiftes
- **Backend** — Nyt `mielelogic/get_week_availability` WebSocket-kommando (17 i alt); bruger eksisterende timetable-data fra koordinatoren, ingen ekstra API-kald

---

## [2.2.0] - 2026-05-30

### Tilføjet — UX polish
- **Inline booking-bekræftelse** — "Book nu" viser centeret overlay med vaskehus, dato og tidsblok; to knapper: Annuller / Book nu ✓. Ingen native `confirm()` dialog.
- **Inline cancel-bekræftelse** — ✕-knap på booking-rækker åbner rød overlay-variant med "Behold" / "Slet ✕"
- **Skeleton loading** — Booking-tab viser shimmer-animerede placeholder-cards ved initial load (`_initialLoaded` flag); forsvinder automatisk når data ankommer
- **Bekræftelsesoverlay** — backdrop-blur baggrund, fade-in animation, mobilvenlig centrering

---

## [2.1.0] - 2026-05-30

### Tilføjet — Performance & UX forbedringer
- **Font preload** — DM Sans/DM Mono injiceres nu én gang fra `entrypoint.js` i stedet for `@import` inde i `_css()` der kørte ved hvert `_render()`-kald
- **Split load-loop** — `_loadCore()` (slots + bookings + status, 30s interval) adskilt fra notifikationer som nu kun loades lazy ved tab-skift
- **In-panel toast** — Grøn/orange/rød slide-in toast erstatter `persistent_notification` for al triviel feedback (3.5s auto-dismiss)
- **Klikbare slot-chips** — Fri chips kan nu klikkes direkte og synkroniserer med select-feltet; valgt chip fremhæves med `chip-selected` styling
- **`_historyLoaded` flag** — Rettet bug hvor tom historik blev cachet som "allerede loaded"; henter korrekt igen ved næste tab-skift
- **Exponential backoff** — Polling stopper efter 4 fejl og venter 5→10→20→60s; genoptager automatisk via `visibilitychange`-event når siden bliver aktiv
- **Cached state ved fejl** — `_loadBookings()` / `_loadStatus()` beholder nu forrige data ved WS-fejl i stedet for at overskrive med tomt objekt
- **`data-bindex`** — Erstatter JSON-streng i `data-cancel` attribut på slet-knapper; sikrere og fri for escaping-problemer

---

## [2.0.0] - 2026-04-04

### Tilføjet — Panel-registrering (Energy Hub-metoden) 🔧
- **Parameteriseret panel** — Sidebar titel, ikon, og require_admin kan nu ændres via Options Flow
- **Panel til/fra toggle** — Panel kan deaktiveres helt fra Indstillinger → Integrationer → Konfigurer
- **Live reload** — Ændringer træder i kraft med det samme uden HA-genstart (`_async_update_listener`)
- **Proper unregister** — `async_unregister_panel()` rydder `_panel_registered` flag korrekt
- **Dependencies** — `manifest.json` deklarerer nu `http`, `frontend`, `panel_custom`
- **strings.json** — Ny fil tilføjet (Gold tier krav)
- **6 menupunkter** — Options Flow har nu Credentials, Calendar, Opening Hours, Machines, Time Slots, Panel

### Tilføjet — Frontend redesign (Indeklima Designer) 🎨
- **Design tokens** — Blå `#3b82f6` / cyan `#06b6d4` accent-farver fra `indeklima_designer_reference.md`
- **Typografi** — DM Sans + DM Mono (Google Fonts)
- **Layout** — `.panel-topbar` (fast) + `.panel-scroll` (flex) — samme pattern som Indeklima og Heat Manager
- **Header** — Gradient-ikon (blå→cyan) + h1 titel + meta-info
- **Tab-bar** — Pill-tabs med ikon + label (kun ikon på mobil)
- **Cards** — `border-radius: 18px`, `var(--bg2)` baggrund, subtle hover
- **Book-knap** — Gradient `--accent` → `--accent2`
- **Slot chips** — DM Mono font, accent-glow baggrund
- **Semantiske farver** — `--green` / `--orange` / `--red` fra Designer-specifikationen
- **Responsivt** — Tab-labels skjules på mobil, padding reduceres

### Ændret
- Alle .py-filer bumped til VERSION = "2.0.0"
- Options Flow udvides fra 5 til 6 menupunkter (+ Panel)
- Panel-indstillinger gemmes i `entry.options` (ikke `entry.data`)

---

## [1.9.1] - 2026-03-28

### Tilføjet — Slots tilgængelighed 🟢🔴
- **Live tilgængelighed** — Tidsblok-dropdown viser hvilke tider der er optaget/ledige for den valgte dato
- **Farvedede chips** — Under dropdown: grønne `✓` for ledige tider, røde `✕` for optagne
- **Disabled slots** — Optagne tider markeres som `"07:00-09:00 (2t) — Optaget"` og kan ikke vælges
- **Auto-opdatering** — Slots genindlæses automatisk når dato eller vaskehus skiftes
- **Auto-valg** — Første ledige slot vælges automatisk ved indlæsning
- **Backend** — `get_slots` WebSocket-kommando accepterer nu valgfrit `date` parameter og returnerer `booked: bool` per slot

### Tilføjet — Kalender-fixes 📅
- **Forkerte tider rettet** — Kalenderbegivenheder sendes nu som UTC til `calendar.create_event` — HA konverterer selv til lokal tid
- **Persistent duplikat-tracking** — `_created_events` gemmes nu i `storage.py` og overlever HA-genstart (ingen duplikater efter restart)
- **Sletning ved aflysning** — `cancel_booking()` kalder nu `calendar.delete_event` via ±1 time søgevindue
- **`_times_match()` helper** — UTC-baseret datetime-sammenligning for korrekt event-matching
- **`_get_store()` helper** — Tilføjet i coordinator til at hente store fra hass.data

### Tilføjet — Panel omskrevet til vanilla JS 🔧
- **Ingen LitElement** — Pure `HTMLElement` med shadow DOM — ingen CDN-afhængighed
- **Samme arkitektur som Heat Manager og Indeklima**
- **Rigtigt app-ikon** — Originalt guldfarvet vaskemaskine-ikon embedded som base64 PNG

### Tilføjet — UI Redesign 🎨
- **Nyt mørkt design** — `#0d0d0d` baggrund, thin borders, UPPERCASE section labels
- **Horizontal tab-navigation** — Oversigt / Notifikationer / Historik / Konfiguration
- **Vaskehus-toggle** — To knapper med SVG-ikoner
- **Kompakte booking-rækker** — Med farvet venstre accent-streg

### Rettet
- Booking card border konsistens (div.card-root i stedet for ha-card)
- Notifikationsfane viste altid "not ready" — `_get_store()` i websocket.py rettet
- `_get_store()` i websocket.py brugte forkert `.get("store")` — rettet til at iterere korrekt
- Panel tab-skift virkede ikke pålideligt (LitElement-problem — løst ved vanilla JS)

---

## [1.8.0] - 2026-02-28

### Tilføjet — Admin-fane ⚙️
- Driftsbesked der vises øverst i booking-oversigten
- Toggle til midlertidig booking-spærring med tilpasset besked
- Persistent lagring der overlever HA-genstart

### Tilføjet — Statistik-fane 📊
- Lister afsluttede bookinger de seneste 30 dage
- Viser vaskehus, dato, tid, varighed og brugernavn
- Oprydningsknap til gammel metadata

### Tilføjet — Rige notifikationer 🔔
- Deep links: tryk på notifikation åbner MieleLogic-panel direkte
- "Åbn Panel"-knap på alle notifikationer
- Tilpassede skabeloner med live preview
- Variabelsystem: `{vaskehus}`, `{time}`, `{date}`, `{duration}`, `{machine}`
- iOS: lyd, badge, subtitle / Android: kanal, vigtighed

### Rettet — Brugertracking
- Viser nu korrekt Home Assistant-brugernavn fremfor altid "Via Panel"

### Gold Tier
- `EntityDescription` dataklasser for alle sensorer og binary sensorer
- Genkonfigurationsflow (`async_step_reconfigure`) implementeret

---

## [1.7.0] - 2026-02-27

### Ændret
- Fjernet verbose debug-logs — renere logfiler til produktionsbrug

---

## [1.6.0] - 2026-02-27

### Rettet
- Brugertracking viser nu "Via Panel" korrekt under alle bookinger

---

## [1.5.0] - 2026-02-22

### Tilføjet — Integreret sidebarpanel 🚀
- Custom sidebarpanel uden pakke-filer
- WebSocket API med 13 kommandoer
- Auto-refresh hvert 30. sekund
- Responsivt design (mobil, tablet, desktop)

### Tilføjet — Notifikationer
- 4 standard-notifikationer: 15-min påmindelse, 5-min advarsel, booking oprettet/aflyst
- Enhedsvælger til valg af hvilke mobilapps modtager notifikationer
- Test-notifikationer direkte fra panel

---

## [1.4.6] - 2026-01-30

### Tilføjet — Vaskehus-abstraktion
- Kalender og UI viser "Klatvask"/"Storvask" fremfor "Maskine 1"/"Maskine 3"
- 5-punkts Options-menu

---

## [1.3.0] - 2026-01-21

### Tilføjet
- Kalenderintegration (`calendar.mielelogic_reservations`)
- Ekstern kalender-sync (CalDAV / Google Calendar)

---

## [1.1.0] - 2026-01-20

### Tilføjet — Silver Tier fundament
- DeviceInfo og enhedsorganisering
- `has_entity_name = True` på alle platforme
- Options Flow til konfiguration

---

## [1.0.5] - 2026-01-13

### Første release
- Grundlæggende autentificering og datahentning
- OAuth2 password grant flow

---

**Vedligeholder:** KingPainter  
**Repository:** https://github.com/kingpainter/mielelogic
