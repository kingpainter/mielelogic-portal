# v1.3.3 Installation Guide

## 🎯 Hvad Fikser Vi?

**Problem 1: Forkert tid**
- Reservation kl. 19:00 → Kalender viser kl. 20:00 ❌
- Årsag: UTC tid i stedet for Danmark tid

**Problem 2: Lange navne**
- "Klatvask #1 [MieleLogic]" → For langt og rodet ❌
- Ønsket: "Klatvask Reserveret" ✅

---

## ✅ Løsning i v1.3.3

### Før:
```
Calendar Event:
  Summary: "Klatvask #1 [MieleLogic]"
  Time: 20:00 - 21:30  (1 time for sent!)
```

### Efter:
```
Calendar Event:
  Summary: "Klatvask Reserveret"
  Time: 19:00 - 20:30  (korrekt tid!)
```

---

## 📦 Filer der skal opdateres

**3 filer til v1.3.3:**
1. `coordinator.py` (v1.3.3 - timezone fix + simpler names)
2. `const.py` (v1.3.3 - version bump)
3. `manifest.json` (v1.3.3 - version bump)

**Alle andre filer forbliver uændrede (v1.3.2 eller tidligere)**

---

## 🚀 Installation (Step-by-Step)

### Step 1: Backup (Anbefalet)
```bash
# Windows:
C:\path\to\homeassistant\custom_components\mielelogic\

# Kopier disse filer til backup folder:
- coordinator.py
- const.py
- manifest.json
```

### Step 2: Kopier nye filer
1. Download filerne fra outputs:
   - `coordinator.py`
   - `const.py`
   - `manifest.json`

2. Kopier til:
   ```
   C:\path\to\homeassistant\custom_components\mielelogic\
   ```

3. Overskriv de eksisterende filer

### Step 3: Restart Home Assistant
- Settings → System → Restart Home Assistant
- Vent ~30 sekunder

### Step 4: Verificer installation
```
Developer Tools → States → Filter "mielelogic"

Check version:
sensor.mielelogic_portal_reservations → Attributes → version: "1.3.3"
```

---

## 🧪 Test Checklist

### Test 1: Lav ny reservation
1. Åbn MieleLogic app
2. Book en vasker (f.eks. Klatvask #1 kl. 19:00)
3. Vent 5 minutter (eller restart coordinator)
4. Check din eksterne kalender (f.eks. `calendar.kun_flemming`)

**Forventet resultat:**
```
Event:
  Summary: "Klatvask Reserveret"  ✅
  Time: 19:00 - 20:30  ✅ (matcher MieleLogic app)
```

### Test 2: Check forskellige maskiner
- **Klatvask #1** → "Klatvask Reserveret"
- **Klatvask #2** → "Klatvask Reserveret"
- **Storvask #3** → "Storvask Reserveret"
- **Storvask #4** → "Storvask Reserveret"
- **Storvask #5** → "Storvask Reserveret"

### Test 3: Duplicate detection
1. Lav samme reservation to gange (samme tid + maskine)
2. Check at kun ÉN event oprettes i kalender
3. Logs skal vise: "Event 'Klatvask Reserveret' already exists, skipping"

### Test 4: Check logs
```bash
grep "Created calendar event" /config/home-assistant.log

Forventet:
✅ Created calendar event: Klatvask Reserveret
✅ Created calendar event: Storvask Reserveret
```

---

## 🗑️ Ryd op i gamle events (Valgfrit)

**Problem:** Gamle events med forkerte tider bliver IKKE opdateret

**Løsning:** Slet gamle events manuelt

### Apple Calendar:
1. Åbn Calendar app
2. Filtrer efter "MieleLogic" (hvis du brugte den gamle tag)
3. Slet alle gamle events med forkerte tider
4. Nye events vil blive oprettet med korrekte tider

### Google Calendar:
1. Åbn Google Calendar
2. Søg efter "MieleLogic" eller "Klatvask"
3. Slet gamle events med forkerte tider
4. Nye events vil blive oprettet automatisk

---

## 🔍 Debugging

### Problem: Events oprettes stadig med forkert tid
**Check:**
1. Er coordinator.py opdateret? (version 1.3.3)
2. Er HA restarted?
3. Check logs:
```bash
grep "timezone" /config/home-assistant.log
```

**Løsning:**
- Verificer at filen er kopieret korrekt
- Restart HA igen
- Check at `ZoneInfo("Europe/Copenhagen")` bruges

### Problem: Event navn er stadig "Klatvask #1"
**Check:**
1. Er det en gammel event? (oprettet før v1.3.3)
2. Check logs for nye events:
```bash
grep "Created calendar event" /config/home-assistant.log | tail -5
```

**Løsning:**
- Gamle events bliver IKKE opdateret
- Slet gamle events manuelt
- Vent på nye events (5 min eller restart)

### Problem: Ingen events oprettes
**Check:**
1. Er calendar sync aktiveret?
   ```
   Settings → Devices & Services → MieleLogic Portal
   → Configure → Calendar sync → Enabled
   ```

2. Er target calendar korrekt?
   ```
   Developer Tools → States → Search "calendar"
   Verify calendar.kun_flemming exists
   ```

3. Check logs:
```bash
grep "calendar sync" /config/home-assistant.log
```

**Løsning:**
- Enable calendar sync hvis deaktiveret
- Verify target calendar exists
- Check for sync errors i logs

---

## 📊 Forventet Resultat

### Success kriterier:
- ✅ Event tid matcher MieleLogic app præcist
- ✅ Event navn er "Klatvask Reserveret" eller "Storvask Reserveret"
- ✅ Ingen duplicates oprettes
- ✅ Gamle events kan slettes manuelt
- ✅ Nye events har korrekt format

### Performance:
- Samme API calls som før (ingen ændring)
- Timezone konvertering er negligible overhead
- Sync virker stadig hver 5. minut

---

## 🎊 Efter Installation

### Check at alt virker:
1. [ ] Nye events har korrekt tid
2. [ ] Nye events har simpelt navn
3. [ ] Gamle events kan slettes (optional)
4. [ ] Integration virker stadig normalt
5. [ ] Logs viser ingen fejl

### Hvis alt virker:
- Commit til Git! 🎉
- Tag v1.3.3
- Update README hvis nødvendigt

---

## 💬 Spørgsmål?

**Virker tidszone konverteringen?**
- Check at events matcher MieleLogic app præcist
- Danmark = UTC+1 (vinter) eller UTC+2 (sommer)

**Vil gamle events blive opdateret?**
- Nej, gamle events forbliver som de er
- Nye events vil have korrekt format
- Slet gamle events manuelt hvis ønsket

**Kan jeg ændre event navne?**
- Ja, men kræver kode ændring i coordinator.py
- Nuværende format: "{machine_name} Reserveret"
- Eksempel custom: "🧺 {machine_name} - Reserveret"

---

**Version:** 1.3.3  
**Release Date:** 26. januar 2026  
**Type:** Patch (Bug Fix)  
**Breaking Changes:** Minor (event name format)  
**Status:** Ready to Deploy! 🚀

God fornøjelse med korrekte kalendertider! 🎉
