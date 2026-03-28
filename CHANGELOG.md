# Changelog

Alle bemærkelsesværdige ændringer dokumenteres her.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
Versionering: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [1.9.1] - 2026-03-28

### Ændret — UI Redesign 🎨
- **Nyt visuelt design** — Panel og Lovelace-kort redesignet til at matche Heat Manager / Indeklima design-sproget
- **Mørkt tema** — Sort baggrund (`#0d0d0d` / `#111`), thin borders (`#1e1e1e`), hvid tekst — konsistent med andre HA-integrationer i projektet
- **Uppercase sektionslabels** — Alle sektioner har `UPPERCASE LETTER-SPACING` labels i grå, præcis som Heat Manager
- **Horisontale tabs** — Panel bruger nu horisontale tabs øverst (Oversigt / Notifikationer / Historik / Konfiguration) fremfor sidebar-navigation
- **Ikon-header** — Topbar med app-ikon, navn, meta-info og "Opdater"-knap til højre — samme mønster som Heat Manager og Indeklima
- **Vaskehus-toggle** — To knapper fremfor dropdown til valg af Klatvask/Storvask
- **Booking-rækker** — Kompakte rækker med farvet venstre accent-streg fremfor store kort
- **Lovelace-kort** — Matcher panel-designet: ikon-header, `UPPERCASE SECTION LABELS`, maskinstatus med farvede ring-ikoner, diskrete ✕ delete-knapper

### Rettet — Booking Card
- Erstattet `ha-card` custom element med `div.card-root` for konsistent border-rendering
- Hover-effekt bruger `inset box-shadow` — kan ikke længere bløde ud over kortets kant
- Booking-liste pakket i `bookings-block` container for visuel konsistens

### Rettet — Panel Reaktivitet
- `currentTab`, `editingNotificationId`, `editTitle`, `editMessage` tilføjet til LitElement `static get properties()` — tabs og redigeringsmodal re-renderer nu korrekt
- Lit-import ændret fra `lit-element@2.4.0` til `lit@2` — eliminerer "Multiple versions of Lit"-konsol-advarsel
- Notifications-objekt bruger spread-operator for LitElement-reaktivitet

### Rettet — Notifikationsfane
- `_get_store()` i `websocket.py` itererer nu korrekt over config-entry dict — notifikationsfanen returnerede altid "not ready" tidligere

### Tilføjet — Maskinestatus
- Live maskinstatusblok i booking-kortet viser alle vaskemaskiner og tørretumblere som farvede ring-ikoner
- Farver: grøn = Ledig · orange = I gang · blå = Reserveret · mørk = Lukket
- Tooltip med fuldt maskinnavn og status-tekst fra Miele API

### Teknisk
- `panel.js` — Komplet omskrivning af styles. Alle eksisterende funktioner og WebSocket-kald bevaret
- `mielelogic-booking-card.js` — Komplet omskrivning af CSS og HTML-struktur. Alle funktioner bevaret
- `websocket.py` v1.9.1 — `_get_store()` rettet

---

## [2.0.0] - 2026-02-28

### Tilføjet — Admin-fane ⚙️
- **Admin-tab** — Ny fjerde fane i panel til admin-kontrol
- **Driftsbesked** — Tekstfelt til operatørbesked der vises øverst i booking-kortet
- **Booking spærring** — Toggle til at spærre for nye bookinger med tilpasset besked
- **Persistent admin-lagring** — Admin-indstillinger overlever HA-genstart

### Tilføjet — Statistik-fane 📊
- **Statistik-tab** — Ny femte fane med bookinghistorik
- **30-dages historik** — Lister alle afsluttede bookinger
- **Per-booking detalje** — Vaskehus, dato, tid, varighed og brugernavn
- **Oprydningsknap** — Fjern metadata ældre end 30 dage

### Rettet — Brugertracking 👤
- **Rigtig HA-brugernavn** — Viser nu korrekt Home Assistant-brugernavn fremfor altid "Via Panel"
- `connection.context` i HA WebSocket er et kald, ikke et objekt — rettet

### Gold Tier
- `EntityDescription` dataklasser for alle sensorer og binary sensorer
- `has_entity_description = True` på alle platforme
- Genkonfigurationsflow (`async_step_reconfigure`) implementeret
- Persistent operator-beskeder og booking-låse via `storage.py`

---

## [1.9.0] - 2026-02-28 *(inkluderet i 2.0.0)*

