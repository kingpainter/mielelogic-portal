# Changelog

Alle bemærkelsesværdige ændringer dokumenteres her.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [1.9.1] - 2026-03-28

### Ændret — Panel omskrevet til vanilla JS 🔧
- **Ingen LitElement** — Panelet er nu skrevet i vanilla `HTMLElement` med shadow DOM
- **Ingen CDN-afhængighed** — Ingen import fra `unpkg.com` — panelet loader øjeblikkeligt
- **Samme arkitektur som Heat Manager og Indeklima** — konsistent kodebase på tværs af projekter
- **Rigtigt app-ikon** — Det originale guldflotte vaskemaskine-ikon er embedded direkte i panelet

### Ændret — UI Redesign 🎨
- **Nyt visuelt design** — Mørkt tema (`#0d0d0d`), thin borders, uppercase section labels
- **Horisontale tabs** — Oversigt / Notifikationer / Historik / Konfiguration
- **Ikon-header** — App-ikon øverst til venstre, "Opdater"-knap til højre
- **Vaskehus-toggle** — To knapper med SVG-ikoner fremfor dropdown
- **Booking-rækker** — Kompakte rækker med farvet venstre accent-streg

### Rettet — Booking Card
- Erstattet `ha-card` med `div.card-root` for konsistent border-rendering
- Hover-effekt bruger `inset box-shadow` — bløder ikke ud over kortets kant

### Rettet — Panel Reaktivitet (tidligere LitElement-version)
- Tab-skift, notifikationsmodal og admin-toggle virkede ikke pålideligt
- Løst ved at skifte til vanilla JS med eksplicit DOM-opdatering

### Rettet — Notifikationsfane
- `_get_store()` i `websocket.py` itererer nu korrekt over config-entry dict

### Tilføjet — Maskinestatus
- Live maskinstatusblok i booking-kortet: grøn=Ledig, orange=I gang, blå=Reserveret

---

## [2.0.0] - 2026-02-28

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
