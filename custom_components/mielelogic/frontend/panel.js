// MieleLogic Panel — Main UI Component
// VERSION = "1.9.1"
// Architecture: vanilla HTMLElement + shadow DOM
// Same pattern as Heat Manager (0.3.0) and Indeklima (2.4.0)

class MieleLogicPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass          = null;
    this._tab           = "booking";
    this._loading       = false;
    this._error         = null;
    this._errCount      = 0;
    this._interval      = null;
    this._renderPending = false;

    // Data
    this._vaskehus      = "Klatvask";
    this._slots         = [];
    this._selectedSlot  = "";
    this._selectedDate  = new Date().toISOString().split("T")[0];
    this._bookings      = [];
    this._status        = {};

    // Notifications
    this._devices           = [];
    this._availableDevices  = [];
    this._notifications     = {};

    // Edit modal
    this._editingId     = null;
    this._editTitle     = "";
    this._editMessage   = "";

    // Admin
    this._admin         = { booking_locked: false, lock_message: "Booking er midlertidigt spærret", info_message: "" };
    this._adminSaving   = false;

    // History
    this._history       = [];
    this._historyLoading = false;
    this._cleanupResult = "";
  }

  set hass(h) {
    const first = !this._hass;
    this._hass = h;
    if (first) this._init();
  }

  connectedCallback() {
    if (!this.shadowRoot.querySelector("style")) {
      const st = document.createElement("style");
      st.textContent = this._css();
      this.shadowRoot.appendChild(st);
    }
    if (!this.shadowRoot.querySelector(".page")) {
      const wrap = document.createElement("div");
      wrap.className = "page";
      wrap.innerHTML = `<div class="loading-wrap"><span class="spin">↻</span> Indlæser MieleLogic…</div>`;
      this.shadowRoot.appendChild(wrap);
    }
    if (this._hass && this._bookings.length === 0) this._init();
    this._interval = setInterval(() => {
      if (this._errCount > 3) { clearInterval(this._interval); return; }
      if (document.visibilityState === "visible") this._loadAll();
    }, 30000);
  }

  disconnectedCallback() { clearInterval(this._interval); }

  // ── Init & data loading ─────────────────────────────────────────────────────

  async _init() {
    await this._loadAll();
    await this._loadAdmin();
  }

  async _loadAll() {
    if (!this._hass) return;
    try {
      await Promise.all([
        this._loadSlots(),
        this._loadBookings(),
        this._loadStatus(),
        this._loadNotifications(),
      ]);
      this._errCount = 0;
    } catch (e) { this._errCount++; }
    this._render();
  }

  async _loadSlots() {
    try {
      const r = await this._hass.callWS({ type: "mielelogic/get_slots", vaskehus: this._vaskehus, date: this._selectedDate });
      this._slots = r.slots || [];
      if (this._slots.length > 0) {
        const firstFree = this._slots.find(s => !s.booked);
        const preferred = firstFree || this._slots[0];
        if (!this._selectedSlot || this._slots.every(s => s.booked)) {
          this._selectedSlot = preferred.start;
        }
      }
    } catch (e) { this._error = "Kunne ikke hente tidslots"; }
  }

  async _loadBookings() {
    try {
      const r = await this._hass.callWS({ type: "mielelogic/get_bookings" });
      this._bookings = r.bookings || [];
    } catch (e) {}
  }

  async _loadStatus() {
    try {
      const r = await this._hass.callWS({ type: "mielelogic/get_status" });
      this._status = r || {};
    } catch (e) {}
  }

  async _loadNotifications() {
    try {
      const dr = await this._hass.callWS({ type: "mielelogic/get_devices" });
      this._availableDevices = dr.available || [];
      this._devices = dr.configured || [];
      const nr = await this._hass.callWS({ type: "mielelogic/get_notifications" });
      this._notifications = nr.notifications || {};
    } catch (e) {}
  }

  async _loadAdmin() {
    try {
      const r = await this._hass.callWS({ type: "mielelogic/get_admin" });
      this._admin = r || this._admin;
      this._render();
    } catch (e) {}
  }

  async _loadHistory() {
    this._historyLoading = true;
    this._cleanupResult = "";
    this._render();
    try {
      const r = await this._hass.callWS({ type: "mielelogic/get_history" });
      this._history = r.history || [];
    } catch (e) { this._history = []; }
    this._historyLoading = false;
    this._render();
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async _doBook() {
    if (!this._selectedSlot || !this._selectedDate) { alert("Vælg tidslot og dato"); return; }
    const slot = this._slots.find(s => s.start === this._selectedSlot);
    if (!confirm(`Book ${this._vaskehus} ${this._selectedDate} ${slot?.label || ""}?`)) return;
    this._loading = true; this._error = null; this._render();
    try {
      const r = await this._hass.callWS({ type: "mielelogic/make_booking", vaskehus: this._vaskehus, slot_start: this._selectedSlot, date: this._selectedDate });
      this._notify(r.message);
      if (r.success) { await new Promise(res => setTimeout(res, 400)); await this._loadAll(); }
      else { this._error = r.message; }
    } catch (e) { this._error = e.message; this._notify("Booking fejlede: " + e.message); }
    this._loading = false; this._render();
  }

  async _doCancel(b) {
    if (!confirm(`Slet ${b.vaskehus} booking ${this._fmtDate(b.Start)}?`)) return;
    this._loading = true; this._render();
    try {
      const r = await this._hass.callWS({ type: "mielelogic/cancel_booking", machine_number: b.MachineNumber, start_time: b.Start, end_time: b.End });
      this._notify(r.success ? "Booking slettet" : r.message);
      if (r.success) { await new Promise(res => setTimeout(res, 400)); await this._loadAll(); }
    } catch (e) { this._notify("Sletning fejlede: " + e.message); }
    this._loading = false; this._render();
  }

  async _doSaveDevices() {
    try { await this._hass.callWS({ type: "mielelogic/save_devices", devices: this._devices }); this._notify("Enheder gemt"); }
    catch (e) { this._notify("Kunne ikke gemme enheder"); }
  }

  async _doToggleNotification(id) {
    const n = this._notifications[id]; if (!n) return;
    await this._doSaveNotification(id, { ...n, enabled: !n.enabled });
  }

  async _doSaveNotification(id, cfg) {
    try {
      await this._hass.callWS({ type: "mielelogic/save_notification", notification_id: id, config: cfg });
      this._notify("Notifikation gemt");
      await this._loadNotifications();
      this._render();
    } catch (e) { this._notify("Kunne ikke gemme"); }
  }

  async _doTestNotification(id) {
    try { await this._hass.callWS({ type: "mielelogic/test_notification", notification_id: id }); this._notify("Test besked sendt!"); }
    catch (e) { this._notify("Test fejlede"); }
  }

  async _doSaveEdit() {
    if (!this._editingId) return;
    const n = this._notifications[this._editingId];
    try {
      await this._hass.callWS({ type: "mielelogic/save_notification", notification_id: this._editingId, config: { ...n, title: this._editTitle, message: this._editMessage } });
      this._notifications[this._editingId] = { ...n, title: this._editTitle, message: this._editMessage };
      this._notify("Skabelon gemt!");
      this._closeModal();
    } catch (e) { this._notify("Kunne ikke gemme"); }
  }

  async _doResetNotification() {
    if (!this._editingId || !confirm("Nulstil til standard skabelon?")) return;
    try {
      const r = await this._hass.callWS({ type: "mielelogic/reset_notification", notification_id: this._editingId });
      this._notifications[this._editingId] = r.config;
      this._editTitle = r.config.title;
      this._editMessage = r.config.message;
      this._notify("Nulstillet til standard!");
      this._render();
    } catch (e) { this._notify("Kunne ikke nulstille"); }
  }

  async _doSaveAdmin() {
    this._adminSaving = true; this._render();
    try {
      await this._hass.callWS({ type: "mielelogic/save_admin", booking_locked: this._admin.booking_locked, lock_message: this._admin.lock_message || "Booking er midlertidigt spærret", info_message: this._admin.info_message || "" });
      this._notify("Admin indstillinger gemt");
    } catch (e) { this._notify("Kunne ikke gemme"); }
    this._adminSaving = false; this._render();
  }

  async _doCleanupHistory() {
    try {
      const r = await this._hass.callWS({ type: "mielelogic/cleanup_history" });
      this._cleanupResult = r.cleaned > 0 ? `${r.cleaned} poster ryddet` : "Ingen gamle poster at rydde";
      await this._loadHistory();
    } catch (e) { this._cleanupResult = "Fejl ved oprydning"; this._render(); }
  }

  _notify(msg) {
    this._hass.callService("persistent_notification", "create", { message: msg, title: "MieleLogic", notification_id: `mielelogic_${Date.now()}` });
  }

  _closeModal() { this._editingId = null; this._editTitle = ""; this._editMessage = ""; this._render(); }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _fmtDate(ds) {
    return new Date(ds).toLocaleString("da-DK", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  _fmtCurrency(a) {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(a);
  }

  _preview(tpl) {
    const ex = { "{vaskehus}": "Klatvask", "{time}": "14:30", "{date}": "28-05-2026", "{duration}": "120 minutter", "{machine}": "Maskine 1" };
    let r = tpl;
    for (const [k, v] of Object.entries(ex)) r = r.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v);
    return r;
  }

  _esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── SVG icons ───────────────────────────────────────────────────────────────

  _svgKlatvask() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5"/>
      <circle cx="12" cy="13" r="4"/>
      <circle cx="12" cy="13" r="1.8" stroke-width="1"/>
      <line x1="7" y1="8" x2="9" y2="8" stroke-width="1"/>
      <circle cx="6" cy="8" r="0.8" fill="currentColor" stroke="none"/>
    </svg>`;
  }

  _svgStorvask() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2.5"/>
      <circle cx="12" cy="13" r="5"/>
      <circle cx="12" cy="13" r="2.2" stroke-width="1"/>
      <line x1="6" y1="8" x2="9" y2="8" stroke-width="1"/>
      <circle cx="5" cy="8" r="0.8" fill="currentColor" stroke="none"/>
      <path d="M5 14 Q6 11 8 12" stroke-width="1" fill="none"/>
    </svg>`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  _render() {
    const root = this.shadowRoot;
    let page = root.querySelector(".page");
    if (!page) {
      page = document.createElement("div");
      page.className = "page";
      root.appendChild(page);
    }
    page.innerHTML = this._html();
    this._bindEvents(page);
  }

  _html() {
    const count = this._bookings.length;
    const max   = this._status.max_reservations;
    return `
      ${this._htmlTopbar(count, max)}
      ${this._htmlTabs()}
      <div class="content">
        ${this._error ? `<div class="error-strip"><span>⚠ ${this._error}</span><button data-action="clear-error">✕</button></div>` : ""}
        ${this._tab === "booking"       ? this._htmlBooking()       : ""}
        ${this._tab === "notifications" ? this._htmlNotifications() : ""}
        ${this._tab === "stats"         ? this._htmlStats()         : ""}
        ${this._tab === "admin"         ? this._htmlAdmin()         : ""}
      </div>
      ${this._editingId ? this._htmlModal() : ""}
    `;
  }

  _htmlTopbar(count, max) {
    const bal = this._status.balance ? ` · ${this._fmtCurrency(this._status.balance)}` : "";
    return `
      <div class="topbar">
        <div class="topbar-left">
          <div class="app-icon">
            <img src="data:image/png;base64,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" style="width:52px;height:52px;border-radius:16px;object-fit:cover" alt="" />
          </div>
          <div class="app-info">
            <span class="app-name">MieleLogic</span>
            <span class="app-meta">${count}${max ? ` / ${max}` : ""} booking${count !== 1 ? "er" : ""}${bal}</span>
          </div>
        </div>
        <div class="topbar-right">
          <button class="refresh-btn" data-action="refresh" ${this._loading ? "disabled" : ""}>
            <span class="${this._loading ? "spin" : ""}">↻</span> Opdater
          </button>
        </div>
      </div>
    `;
  }

  _htmlTabs() {
    const tabs = [
      { id: "booking",       label: "Oversigt" },
      { id: "notifications", label: "Notifikationer" },
      { id: "stats",         label: "Historik" },
      { id: "admin",         label: "Konfiguration" },
    ];
    return `
      <div class="tabs-row">
        ${tabs.map(t => `<button class="tab-btn ${this._tab === t.id ? "tab-active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}
      </div>
    `;
  }

  _htmlBooking() {
    const s       = this._admin;
    const locked  = s.booking_locked;
    const canBook = !locked && this._bookings.length < (this._status.max_reservations || 99);

    const infoMsg = s.info_message ? `<div class="info-strip">${s.info_message}</div>` : "";
    const lockMsg = locked ? `<div class="lock-strip">🔒 ${s.lock_message || "Booking er midlertidigt spærret"}</div>` : "";

    const slotsOpts = this._slots.length === 0
      ? `<option>Henter tidslots…</option>`
      : this._slots.map(sl => {
          const booked = sl.booked;
          const sel    = this._selectedSlot === sl.start ? "selected" : "";
          const dis    = booked ? "disabled" : "";
          const label  = booked ? `${sl.label} — Optaget` : sl.label;
          return `<option value="${sl.start}" ${sel} ${dis} data-booked="${booked}">${label}</option>`;
        }).join("");

    const bookBtn = this._loading
      ? `<button class="book-btn btn-locked" disabled><span class="spin">↻</span> Booker…</button>`
      : locked
        ? `<button class="book-btn btn-locked" disabled>🔒 ${s.lock_message || "Booking spærret"}</button>`
        : !canBook
          ? `<button class="book-btn btn-full" disabled>Max bookinger nået</button>`
          : `<button class="book-btn btn-ready" data-action="book">Book nu</button>`;

    const bookingsHtml = this._bookings.length === 0
      ? `<div class="empty-row">Ingen aktive bookinger</div>`
      : this._bookings.map(b => this._htmlBookingRow(b)).join("");

    return `
      <div class="section">
        ${infoMsg}${lockMsg}
        <div class="section-label">NY BOOKING</div>
        <div class="vhus-toggle">
          <button class="vhus-btn ${this._vaskehus === "Klatvask" ? "vhus-active" : ""}" data-vhus="Klatvask">
            ${this._svgKlatvask()} Klatvask
          </button>
          <button class="vhus-btn ${this._vaskehus === "Storvask" ? "vhus-active" : ""}" data-vhus="Storvask">
            ${this._svgStorvask()} Storvask
          </button>
        </div>
        <div class="field-blk">
          <span class="field-label">TIDSBLOK</span>
          <div class="sel-wrap">
            <select class="field-select" data-field="slot" ${this._loading || this._slots.length === 0 ? "disabled" : ""}>${slotsOpts}</select>
            <span class="sel-arr">▾</span>
          </div>
        </div>
        <div class="slot-hint">
          ${this._slots.map(sl => `<span class="slot-chip ${sl.booked ? 'booked' : 'free'}">${sl.start} ${sl.booked ? '✕' : '✓'}</span>`).join('')}
        </div>
        <div class="field-blk">
          <span class="field-label">DATO</span>
          <input type="date" class="field-input" data-field="date" value="${this._selectedDate}" ${this._loading ? "disabled" : ""} />
        </div>
        ${bookBtn}
      </div>

      <div class="section">
        <div class="section-label-row">
          <span class="section-label">AKTIVE BOOKINGER</span>
          <span class="cnt-badge">${this._bookings.length}</span>
        </div>
        ${bookingsHtml}
      </div>
    `;
  }

  _htmlBookingRow(b) {
    const dur = (() => {
      const d = b.Duration ?? b.duration;
      if (d != null && !isNaN(+d)) return +d + " min";
      try { const m = Math.round((new Date(b.End) - new Date(b.Start)) / 60000); if (m > 0) return m + " min"; } catch (e) {}
      return "";
    })();
    return `
      <div class="brow">
        <div class="brow-accent ${b.vaskehus === "Storvask" ? "ba-stor" : "ba-klat"}"></div>
        <div class="brow-info">
          <span class="brow-name">${b.vaskehus || "Booking"}</span>
          <span class="brow-meta">
            ${this._fmtDate(b.Start)}
            ${dur ? ` · ${dur}` : ""}
            ${b.created_by ? ` · <span class="brow-via">${b.created_by}</span>` : ""}
          </span>
        </div>
        <button class="del-btn" data-cancel='${JSON.stringify({ MachineNumber: b.MachineNumber, Start: b.Start, End: b.End, vaskehus: b.vaskehus })}' ${this._loading ? "disabled" : ""} title="Slet booking">✕</button>
      </div>
    `;
  }

  _htmlNotifications() {
    const devHtml = this._availableDevices.length === 0
      ? `<div class="empty-row">Ingen mobile apps fundet — installer HA Companion</div>`
      : `<div class="dev-list">
          ${this._availableDevices.map(d => `
            <label class="dev-chip ${this._devices.includes(d.service) ? "dev-on" : ""}">
              <span class="dev-dot ${this._devices.includes(d.service) ? "dot-on" : ""}"></span>
              <span>${d.name}</span>
              <input type="checkbox" data-device="${d.service}" ${this._devices.includes(d.service) ? "checked" : ""} style="display:none" />
            </label>
          `).join("")}
        </div>
        <button class="act-btn" data-action="save-devices">Gem enheder</button>`;

    const notifHtml = Object.keys(this._notifications).length === 0
      ? `<div class="empty-row">Ingen notifikationer konfigureret</div>`
      : `<div class="notif-list">
          ${Object.entries(this._notifications).map(([id, n]) => `
            <div class="notif-row ${n.enabled ? "notif-on" : ""}">
              <div class="notif-left">
                <label class="tog-wrap">
                  <input type="checkbox" data-toggle-notif="${id}" ${n.enabled ? "checked" : ""} />
                  <span class="tog-track"><span class="tog-thumb ${n.enabled ? "thumb-on" : ""}"></span></span>
                </label>
                <div class="notif-texts">
                  <span class="notif-name">${n.title}</span>
                  <span class="notif-msg">${n.message}</span>
                </div>
              </div>
              <div class="notif-acts">
                <button class="ghost-btn" data-edit-notif="${id}">Rediger</button>
                <button class="ghost-btn ghost-green" data-test-notif="${id}" ${!n.enabled || this._devices.length === 0 ? "disabled" : ""}>Test</button>
              </div>
            </div>
          `).join("")}
        </div>`;

    return `
      <div class="section">
        <div class="section-label">MOBILE ENHEDER</div>
        <p class="sec-desc">Vælg hvilke enheder der modtager notifikationer</p>
        ${devHtml}
      </div>
      <div class="section">
        <div class="section-label">NOTIFIKATIONER</div>
        <p class="sec-desc">Aktiver og tilpas beskedskabeloner</p>
        ${notifHtml}
      </div>
    `;
  }

  _htmlModal() {
    const n = this._notifications[this._editingId];
    if (!n) return "";
    return `
      <div class="modal-bg" data-action="close-modal">
        <div class="modal-box" data-stop-propagation>
          <div class="modal-head">
            <span class="modal-title">Rediger skabelon</span>
            <button class="modal-close" data-action="close-modal">✕</button>
          </div>
          <div class="modal-field">
            <label class="field-label">TITEL</label>
            <input class="field-input" type="text" data-modal-field="title" value="${this._esc(this._editTitle)}" placeholder="Notifikationstitel" />
            <div class="preview-line"><span class="preview-k">Eksempel:</span> ${this._preview(this._editTitle)}</div>
          </div>
          <div class="modal-field">
            <label class="field-label">BESKED</label>
            <textarea class="field-textarea" data-modal-field="message" rows="3" placeholder="Beskedtekst">${this._esc(this._editMessage)}</textarea>
            <div class="preview-line"><span class="preview-k">Eksempel:</span> ${this._preview(this._editMessage)}</div>
          </div>
          <div class="var-row">
            ${["{vaskehus}", "{time}", "{date}", "{duration}", "{machine}"].map(v => `<code class="var-tag">${v}</code>`).join("")}
          </div>
          <div class="modal-acts">
            <button class="ghost-btn" data-action="reset-notif">Nulstil</button>
            <div class="modal-acts-r">
              <button class="ghost-btn" data-action="close-modal">Annuller</button>
              <button class="act-btn" data-action="save-edit">Gem skabelon</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _htmlStats() {
    const fmt = (e) => {
      const start = e.start_time || "";
      const date  = start.split(" ")[0] || start.split("T")[0] || "–";
      const time  = (start.split(" ")[1] || start.split("T")[1] || "").slice(0, 5) || "–";
      const parts = date.split("-");
      return { dateStr: parts.length === 3 ? `${parts[2]}.${parts[1]}` : date, time, dur: e.duration ? e.duration + " min" : "–", user: e.created_by || "–", vaskehus: e.vaskehus || `Maskine ${e.machine}` };
    };

    const rows = this._historyLoading
      ? `<div class="loading-row"><span class="spin">↻</span> Henter historik…</div>`
      : this._history.length === 0
        ? `<div class="empty-row">Ingen afsluttede bookinger de seneste 30 dage</div>`
        : `<div class="hist-list">${this._history.map(e => {
            const f = fmt(e);
            return `<div class="hist-row">
              <div><div class="hist-vask">${f.vaskehus}</div><div class="hist-meta">${f.dateStr} kl. ${f.time} · ${f.dur}</div></div>
              <div class="hist-user">${f.user}</div>
            </div>`;
          }).join("")}</div>
          <div class="cleanup-row">
            <button class="ghost-btn" data-action="cleanup">Ryd gamle poster</button>
            ${this._cleanupResult ? `<span class="cleanup-msg">${this._cleanupResult}</span>` : ""}
          </div>`;

    return `
      <div class="section">
        <div class="section-label-row">
          <span class="section-label">AFSLUTTEDE BOOKINGER</span>
          <span class="sec-sub">Seneste 30 dage</span>
        </div>
        ${rows}
      </div>
    `;
  }

  _htmlAdmin() {
    return `
      <div class="section">
        <div class="section-label">DRIFTSBESKED</div>
        <p class="sec-desc">Vises øverst i booking-oversigten for alle brugere</p>
        <div class="field-blk">
          <input class="field-input" type="text" data-admin-field="info_message"
            value="${this._esc(this._admin.info_message || "")}" placeholder="Fx: Vaskemaskine 1 er ude af drift…" />
        </div>
      </div>
      <div class="section">
        <div class="section-label">BOOKING SPÆRRING</div>
        <p class="sec-desc">Spærr for nye bookinger midlertidigt</p>
        <div class="tog-label-row" style="margin-bottom:14px">
          <label class="tog-wrap">
            <input type="checkbox" data-admin-field="booking_locked" ${this._admin.booking_locked ? "checked" : ""} />
            <span class="tog-track"><span class="tog-thumb ${this._admin.booking_locked ? "thumb-on" : ""}"></span></span>
          </label>
          <span class="tog-text">${this._admin.booking_locked ? "Booking er spærret" : "Booking er åben"}</span>
        </div>
        <div class="field-blk">
          <span class="field-label">SPÆRRINGSBESKED</span>
          <input class="field-input" type="text" data-admin-field="lock_message"
            value="${this._esc(this._admin.lock_message || "")}" placeholder="Booking er midlertidigt spærret" />
        </div>
        <button class="act-btn" data-action="save-admin" ${this._adminSaving ? "disabled" : ""}>
          ${this._adminSaving ? '<span class="spin">↻</span> Gemmer…' : "Gem indstillinger"}
        </button>
      </div>
    `;
  }

  // ── Event binding ────────────────────────────────────────────────────────────

  _bindEvents(root) {
    root.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        this._tab = btn.dataset.tab;
        if (this._tab === "stats" && this._history.length === 0) this._loadHistory();
        else this._render();
      });
    });

    const refreshBtn = root.querySelector("[data-action='refresh']");
    if (refreshBtn) refreshBtn.addEventListener("click", () => this._loadAll());

    const clearErr = root.querySelector("[data-action='clear-error']");
    if (clearErr) clearErr.addEventListener("click", () => { this._error = null; this._render(); });

    root.querySelectorAll("[data-vhus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        this._vaskehus = btn.dataset.vhus;
        this._selectedSlot = "";
        await this._loadSlots();
        // Auto-select first available (not booked) slot
        const firstFree = this._slots.find(s => !s.booked);
        if (firstFree) this._selectedSlot = firstFree.start;
        this._render();
      });
    });

    const slotSel = root.querySelector("[data-field='slot']");
    if (slotSel) slotSel.addEventListener("change", e => { this._selectedSlot = e.target.value; });

    const dateIn = root.querySelector("[data-field='date']");
    if (dateIn) dateIn.addEventListener("change", async e => {
      this._selectedDate = e.target.value;
      this._selectedSlot = "";
      await this._loadSlots();
      this._render();
    });

    const bookBtn = root.querySelector("[data-action='book']");
    if (bookBtn) bookBtn.addEventListener("click", () => this._doBook());

    root.querySelectorAll("[data-cancel]").forEach(btn => {
      btn.addEventListener("click", () => {
        try { this._doCancel(JSON.parse(btn.dataset.cancel)); } catch (e) {}
      });
    });

    root.querySelectorAll("[data-device]").forEach(cb => {
      cb.addEventListener("change", () => {
        const svc = cb.dataset.device;
        this._devices = cb.checked ? [...this._devices, svc] : this._devices.filter(d => d !== svc);
        this._render();
      });
    });

    const saveDevBtn = root.querySelector("[data-action='save-devices']");
    if (saveDevBtn) saveDevBtn.addEventListener("click", () => this._doSaveDevices());

    root.querySelectorAll("[data-toggle-notif]").forEach(cb => {
      cb.addEventListener("change", () => this._doToggleNotification(cb.dataset.toggleNotif));
    });

    root.querySelectorAll("[data-edit-notif]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.editNotif;
        const n = this._notifications[id];
        if (!n) return;
        this._editingId = id;
        this._editTitle = n.title;
        this._editMessage = n.message;
        this._render();
      });
    });

    root.querySelectorAll("[data-test-notif]").forEach(btn => {
      btn.addEventListener("click", () => this._doTestNotification(btn.dataset.testNotif));
    });

    const modalBg = root.querySelector(".modal-bg");
    if (modalBg) {
      modalBg.addEventListener("click", e => { if (e.target === modalBg) this._closeModal(); });
      const stopEl = modalBg.querySelector("[data-stop-propagation]");
      if (stopEl) stopEl.addEventListener("click", e => e.stopPropagation());
    }

    root.querySelectorAll("[data-action='close-modal']").forEach(el => {
      el.addEventListener("click", () => this._closeModal());
    });

    const titleIn = root.querySelector("[data-modal-field='title']");
    if (titleIn) titleIn.addEventListener("input", e => { this._editTitle = e.target.value; this._render(); });

    const msgIn = root.querySelector("[data-modal-field='message']");
    if (msgIn) msgIn.addEventListener("input", e => { this._editMessage = e.target.value; this._render(); });

    const saveEditBtn = root.querySelector("[data-action='save-edit']");
    if (saveEditBtn) saveEditBtn.addEventListener("click", () => this._doSaveEdit());

    const resetBtn = root.querySelector("[data-action='reset-notif']");
    if (resetBtn) resetBtn.addEventListener("click", () => this._doResetNotification());

    const infoIn = root.querySelector("[data-admin-field='info_message']");
    if (infoIn) infoIn.addEventListener("input", e => { this._admin.info_message = e.target.value; });

    const lockMsg = root.querySelector("[data-admin-field='lock_message']");
    if (lockMsg) lockMsg.addEventListener("input", e => { this._admin.lock_message = e.target.value; });

    const lockCb = root.querySelector("[data-admin-field='booking_locked']");
    if (lockCb) lockCb.addEventListener("change", e => { this._admin.booking_locked = e.target.checked; this._render(); });

    const saveAdminBtn = root.querySelector("[data-action='save-admin']");
    if (saveAdminBtn) saveAdminBtn.addEventListener("click", () => this._doSaveAdmin());

    const cleanupBtn = root.querySelector("[data-action='cleanup']");
    if (cleanupBtn) cleanupBtn.addEventListener("click", () => this._doCleanupHistory());
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _css() {
    return `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .page {
        display: flex; flex-direction: column; min-height: 100%;
        background: #0d0d0d; color: #e8e8e8;
        font-family: 'DM Sans', 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 14px; line-height: 1.5;
      }

      .topbar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px 16px; flex-shrink: 0;
      }
      .topbar-left  { display: flex; align-items: center; gap: 14px; }
      .topbar-right { display: flex; gap: 8px; align-items: center; }

      .app-icon {
        width: 52px; height: 52px; border-radius: 16px;
        background: linear-gradient(135deg, #f0c040 0%, #c87800 100%);
        display: flex; align-items: center; justify-content: center;
        font-size: 26px; overflow: hidden; flex-shrink: 0;
        box-shadow: 0 0 20px rgba(240,192,64,0.3);
      }
      .app-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }

      .app-name { display: block; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #f0f0f0; line-height: 1.1; }
      .app-meta { display: block; font-size: 12px; color: #555; margin-top: 2px; }

      .refresh-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 16px; background: #1a1a1a; border: 1px solid #2e2e2e;
        border-radius: 20px; color: #777; font-size: 13px; cursor: pointer;
        font-family: inherit; transition: all 0.15s;
      }
      .refresh-btn:hover:not(:disabled) { border-color: #555; color: #ccc; }
      .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .tabs-row {
        display: flex; gap: 0; padding: 0 24px;
        border-bottom: 1px solid #1a1a1a; flex-shrink: 0;
      }
      .tab-btn {
        padding: 14px 18px; background: none; border: none;
        font-size: 14px; font-weight: 500; color: #444; cursor: pointer;
        font-family: inherit; border-bottom: 2px solid transparent;
        margin-bottom: -1px; transition: color 0.15s;
      }
      .tab-btn:hover { color: #999; }
      .tab-active { color: #f0f0f0 !important; border-bottom-color: #f0f0f0 !important; }

      .content { padding: 20px 24px; display: flex; flex-direction: column; gap: 0; flex: 1; }

      @media (min-width: 900px) {
        .content { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; align-items: start; }
        .content .error-strip { grid-column: 1 / -1; }
      }

      .section {
        background: #111; border: 1px solid #1e1e1e; border-radius: 12px;
        padding: 20px; margin-bottom: 16px;
      }
      .section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.9px; color: #333; margin-bottom: 14px; display: block; }
      .section-label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .cnt-badge { font-size: 12px; font-weight: 700; color: #555; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 20px; padding: 2px 9px; }
      .sec-sub  { font-size: 12px; color: #333; }
      .sec-desc { font-size: 12px; color: #444; margin-bottom: 14px; margin-top: -8px; }

      .error-strip {
        background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25);
        border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
        display: flex; align-items: center; justify-content: space-between; color: #fca5a5; font-size: 13px;
      }
      .error-strip button { background: none; border: none; color: #888; cursor: pointer; font-size: 14px; }
      .info-strip { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 7px; padding: 9px 12px; font-size: 13px; color: #93c5fd; margin-bottom: 14px; }
      .lock-strip { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 7px; padding: 9px 12px; font-size: 13px; color: #fcd34d; margin-bottom: 14px; }

      .vhus-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
      .vhus-btn {
        flex: 1; padding: 10px 12px; background: #1a1a1a; border: 1px solid #2a2a2a;
        border-radius: 8px; color: #555; font-size: 14px; font-weight: 500;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        gap: 8px; font-family: inherit; transition: all 0.15s;
      }
      .vhus-btn:hover:not(:disabled) { border-color: #444; color: #aaa; }
      .vhus-active { background: #1e1e1e !important; border-color: #e8e8e8 !important; color: #e8e8e8 !important; font-weight: 600 !important; }
      .vhus-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .field-blk { margin-bottom: 14px; }
      .field-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; color: #333; margin-bottom: 7px; }
      .field-input, .field-select, .field-textarea {
        width: 100%; padding: 10px 13px; background: #0d0d0d; border: 1px solid #1e1e1e;
        border-radius: 8px; color: #e8e8e8; font-size: 14px; font-family: inherit;
        appearance: none; -webkit-appearance: none; transition: border-color 0.15s;
      }
      .field-input:focus, .field-select:focus, .field-textarea:focus { outline: none; border-color: #444; }
      .field-textarea { resize: vertical; }
      .sel-wrap { position: relative; }
      .sel-arr { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #555; pointer-events: none; }
      /* Booked slot hint strip below select */
      .slot-hint { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
      .slot-chip {
        font-size: 11px; font-weight: 600; letter-spacing: 0.3px;
        padding: 3px 9px; border-radius: 20px; border: 1px solid;
        white-space: nowrap;
      }
      .slot-chip.free   { background: rgba(74,222,128,0.08); border-color: rgba(74,222,128,0.3); color: #4ade80; }
      .slot-chip.booked { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.25); color: #f87171; }

      .book-btn {
        width: 100%; padding: 13px; border: none; border-radius: 8px;
        font-size: 15px; font-weight: 600; font-family: inherit;
        cursor: pointer; display: flex; align-items: center;
        justify-content: center; gap: 8px; transition: all 0.2s; margin-top: 4px;
      }
      .btn-ready  { background: #1e1e1e; border: 1px solid #444; color: #e8e8e8; }
      .btn-ready:hover:not(:disabled) { background: #e8e8e8; color: #0d0d0d; border-color: #e8e8e8; }
      .btn-full, .btn-locked { background: #1a1a1a; border: 1px solid #2a2a2a; color: #444; cursor: not-allowed; }
      .book-btn:disabled { opacity: 0.6; }

      .empty-row { font-size: 13px; color: #333; padding: 10px 0 4px; text-align: center; }
      .brow { display: flex; align-items: center; padding: 11px 0; border-bottom: 1px solid #1a1a1a; transition: opacity 0.15s; }
      .brow:last-child { border-bottom: none; padding-bottom: 0; }
      .brow:hover { opacity: 0.8; }
      .brow-accent { width: 3px; height: 34px; border-radius: 2px; margin-right: 14px; flex-shrink: 0; }
      .ba-klat { background: #666; }
      .ba-stor { background: #999; }
      .brow-info { flex: 1; min-width: 0; }
      .brow-name { display: block; font-size: 14px; font-weight: 600; color: #e8e8e8; }
      .brow-meta { display: block; font-size: 12px; color: #444; margin-top: 2px; }
      .brow-via  { color: #333; }
      .del-btn {
        padding: 6px 11px; background: none; border: 1px solid #2a2a2a;
        border-radius: 6px; color: #333; font-size: 12px; cursor: pointer;
        transition: all 0.15s; font-family: inherit; flex-shrink: 0;
      }
      .del-btn:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; background: rgba(220,38,38,0.07); }
      .del-btn:disabled { opacity: 0.3; cursor: not-allowed; }

      .spin { display: inline-block; animation: sp 0.7s linear infinite; }
      @keyframes sp { to { transform: rotate(360deg); } }
      .loading-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #444; padding: 8px 0; }
      .loading-wrap { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 60px 24px; color: #444; font-size: 14px; }

      .dev-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
      .dev-chip { display: flex; align-items: center; gap: 8px; padding: 7px 14px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 100px; cursor: pointer; font-size: 13px; font-weight: 500; color: #444; transition: all 0.15s; user-select: none; }
      .dev-chip:hover { border-color: #3a3a3a; color: #aaa; }
      .dev-on { border-color: #888 !important; color: #e8e8e8 !important; }
      .dev-dot { width: 7px; height: 7px; border-radius: 50%; background: #333; flex-shrink: 0; }
      .dot-on  { background: #e8e8e8; }

      .notif-list { display: flex; flex-direction: column; }
      .notif-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid #1a1a1a; flex-wrap: wrap; opacity: 0.4; transition: opacity 0.15s; }
      .notif-row:last-child { border-bottom: none; padding-bottom: 0; }
      .notif-on { opacity: 1; }
      .notif-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
      .notif-texts { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .notif-name { font-size: 14px; font-weight: 600; color: #e8e8e8; }
      .notif-msg  { font-size: 12px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .notif-acts { display: flex; gap: 6px; flex-shrink: 0; }

      .tog-wrap { display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; }
      .tog-wrap input { display: none; }
      .tog-track { width: 34px; height: 19px; background: #1e1e1e; border-radius: 100px; position: relative; border: 1px solid #2e2e2e; display: block; }
      .tog-thumb { position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #333; transition: all 0.2s; }
      .thumb-on { background: #e8e8e8 !important; transform: translateX(15px) !important; }
      .tog-label-row { display: flex; align-items: center; gap: 12px; }
      .tog-text { font-size: 14px; font-weight: 500; color: #aaa; }

      .act-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; background: #e8e8e8; color: #0d0d0d; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.15s; margin-top: 8px; }
      .act-btn:hover:not(:disabled) { background: #fff; }
      .act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .ghost-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: #1a1a1a; border: 1px solid #2e2e2e; border-radius: 7px; color: #555; font-size: 13px; font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
      .ghost-btn:hover:not(:disabled) { border-color: #444; color: #ccc; }
      .ghost-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .ghost-green { color: #4ade80; border-color: rgba(74,222,128,0.2); }
      .ghost-green:hover:not(:disabled) { background: rgba(74,222,128,0.06); border-color: #4ade80; }

      .hist-list { display: flex; flex-direction: column; margin-bottom: 16px; }
      .hist-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px; }
      .hist-row:last-child { border-bottom: none; }
      .hist-vask { font-weight: 600; color: #e8e8e8; margin-bottom: 2px; }
      .hist-meta { color: #333; font-size: 12px; }
      .hist-user { color: #333; font-size: 12px; white-space: nowrap; }
      .cleanup-row { display: flex; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid #1a1a1a; }
      .cleanup-msg { font-size: 13px; color: #555; }

      .modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; backdrop-filter: blur(8px); }
      .modal-box { background: #111; border: 1px solid #2a2a2a; border-radius: 16px; padding: 28px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.7); }
      .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
      .modal-title { font-size: 17px; font-weight: 700; color: #e8e8e8; }
      .modal-close { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 50%; width: 30px; height: 30px; color: #555; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }
      .modal-close:hover { border-color: #dc2626; color: #dc2626; }
      .modal-field { margin-bottom: 18px; }
      .preview-line { margin-top: 7px; font-size: 12px; color: #333; padding: 8px 12px; background: #0d0d0d; border-radius: 7px; border: 1px solid #1e1e1e; }
      .preview-k { color: #444; font-weight: 600; margin-right: 6px; }
      .var-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 22px; }
      .var-tag { font-family: 'Fira Code', monospace; font-size: 11px; padding: 3px 9px; background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 5px; color: #666; font-weight: 500; }
      .modal-acts { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #1e1e1e; padding-top: 18px; }
      .modal-acts-r { display: flex; gap: 8px; }

      @media (max-width: 640px) {
        .topbar { padding: 16px 16px 12px; }
        .tabs-row { padding: 0 16px; }
        .content { padding: 16px; }
        .tab-btn { padding: 12px 12px; font-size: 13px; }
        .vhus-toggle { flex-direction: column; }
        .notif-row { flex-direction: column; align-items: flex-start; }
        .notif-acts { align-self: flex-end; }
        .modal-acts { flex-direction: column-reverse; }
        .modal-acts-r { width: 100%; justify-content: flex-end; }
      }
    `;
  }
}

if (!customElements.get("mielelogic-panel")) {
  customElements.define("mielelogic-panel", MieleLogicPanel);
}
