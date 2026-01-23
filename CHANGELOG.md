# Changelog - v1.3.2

All notable changes to the MieleLogic Home Assistant integration.

---

## [1.3.2] - 2026-01-24

### ✨ Added - Opening Hours & Enhanced Options

#### 1. **Opening Hours Configuration** ⭐
Configure when your laundry opens/closes for enhanced display.

**Display Enhancement:**
```
Before: "Lukket indtil"
After:  "Lukket indtil kl. 07:00"
```

**Configuration:**
- Initial setup or Options Flow → Configure opening hours
- Default: 07:00 - 21:00

#### 2. **3-Option Menu in Options Flow**
- Update credentials
- Configure calendar sync  
- Configure opening hours ⭐ NEW!

#### 3. **Renamed to "MieleLogic Portal"**
Cleaner branding (was "MieleLogic Vaskeri {id}")

### 🔧 Changed
- Enhanced sensor display (status + reservation + hours)
- Safe defaults for config data
- Improved Options Flow stability

### 🐛 Fixed
- OptionsFlow initialization errors
- Missing data handling
- Selector compatibility

### ✅ Migration
- 100% backward compatible
- Opening hours default to 07:00 - 21:00
- No reconfiguration needed

---

## [1.3.1] - 2026-01-24
- Calendar sync to external calendar (optional)
- Menu-based Options Flow

## [1.3.0] - 2026-01-21
- Calendar integration
- 4 Automation blueprints
- Timezone fixes

## [1.2.0] - 2026-01-20
- 6 Binary sensors
- Enhanced attributes
- 90% API caching

## [1.1.0] - 2026-01-20
- Device organization
- Options Flow
- Smart token refresh

## [1.0.5] - 2026-01-13
- Initial alpha release
