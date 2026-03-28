# MieleLogic — Projektstatus og Roadmap

**Sidst opdateret:** 28. marts 2026  
**Aktuel version:** 1.9.1  
**HA-krav:** Home Assistant Core 2026.1.0+

---

## Hvad er i dag

MieleLogic er en fuldt funktionel Home Assistant-integration til MieleLogic vaskehus-systemer. Integrationen er i aktiv produktion og bruges dagligt.

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
| Automatiske notifikationer ved booking/aflys | ✅ Stabil | v1.5.2 |
| Brugertracking (HA-brugernavn) | ✅ Stabil | v1.6.0 |
| Live maskinestatus i kort | ✅ Stabil | v1.9.1 |
| Rige notifikationer med deep links | ✅ Stabil | v2.0.0 |
| Tilpassede notifikationsskabeloner | ✅ Stabil | v2.0.0 |
| Admin-tab (driftsbesked + spærring) | ✅ Stabil | v2.0.0 |
| Statistik-tab (30-dages historik) | ✅ Stabil | v2.0.0 |
| Gold tier EntityDescription | ✅ Stabil | v2.0.0 |
| Genkonfigurationsflow | ✅ Stabil | v2.0.0 |
| Nyt mørkt UI-design (Heat Manager-stil) | ✅ Klar | v1.9.1 |

### Kendte begrænsninger (designede)

| Begrænsning | Årsag | Planlagt fix |
|---|---|---|
| Kun én vaskehus-installation | Arkitektur | v3.0.0 |
| Kalenderbegivenheder slettes ikke ved aflysning | Ikke implementeret | v2.1.0 |
| Panel kræver internetadgang (LitElement CDN) | CDN-dependency | Ingen plan |
| "Via Panel" vises for websocket-bookinger | HA-begrænsning | Accepteret |

---

## Nærste skridt — v2.1.0

**Tema:** Gold Tier komplettering og kalender-cleanup  
**Estimeret arbejde:** 4–6 timer

### Opgaver

**Kalender-cleanup ved aflysning**
Når en booking aflyses, bør den tilhørende kalenderbegivenhed slettes. I dag forbliver den i kalenderen.
- Implementer `calendar.delete_event` kald i `booking_manager.py`
- Håndter tilfælde hvor begivenheden ikke eksisterer
- Test med HA 2026.1+ kalender-services

**Gold Tier: Automatiske tests**
For at opfylde HA Gold Tier kravene fuldt ud mangler:
- `config_flow_test` — unittest til konfigurationsflow
- `integration_test_coverage` — dækning af koordinator og WebSocket-kommandoer

**Brands-indsendelse (forberedelse)**
- Design integration-ikon (SVG, 256×256, transparent baggrund)
- Opret PR til `home-assistant/brands` repository
- Kræver godkendt ikon-design

### Prioritering

```
1. Kalender-cleanup       (brugerfacing, mærkbar forbedring)
2. Automatiske tests      (nødvendig for Gold Tier)
3. Brands-indsendelse     (nødvendig for officiel HACS-listing)
```

---

## Fremtid — v3.0.0

**Tema:** Multi-vaskehus og avancerede funktioner  
**Estimeret arbejde:** 20–30 timer  
**ETA:** 2–4 måneder

### Planlagte funktioner

**Multi-vaskehus support**
Den nuværende arkitektur understøtter kun én MieleLogic-konto/installation. Mange ejendomme kan have flere separate vaskehuse med egne maskiner og tidslots.
- Refaktorer `config_flow.py` til at understøtte flere instanser
- Tilpas WebSocket-kommandoer til at have en `entry_id`-parameter
- Opdater panel til at navigere mellem instanser

**Aflys booking direkte fra notifikation**
I dag kan man kun se en notifikation og eventuelt åbne panelet. Det ville være bedre om man direkte fra notifikationen kan aflyse bookingen.
- Implementer `ACTION_CANCEL` i notification action-handler
- Kræver HA Companion app 2026+ for action callbacks

**Kalender-tovejssynkronisering**
I dag synkroniserer integrationen fra MieleLogic til HA-kalender. Med tovejssynk kunne man oprette bookinger fra HA-kalender.
- Kompleks arkitektur — kræver polling af kalenderændringer
- Potentielt konflikt med eksisterende bookinger

