# VERSION = "2.6.4"
"""Constants for MieleLogic integration."""
DOMAIN = "mielelogic"
VERSION = "2.6.4"

# API credentials
CONF_USERNAME = "username"
CONF_PASSWORD = "password"
CONF_CLIENT_ID = "client_id"
CONF_LAUNDRY_ID = "laundry_id"
CONF_CLIENT_SECRET = "client_secret"

# API endpoints
API_BASE_URL = "https://api.mielelogic.com/v7"
AUTH_URL = "https://sec.mielelogic.com/v7/token"

# Default OAuth2 client ID (public — not a secret)
DEFAULT_CLIENT_ID = "YV1ZAQ7BTE9IT2ZBZXLJ"

# Panel configuration (Energy Hub pattern)
CONF_SIDEBAR_TITLE = "sidebar_title"
CONF_SIDEBAR_ICON = "sidebar_icon"
CONF_PANEL_ENABLED = "panel_enabled"
CONF_REQUIRE_ADMIN = "require_admin"

DEFAULT_SIDEBAR_TITLE = "MieleLogic"
DEFAULT_SIDEBAR_ICON = "mdi:washing-machine"
DEFAULT_PANEL_ENABLED = True
DEFAULT_REQUIRE_ADMIN = False

# Calendar configuration (v2.5.0)
# Primary: always synced (auto by coordinator + on booking via panel)
# Secondary: optional per-booking chips in panel, never auto-synced
CONF_PRIMARY_CALENDAR = "primary_calendar"       # replaces sync_to_calendar
CONF_SECONDARY_CALENDARS = "secondary_calendars"  # list[str] of entity_ids

# Direct CalDAV credentials (v2.6.0)
# HA's CalDAV integration doesn't support calendar.delete_event
# (home-assistant/core#159784), so we talk to the CalDAV server directly
# for deletion only. Creation still uses calendar.create_event as before.
CONF_CALDAV_URL = "caldav_url"
CONF_CALDAV_USERNAME = "caldav_username"
CONF_CALDAV_PASSWORD = "caldav_password"
