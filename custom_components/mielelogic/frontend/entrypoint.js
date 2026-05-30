// MieleLogic Panel Entrypoint
// VERSION = "2.1.0"
// Injects DM Sans/DM Mono font once — avoids @import inside shadow DOM _css()
// which would re-request the font on every _render() call.

(function() {
  const FONT_ID = "mielelogic-fonts";
  if (!document.getElementById(FONT_ID)) {
    const link = document.createElement("link");
    link.id   = FONT_ID;
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }
})();

import "./panel.js";
