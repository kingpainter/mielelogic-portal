# VERSION = "2.0.0"
"""Constants for MieleLogic integration."""
DOMAIN = "mielelogic"
VERSION = "2.0.0"

# API credentials
CONF_USERNAME = "username"
CONF_PASSWORD = "password"
CONF_CLIENT_ID = "client_id"
CONF_LAUNDRY_ID = "laundry_id"
CONF_CLIENT_SECRET = "client_secret"

# API endpoints
API_BASE_URL = "https://api.mielelogic.com/v7"
AUTH_URL = "https://sec.mielelogic.com/v7/token"

# Panel configuration (Energy Hub pattern)
CONF_SIDEBAR_TITLE = "sidebar_title"
CONF_SIDEBAR_ICON = "sidebar_icon"
CONF_PANEL_ENABLED = "panel_enabled"
CONF_REQUIRE_ADMIN = "require_admin"

DEFAULT_SIDEBAR_TITLE = "MieleLogic"
DEFAULT_SIDEBAR_ICON = "mdi:washing-machine"
DEFAULT_PANEL_ENABLED = True
DEFAULT_REQUIRE_ADMIN = False
