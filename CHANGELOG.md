# Changelog

Alle bemærkelsesværdige ændringer dokumenteres her.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [2.6.5] — Quality scale: Bronze fixes, websession, tests grønne

### Ændret
- Services registreres i `async_setup` (action-setup). Handlers henter koordinator ved kald.
- Maskinnummer-validering accepterer 1–7 (nye maskiner).
- Alle HTTP-kald bruger HA's delte session via `async_get_clientsession` (inject-websession).
- CalDAV-sletning bruger nu en async-klient (`caldav_async.py`) i stedet for den synkrone `caldav`-pakke. `caldav` er fjernet fra `manifest.json` (async-dependency). `caldav_client.py` er ikke længere i brug og kan slettes.
- `hassfest`: URL fjernet fra caldav-beskrivelse; `CONFIG_SCHEMA` tilføjet.
- Koordinator sender `config_entry` videre til `DataUpdateCoordinator` (fast ved `self.config_entry = None`).
- `AbortFlow` propagerer i config flow (dublet-laundry giver nu afvisning, ikke "unknown"-fejl).
- `async_unload_entry` tåler manglende `hass.data[DOMAIN]`.

### Tilføjet
- `async_remove_config_entry_device`: stale enheder kan slettes i UI.
- `tests/test_config_flow.py` (succes, invalid_auth, cannot_connect, dublet).
- Maskine-inventar-sensor, der noterer ændringer i maskinsættet.

### Tests
- CI: 84 tests grønne, hassfest grøn.

---

## [Unreleased] — Gold Tier unit tests

### Tilføjet — Test-suite for coordinator, booking_manager, websocket
- Ny `tests/`-mappe: `conftest.py` (delte fixtures + `MockConfigEntry`/`MockCoordinator`), `test_coordinator.py`, `test_booking_manager.py`, `test_websocket.py`
- `pytest.ini` og `requirements.txt` (pinned `pytest-homeassistant-custom-component==0.13.316`, kræver Python 3.13+)
- Ny CI-workflow `.github/workflows/pytest.yml` — kører test-suiten på hvert push/PR mod `main`/`dev`
- Dækker: token-refresh/retry-logik, caching, datetime-parsing og `_get_store` fallback i coordinator; booking/cancel happy-path + fejlhåndtering, primær/sekundær kalender-sync og -sletning i booking_manager; `_get_from_runtime` fallback-kæde, timetable-parsing og fejlkoder (`not_ready`/`invalid_input`/`service_error`/`storage_error`/`not_found`) i websocket

---

## [2.6.4] - 2026-11-24

### Tilføjet — Maskine inventar-sensor
- Ny sensor `sensor.mielelogic_maskine_inventar`. State er antal maskiner. Attributterne `machine_numbers`, `by_laundry` (fx `Klatvask: [1, 2]`) og `changed_at` viser det aktuelle billede.
- Sensoren gemmer den sidst kendte maskineliste og sender en persistent notifikation i HA, når maskinnumre tilføjes eller forsvinder. Listen overlever HA-genstart via `RestoreEntity`.
- Tomme svar fra API'et ignoreres, så en mislykket hentning ikke udløser falsk alarm.

---

## [2.6.3] - 2026-11-24

### Ændret — Restid for det booked vaskeri i booking-kortet
- `websocket.py` (`ws_get_machines`): grupperer maskiner på `UnitName` (Klatvask / Stor vask) i stedet for hardkodede numre. Klatvask = 1, 2; Stor vask = 3, 4, 5.
- Restid parses fra `Text1` ("Resttid: N min.") og sendes som `remaining_minutes`. Tidspunkt for reserverede maskiner læses fra `Text2` (fx "kl. 17:00").
- Aktiv booking findes ud fra `coordinator.data["reservations"]` (`Start <= nu < End`). Svaret får nyt `booking`-felt med `unit_name`, `start`, `end`, og hver maskine får `in_booked_laundry` og `booked_by_us`.
- `mielelogic-booking-card.js`: viser kun maskinerne i det vaskeri, der er booket i det aktive slot, med restid (fx "33 min"). Uden aktiv booking vises ingen maskinsektion.

### Rettet
- `websocket.py` og `sensor.py` læste `ReservationInfo`, som ikke findes i `laundrystates`-svaret. Tidspunktet ligger i `Text2`.
- Versionsnumre var ikke konsistente. Alle `.py`-headere i integrationen, `tests/`, `panel.js`, `const.py`, `manifest.json` og README-badge'en er nu 2.6.3. `mielelogic-booking-card.js` stod på 2.7.1 og er også 2.6.3. `frontend/entrypoint.js` har sin egen version (2.1.0) og er uændret.