### Tilføjet — Rige notifikationer 🔔
- **Deep links** — Tryk på notifikation åbner MieleLogic-panel direkte
- **Action-knapper** — "Åbn Panel"-knap på alle notifikationer
- **Tilpassede skabeloner** — Rediger titel og besked per notifikationstype
- **Variabelsystem** — `{vaskehus}`, `{time}`, `{date}`, `{duration}`, `{machine}`
- **Live preview** — Se hvordan notifikationen ser ud med eksempeldata
- **Nulstil til standard** — Ét klik gendanner standard-skabelon
- **Platform-support** — iOS: lyd, badge, subtitle / Android: kanal, vigtighed, tags

---

## [1.7.0] - 2026-02-27

### Ændret — Kodekvalitet 🧹
- Fjernet verbose debug-logs fra v1.6.0 fejlsøgningssession
- Essentielle informationer på INFO-niveau, detaljer på DEBUG-niveau
- Renere logfiler til produktionsbrug

---

## [1.6.0] - 2026-02-27

### Rettet — Brugertracking visning 🎯
- Nøgleformat-mismatch rettet: gem brugte mellemrum, hent brugte T-separator
- Brugertracking viser nu "Via Panel" korrekt under alle bookinger
- Pålidelig metadata-opslag på tværs af forskellige datetime-formater

---

## [1.5.2] - 2026-02-23

### Tilføjet — Brugertracking 👤
- Sporer hvilken Home Assistant-bruger der oprettede en booking
- Viser "👤 Brugernavn" under bookinger i panel
- Automatisk oprydning af gammel metadata efter 7 dage

### Tilføjet — Automatiske notifikationer 📨
- Automatisk notifikation ved booking oprettet
- Automatisk notifikation ved booking aflyst

### Ændret — Kalender
- Kun ét kalender aktivt ad gangen (intern eller ekstern, ikke begge)
- Forhindrer duplikerede kalenderbegivenheder

---

## [1.5.1] - 2026-02-22

### Tilføjet — Notifikationsfane
- Notifikationsfane i panel med komplet UI
- Enhedsvælger til valg af hvilke mobilapps modtager notifikationer
- 4 standard-notifikationer: 15-min påmindelse, 5-min advarsel, booking oprettet, booking aflyst
- Test-notifikationer
- Toggle-system til aktivering/deaktivering

---

## [1.5.0] - 2026-02-22

### Tilføjet — Integreret panel 🚀
- Custom sidebarpanel uden pakke-filer
- WebSocket API med 13 kommandoer
- Auto-refresh hvert 30. sekund med fejlhåndtering
- Responsivt design (mobil, tablet, desktop)

### Rettet
- Panel-duplikerings-registrering
- Kalender-services graceful fallback for HA < 2026.1
- WebSocket-fejl ved forbindelukning

---

## [1.4.6] - 2026-01-30

### Tilføjet — Vaskehus-abstraktion
- Maskinkonfiguration (vælg primær maskine per vaskehus)
- Tidsslotkonfiguration via Options Flow
- Kalender viser "Klatvask booket" fremfor "Maskine 1 booket"
- 5-punkts Options-menu

---

## [1.4.5] - 2026-01-30

### Tilføjet — Services
- `mielelogic.make_reservation` service
- `mielelogic.cancel_reservation` service
- Service response-support

---

## [1.3.2] - 2026-01-24

### Tilføjet
- Åbningstider-konfiguration
- Forbedret sensor-visning ("Lukket indtil kl. 07:00")

---

## [1.3.1] - 2026-01-24

### Tilføjet
- Ekstern kalender-sync (CalDAV / Google Calendar)
- Menu-baseret Options Flow

---

## [1.3.0] - 2026-01-21

### Tilføjet
- Kalenderintegration (`calendar.mielelogic_reservations`)
- 4 automatiserings-blueprints
- Tidszone-fix for binary sensorer

---

## [1.2.0] - 2026-01-20

### Tilføjet
- 6 binary sensorer til automatisering
- Response-caching (60s TTL, 90% API-reduktion)

---

## [1.1.0] - 2026-01-20

### Tilføjet — Silver Tier fundament
- DeviceInfo og enhedsorganisering
- Moderne enhedsnavngivning (`has_entity_name = True`)
- Options Flow til konfiguration
- Smart token-refresh

---

## [1.0.5] - 2026-01-13

### Første release
- Grundlæggende autentificering og datahentning
- Flad sensor-struktur
- OAuth2 password grant flow

---

**Vedligeholder:** KingPainter  
**Repository:** https://github.com/kingpainter/mielelogic  
**Licens:** MIT
