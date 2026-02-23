custom_components/mielelogic/
│
├── 📄 __init__.py                    # v1.5.0 - Setup + Panel + WebSocket
├── 📄 manifest.json                  # v1.5.0 - Frontend support
├── 📄 const.py                       # v1.5.0 - Version konstanter
│
├── 🔧 config_flow.py                 # v1.4.6 - Unchanged
├── 🔄 coordinator.py                 # v1.4.7 - Unchanged
│
├── 📊 sensor.py                      # v1.3.2.1 - Unchanged
├── 🔘 binary_sensor.py               # v1.3.0 - Unchanged
├── 📅 calendar.py                    # v1.4.6 - Unchanged
│
├── 🛠️ services.py                     # v1.4.7 - Unchanged
├── 🔍 diagnostics.py                 # v1.3.2 - Unchanged
│
├── ✨ panel.py                       # v1.5.0 - NEW! Panel registration
├── ⏰ time_manager.py                # v1.5.0 - NEW! Time slot logic
├── 📝 booking_manager.py             # v1.5.0 - NEW! Booking operations
├── 🔌 websocket.py                   # v1.5.0 - NEW! WebSocket API
│
├── 📁 frontend/                      # v1.5.0 - NEW FOLDER!
│   ├── 📄 entrypoint.js              # v1.5.0 - Frontend entry
│   └── 📄 panel.js                   # v1.5.0 - Complete panel UI
│
└── 📁 translations/
    ├── 📄 da.json                    # v1.4.6 - Unchanged
    └── 📄 en.json                    # v1.4.6 - Unchanged
	
mielelogic/
├── __init__.py              ✅ (opdateret)
├── manifest.json            ✅ (opdateret)
├── const.py                 ✅ (opdateret)
├── config_flow.py           ✅ (original)
├── coordinator.py           ✅ (original)
├── sensor.py                ✅ (original)
├── binary_sensor.py         ✅ (original)
├── calendar.py              ✅ (original)
├── services.py              ✅ (original)
├── diagnostics.py           ✅ (original)
├── panel.py                 ✅ (ny)
├── time_manager.py          ✅ (ny)
├── booking_manager.py       ✅ (ny)
├── websocket.py             ✅ (ny)
├── frontend/
│   ├── entrypoint.js        ✅ (ny)
│   └── panel.js             ✅ (ny)
└── translations/
    ├── da.json              ✅ (original)
    └── en.json              ✅ (original)