---

## [2.6.2] - 2026-08-22

### Rettet — Backend/UI-gennemgang: kvote-bug, fejlbeskeder, oprydning, toast-UX
- **services.py**: `_check_max_reservations` blokerede al booking hvis MieleLogic-API'et momentant returnerede `MaxUserReservations: 0` (set under test 2026-08-22, formentlig en race/kvirk i deres backend). Behandles nu som en ugyldig værdi — logges som advarsel, blokerer ikke længere bookingen.
- **services.py**: alle bruger-synlige valideringsfejl (maskinnummer, åbningstider, varighed, kvote, "booking ikke fundet") oversat fra engelsk til kort, dansk tekst — de gik før uoversat og delvist flerlinjet/teknisk direkte igennem til panelets toast-beskeder
- **coordinator.py**: automatisk oprydning af gammel booking-metadata (én gang i døgnet, via eksisterende `store.async_cleanup_old_bookings(days=7)`) — tidligere skete oprydning kun manuelt via admin-fanens "Ryd historik"-knap
- **panel.js** (v2.6.2): toast-beskeder skalerer nu varighed med længde (3,5–12 sek. i stedet for altid fast 3,5 sek.), understøtter flerlinjede beskeder (`white-space: pre-line` i stedet for `nowrap`) og kan lukkes med et tryk (`pointer-events: auto`) — relevant nu hvor længere fejlbeskeder (fx kvote-fejlen med bookingliste) rent faktisk kan læses

### Kendte resterende punkter (ikke lavet i denne omgang)
- `services.py` mangler stadig egen pytest-dækning (coordinator/booking_manager/websocket har det, services.py ikke)
- v1.4.7-planen (emoji-fix, calendar sync wrapper, overlap detection, retry-logik) står stadig åben

---

## [2.6.1] - 2026-08-22

### Tilføjet — Debug-logging af reservations-API-svar
- Under test af CalDAV-fixet stødte vi på en separat, endnu uforklaret fejl: `Booking failed: Maximum reservations reached (0/0)` — API'et returnerede tilsyneladende `MaxUserReservations: 0` under hurtige book/annullér-testcyklusser, hvilket blokerer al booking indtil næste opdatering.
- `coordinator.py`: tilføjet debug-log af antal aktive reservationer og `MaxUserReservations` hver gang `/reservations`-endepunktet hentes, så vi kan se det rå API-svar næste gang det sker og finde den reelle årsag (MieleLogic-API-kvirk vs. cache-timing).
- Ingen adfærdsændring endnu — kun observabilitet. Selve blokerings-logikken i `services.py` rørt ikke i denne omgang.

---

## [2.6.0] - 2026-08-22

