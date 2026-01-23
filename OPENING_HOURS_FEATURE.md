# v1.3.2 - Åbningstider Feature

## 🎯 Hvad er nyt?

**"Lukket indtil" viser nu åbningstid!**

### FØR:
```
State: "Lukket indtil"
```

### EFTER:
```
State: "Lukket indtil kl. 07:00"  ✅
```

---

## 📋 Hvordan virker det?

### Priority logik i sensor:

1. **Hvis ReservationInfo har værdi** → vis det
   ```
   "Ledig indtil kl. 21:00"
   ```

2. **Hvis status er "Lukket indtil"** → tilføj åbningstid
   ```
   "Lukket indtil kl. 07:00"
   ```

3. **Ellers** → bare status
   ```
   "Ledig"
   ```

---

## ⚙️ Konfiguration

### Config Flow (initial setup):
```
Setup MieleLogic Portal:
├── Username
├── Password
├── Client ID
├── Laundry ID
├── Opening time: [07:00]  ← NY!
└── Closing time: [21:00]  ← NY!
```

**Default værdier:**
- Opening: 07:00
- Closing: 21:00

### Options Flow (ændre senere):
```
Configure MieleLogic Portal:
├── Update credentials
├── Configure calendar
└── Configure opening hours  ← NY!
    ├── Opening time: [07:00]
    └── Closing time: [21:00]
```

---

## 📦 Filer der skal opdateres

**Opdaterede filer:**
1. config_flow.py (åbningstider i setup + options)
2. sensor.py (logic til "Lukket indtil")
3. da.json (danske oversættelser)
4. en.json (engelske oversættelser)

**Uændrede filer:**
- coordinator.py
- const.py
- manifest.json

---

## 🚀 Installation

### Step 1: Kopier filer
```
config_flow.py → /custom_components/mielelogic/
sensor.py      → /custom_components/mielelogic/
da.json        → /custom_components/mielelogic/translations/
en.json        → /custom_components/mielelogic/translations/
```

### Step 2: Restart HA
- Settings → System → Restart Home Assistant

### Step 3: Opdater åbningstider (hvis nødvendigt)
- Settings → Devices & Services → MieleLogic Portal
- Click "Configure"
- Vælg "Configure opening hours"
- Indstil: Åbner 07:00, Lukker 21:00
- Save

---

## ✅ Test Checklist

### Test 1: Eksisterende integration
Hvis du HAR integration installeret:

1. Opdater filer
2. Restart HA
3. Options Flow → Configure opening hours
4. Set: 07:00 - 21:00
5. Check sensor når den viser "Lukket indtil"

### Test 2: Ny installation
Hvis du installerer FRA bunden:

1. Installer filer
2. Restart HA
3. Add Integration → MieleLogic
4. Config Flow viser åbningstider ✅
5. Set: 07:00 - 21:00 (eller dine tider)
6. Complete setup

### Test 3: "Lukket indtil" status
```
Developer Tools → States → sensor.mielelogic_klatvask_1_status

Når vaskehus er lukket:
State: "Lukket indtil kl. 07:00"  ✅
```

---

## 🔍 Eksempler

### Eksempel 1: Normal drift (åbent)
```yaml
Status: "Ledig indtil"
ReservationInfo: "kl. 21:00"
→ Display: "Ledig indtil kl. 21:00"  (bruger ReservationInfo)
```

### Eksempel 2: Lukket (uden reservation)
```yaml
Status: "Lukket indtil"
ReservationInfo: ""
Opening time config: "07:00"
→ Display: "Lukket indtil kl. 07:00"  (bruger config)
```

### Eksempel 3: I brug
```yaml
Status: "Resttid: 55 min"
ReservationInfo: ""
→ Display: "Resttid: 55 min"  (bare status)
```

---

## ⚙️ Forskellige åbningstider

Hvis dit vaskehus har andre tider:

**Eksempel: 08:00 - 20:00**
```
Options Flow → Configure opening hours
Opening: 08:00
Closing: 20:00
```

**Resultat:**
```
"Lukket indtil kl. 08:00"
```

---

## 📝 Config Entry Data

Data gemmes i config_entry.data:
```python
{
  "username": "kongemaleren",
  "password": "***",
  "client_id": "YV1ZAQ7BTE9IT2ZBZXLJ",
  "laundry_id": "3444",
  "sync_to_calendar": "calendar.kun_flemming",  # optional
  "opening_time": "07:00",  # NY!
  "closing_time": "21:00"   # NY!
}
```

---

## 🎯 Alle v1.3.2 Features samlet

### ✅ Calendar Sync (fra tidligere)
- Synkroniser til ekstern kalender (f.eks. CalDAV)
- Valgfrit via Options Flow

### ✅ Sensor kombinering (fra tidligere)
- Status + ReservationInfo = "Ledig indtil kl. 21:00"

### ✅ Åbningstider (NY!)
- "Lukket indtil" + åbningstid = "Lukket indtil kl. 07:00"
- Konfigurerbart i setup og options

---

## 📦 Komplet v1.3.2 Pakke

**7 filer til deployment:**
1. config_flow.py (menu + åbningstider)
2. coordinator.py (calendar sync)
3. sensor.py (kombineret display + åbningstider)
4. const.py (v1.3.2)
5. manifest.json (v1.3.2)
6. da.json (danske oversættelser)
7. en.json (engelske oversættelser)

**Alle features:**
- ✅ Calendar sync (optional)
- ✅ Status + ReservationInfo kombinering
- ✅ "Lukket indtil" med åbningstid
- ✅ 3 options i Options Flow
- ✅ "MieleLogic Portal" navn

**Status:** Ready for testing! 🚀

---

**Version:** 1.3.2  
**Feature:** Opening Hours Display  
**Breaking Changes:** None ✅  
**Backward Compatible:** 100% ✅

Test det og fortæl mig om det virker! 😊
