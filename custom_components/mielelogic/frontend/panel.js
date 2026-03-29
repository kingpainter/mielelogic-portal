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

  _bindEvents(page) {
    // Tab switching
    page.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        this._tab = btn.dataset.tab;
        if (this._tab === "stats" && this._history.length === 0) this._loadHistory();
        this._render();
      });
    });
    // Vaskehus toggle
    page.querySelectorAll("[data-vhus]").forEach(btn => {
      btn.addEventListener("click", () => {
        this._vaskehus = btn.dataset.vhus;
        this._selectedSlot = "";
        this._loadSlots().then(() => this._render());
      });
    });
    // Field inputs
    const slotSel = page.querySelector("[data-field='slot']");
    if (slotSel) slotSel.addEventListener("change", e => { this._selectedSlot = e.target.value; });
    const dateIn = page.querySelector("[data-field='date']");
    if (dateIn) dateIn.addEventListener("change", e => {
      this._selectedDate = e.target.value;
      this._selectedSlot = "";
      this._loadSlots().then(() => this._render());
    });
    // Generic data-action buttons
    page.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", e => {
        if (el.dataset.stopPropagation !== undefined) { e.stopPropagation(); return; }
        const action = el.dataset.action;
        if (action === "book")             this._doBook();
        else if (action === "refresh")     this._loadAll();
        else if (action === "clear-error") { this._error = null; this._render(); }
        else if (action === "save-devices") this._doSaveDevices();
        else if (action === "save-edit")   this._doSaveEdit();
        else if (action === "reset-notif") this._doResetNotification();
        else if (action === "close-modal") { e.stopPropagation(); this._closeModal(); }
        else if (action === "save-admin")  this._doSaveAdmin();
        else if (action === "cleanup-history") this._doCleanupHistory();
      });
    });
    // Modal background click to close
    const modalBg = page.querySelector(".modal-bg");
    if (modalBg) modalBg.addEventListener("click", e => {
      if (e.target === modalBg) this._closeModal();
    });
    const modalBox = page.querySelector(".modal-box");
    if (modalBox) modalBox.addEventListener("click", e => e.stopPropagation());
    // Delete (cancel) booking
    page.querySelectorAll("[data-cancel]").forEach(btn => {
      btn.addEventListener("click", () => {
        try { this._doCancel(JSON.parse(btn.dataset.cancel)); } catch (e) {}
      });
    });
    // Device checkboxes
    page.querySelectorAll("[data-device]").forEach(cb => {
      cb.addEventListener("change", () => {
        const svc = cb.dataset.device;
        if (cb.checked) { if (!this._devices.includes(svc)) this._devices = [...this._devices, svc]; }
        else { this._devices = this._devices.filter(d => d !== svc); }
        cb.closest("label")?.classList.toggle("dev-on", cb.checked);
      });
    });
    // Notification toggles
    page.querySelectorAll("[data-toggle-notif]").forEach(cb => {
      cb.addEventListener("change", () => this._doToggleNotification(cb.dataset.toggleNotif));
    });
    // Edit notification
    page.querySelectorAll("[data-edit-notif]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.editNotif;
        const n  = this._notifications[id]; if (!n) return;
        this._editingId   = id;
        this._editTitle   = n.title;
        this._editMessage = n.message;
        this._render();
      });
    });
    // Test notification
    page.querySelectorAll("[data-test-notif]").forEach(btn => {
      btn.addEventListener("click", () => this._doTestNotification(btn.dataset.testNotif));
    });
    // Modal field live editing
    const titleIn = page.querySelector("[data-modal-field='title']");
    if (titleIn) titleIn.addEventListener("input", e => { this._editTitle = e.target.value; });
    const msgTA = page.querySelector("[data-modal-field='message']");
    if (msgTA) msgTA.addEventListener("input", e => { this._editMessage = e.target.value; });
    // Admin textareas/inputs
    page.querySelectorAll("[data-admin]").forEach(el => {
      el.addEventListener("input", e => { this._admin = { ...this._admin, [el.dataset.admin]: e.target.value }; });
    });
    page.querySelectorAll("[data-admin-check]").forEach(cb => {
      cb.addEventListener("change", () => { this._admin = { ...this._admin, [cb.dataset.adminCheck]: cb.checked }; this._render(); });
    });
  }

  _htmlStats() {
    const fmt = e => {
      const start = e.start_time || "", date = start.split(" ")[0] || start.split("T")[0] || "–";
      const time = (start.split(" ")[1] || start.split("T")[1] || "").slice(0,5) || "–";
      const parts = date.split("-");
      return { dateStr: parts.length===3 ? `${parts[2]}.${parts[1]}` : date, time, dur: e.duration ? e.duration+" min" : "–", user: e.created_by||"–", vaskehus: e.vaskehus||`Maskine ${e.machine}` };
    };
    const items = this._historyLoading
      ? `<div class="stats-loading">⏳ Henter historik…</div>`
      : this._history.length === 0
      ? `<div class="stats-empty">📭 Ingen afsluttede bookinger de seneste 30 dage</div>`
      : `<div class="stats-count">${this._history.length} booking${this._history.length !== 1 ? "er" : ""} fundet</div>
         <div class="history-list">${this._history.map(e => {
           const f = fmt(e);
           return `<div class="history-item">
             <div class="history-left">
               <span class="history-vaskehus">${f.vaskehus}</span>
               <span class="history-meta">${f.dateStr} · ${f.time} · ${f.dur}</span>
             </div>
             <div class="history-user">👤 ${f.user}</div>
           </div>`;
         }).join("")}</div>`;
    return `
      <div class="stats-tab">
        <h2>📊 Statistik</h2>
        <p class="stats-desc">Afsluttede bookinger de seneste 30 dage</p>
        ${items}
        <div class="cleanup-section">
          <button class="cleanup-btn" data-action="cleanup-history">🧹 Ryd metadata ældre end 30 dage</button>
          ${this._cleanupResult ? `<p class="cleanup-result">${this._cleanupResult}</p>` : ""}
        </div>
      </div>`;
  }

  _htmlAdmin() {
    const a = this._admin;
    return `
      <div class="admin-tab">
        <h2>⚙️ Admin</h2>
        <section class="admin-section">
          <h3>📢 Driftsbesked</h3>
          <p class="admin-desc">Vises øverst i booking kortet til alle brugere. Efterlad tom for ingen besked.</p>
          <textarea class="admin-textarea" data-admin="info_message" placeholder="f.eks. Vaskehuset rengøres fredag d. 3/3 kl. 10-12">${this._esc(a.info_message || "")}</textarea>
        </section>
        <section class="admin-section">
          <h3>🔒 Booking spærring</h3>
          <p class="admin-desc">Spærrer for nye bookinger i booking kortet. Eksisterende bookinger påvirkes ikke.</p>
          <label class="admin-toggle">
            <input type="checkbox" data-admin-check="booking_locked" ${a.booking_locked ? "checked" : ""} />
            <span class="toggle-slider"></span>
            <span class="toggle-label">${a.booking_locked ? "🔒 Booking spærret" : "🔓 Booking åben"}</span>
          </label>
          ${a.booking_locked ? `<input type="text" class="admin-input" data-admin="lock_message" placeholder="Besked til brugerne..." value="${this._esc(a.lock_message || "")}" />` : ""}
        </section>
        <button class="admin-save-btn${this._adminSaving ? " saving" : ""}" data-action="save-admin" ${this._adminSaving ? "disabled" : ""}>
          ${this._adminSaving ? "💾 Gemmer…" : "💾 Gem indstillinger"}
        </button>
      </div>`;
  }

  // ── CSS ──────────────────────────────────────────────────────────────────

  _css() {
    return `
      :host, * { box-sizing: border-box; }
      :host {
        display: block; width: 100%; padding: 16px; max-width: 900px;
        margin: 0 auto; font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
        color: var(--primary-text-color, #212121);
      }
      .panel {
        background: var(--card-background-color, #1e1e1e);
        border-radius: 12px; padding: 24px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .header { margin-bottom: 8px; }
      .header h1 { margin: 0 0 4px; font-size: 24px; font-weight: 600; }
      .subtitle { margin: 0 0 20px; font-size: 13px; color: var(--secondary-text-color); }
      .error-banner {
        background: #ffebee; color: #c62828; padding: 10px 14px;
        border-radius: 8px; margin-bottom: 14px; border-left: 4px solid #c62828; font-size: 13px;
      }
      /* Tabs */
      .tabs {
        display: flex; gap: 4px; margin-bottom: 24px;
        border-bottom: 2px solid var(--divider-color, rgba(255,255,255,0.12));
      }
      .tab-btn {
        background: none; border: none; padding: 10px 16px; font-size: 14px; font-weight: 500;
        color: var(--secondary-text-color); cursor: pointer;
        border-bottom: 3px solid transparent; margin-bottom: -2px;
        font-family: inherit; transition: color 0.2s, border-color 0.2s;
      }
      .tab-btn:hover { color: var(--primary-color, #03a9f4); }
      .tab-btn.active { color: var(--primary-color, #03a9f4); border-bottom-color: var(--primary-color, #03a9f4); }
      /* Booking tab */
      .booking-tab { display: flex; flex-direction: column; gap: 16px; }
      .form-block {
        background: var(--primary-background-color, rgba(255,255,255,0.05));
        border-radius: 10px; padding: 14px;
      }
      .field-group { margin-bottom: 12px; }
      .field-label {
        display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.6px;
        text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 5px;
      }
      .field-select, .field-input {
        width: 100%; padding: 10px 14px; border-radius: 8px; font-size: 14px;
        background: var(--card-background-color, #2a2a2a);
        border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        color: var(--primary-text-color); appearance: none; font-family: inherit; cursor: pointer;
      }
      .field-select:disabled, .field-input:disabled { opacity: 0.5; cursor: not-allowed; }
      .book-btn {
        width: 100%; padding: 13px; border: none; border-radius: 8px; font-size: 15px;
        font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s;
      }
      .book-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .book-btn.open  { background: linear-gradient(135deg, #03a9f4, #0288d1); color: #fff; }
      .book-btn.full  { background: #616161; color: #bdbdbd; }
      .book-btn.closed-btn { background: #424242; color: #bdbdbd; }
      .bookings-block {
        background: var(--primary-background-color, rgba(255,255,255,0.05));
        border-radius: 10px; padding: 10px 14px;
      }
      .section-title {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 14px; font-weight: 600; margin-bottom: 10px;
      }
      .booking-badge {
        background: var(--divider-color, rgba(255,255,255,0.12));
        color: var(--secondary-text-color); font-size: 11px; font-weight: 700;
        padding: 2px 8px; border-radius: 10px;
      }
      .booking-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; border-radius: 8px; margin-bottom: 6px;
        background: var(--card-background-color, rgba(255,255,255,0.04));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.08));
      }
      .booking-row:last-child { margin-bottom: 0; }
      .booking-name { font-size: 14px; font-weight: 600; }
      .booking-meta { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
      .del-btn {
        background: none; border: 1px solid var(--divider-color, rgba(255,255,255,0.2));
        border-radius: 6px; padding: 5px 9px; cursor: pointer; font-size: 14px;
        color: var(--secondary-text-color); font-family: inherit; transition: all 0.15s;
      }
      .del-btn:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; }
      .del-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .empty-state { text-align: center; color: var(--secondary-text-color); padding: 20px; font-size: 13px; }
      /* Info banner */
      .info-banner {
        background: rgba(255,152,0,0.1); color: #ff9800; padding: 10px 14px;
        border-radius: 8px; margin-bottom: 14px; border-left: 4px solid #ff9800; font-size: 13px;
      }
      /* Toast */
      .toast {
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;
        z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); pointer-events: none;
        animation: fadeIn 0.2s ease;
      }
      .toast-success { background: #4caf50; color: #fff; }
      .toast-error   { background: #f44336; color: #fff; }
      @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      /* Spinner */
      .spin { display: inline-block; animation: sp 0.7s linear infinite; }
      @keyframes sp { to { transform: rotate(360deg); } }
      /* Notifications tab */
      .notif-tab { display: flex; flex-direction: column; gap: 20px; }
      .section { background: var(--card-background-color, rgba(255,255,255,0.04)); border-radius: 10px; padding: 16px; }
      .section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 6px; }
      .sec-desc { font-size: 12px; color: var(--secondary-text-color); margin: 0 0 12px; }
      .device-list, .notif-list { display: flex; flex-direction: column; gap: 8px; }
      .device-row, .notif-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; border-radius: 8px;
        background: var(--primary-background-color, rgba(255,255,255,0.04));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.08));
      }
      .device-name, .notif-name { font-size: 14px; font-weight: 500; }
      .notif-msg { font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
      .notif-left { display: flex; align-items: center; gap: 12px; }
      .notif-texts { display: flex; flex-direction: column; }
      .notif-acts { display: flex; gap: 6px; }
      .ghost-btn {
        background: none; border: 1px solid var(--divider-color, rgba(255,255,255,0.2));
        border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 13px;
        color: var(--secondary-text-color); font-family: inherit; transition: all 0.15s;
      }
      .ghost-btn:hover:not(:disabled) { border-color: #03a9f4; color: #03a9f4; }
      .ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .ghost-green:hover:not(:disabled) { border-color: #4caf50; color: #4caf50; }
      .no-devices { font-size: 13px; color: var(--secondary-text-color); text-align: center; padding: 12px; }
      /* Toggle */
      .tog-wrap { display: flex; align-items: center; cursor: pointer; }
      .tog-wrap input { display: none; }
      .tog-track {
        width: 36px; height: 20px; background: var(--divider-color, #555);
        border-radius: 10px; position: relative; transition: background 0.2s; flex-shrink: 0;
      }
      .tog-thumb {
        position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
        background: #fff; border-radius: 50%; transition: left 0.2s;
      }
      .tog-wrap input:checked ~ .tog-track { background: #03a9f4; }
      .tog-thumb.thumb-on { left: 18px; }
      /* Modal */
      .modal-bg {
        position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .modal-box {
        background: var(--card-background-color, #2a2a2a);
        border-radius: 12px; padding: 24px; max-width: 480px; width: 100%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
      .modal-title { font-size: 16px; font-weight: 700; }
      .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--secondary-text-color); padding: 4px; font-family: inherit; }
      .modal-field { margin-bottom: 16px; }
      .field-label-sm { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 5px; }
      .field-input {
        width: 100%; padding: 10px 12px; border-radius: 8px; font-size: 14px;
        background: var(--primary-background-color, rgba(255,255,255,0.05));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.15));
        color: var(--primary-text-color); font-family: inherit;
      }
      .field-input:focus { outline: none; border-color: #03a9f4; }
      .field-textarea {
        width: 100%; padding: 10px 12px; border-radius: 8px; font-size: 14px;
        background: var(--primary-background-color, rgba(255,255,255,0.05));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.15));
        color: var(--primary-text-color); font-family: inherit; resize: vertical; min-height: 80px;
      }
      .field-textarea:focus { outline: none; border-color: #03a9f4; }
      .preview-line { font-size: 12px; color: var(--secondary-text-color); margin-top: 5px; }
      .preview-k { font-weight: 600; margin-right: 4px; }
      .var-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0; }
      .var-tag { background: rgba(3,169,244,0.1); color: #03a9f4; border-radius: 4px; padding: 2px 6px; font-size: 12px; font-family: monospace; }
      .modal-acts { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 16px; }
      .modal-acts-r { display: flex; gap: 8px; }
      .act-btn {
        background: linear-gradient(135deg, #03a9f4, #0288d1); color: #fff; border: none;
        border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 14px;
        font-weight: 600; font-family: inherit;
      }
      /* Stats tab */
      .stats-tab { padding: 0; max-width: 600px; }
      .stats-tab h2 { margin: 0 0 4px; font-size: 18px; }
      .stats-desc { font-size: 12px; color: var(--secondary-text-color); margin: 0 0 16px; }
      .stats-loading, .stats-empty { text-align: center; padding: 32px; color: var(--secondary-text-color); font-size: 14px; }
      .stats-count { font-size: 12px; color: var(--secondary-text-color); margin-bottom: 8px; }
      .history-list { background: var(--card-background-color, #1e1e1e); border-radius: 10px; overflow: hidden; }
      .history-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px; border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.08));
      }
      .history-item:last-child { border-bottom: none; }
      .history-left { display: flex; flex-direction: column; gap: 2px; }
      .history-vaskehus { font-size: 14px; font-weight: 600; }
      .history-meta { font-size: 12px; color: var(--secondary-text-color); }
      .history-user { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; }
      .cleanup-section { margin-top: 20px; }
      .cleanup-btn {
        width: 100%; padding: 11px; background: var(--card-background-color, #1e1e1e);
        border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        color: var(--primary-text-color); border-radius: 8px; font-size: 14px; cursor: pointer; font-family: inherit;
      }
      .cleanup-btn:hover { background: rgba(255,255,255,0.05); }
      .cleanup-result { font-size: 13px; text-align: center; margin: 8px 0 0; }
      /* Admin tab */
      .admin-tab { padding: 0; max-width: 600px; }
      .admin-tab h2 { margin: 0 0 20px; font-size: 18px; }
      .admin-section { margin-bottom: 24px; background: var(--card-background-color, #1e1e1e); border-radius: 10px; padding: 16px; }
      .admin-section h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
      .admin-desc { font-size: 12px; color: var(--secondary-text-color); margin: 0 0 12px; }
      .admin-textarea {
        width: 100%; min-height: 70px; padding: 10px; box-sizing: border-box;
        background: var(--primary-background-color, rgba(255,255,255,0.05));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        border-radius: 8px; color: var(--primary-text-color); font-family: inherit; font-size: 13px; resize: vertical;
      }
      .admin-input {
        width: 100%; padding: 10px; margin-top: 10px; box-sizing: border-box;
        background: var(--primary-background-color, rgba(255,255,255,0.05));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        border-radius: 8px; color: var(--primary-text-color); font-family: inherit; font-size: 13px;
      }
      .admin-toggle { display: flex; align-items: center; gap: 12px; cursor: pointer; }
      .admin-toggle input { display: none; }
      .toggle-slider {
        width: 44px; height: 24px; background: var(--divider-color, #555);
        border-radius: 12px; position: relative; transition: background 0.2s; flex-shrink: 0;
      }
      .toggle-slider::after {
        content: ""; position: absolute; top: 2px; left: 2px;
        width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: left 0.2s;
      }
      .admin-toggle input:checked ~ .toggle-slider { background: #e53935; }
      .admin-toggle input:checked ~ .toggle-slider::after { left: 22px; }
      .toggle-label { font-size: 14px; font-weight: 500; }
      .admin-save-btn {
        width: 100%; padding: 13px; background: linear-gradient(135deg, #03a9f4, #0288d1);
        color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
        cursor: pointer; font-family: inherit;
      }
      .admin-save-btn.saving { opacity: 0.6; cursor: not-allowed; }
    `;
  }
}

customElements.define("mielelogic-panel", MieleLogicPanel);