### Rettet — Kalenderevents slettes nu korrekt ved annullering (CalDAV)
- Root cause fundet: Home Assistants indbyggede CalDAV-integration understøtter `calendar.create_event`/`get_events`, men **ikke** `calendar.delete_event` (åbent HA core-issue #159784). Da både primær (`calendar.kun_flemming`) og sekundær (`calendar.lukas`) kalender er CalDAV-baserede (iCloud), fejlede al kalender-sletning hidtil stille i baggrunden når en booking blev annulleret — selve bookingen blev annulleret korrekt, men eventet blev stående i kalenderen.
- Ny `caldav_client.py`: minimal direkte CalDAV-klient (via `caldav`-pakken) der finder og sletter det matchende event direkte på CalDAV-serveren, uden om HA's kalender-entity. Oprettelse af events bruger stadig `calendar.create_event` som før — kun sletning er ændret.
- `booking_manager.py`: `_delete_calendar_event()` og `_delete_secondary_calendar_events()` forsøger nu direkte CalDAV-sletning først (hvis konfigureret), og falder tilbage til den gamle `calendar.delete_event`-service-vej for ikke-CalDAV-kalendere (f.eks. Local Calendar, Google Calendar)
- Nyt options-flow-trin under “Konfigurer Kalender Synkronisering”: valgfrie felter til CalDAV server-URL, brugernavn og app-specifik adgangskode — kun nødvendige hvis primær/sekundær kalender er CalDAV-baseret
- Ny afhængighed: `caldav>=1.0.1` i `manifest.json`
- Bonus-fix: rettede en eksisterende mismatch i `strings.json`/`da.json` hvor kalender-trinnets beskrivelse refererede ikke-eksisterende placeholders (`{primary}`/`{secondaries}`/`{hint}`) og feltnavnet `secondary_calendars` i stedet for det faktisk brugte `secondary_calendars_text`

---

## [2.5.8] - 2026-08-21

### Tilføjet — Lokale brand-ikoner (HA 2026.3+)
- Ny `custom_components/mielelogic/brand/`-mappe med `icon.png` (256x256) og `icon@2x.png` (512x512), genereret fra det eksisterende `mielelogic_logo.png` (center-croppet til kvadrat, PNG-optimeret)
- Siden HA 2026.3 kan custom integrations levere deres eget brand-ikon direkte i integrationsmappen — `home-assistant/brands`-repoet tager ikke længere imod PRs for custom integrations. Ingen ekstern indsendelse nødvendig længere.
- `hacs.json` — minimum HA-version bumpet fra `2026.1.0` til `2026.3.0` (krævet for at lokale brand-ikoner vises)
- HACS-validering ignorerer stadig `brands`-checket i CI (`ignore: brands` i `.github/workflows/validate.yml`), da det tjekker det gamle eksterne repo som ikke længere er den relevante mekanisme

---

## [2.5.7] - 2026-08-21

### Rettet — Notifikations-tab reload efter gem
- `panel.js` (v2.5.0 → v2.5.7) — `_doSaveEdit()` (skabelon-editor for titel/besked) opdaterede kun lokal state efter gem og reloadede aldrig fra serveren, i modsætning til `_doSaveNotification()`/`_doToggleNotification()` som allerede gjorde det korrekt
- Tilføjet `await this._loadNotifications()` efter vellykket `save_notification`-kald i `_doSaveEdit()`, så panelet altid viser server-bekræftet state efter en skabelon-redigering

---

## [2.5.6] - 2026-07-20

### Rettet — Panel-view skalering på booking-kortet
- `mielelogic-booking-card.js` (v2.7.0 → v2.7.1) fyldte kun sin naturlige indholdshøjde, uanset forældre-container — brugbart i normal grid-view, men forkert skaleret i et HA `type: panel`-view (fx en 7" tablet i landscape)
- `:host` sætter nu `height: 100%`, og `#root` / `.card-root` er omdannet til en flex-kolonne med `height: 100%; min-height: 0;` så kortet arver panelets fulde højde
- `.card-header` er `flex-shrink: 0` (fast), og alt indhold derunder (fejl/info-bars, maskiner, ny booking, aktive bookinger) er flyttet ind i et nyt `.card-scroll`-lag med `flex: 1; min-height: 0; overflow-y: auto` — indholdet scroller internt i stedet for at overflowe eller blive presset sammen
- Samme mønster som allerede bruges i `secure_me_alarm_tab_card.js`
- `getCardSize()` uændret; ingen `max-width`/`margin: auto` at fjerne

---

## [2.5.5] - 2026-06-13

### Ændret — Ensartet WebSocket fejlklassificering
- Alle 18 WS-handlere returnerer nu specifikke fejlkoder i stedet for generisk `"unknown_error"`:
  - `service_error` — API/coordinator/slot-fejl
  - `storage_error` — store read/write-fejl
  - `invalid_input` — ugyldigt slot i `make_booking` (tidligere `invalid_slot`)
- Giver mulighed for mere præcise fejlbeskeder i panelet

### Tilføjet — Notifikations spam-filter
- Ny fil `notification_spam_filter.py` med `NotificationSpamFilter`-klasse
- Forhindrer at samme notifikation (type + maskine + tid) sendes mere end én gang per 60 sekunder
- Forebygger dobbelt-notifikationer ved hurtige kalender-sync triggers
- Automatisk cleanup af gamle entries efter 1 time

### Ændret — Parallel load ved integration-setup
- `store.async_load()` og `coordinator.async_config_entry_first_refresh()` køres nu parallelt via `asyncio.gather()` ved opstart af nye config entries
- Reducerer opstartstid marginalt

---

## [2.5.4] - 2026-05-31

### Tilføjet — House Voice tale-påmindelse
- **`voice_reminder`** — ny notifikationstype der kalder `house_voice.say` med `event_id: "Vaske tid"` 15 min før booking starter
- Til/fra-toggle i notifikationspanelet som alle andre notifikationer
- Test-knap kalder `house_voice.say` direkte med det konfigurerede event-id
- `schedule_voice_reminder()` i `notification_manager.py` bruger `async_call_later` med in-memory cancel-handle
- `cancel_voice_reminder()` køres automatisk når en booking aflyses
- Graceful fallback: gør ingenting hvis `house_voice.say` ikke er tilgængelig
- Reminder skippes automatisk hvis tidspunktet er i fortiden (f.eks. booking om 5 min)

---

## [2.5.3] - 2026-05-31

### Tilføjet — Re-authentication flow
- **`async_step_reauth`** — HA viser nu et "Integration kræver gentilslutning"-banner når credentials er udløbet eller ugyldige
- **`coordinator._refresh_token`** — kalder nu `entry.async_start_reauth()` når både refresh grant og password grant fejler, i stedet for blot at logge en fejl
- **`strings.json` + `translations/da.json`** — `reauth_confirm`-trin og `reauth_successful`-abort tilføjet til begge filer
- Gold tier `reauthentication_flow`-krav er nu fuldt implementeret

---

## [2.5.2] - 2026-05-31

### Rettet — CI-fejl
- **`manifest.json`** — fjernet ugyldige felter `icon` og `frontend` som hassfest ikke accepterer
- **`hacs.json`** — fjernet ugyldige felter `domains` og `iot_class`; bumped `homeassistant` til `2026.1.0`
- **CI workflow** — HACS brands-check skippes (`ignore: brands`) da brand-submission er et fremtidigt mål; flake8 ignorerer nu whitespace/style-advarsler (W291/W293/E221/E303/F841/F541) og fejler kun på reelle kodefejl

---

## [2.5.1] - 2026-05-31

### Rettet
- **`_renderWeekStrip` manglede** — metoden blev kaldt i `_update()` men eksisterede ikke i klassen, hvilket fik booking-kortet til at crashe med `TypeError: this._renderWeekStrip is not a function` på alle mobile og desktop enheder
- Feltnavne justeret til at matche `get_week_availability` WS-response (`has_free`, `label`, `day_num` fremfor `free`, `weekday`, `day`)
- **CI/CD workflow** — `.github/workflows/validate.yml` tilføjet med 6 jobs: hassfest, HACS-validering, Python lint (flake8), JS syntakstjek, translations-paritet og versions-konsistens

---

## [2.5.0] - 2026-05-30

### Tilføjet — Multi-kalender + runtime_data migration
- **Primær kalender** — auto-sync som før (koordinator) + per-booking via panel. Konfigureres i Options Flow under Kalender
- **Sekundære kalendere** — valgfrie chips i booking-formularen (“TILFØJ TIL KALENDER”). Ikke-default, brugeren aktiverer aktivt. Cyan chips, toggle ved klik
- **Sletning ved cancel** — sekundære kalenderevents slettes automatisk ved cancel; hvilke kalendere der var valgt gemmes persistent i storage
- **`runtime_data`-migration** — `hass.data[DOMAIN][entry_id]` erstattet af `entry.runtime_data` i `__init__.py`. Alle managers tilgængelige via `_get_from_runtime()` helper i websocket.py med `hass.data`-fallback
- **`get_calendars` WS-kommando** — 18 kommandoer i alt. Returnerer primær + sekundære med venlige navne fra HA state
- **`make_booking` WS** — modtager nu `extra_calendars: list` parameter
- **`storage.py`** — ny `secondary_calendar_synced` datastruktur, `async_save_booking_metadata` udvidet med `secondary_calendars`, duplikatsektion ryddet op
- **Options Flow kalender-trin** — primær dropdown + sekundær komma-separeret tekstfelt

---

## [2.4.0] - 2026-05-30

### Tilføjet — Backend/stabilitet & UX
- **Cancel fra push-notifikation** — `booking_created`-notifikation får nu en “Aflys booking” action-knap (destructive, iOS + Android). Event listener på `mobile_app_notification_action` i `__init__.py` parser action-ID og kalder `cancel_booking()` direkte
- **Countdown-chip på aktive bookinger** — Grøn chip med MM:SS når booking er aktiv nu, blå chip med “om Xm” når fremtidig, grå “Færdig” når udløbet. Ticker på 1s interval opdaterer kun `[data-countdown]` elementer — ingen fuld re-render
- **Robust kalender-sletning** — `_delete_calendar_event` matcher nu på summary + præcis starttid først, derefter summary-only fallback. `delete_event`-tjek rykket før event-access
- **Rige notifikationer** — Alle notifikationer får nu `data.url = "/mielelogic"` (tap åbner panel) og `data.push.sound = "default"`. Åbn Panel-knap på alle typer
- **Versioner:** `__init__.py`, `booking_manager.py`, `notification_manager.py` — alle bumped til 2.3.0. `panel.js` → v2.4.0

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
