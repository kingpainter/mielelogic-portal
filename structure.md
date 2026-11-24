# MieleLogic — File Structure

Current layout of the repository. Versions are tracked in `CHANGELOG.md` and in each file's `# VERSION` header, not here.

```
mielelogic-portal/
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       ├── pytest.yml             # Runs pytest and mypy
│       ├── validate.yml           # hassfest, HACS, flake8, JS syntax, translations
│       └── sync_logo.yml
├── custom_components/
│   └── mielelogic/
│       ├── __init__.py            # Setup, runtime_data, notification action listener
│       ├── manifest.json
│       ├── const.py               # Constants and VERSION
│       ├── config_flow.py         # Setup, reconfigure and options flow
│       ├── coordinator.py         # API polling, token handling, primary calendar sync
│       ├── booking_manager.py     # Booking and cancellation, calendar sync and deletion
│       ├── caldav_async.py        # Async CalDAV client (event deletion)
│       ├── services.py            # make_reservation / cancel_reservation services
│       ├── services.yaml          # Service definitions
│       ├── websocket.py           # WebSocket API commands used by the panel
│       ├── storage.py             # Booking metadata and calendar sync state
│       ├── notification_manager.py
│       ├── notification_spam_filter.py
│       ├── time_manager.py
│       ├── panel.py               # Sidebar panel and card registration
│       ├── sensor.py              # Sensors (EntityDescription pattern)
│       ├── binary_sensor.py       # Binary sensors (EntityDescription pattern)
│       ├── calendar.py
│       ├── aiohttp_session.py     # Shared aiohttp session helper
│       ├── diagnostics.py
│       ├── icons.json             # Entity icons
│       ├── strings.json           # Source texts (config, entities, issues, exceptions)
│       ├── quality_scale.yaml     # Home Assistant quality scale status
│       ├── brand/                 # Local brand icons (HA 2026.3+)
│       ├── frontend/
│       │   ├── entrypoint.js      # Font preload
│       │   ├── panel.js           # Panel (vanilla HTMLElement, shadow DOM)
│       │   ├── mielelogic-booking-card.js
│       │   └── mielelogic_logo.png
│       └── translations/
│           ├── da.json
│           └── en.json
├── tests/
│   ├── conftest.py
│   ├── test_booking_manager.py
│   ├── test_caldav_async.py
│   ├── test_config_flow.py
│   ├── test_coordinator.py
│   ├── test_sensor_dynamic.py
│   ├── test_services.py
│   └── test_websocket.py
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE.md
├── README.md
├── hacs.json
├── mypy.ini                       # Strict type checking for the integration
├── pytest.ini
├── requirements.txt
├── screenshots/                   # Images used in README.md
└── structure.md
```
