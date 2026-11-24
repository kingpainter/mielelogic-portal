# Contributing to MieleLogic

Thank you for your interest in contributing! 🧺

MieleLogic is a community project and all contributions are welcome — from bug reports to new features.

---

## 🐛 Report a bug

Use [GitHub Issues](https://github.com/kingpainter/mielelogic/issues) with the **Bug Report** template.

**Before you open an issue:**
- Check that you are running Home Assistant 2026.1.0+
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
- Python 3.11+
- Home Assistant 2026.1.0+
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
4. **Test thoroughly** — use the testing checklist in `PROJECT_INSTRUCTIONS.md`
5. **Commit** with a descriptive message:
   ```
   fix: card border no longer bleeds on hover
   feat: add multi-laundry support
   ```
6. **Open a Pull Request** against the `main` branch

### Code standards

**Python:**
- Follow the existing pattern with `dict`-based data access
- `VERSION = "x.x.x"` at the top of every `.py` file
- Use `_LOGGER` for logging — not `print()`
- Graceful fallback if HA services are not available

**JavaScript:**
- All state variables must be in LitElement `static get properties()`
- Use `lit@2` — not `lit-element@2.4.0`
- Use `inset box-shadow` for hover effects — never `border` or `outline` on elements inside `overflow: hidden`
- Use `div.card-root` as the wrapper — never `ha-card`

**Versions:**
- Bump the version in `const.py`, `manifest.json` and `__init__.py`
- Add an entry to `CHANGELOG.md`

---

## 📋 Pull Request guidelines

- One PR per feature/fix
- Describe what changed and why
- Reference related issues with `Fixes #123`
- Make sure all existing features still work

---

## 🌍 Language

- Code and comments: English
- UI texts (da.json/en.json): Danish + English
- Documentation (README, CHANGELOG, contributing guides): English
- Issues and PRs: Danish or English — both are welcome

---

## ❓ Questions

Do you have a question that is not covered here? Open a [Discussion](https://github.com/kingpainter/mielelogic/discussions) or open an issue with the `question` label.

---

**Thank you for your contribution! 🙏**
