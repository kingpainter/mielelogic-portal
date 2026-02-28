# Contributing to MieleLogic

Tak for din interesse i at bidrage! 🧺

MieleLogic er et community-projekt og alle bidrag er velkomne — fra bugreports til nye features.

---

## 🐛 Rapporter en fejl

Brug [GitHub Issues](https://github.com/kingpainter/mielelogic/issues) med **Bug Report** templaten.

**Før du opretter en issue:**
- Tjek at du kører Home Assistant 2026.1.0+
- Tjek at fejlen ikke allerede er rapporteret
- Genstart Home Assistant og se om fejlen gentager sig

**En god bugreport indeholder:**
- HA version + MieleLogic version
- Hvad du forventede vs. hvad der skete
- Relevante log-linjer fra `Settings → System → Logs`
- Screenshot hvis relevant

---

## 💡 Foreslå en feature

Brug [GitHub Issues](https://github.com/kingpainter/mielelogic/issues) med **Feature Request** templaten.

Beskriv gerne:
- Hvad du vil opnå (use case)
- Hvordan du forestiller dig det skal fungere
- Hvorfor det ville gavne andre brugere

---

## 🔧 Bidrag med kode

### Krav
- Python 3.11+
- Home Assistant 2026.1.0+
- MieleLogic konto med aktiv vasketøjsadgang
- Grundlæggende kendskab til Home Assistant custom integrations

### Workflow

1. **Fork** repositoriet
2. **Opret en branch** med et beskrivende navn:
   ```
   git checkout -b fix/card-border-rendering
   git checkout -b feat/multi-laundry-support
   ```
3. **Lav dine ændringer** — se kodestandarder nedenfor
4. **Test grundigt** — brug testing checklist i `PROJECT_INSTRUCTIONS.md`
5. **Commit** med en beskrivende besked:
   ```
   fix: card border no longer bleeds on hover
   feat: add multi-laundry support
   ```
6. **Åbn en Pull Request** mod `main` branchen

### Kodestandarder

**Python:**
- Følg eksisterende mønster med `dict`-baseret data access
- `VERSION = "x.x.x"` øverst i alle `.py` filer
- Brug `_LOGGER` til logging — ikke `print()`
- Graceful fallback hvis HA services ikke er tilgængelige

**JavaScript:**
- Alle state-variabler skal være i LitElement `static get properties()`
- Brug `lit@2` — ikke `lit-element@2.4.0`
- Brug `inset box-shadow` til hover-effekter — aldrig `border` eller `outline` på elementer inde i `overflow: hidden`
- Brug `div.card-root` som wrapper — aldrig `ha-card`

**Versioner:**
- Bump version i `const.py`, `manifest.json` og `__init__.py`
- Tilføj entry i `CHANGELOG.md`

---

## 📋 Pull Request Guidelines

- Én PR per feature/fix
- Beskriv hvad der er ændret og hvorfor
- Reference evt. relaterede issues med `Fixes #123`
- Sørg for at alle eksisterende features stadig virker

---

## 🌍 Sprog

- Kode og kommentarer: Engelsk
- UI-tekster (da.json/en.json): Dansk + Engelsk
- Issues og PRs: Dansk eller Engelsk — begge er velkomne

---

## ❓ Spørgsmål

Har du spørgsmål der ikke er dækket her? Åbn en [Discussion](https://github.com/kingpainter/mielelogic/discussions) eller opret en issue med label `question`.

---

**Tak for dit bidrag! 🙏**
