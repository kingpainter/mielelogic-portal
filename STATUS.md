# MieleLogic — Projektstatus og Roadmap

**Sidst opdateret:** 28. marts 2026  
**Aktuel version:** 1.9.1  
**HA-krav:** Home Assistant Core 2026.1.0+

---

## Hvad er i dag

MieleLogic er en fuldt funktionel Home Assistant-integration til MieleLogic vaskehus-systemer i aktiv produktion.

### Hvad virker

| Område | Status | Siden |
|---|---|---|
| OAuth2-autentificering | ✅ Stabil | v1.0.5 |
| Sensorer og binary sensorer | ✅ Stabil | v1.1.0 |
| Kalenderintegration | ✅ Stabil | v1.3.0 |
| Vaskehus-abstraktion (Klatvask/Storvask) | ✅ Stabil | v1.4.6 |
| Integreret sidebarpanel | ✅ Stabil | v1.5.0 |
| Lovelace booking-kort | ✅ Stabil | v1.5.0 |
| Notifikationssystem (4 typer) | ✅ Stabil | v1.5.1 |
| Brugertracking (HA-brugernavn) | ✅ Stabil | v1.6.0 |
| Live maskinestatus i kort | ✅ Stabil | v1.9.1 |
| Rige notifikationer med deep links | ✅ Stabil | v2.0.0 |
| Tilpassede notifikationsskabeloner | ✅ Stabil | v2.0.0 |
| Admin-tab (driftsbesked + spærring) | ✅ Stabil | v2.0.0 |
| Statistik-tab (30-dages historik) | ✅ Stabil | v2.0.0 |
| Gold tier EntityDescription | ✅ Stabil | v2.0.0 |
| Genkonfigurationsflow | ✅ Stabil | v2.0.0 |
| Mørkt UI-design (Heat Manager-stil) | ✅ Stabil | v1.9.1 |
| Vanilla JS panel (ingen LitElement/CDN) | ✅ Stabil | v1.9.1 |

### Kendte begrænsninger

| Begrænsning | Planlagt fix |
|---|---|
| Kun én vaskehus-installation | v3.0.0 |
| Kalenderbegivenheder slettes ikke ved aflysning | v2.1.0 |

---

## Næste skridt — v2.1.0

**Tema:** Gold Tier komplettering og kalender-cleanup

- **Kalender-cleanup** — `calendar.delete_event` ved booking-aflysning i `booking_manager.py`
- **Gold Tier tests** — `config_flow_test` og integration test coverage
- **Brands-indsendelse** — ikon-design og PR til `home-assistant/brands`

---

## Fremtid — v3.0.0

- Multi-vaskehus support
- Aflys booking direkte fra notifikation
- Grafisk statistik (bookingmønstre, uge/måned)

---

## Panel-arkitektur (v1.9.1+)

Panelet er skrevet i **vanilla `HTMLElement`** med shadow DOM — præcis samme mønster som Heat Manager og Indeklima:

```javascript
class MieleLogicPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  set hass(h) { ... }
  connectedCallback() { ... }
  _render() { ... }
}
```

**Fordele vs. LitElement:**
- Ingen CDN-afhængighed (`unpkg.com`)
- Ingen "Multiple versions of Lit"-advarsel i konsol
- Hurtigere initial load
- Samme kodebase som projektets andre paneler

---

## Versionsoversigt

```
v1.0.5  Jan 2026  Første release
v1.1.0  Jan 2026  Silver Tier — DeviceInfo, Options Flow
v1.3.0  Jan 2026  Kalenderintegration
v1.4.6  Jan 2026  Vaskehus-abstraktion (Klatvask/Storvask)
v1.5.0  Feb 2026  Integreret sidebarpanel, WebSocket API
v1.5.2  Feb 2026  Brugertracking, automatiske notifikationer
v1.6.0  Feb 2026  Brugertracking-fix
v1.7.0  Feb 2026  Produktionslog-rensning
v2.0.0  Feb 2026  Rige notifikationer, admin-tab, statistik, Gold Tier
v1.9.1  Mar 2026  Vanilla JS panel, redesign, rigtigt app-ikon  ◀ NU
─────────────────────────────────────────────────────────────
v2.1.0  Kommende  Kalender-cleanup, Gold Tier tests, brands
v3.0.0  Fremtid   Multi-vaskehus, avancerede funktioner
```

---

## Filer der opdateres ved næste release

| Fil | Hvad |
|---|---|
| `const.py` | `VERSION = "x.x.x"` |
| `manifest.json` | `"version": "x.x.x"` |
| `__init__.py` | Kommentar øverst |
| `CHANGELOG.md` | Ny sektion |
| `README.md` | Badge + seneste version |
| `STATUS.md` | Denne fil |

---

## Udviklingsregler

- **Ingen breaking changes i minor versions**
- **Vaskehus-abstraktionen er kernen** — brugerne tænker i "Klatvask"/"Storvask", ikke maskinnumre
- **Vanilla JS til frontend** — ingen CDN-dependencies, samme mønster som Heat Manager/Indeklima
- **Produktionskode fra dag ét** — INFO for vigtige hændelser, DEBUG for detaljer
- **HA-standarder følges** — EntityDescription, has_entity_name, async-patterns, koordinator

---

*Opdater dette dokument ved hver release.*
