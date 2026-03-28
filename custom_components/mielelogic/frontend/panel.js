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

    this._vaskehus      = "Klatvask";
    this._slots         = [];
    this._selectedSlot  = "";
    this._selectedDate  = new Date().toISOString().split("T")[0];
    this._bookings      = [];
    this._status        = {};

    this._devices           = [];
    this._availableDevices  = [];
    this._notifications     = {};

    this._editingId     = null;
    this._editTitle     = "";
    this._editMessage   = "";

    this._admin         = { booking_locked: false, lock_message: "Booking er midlertidigt spærret", info_message: "" };
    this._adminSaving   = false;

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

  async _init() {
    await this._loadAll();
    await this._loadAdmin();
  }

  async _loadAll() {
    if (!this._hass) return;
    try {
      await Promise.all([this._loadSlots(), this._loadBookings(), this._loadStatus(), this._loadNotifications()]);
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
    try { const r = await this._hass.callWS({ type: "mielelogic/get_bookings" }); this._bookings = r.bookings || []; } catch (e) {}
  }

  async _loadStatus() {
    try { const r = await this._hass.callWS({ type: "mielelogic/get_status" }); this._status = r || {}; } catch (e) {}
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
    try { const r = await this._hass.callWS({ type: "mielelogic/get_admin" }); this._admin = r || this._admin; this._render(); } catch (e) {}
  }

  async _loadHistory() {
    this._historyLoading = true; this._cleanupResult = ""; this._render();
    try { const r = await this._hass.callWS({ type: "mielelogic/get_history" }); this._history = r.history || []; } catch (e) { this._history = []; }
    this._historyLoading = false; this._render();
  }

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
      await this._loadNotifications(); this._render();
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
      this._notify("Skabelon gemt!"); this._closeModal();
    } catch (e) { this._notify("Kunne ikke gemme"); }
  }

  async _doResetNotification() {
    if (!this._editingId || !confirm("Nulstil til standard skabelon?")) return;
    try {
      const r = await this._hass.callWS({ type: "mielelogic/reset_notification", notification_id: this._editingId });
      this._notifications[this._editingId] = r.config;
      this._editTitle = r.config.title; this._editMessage = r.config.message;
      this._notify("Nulstillet til standard!"); this._render();
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

  _fmtDate(ds) {
    return new Date(ds).toLocaleString("da-DK", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  _fmtCurrency(a) { return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(a); }

  _preview(tpl) {
    const ex = { "{vaskehus}": "Klatvask", "{time}": "14:30", "{date}": "28-05-2026", "{duration}": "120 minutter", "{machine}": "Maskine 1" };
    let r = tpl;
    for (const [k, v] of Object.entries(ex)) r = r.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v);
    return r;
  }

  _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  _svgKlatvask() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="12" cy="13" r="4"/>
      <circle cx="12" cy="13" r="1.8" stroke-width="1"/>
      <line x1="7" y1="8" x2="9" y2="8" stroke-width="1"/>
      <circle cx="6" cy="8" r="0.8" fill="currentColor" stroke="none"/>
    </svg>`;
  }

  _svgStorvask() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2.5"/><circle cx="12" cy="13" r="5"/>
      <circle cx="12" cy="13" r="2.2" stroke-width="1"/>
      <line x1="6" y1="8" x2="9" y2="8" stroke-width="1"/>
      <circle cx="5" cy="8" r="0.8" fill="currentColor" stroke="none"/>
      <path d="M5 14 Q6 11 8 12" stroke-width="1" fill="none"/>
    </svg>`;
  }

  _render() {
    const root = this.shadowRoot;
    let page = root.querySelector(".page");
    if (!page) { page = document.createElement("div"); page.className = "page"; root.appendChild(page); }
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
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAA0CAIAAABKGoy8AAAB" style="width:52px;height:52px;border-radius:16px;object-fit:cover" alt="" />
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
      { id: "booking", label: "Oversigt" }, { id: "notifications", label: "Notifikationer" },
      { id: "stats", label: "Historik" }, { id: "admin", label: "Konfiguration" },
    ];
    return `<div class="tabs-row">${tabs.map(t => `<button class="tab-btn ${this._tab === t.id ? "tab-active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  }

  _htmlBooking() {
    const s = this._admin, locked = s.booking_locked;
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
      : locked ? `<button class="book-btn btn-locked" disabled>🔒 ${s.lock_message || "Booking spærret"}</button>`
      : !canBook ? `<button class="book-btn btn-full" disabled>Max bookinger nået</button>`
      : `<button class="book-btn btn-ready" data-action="book">Book nu</button>`;
    const bookingsHtml = this._bookings.length === 0
      ? `<div class="empty-row">Ingen aktive bookinger</div>`
      : this._bookings.map(b => this._htmlBookingRow(b)).join("");
    return `
      <div class="section">
        ${infoMsg}${lockMsg}
        <div class="section-label">NY BOOKING</div>
        <div class="vhus-toggle">
          <button class="vhus-btn ${this._vaskehus === "Klatvask" ? "vhus-active" : ""}" data-vhus="Klatvask">${this._svgKlatvask()} Klatvask</button>
          <button class="vhus-btn ${this._vaskehus === "Storvask" ? "vhus-active" : ""}" data-vhus="Storvask">${this._svgStorvask()} Storvask</button>
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
      </div>`;
  }

  _htmlBookingRow(b) {
    const dur = (() => {
      const d = b.Duration ?? b.duration;
      if (d != null && !isNaN(+d)) return +d + " min";
      try { const m = Math.round((new Date(b.End) - new Date(b.Start)) / 60000); if (m > 0) return m + " min"; } catch (e) {}
      return "";
    })();
    return `<div class="brow">
      <div class="brow-accent ${b.vaskehus === "Storvask" ? "ba-stor" : "ba-klat"}"></div>
      <div class="brow-info">
        <span class="brow-name">${b.vaskehus || "Booking"}</span>
        <span class="brow-meta">${this._fmtDate(b.Start)}${dur ? ` · ${dur}` : ""}${b.created_by ? ` · <span class="brow-via">${b.created_by}</span>` : ""}</span>
      </div>
      <button class="del-btn" data-cancel='${JSON.stringify({ MachineNumber: b.MachineNumber, Start: b.Start, End: b.End, vaskehus: b.vaskehus })}' ${this._loading ? "disabled" : ""} title="Slet booking">✕</button>
    </div>`;
  }

  _htmlNotifications() {
    const devHtml = this._availableDevices.length === 0
      ? `<div class="empty-row">Ingen mobile apps fundet — installer HA Companion</div>`
      : `<div class="dev-list">${this._availableDevices.map(d => `
          <label class="dev-chip ${this._devices.includes(d.service) ? "dev-on" : ""}">
            <span class="dev-dot ${this._devices.includes(d.service) ? "dot-on" : ""}"></span>
            <span>${d.name}</span>
            <input type="checkbox" data-device="${d.service}" ${this._devices.includes(d.service) ? "checked" : ""} style="display:none" />
          </label>`).join("")}</div>
        <button class="act-btn" data-action="save-devices">Gem enheder</button>`;
    const notifHtml = Object.keys(this._notifications).length === 0
      ? `<div class="empty-row">Ingen notifikationer konfigureret</div>`
      : `<div class="notif-list">${Object.entries(this._notifications).map(([id, n]) => `
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
          </div>`).join("")}</div>`;
    return `
      <div class="section">
        <div class="section-label">MOBILE ENHEDER</div>
        <p class="sec-desc">Vælg hvilke enheder der modtager notifikationer</p>${devHtml}
      </div>
      <div class="section">
        <div class="section-label">NOTIFIKATIONER</div>
        <p class="sec-desc">Aktiver og tilpas beskedskabeloner</p>${notifHtml}
      </div>`;
  }

  _htmlModal() {
    const n = this._notifications[this._editingId]; if (!n) return "";
    return `<div class="modal-bg" data-action="close-modal">
      <div class="modal-box" data-stop-propagation>
        <div class="modal-head"><span class="modal-title">Rediger skabelon</span><button class="modal-close" data-action="close-modal">✕</button></div>
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
        <div class="var-row">${["{vaskehus}","{time}","{date}","{duration}","{machine}"].map(v=>`<code class="var-tag">${v}</code>`).join("")}</div>
        <div class="modal-acts">
          <button class="ghost-btn" data-action="reset-notif">Nulstil</button>
          <div class="modal-acts-r">
            <button class="ghost-btn" data-action="close-modal">Annuller</button>
            <button class="act-btn" data-action="save-edit">Gem skabelon</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  _htmlStats() {
    const fmt = e => {
      const start = e.start_time || "", date = start.split(" ")[0] || start.split("T")[0] || "–";
      const time = (start.split(" ")[1] || start.split("T")[1] || "").slice(0,5) || "–";
      const parts = date.split("-");
      return { dateStr: parts.length===3 ? `${parts[2]}.${parts[1]}` : date, time, dur: e.duration ? e.duration+" min" : "–", user: e.created_by||"–", vaskehus: e.vaskehus||`Maskine ${e.machine}` };
    };
