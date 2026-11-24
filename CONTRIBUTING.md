# Contributing to MieleLogic

Thank you for your interest in contributing! 🧺

MieleLogic is a community project and all contributions are welcome — from bug reports to new features.

---

## 🐛 Report a bug

Use [GitHub Issues](https://github.com/kingpainter/mielelogic/issues) with the **Bug Report** template.

**Before you open an issue:**
- Check that you are running Home Assistant 2026.3.0+
- Check that the bug has not already been reported
- Restart Home Assistant and see whether the bug happens again

**A good bug report includes:**
- HA version + MieleLogic version
- What you expected vs. what happened
- Relevant log lines from `Settings → System → Logs`
- A screenshot if relevant

---

## 💡 Suggest a feature

Use [GitHub Issues](https://github.com/kingpainter/mielelogic/issues) with the **Feature Request** template.

Please describe:
- What you want to achieve (use case)
- How you imagine it should work
- Why it would benefit other users

---

## 🔧 Contributing code

### Requirements
- Python 3.13+ (the test stack requires it)
- Home Assistant 2026.3.0+
- A MieleLogic account with active laundry access
- Basic knowledge of Home Assistant custom integrations

### Workflow

1. **Fork** the repository
2. **Create a branch** with a descriptive name:
   ```
   git checkout -b fix/card-border-rendering
   git checkout -b feat/multi-laundry-support
   ```
3. **Make your changes** — see the code standards below
4. **Run the checks locally** (the same checks run in CI):
   ```
   pip install -r requirements.txt
   pytest tests/
   mypy --config-file mypy.ini
   ```
5. **Commit** with a descriptive message in English:
   ```
   fix: card border no longer bleeds on hover
   feat: add multi-laundry support
   ```
6. **Open a Pull Request** against the `main` branch

### Code standards

**Python:**
- Strict typing: `mypy --config-file mypy.ini` must pass with no errors
- Access runtime state through `entry.runtime_data` (the `hass.data` fallback exists only in `websocket.py`)
- Every `.py` file starts with `# VERSION = "x.x.x"`
- Use `_LOGGER` for logging — not `print()`
- Use `CLIENT_TIMEOUT` (`aiohttp.ClientTimeout`) for HTTP calls and `async_get_clientsession` / `shared_session` for the HTTP session
- Raise `ServiceValidationError` or `HomeAssistantError` with a `translation_key` (texts go in `strings.json`, `en.json` and `da.json` under `exceptions`)
- Entity icons go in `icons.json`, not in code

**JavaScript:**
- The panel and the booking card are vanilla `HTMLElement` components with shadow DOM. Do not add Lit or other frameworks
- Use `div.card-root` as the wrapper — never `ha-card`
- Use `inset box-shadow` for hover effects — never `border` or `outline` on elements inside `overflow: hidden`

**Versions** — bump all of these when releasing:
- `# VERSION = "x.x.x"` header in every `.py` file, including `tests/`
- `VERSION` in `const.py` and `version` in `manifest.json`
- The version headers in `frontend/panel.js` and `frontend/mielelogic-booking-card.js`, and the version text in the panel header
- The version badge in `README.md`
- The version log messages in `__init__.py` and `websocket.py`
- A new entry at the top of `CHANGELOG.md`

---

## 📋 Pull Request guidelines

- One PR per feature/fix
- Describe what changed and why
- Reference related issues with `Fixes #123`
- Make sure all existing features still work
- `pytest tests/` and `mypy --config-file mypy.ini` must pass

---

## 🌍 Language

- Code, comments and documentation (README, CHANGELOG, contributing guides): English
- UI texts (`translations/da.json`, `translations/en.json`): Danish and English
- Commit messages: English
- Issues and PRs: Danish or English — both are welcome

---

## ❓ Questions

Do you have a question that is not covered here? Open a [Discussion](https://github.com/kingpainter/mielelogic/discussions) or open an issue with the `question` label.

---

**Thank you for your contribution! 🙏**