**Forbedret statistik**
- Grafisk oversigt over bookingmønstre
- Sammenligning uge/måned
- Eksport til CSV

---

## Designmål

### UI-designlinje
Alle frontend-komponenter i projektet (MieleLogic, Heat Manager, Indeklima) sigter mod samme designsprog:
- Sort/næsten-sort baggrund (`#0d0d0d`, `#111`)
- Thin borders i `#1e1e1e`
- `UPPERCASE LETTER-SPACING` sektionslabels i `#333`–`#444`
- Hvide topbar-tabs med aktiv understregning
- Ikon-header med app-ikon til venstre, status/knapper til højre
- Hvid primærknap der inverterer til sort ved hover

**Status:** MieleLogic v1.9.1 er redesignet til at matche denne designlinje. Der er fortsat plads til at polere detaljer yderligere — særligt notifikationsfanen og statistik-fanen kan forbedres visuelt.

### Kode-kvalitetsmål
- Gold Tier overholdt for alle eksisterende entiteter
- Alle async-operationer korrekt håndteret
- Produktionslogning: INFO for vigtige hændelser, DEBUG for detaljer
- Ingen breaking changes mellem minor versions

---

## Versionsoversigt

```
v1.0.5  Jan 2026  Første release — grundlæggende autentificering
v1.1.0  Jan 2026  Silver Tier fundament — DeviceInfo, Options Flow
v1.2.0  Jan 2026  Binary sensorer, response-caching
v1.3.0  Jan 2026  Kalenderintegration, automation-blueprints
v1.3.2  Jan 2026  Åbningstider, forbedret sensor-visning
v1.4.5  Jan 2026  Services: make/cancel reservation
v1.4.6  Jan 2026  Vaskehus-abstraktion (Klatvask/Storvask)
v1.5.0  Feb 2026  Integreret sidebarpanel, WebSocket API
v1.5.1  Feb 2026  Notifikationsfane med UI
v1.5.2  Feb 2026  Brugertracking, automatiske notifikationer
v1.6.0  Feb 2026  Brugertracking-fix
v1.7.0  Feb 2026  Produktionslog-rensning
v1.9.1  Feb 2026  Maskinestatus-blok, UI-rettelser
v2.0.0  Feb 2026  Rige notifikationer, admin-tab, statistik, Gold Tier
v1.9.1  Mar 2026  UI-redesign: Heat Manager/Indeklima design-sprog ◀ NU
─────────────────────────────────────────────────────────────────
v2.1.0  Kommende  Kalender-cleanup, Gold Tier tests, brands
v3.0.0  Fremtid   Multi-vaskehus, avancerede funktioner
```

> Bemærk: Versionnummerering er ikke strengt lineær — v2.0.0 kom før den endelige v1.9.1 UI-redesign.

---

## Filer der kræver opdatering ved næste release

Når en ny version frigives, skal disse filer altid opdateres:

| Fil | Hvad opdateres |
|---|---|
| `const.py` | `VERSION = "x.x.x"` |
| `manifest.json` | `"version": "x.x.x"` |
| `__init__.py` | Kommentar øverst |
| `CHANGELOG.md` | Ny sektion |
| `README.md` | Badge + "Seneste version" |
| `STATUS.md` | Denne fil — aktuel version + dato |

---

## Udviklingsprincipper

Projektet følger disse principper konsekvent:

**Ingen breaking changes i minor versions.** Brugere skal altid kunne opdatere uden at rekonfigurere.

**Én ting ad gangen.** Hver version løser et veldefineret problem fremfor at kaste mange ting ind på én gang.

**Vaskehus-abstraktionen er kernen.** Brugerne tænker i "Klatvask" og "Storvask" — ikke "Maskine 1" og "Maskine 3". Alt UI og kalenderdata skal afspejle dette.

**Produktionskode fra dag ét.** Verbose debug-logs fjernes inden release. Fejl logges på WARNING/ERROR, ikke INFO.

**HA-standarder følges.** EntityDescription, has_entity_name, async-patterns, koordinator-mønster — alt følger HA's officielle anbefalinger.

---

*Dette dokument vedligeholdes som den primære reference for projektets retning. Opdater det ved hver release.*
