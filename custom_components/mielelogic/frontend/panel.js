// MieleLogic Panel - Main UI Component
// VERSION = "1.9.1"

import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit@2/index.js?module";

class MieleLogicPanel extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      narrow: { type: Boolean },
      vaskehus: { type: String },
      slots: { type: Array },
      selectedSlot: { type: String },
      selectedDate: { type: String },
      bookings: { type: Array },
      status: { type: Object },
      loading: { type: Boolean },
      error: { type: String },
      currentTab: { type: String },
      adminSettings: { type: Object },
      adminSaving: { type: Boolean },
      history: { type: Array },
      historyLoading: { type: Boolean },
      cleanupResult: { type: String },
      devices: { type: Array },
      availableDevices: { type: Array },
      notifications: { type: Object },
      editingNotificationId: { type: String },
      editTitle: { type: String },
      editMessage: { type: String },
    };
  }

  constructor() {
    super();
    this.vaskehus = "Klatvask";
    this.slots = [];
    this.selectedSlot = "";
    this.selectedDate = new Date().toISOString().split("T")[0];
    this.bookings = [];
    this.status = {};
    this.loading = false;
    this.error = null;
    this.currentTab = "booking";
    this.adminSettings = { booking_locked: false, lock_message: "Booking er midlertidigt spærret", info_message: "" };
    this.adminSaving = false;
    this.history = [];
    this.historyLoading = false;
    this.cleanupResult = "";
    this.devices = [];
    this.availableDevices = [];
    this.notifications = {};
    this.editingNotificationId = null;
    this.editTitle = "";
    this.editMessage = "";
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
    this.loadAdminSettings();
    this._errorCount = 0;
    this._refreshInterval = setInterval(() => {
      if (this._errorCount > 3) {
        clearInterval(this._refreshInterval);
        this._refreshInterval = null;
        return;
      }
      if (this.isConnected && !this.loading && document.visibilityState === "visible") {
        this.loadData().catch(err => { this._errorCount++; });
      }
    }, 30000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._refreshInterval) { clearInterval(this._refreshInterval); this._refreshInterval = null; }
  }

  async loadHistory() {
    this.historyLoading = true;
    this.cleanupResult = "";
    try {
      const result = await this.hass.callWS({ type: "mielelogic/get_history" });
      this.history = result.history || [];
    } catch (e) { this.history = []; }
    this.historyLoading = false;
  }

  async cleanupHistory() {
    try {
      const result = await this.hass.callWS({ type: "mielelogic/cleanup_history" });
      this.cleanupResult = result.cleaned > 0 ? `${result.cleaned} poster ryddet` : "Ingen gamle poster at rydde";
      await this.loadHistory();
    } catch (e) { this.cleanupResult = "Fejl ved oprydning"; }
  }

  async loadAdminSettings() {
    try {
      const result = await this.hass.callWS({ type: "mielelogic/get_admin" });
      this.adminSettings = result || this.adminSettings;
    } catch (e) {}
  }

  async saveAdminSettings() {
    this.adminSaving = true;
    try {
      await this.hass.callWS({
        type: "mielelogic/save_admin",
        booking_locked: this.adminSettings.booking_locked,
        lock_message: this.adminSettings.lock_message || "Booking er midlertidigt spærret",
        info_message: this.adminSettings.info_message || "",
      });
      this._notify("Admin indstillinger gemt");
    } catch (e) { this._notify("Kunne ikke gemme"); }
    this.adminSaving = false;
  }

  async loadData() {
    try {
      await Promise.all([this.loadSlots(), this.loadBookings(), this.loadStatus(), this.loadNotificationData()]);
      this._errorCount = 0;
    } catch (err) { throw err; }
  }

  async loadSlots() {
    try {
      const result = await this.hass.callWS({ type: "mielelogic/get_slots", vaskehus: this.vaskehus });
      this.slots = result.slots || [];
      if (this.slots.length > 0 && !this.selectedSlot) this.selectedSlot = this.slots[0].start;
    } catch (err) { this.error = "Kunne ikke hente tidslots"; }
  }

  async loadBookings() {
    try {
      const result = await this.hass.callWS({ type: "mielelogic/get_bookings" });
      this.bookings = result.bookings || [];
    } catch (err) {}
  }

  async loadStatus() {
    try {
      const result = await this.hass.callWS({ type: "mielelogic/get_status" });
      this.status = result || {};
    } catch (err) {}
  }

  async handleVaskehusChange(v) {
    this.vaskehus = v;
    this.selectedSlot = "";
    await this.loadSlots();
  }

  async handleBooking() {
    if (!this.selectedSlot || !this.selectedDate) { alert("Vælg tidslot og dato"); return; }
    const slot = this.slots.find(s => s.start === this.selectedSlot);
    if (!confirm(`Book ${this.vaskehus} ${this.selectedDate} ${slot?.label || ""}?`)) return;
    this.loading = true; this.error = null;
    try {
      const result = await this.hass.callWS({ type: "mielelogic/make_booking", vaskehus: this.vaskehus, slot_start: this.selectedSlot, date: this.selectedDate });
      if (result.success) { this._notify(result.message); await new Promise(r => setTimeout(r, 500)); await this.loadData(); }
      else { this._notify(result.message); this.error = result.message; }
    } catch (err) { this._notify("Booking fejlede: " + err.message); this.error = err.message; }
    finally { this.loading = false; }
  }

  async handleCancelBooking(b) {
    if (!confirm(`Slet ${b.vaskehus} booking ${this.formatDate(b.Start)}?`)) return;
    this.loading = true;
    try {
      const result = await this.hass.callWS({ type: "mielelogic/cancel_booking", machine_number: b.MachineNumber, start_time: b.Start, end_time: b.End });
      if (result.success) { this._notify("Booking slettet"); await new Promise(r => setTimeout(r, 500)); await this.loadData(); }
      else { this._notify(result.message); }
    } catch (err) { this._notify("Sletning fejlede: " + err.message); }
    finally { this.loading = false; }
  }

  _notify(msg) {
    this.hass.callService("persistent_notification", "create", { message: msg, title: "MieleLogic", notification_id: `mielelogic_${Date.now()}` });
  }

  async loadNotificationData() {
    try {
      const dr = await this.hass.callWS({ type: "mielelogic/get_devices" });
      this.availableDevices = dr.available || [];
      this.devices = dr.configured || [];
      const nr = await this.hass.callWS({ type: "mielelogic/get_notifications" });
      this.notifications = nr.notifications || {};
    } catch (err) {}
  }

  handleDeviceToggle(device) {
    this.devices = this.devices.includes(device) ? this.devices.filter(d => d !== device) : [...this.devices, device];
  }

  async saveDevices() {
    try {
      await this.hass.callWS({ type: "mielelogic/save_devices", devices: this.devices });
      this._notify("Enheder gemt");
    } catch (err) { this._notify("Kunne ikke gemme enheder"); }
  }

  async toggleNotification(id) {
    const n = this.notifications[id];
    if (!n) return;
    await this.saveNotification(id, { ...n, enabled: !n.enabled });
  }

  async saveNotification(id, config) {
    try {
      await this.hass.callWS({ type: "mielelogic/save_notification", notification_id: id, config });
      this._notify("Notifikation gemt");
      await this.loadNotificationData();
    } catch (err) { this._notify("Kunne ikke gemme"); }
  }

  async testNotification(id) {
    try {
      await this.hass.callWS({ type: "mielelogic/test_notification", notification_id: id });
      this._notify("Test besked sendt!");
    } catch (err) { this._notify("Test fejlede"); }
  }

  editNotification(id) {
    const n = this.notifications[id];
    if (!n) return;
    this.editingNotificationId = id;
    this.editTitle = n.title;
    this.editMessage = n.message;
  }

  cancelEdit() { this.editingNotificationId = null; this.editTitle = ""; this.editMessage = ""; }

  async saveEdit() {
    if (!this.editingNotificationId) return;
    try {
      const n = this.notifications[this.editingNotificationId];
      await this.hass.callWS({ type: "mielelogic/save_notification", notification_id: this.editingNotificationId, config: { ...n, title: this.editTitle, message: this.editMessage } });
      this.notifications = { ...this.notifications, [this.editingNotificationId]: { ...n, title: this.editTitle, message: this.editMessage } };
      this._notify("Skabelon gemt!");
      this.cancelEdit();
    } catch (err) { this._notify("Kunne ikke gemme"); }
  }

  async resetToDefault() {
    if (!this.editingNotificationId || !confirm("Nulstil til standard skabelon?")) return;
    try {
      const result = await this.hass.callWS({ type: "mielelogic/reset_notification", notification_id: this.editingNotificationId });
      this.notifications = { ...this.notifications, [this.editingNotificationId]: result.config };
      this.editTitle = result.config.title;
      this.editMessage = result.config.message;
      this._notify("Nulstillet til standard!");
    } catch (err) { this._notify("Kunne ikke nulstille"); }
  }

  getPreviewText(tpl, type) {
    let r = tpl;
    const ex = { "{vaskehus}": "Klatvask", "{time}": "14:30", "{date}": "28-05-2026", "{duration}": "120 minutter", "{machine}": "Maskine 1" };
    for (const [k, v] of Object.entries(ex)) r = r.replace(new RegExp(k.replace(/[{}]/g, "\\$&"), "g"), v);
    return r;
  }

  formatDate(ds) {
    return new Date(ds).toLocaleString("da-DK", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  formatCurrency(a) {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(a);
  }

  // ── ICON HELPERS ────────────────────────────────────────────────────────────

  _iconAppLogo() {
    // Washer SVG — matches the gold washer icon aesthetic
    return html`
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
           style="width:48px;height:48px;">
        <rect width="48" height="48" rx="12" fill="url(#gold-grad)"/>
        <defs>
          <linearGradient id="gold-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f0c040"/>
            <stop offset="100%" stop-color="#c87800"/>
          </linearGradient>
        </defs>
        <rect x="8" y="11" width="32" height="26" rx="3" stroke="#7a3a00" stroke-width="1.8" fill="none"/>
        <rect x="8" y="11" width="32" height="8" rx="3" fill="#7a3a00" fill-opacity="0.25"/>
        <circle cx="12" cy="15" r="1.5" fill="#7a3a00"/>
        <rect x="16" y="13.5" width="6" height="3" rx="1.5" fill="#7a3a00"/>
        <circle cx="24" cy="28" r="8" stroke="#7a3a00" stroke-width="1.8" fill="none"/>
        <circle cx="24" cy="28" r="4" stroke="#7a3a00" stroke-width="1.2" fill="none"/>
        <path d="M19 25 Q22 20 27 25" stroke="#7a3a00" stroke-width="1.2" stroke-linecap="round" fill="none"/>
      </svg>
    `;
  }

  _iconKlatvask() {
    return html`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="2.5"/>
        <circle cx="12" cy="13" r="4"/>
        <circle cx="12" cy="13" r="2"/>
        <line x1="7" y1="8.5" x2="10" y2="8.5"/>
        <circle cx="6" cy="8.5" r="0.8" fill="currentColor" stroke="none"/>
      </svg>
    `;
  }

  _iconStorvask() {
    return html`
      <svg width="20" height="18" viewBox="0 0 26 24" fill="none"
           stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="22" height="16" rx="2.5"/>
        <circle cx="13" cy="13" r="5"/>
        <circle cx="13" cy="13" r="2.5"/>
        <line x1="6" y1="8.5" x2="9.5" y2="8.5"/>
        <circle cx="5" cy="8.5" r="0.8" fill="currentColor" stroke="none"/>
        <circle cx="21" cy="7" r="1.2" stroke-width="1"/>
      </svg>
    `;
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  render() {
    const count = this.bookings.length;
    const max   = this.status.max_reservations;
    return html`
      <div class="page">

        <div class="topbar">
          <div class="topbar-left">
            <div class="app-icon">${this._iconAppLogo()}</div>
            <div class="app-icon-REMOVE"><img src="data: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" style="width:100%;height:100%;object-fit:cover;border-radius:10px" /></div>
            <div class="app-info">
              <span class="app-name">MieleLogic</span>
              <span class="app-meta">
                ${count}${max ? ` / ${max}` : ""} booking${count !== 1 ? "er" : ""}
                ${this.status.balance ? html` &middot; ${this.formatCurrency(this.status.balance)}` : ""}
              </span>
            </div>
          </div>
          <div class="topbar-right">
            <button class="refresh-btn" @click=${() => this.loadData()} ?disabled=${this.loading}>
              <span class="${this.loading ? "spin" : ""}">↻</span> Opdater
            </button>
          </div>
        </div>

        <div class="tabs-row">
          ${[
            { id: "booking",       label: "Oversigt" },
            { id: "notifications", label: "Notifikationer" },
            { id: "stats",         label: "Historik" },
            { id: "admin",         label: "Konfiguration" },
          ].map(t => html`
            <button class="tab-btn ${this.currentTab === t.id ? "tab-active" : ""}"
              @click=${() => { this.currentTab = t.id; if (t.id === "stats") this.loadHistory(); this.requestUpdate(); }}>
              ${t.label}
            </button>
          `)}
        </div>

        <div class="content">
          ${this.error ? html`
            <div class="error-strip">
              <span>⚠ ${this.error}</span>
              <button @click=${() => { this.error = null; }}>✕</button>
            </div>
          ` : ""}

          ${this.currentTab === "booking"       ? this.tplBooking()      :
            this.currentTab === "notifications" ? this.tplNotif()        :
            this.currentTab === "stats"         ? this.tplStats()        :
                                                  this.tplAdmin()}
        </div>

        ${this.editingNotificationId ? this.tplModal() : ""}
      </div>
    `;
  }

  // ── BOOKING ────────────────────────────────────────────────────────────────

  tplBooking() {
    const s = this.status;
    const locked  = s.booking_locked === true;
    const canBook = s.can_book !== false && !locked;

    return html`
      ${s.info_message ? html`
        <div class="section">
          <div class="section-label">DRIFTSBESKED</div>
          <div class="info-row">
            <span class="info-dot"></span>
            <span>${s.info_message}</span>
          </div>
        </div>
      ` : ""}

      <div class="section">
        <div class="section-label">NY BOOKING</div>

        <div class="field-blk">
          <div class="vhus-toggle">
            ${["Klatvask", "Storvask"].map(v => html`
              <button class="vhus-btn ${this.vaskehus === v ? "vhus-active" : ""}"
                @click=${() => this.handleVaskehusChange(v)} ?disabled=${this.loading}>
                ${v === "Klatvask"
                  ? html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="12" cy="13" r="4"/><circle cx="12" cy="13" r="1.8" stroke-width="1"/><line x1="7" y1="8" x2="9" y2="8" stroke-width="1"/><circle cx="6" cy="8" r="0.8" fill="currentColor" stroke="none"/></svg>`
                  : html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2.5"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2.2" stroke-width="1"/><line x1="6" y1="8" x2="9" y2="8" stroke-width="1"/><circle cx="5" cy="8" r="0.8" fill="currentColor" stroke="none"/><path d="M5 14 Q6 11 8 12" stroke-width="1" fill="none"/></svg>`
                } ${v}
              </button>
            `)}
          </div>
        </div>

        <div class="field-blk">
          <span class="field-label">TIDSBLOK</span>
          <div class="sel-wrap">
            <select class="field-select" .value=${this.selectedSlot}
              @change=${(e) => (this.selectedSlot = e.target.value)}
              ?disabled=${this.loading || this.slots.length === 0}>
              ${this.slots.length === 0
                ? html`<option>Henter tidslots…</option>`
                : this.slots.map(s => html`<option value=${s.start}>${s.label}</option>`)}
            </select>
            <span class="sel-arr">▾</span>
          </div>
        </div>

        <div class="field-blk">
          <span class="field-label">DATO</span>
          <input type="date" class="field-input" .value=${this.selectedDate}
            @change=${(e) => (this.selectedDate = e.target.value)} ?disabled=${this.loading} />
        </div>

        <button class="book-btn ${locked ? "btn-locked" : canBook ? "btn-ready" : "btn-full"}"
          @click=${this.handleBooking} ?disabled=${this.loading || !canBook}>
          ${this.loading ? html`<span class="spin">↻</span> Booker…`
            : locked ? html`🔒 ${s.lock_message || "Booking spærret"}`
            : canBook ? "Book nu"
            : "Max bookinger nået"}
        </button>
      </div>

      <div class="section">
        <div class="section-label-row">
          <span class="section-label">AKTIVE BOOKINGER</span>
          <span class="cnt-badge">${this.bookings.length}</span>
        </div>
        ${this.bookings.length === 0
          ? html`<div class="empty-row">Ingen aktive bookinger</div>`
          : this.bookings.map(b => this.tplBookingRow(b))}
      </div>
    `;
  }

  tplBookingRow(b) {
    const dur = (() => {
      const d = b.Duration ?? b.duration;
      if (d != null && !isNaN(+d)) return +d + " min";
      try { const m = Math.round((new Date(b.End) - new Date(b.Start)) / 60000); if (m > 0) return m + " min"; } catch(e) {}
      return "";
    })();
    return html`
      <div class="brow">
        <div class="brow-accent ${b.vaskehus === "Storvask" ? "ba-stor" : "ba-klat"}"></div>
        <div class="brow-info">
          <span class="brow-name">${b.vaskehus || "Booking"}</span>
          <span class="brow-meta">
            ${this.formatDate(b.Start)}
            ${dur ? html`&nbsp;&middot;&nbsp;${dur}` : ""}
            ${b.created_by ? html`&nbsp;&middot;&nbsp;<span class="brow-via">${b.created_by}</span>` : ""}
          </span>
        </div>
        <button class="del-btn" @click=${() => this.handleCancelBooking(b)} ?disabled=${this.loading} title="Slet booking">✕</button>
      </div>
    `;
  }

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────

  tplNotif() {
    return html`
      <div class="section">
        <div class="section-label">MOBILE ENHEDER</div>
        <p class="sec-desc">Vælg hvilke enheder der modtager notifikationer</p>
        ${this.availableDevices.length === 0 ? html`
          <div class="empty-row">Ingen mobile apps fundet — installer HA Companion</div>
        ` : html`
          <div class="dev-list">
            ${this.availableDevices.map(d => html`
              <label class="dev-chip ${this.devices.includes(d.service) ? "dev-on" : ""}">
                <span class="dev-dot ${this.devices.includes(d.service) ? "dot-on" : ""}"></span>
                <span>${d.name}</span>
                <input type="checkbox" .checked=${this.devices.includes(d.service)}
                  @change=${() => this.handleDeviceToggle(d.service)} style="display:none" />
              </label>
            `)}
          </div>
          <button class="act-btn" @click=${() => this.saveDevices()}>Gem enheder</button>
        `}
      </div>

      <div class="section">
        <div class="section-label">NOTIFIKATIONER</div>
        <p class="sec-desc">Aktiver og tilpas beskedskabeloner</p>
        ${Object.entries(this.notifications).length === 0
          ? html`<div class="empty-row">Ingen notifikationer konfigureret</div>`
          : html`
            <div class="notif-list">
              ${Object.entries(this.notifications).map(([id, n]) => html`
                <div class="notif-row ${n.enabled ? "notif-on" : ""}">
                  <div class="notif-left">
                    <label class="tog-wrap">
                      <input type="checkbox" .checked=${n.enabled} @change=${() => this.toggleNotification(id)} />
                      <span class="tog-track"><span class="tog-thumb ${n.enabled ? "thumb-on" : ""}"></span></span>
                    </label>
                    <div class="notif-texts">
                      <span class="notif-name">${n.title}</span>
                      <span class="notif-msg">${n.message}</span>
                    </div>
                  </div>
                  <div class="notif-acts">
                    <button class="ghost-btn" @click=${() => this.editNotification(id)}>Rediger</button>
                    <button class="ghost-btn ghost-green" @click=${() => this.testNotification(id)}
                      ?disabled=${!n.enabled || this.devices.length === 0}>Test</button>
                  </div>
                </div>
              `)}
            </div>
        `}
      </div>
    `;
  }

  tplModal() {
    const n = this.notifications[this.editingNotificationId];
    if (!n) return "";
    return html`
      <div class="modal-bg" @click=${this.cancelEdit}>
        <div class="modal-box" @click=${(e) => e.stopPropagation()}>
          <div class="modal-head">
            <span class="modal-title">Rediger skabelon</span>
            <button class="modal-close" @click=${this.cancelEdit}>✕</button>
          </div>

          <div class="modal-field">
            <label class="field-label">TITEL</label>
            <input class="field-input" type="text" .value=${this.editTitle}
              @input=${(e) => { this.editTitle = e.target.value; this.requestUpdate(); }} placeholder="Notifikationstitel" />
            <div class="preview-line"><span class="preview-k">Eksempel:</span> ${this.getPreviewText(this.editTitle, this.editingNotificationId)}</div>
          </div>

          <div class="modal-field">
            <label class="field-label">BESKED</label>
            <textarea class="field-textarea" .value=${this.editMessage} rows="3"
              @input=${(e) => { this.editMessage = e.target.value; this.requestUpdate(); }} placeholder="Beskedtekst"></textarea>
            <div class="preview-line"><span class="preview-k">Eksempel:</span> ${this.getPreviewText(this.editMessage, this.editingNotificationId)}</div>
          </div>

          <div class="var-row">
            ${["{vaskehus}", "{time}", "{date}", "{duration}", "{machine}"].map(v => html`<code class="var-tag">${v}</code>`)}
          </div>

          <div class="modal-acts">
            <button class="ghost-btn" @click=${this.resetToDefault}>Nulstil</button>
            <div class="modal-acts-r">
              <button class="ghost-btn" @click=${this.cancelEdit}>Annuller</button>
              <button class="act-btn" @click=${this.saveEdit}>Gem skabelon</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── STATS ──────────────────────────────────────────────────────────────────

  tplStats() {
    const fmt = (e) => {
      const start = e.start_time || "";
      const date = start.split(" ")[0] || start.split("T")[0] || "–";
      const time = (start.split(" ")[1] || start.split("T")[1] || "").slice(0, 5) || "–";
      const parts = date.split("-");
      return { dateStr: parts.length === 3 ? `${parts[2]}.${parts[1]}` : date, time, dur: e.duration ? e.duration + " min" : "–", user: e.created_by || "–", vaskehus: e.vaskehus || `Maskine ${e.machine}` };
    };
    return html`
      <div class="section">
        <div class="section-label-row">
          <span class="section-label">AFSLUTTEDE BOOKINGER</span>
          <span class="sec-sub">Seneste 30 dage</span>
        </div>
        ${this.historyLoading ? html`<div class="loading-row"><span class="spin">↻</span> Henter historik…</div>`
          : this.history.length === 0 ? html`<div class="empty-row">Ingen afsluttede bookinger de seneste 30 dage</div>`
          : html`
            <div class="stat-count">${this.history.length} booking${this.history.length !== 1 ? "er" : ""}</div>
            <div class="hist-list">
              ${this.history.map(e => { const f = fmt(e); return html`
                <div class="hist-row">
                  <div>
                    <div class="hist-vask">${f.vaskehus}</div>
                    <div class="hist-meta">${f.dateStr} · ${f.time} · ${f.dur}</div>
                  </div>
                  <div class="hist-user">👤 ${f.user}</div>
                </div>
              `;})}
            </div>
        `}
        <div class="cleanup-row">
          <button class="ghost-btn" @click=${() => this.cleanupHistory()}>Ryd metadata ældre end 30 dage</button>
          ${this.cleanupResult ? html`<span class="cleanup-msg">${this.cleanupResult}</span>` : ""}
        </div>
      </div>
    `;
  }

  // ── ADMIN ──────────────────────────────────────────────────────────────────

  tplAdmin() {
    const a = this.adminSettings;
    return html`
      <div class="section">
        <div class="section-label">DRIFTSBESKED</div>
        <p class="sec-desc">Vises øverst til alle brugere — efterlad tom for ingen besked</p>
        <textarea class="field-textarea" placeholder="f.eks. Vaskehuset rengøres fredag d. 3/3 kl. 10–12"
          .value=${a.info_message || ""}
          @input=${(e) => { this.adminSettings = { ...this.adminSettings, info_message: e.target.value }; }}></textarea>
      </div>

      <div class="section">
        <div class="section-label">BOOKING SPÆRRING</div>
        <p class="sec-desc">Spærrer for nye bookinger — eksisterende bookinger påvirkes ikke</p>
        <label class="tog-label-row">
          <label class="tog-wrap">
            <input type="checkbox" .checked=${a.booking_locked}
              @change=${(e) => { this.adminSettings = { ...this.adminSettings, booking_locked: e.target.checked }; }} />
            <span class="tog-track"><span class="tog-thumb ${a.booking_locked ? "thumb-on" : ""}"></span></span>
          </label>
          <span class="tog-text">${a.booking_locked ? "🔒 Booking spærret" : "🔓 Booking åben"}</span>
        </label>
        ${a.booking_locked ? html`
          <input type="text" class="field-input" style="margin-top:12px"
            placeholder="Besked til brugerne…" .value=${a.lock_message || ""}
            @input=${(e) => { this.adminSettings = { ...this.adminSettings, lock_message: e.target.value }; }} />
        ` : ""}
      </div>

      <button class="act-btn" @click=${() => this.saveAdminSettings()} ?disabled=${this.adminSaving}>
        ${this.adminSaving ? html`<span class="spin">↻</span> Gemmer…` : "Gem indstillinger"}
      </button>
    `;
  }

  // ── STYLES ─────────────────────────────────────────────────────────────────

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
        min-height: 100vh;
        background: #0d0d0d;
        color: #e8e8e8;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        box-sizing: border-box;
      }
      *, *::before, *::after { box-sizing: border-box; }

      .page { max-width: 1100px; margin: 0 auto; padding: 0 0 48px; }

      /* ── TOPBAR ─────────────────────────── */
      .topbar { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px 16px; gap: 12px; }
      .topbar-left { display: flex; align-items: center; gap: 14px; }

      .app-icon {
        width: 48px; height: 48px; border-radius: 14px;
        background: transparent; border: none;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; flex-shrink: 0;
        overflow: hidden;
        padding: 0;
      }

      .app-name { display: block; font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #f0f0f0; line-height: 1.1; }
      .app-meta { display: block; font-size: 12px; color: #555; margin-top: 2px; }

      .refresh-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 8px 14px; background: #1a1a1a;
        border: 1px solid #2e2e2e; border-radius: 20px;
        color: #777; font-size: 13px; font-family: inherit;
        cursor: pointer; transition: all 0.15s; white-space: nowrap;
      }
      .refresh-btn:hover:not(:disabled) { border-color: #444; color: #ccc; }
      .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      /* ── TABS ───────────────────────────── */
      .tabs-row {
        display: flex; border-bottom: 1px solid #1e1e1e;
        padding: 0 24px; gap: 2px;
        overflow-x: auto; scrollbar-width: none;
      }
      .tabs-row::-webkit-scrollbar { display: none; }

      .tab-btn {
        padding: 12px 20px; background: none; border: none;
        border-bottom: 2px solid transparent;
        color: #444; font-size: 14px; font-weight: 500; font-family: inherit;
        cursor: pointer; white-space: nowrap; transition: all 0.15s; margin-bottom: -1px;
      }
      .tab-btn:hover { color: #888; }
      .tab-active { color: #e8e8e8 !important; border-bottom-color: #e8e8e8 !important; font-weight: 600 !important; }

      /* ── CONTENT ────────────────────────── */
      .content { padding: 0 24px; }

      .error-strip {
        display: flex; align-items: center; gap: 10px;
        background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.2);
        color: #f87171; border-radius: 10px; padding: 10px 14px;
        margin: 16px 0; font-size: 13px;
      }
      .error-strip button { margin-left: auto; background: none; border: none; cursor: pointer; color: #f87171; font-size: 14px; }

      /* ── SECTION ────────────────────────── */
      .section {
        background: #111; border: 1px solid #1e1e1e;
        border-radius: 12px; padding: 20px; margin-top: 16px;
      }

      .section-label {
        font-size: 11px; font-weight: 700; letter-spacing: 0.9px;
        color: #444; margin-bottom: 14px;
      }

      .section-label-row {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
      }

      .sec-sub  { font-size: 11px; color: #444; font-weight: 500; }
      .sec-desc { font-size: 13px; color: #555; margin: -6px 0 14px; line-height: 1.4; }

      .cnt-badge {
        background: #1a1a1a; color: #555; font-size: 11px; font-weight: 700;
        padding: 2px 9px; border-radius: 100px; border: 1px solid #2a2a2a;
      }

      .stat-count { font-size: 12px; color: #4ade80; font-weight: 600; margin-bottom: 12px; }

      /* ── INFO ROW ───────────────────────── */
      .info-row {
        display: flex; align-items: center; gap: 10px;
        font-size: 13px; color: #f0c040;
        background: rgba(240,192,64,0.07); border: 1px solid rgba(240,192,64,0.18);
        border-radius: 8px; padding: 10px 14px;
      }
      .info-dot { width: 7px; height: 7px; border-radius: 50%; background: #f0c040; flex-shrink: 0; }

      /* ── VASKEHUS TOGGLE ────────────────── */
      .field-blk { margin-bottom: 14px; }

      .vhus-toggle { display: flex; gap: 8px; }
      .vhus-btn {
        flex: 1; padding: 10px 12px;
        background: #1a1a1a; border: 1px solid #2a2a2a;
        border-radius: 8px; color: #555; font-size: 14px;
        font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s;
      }
      .vhus-btn:hover:not(:disabled) { border-color: #3a3a3a; color: #aaa; }
      .vhus-active { border-color: #e8e8e8 !important; color: #e8e8e8 !important; background: #1e1e1e !important; font-weight: 600 !important; }
      .vhus-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      /* ── INPUTS ─────────────────────────── */
      .field-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.7px; color: #444; margin-bottom: 7px; }

      .sel-wrap { position: relative; }
      .sel-arr { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #444; font-size: 12px; }

      .field-select, .field-input, .field-textarea {
        width: 100%; padding: 10px 14px;
        background: #1a1a1a; border: 1px solid #2a2a2a;
        border-radius: 8px; font-size: 14px; font-family: inherit;
        color: #e8e8e8; transition: border-color 0.15s;
        appearance: none; -webkit-appearance: none;
      }
      .field-select { padding-right: 34px; cursor: pointer; }
      .field-select:focus, .field-input:focus, .field-textarea:focus { outline: none; border-color: #444; background: #1e1e1e; }
      .field-select:disabled, .field-input:disabled { opacity: 0.45; cursor: not-allowed; }
      .field-textarea { resize: vertical; min-height: 80px; }

      /* ── BOOK BUTTON ────────────────────── */
      .book-btn {
        width: 100%; padding: 13px; border: none; border-radius: 8px;
        font-size: 15px; font-weight: 600; font-family: inherit;
        cursor: pointer; display: flex; align-items: center;
        justify-content: center; gap: 8px; transition: all 0.2s; margin-top: 4px;
      }
      .btn-ready  { background: #1e1e1e; border: 1px solid #444; color: #e8e8e8; }
      .btn-ready:hover:not(:disabled) { background: #e8e8e8; color: #0d0d0d; border-color: #e8e8e8; }
      .btn-full   { background: #1a1a1a; border: 1px solid #2a2a2a; color: #444; cursor: not-allowed; }
      .btn-locked { background: #1a1a1a; border: 1px solid #2a2a2a; color: #444; cursor: not-allowed; }
      .book-btn:disabled { opacity: 0.6; transform: none; }

      /* ── BOOKING ROWS ───────────────────── */
      .empty-row { font-size: 13px; color: #333; padding: 10px 0 4px; text-align: center; }

      .brow {
        display: flex; align-items: center; padding: 11px 0;
        border-bottom: 1px solid #1a1a1a; transition: opacity 0.15s;
      }
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

      /* ── SPINNER ────────────────────────── */
      .spin { display: inline-block; animation: sp 0.7s linear infinite; }
      @keyframes sp { to { transform: rotate(360deg); } }
      .loading-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #444; padding: 8px 0; }

      /* ── DEVICES ────────────────────────── */
      .dev-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
      .dev-chip {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 14px; background: #1a1a1a; border: 1px solid #2a2a2a;
        border-radius: 100px; cursor: pointer; font-size: 13px; font-weight: 500;
        color: #444; transition: all 0.15s; user-select: none;
      }
      .dev-chip:hover { border-color: #3a3a3a; color: #aaa; }
      .dev-on { border-color: #888 !important; color: #e8e8e8 !important; }
      .dev-dot { width: 7px; height: 7px; border-radius: 50%; background: #333; flex-shrink: 0; transition: background 0.15s; }
      .dot-on  { background: #e8e8e8; }

      /* ── NOTIFICATIONS ──────────────────── */
      .notif-list { display: flex; flex-direction: column; }
      .notif-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 16px; padding: 12px 0; border-bottom: 1px solid #1a1a1a; flex-wrap: wrap;
        opacity: 0.4; transition: opacity 0.15s;
      }
      .notif-row:last-child { border-bottom: none; padding-bottom: 0; }
      .notif-on { opacity: 1; }

      .notif-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
      .notif-texts { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .notif-name { font-size: 14px; font-weight: 600; color: #e8e8e8; }
      .notif-msg  { font-size: 12px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .notif-acts { display: flex; gap: 6px; flex-shrink: 0; }

      /* ── TOGGLE ─────────────────────────── */
      .tog-wrap { display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; }
      .tog-wrap input { display: none; }
      .tog-track {
        width: 34px; height: 19px; background: #1e1e1e;
        border-radius: 100px; position: relative; border: 1px solid #2e2e2e;
        transition: all 0.2s; display: block;
      }
      .tog-thumb {
        position: absolute; top: 2px; left: 2px; width: 13px; height: 13px;
        border-radius: 50%; background: #333; transition: all 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      .thumb-on { background: #e8e8e8 !important; transform: translateX(15px) !important; }

      .tog-label-row { display: flex; align-items: center; gap: 12px; }
      .tog-text { font-size: 14px; font-weight: 500; color: #aaa; }

      /* ── BUTTONS ────────────────────────── */
      .act-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 10px 20px; background: #e8e8e8; color: #0d0d0d;
        border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
        font-family: inherit; cursor: pointer; transition: all 0.15s; margin-top: 8px;
      }
      .act-btn:hover:not(:disabled) { background: #fff; }
      .act-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .ghost-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; background: #1a1a1a; border: 1px solid #2e2e2e;
        border-radius: 7px; color: #555; font-size: 13px; font-weight: 500;
        font-family: inherit; cursor: pointer; transition: all 0.15s; white-space: nowrap;
      }
      .ghost-btn:hover:not(:disabled) { border-color: #444; color: #ccc; }
      .ghost-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .ghost-green { color: #4ade80; border-color: rgba(74,222,128,0.2); }
      .ghost-green:hover:not(:disabled) { background: rgba(74,222,128,0.06); border-color: #4ade80; }

      /* ── HISTORY ────────────────────────── */
      .hist-list { display: flex; flex-direction: column; margin-bottom: 16px; }
      .hist-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; padding: 10px 0; border-bottom: 1px solid #1a1a1a; font-size: 13px;
      }
      .hist-row:last-child { border-bottom: none; }
      .hist-vask { font-weight: 600; color: #e8e8e8; margin-bottom: 2px; }
      .hist-meta { color: #333; font-size: 12px; }
      .hist-user { color: #333; font-size: 12px; white-space: nowrap; }
      .cleanup-row { display: flex; align-items: center; gap: 12px; padding-top: 14px; border-top: 1px solid #1a1a1a; margin-top: 4px; }
      .cleanup-msg { font-size: 13px; color: #555; }

      /* ── MODAL ──────────────────────────── */
      .modal-bg {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; padding: 20px; backdrop-filter: blur(8px);
      }
      .modal-box {
        background: #111; border: 1px solid #2a2a2a; border-radius: 16px;
        padding: 28px; max-width: 520px; width: 100%; max-height: 90vh;
        overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.7);
      }
      .modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
      .modal-title { font-size: 17px; font-weight: 700; color: #e8e8e8; }
      .modal-close {
        background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 50%;
        width: 30px; height: 30px; color: #555; cursor: pointer; font-size: 13px;
        display: flex; align-items: center; justify-content: center; transition: all 0.15s;
      }
      .modal-close:hover { border-color: #dc2626; color: #dc2626; }
      .modal-field { margin-bottom: 18px; }

      .preview-line {
        margin-top: 7px; font-size: 12px; color: #333;
        padding: 8px 12px; background: #0d0d0d;
        border-radius: 7px; border: 1px solid #1e1e1e;
      }
      .preview-k { color: #444; font-weight: 600; margin-right: 6px; }

      .var-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 22px; }
      .var-tag {
        font-family: 'Fira Code', 'Cascadia Code', monospace; font-size: 11px;
        padding: 3px 9px; background: #0d0d0d; border: 1px solid #2a2a2a;
        border-radius: 5px; color: #666; font-weight: 500;
      }

      .modal-acts { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid #1e1e1e; padding-top: 18px; }
      .modal-acts-r { display: flex; gap: 8px; }

      /* ── RESPONSIVE ─────────────────────── */
      @media (max-width: 640px) {
        .topbar  { padding: 16px 16px 12px; }
        .tabs-row { padding: 0 16px; }
        .content { padding: 0 16px; }
        .tab-btn { padding: 12px 12px; font-size: 13px; }
        .vhus-toggle { flex-direction: column; }
        .notif-row { flex-direction: column; align-items: flex-start; }
        .notif-acts { align-self: flex-end; }
        .modal-acts { flex-direction: column-reverse; }
        .modal-acts-r { width: 100%; justify-content: flex-end; }
      }

      @media (min-width: 900px) {
        .content { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; align-items: start; }
        .content .error-strip { grid-column: 1 / -1; }
      }
    `;
  }
}

if (!customElements.get("mielelogic-panel")) {
  customElements.define("mielelogic-panel", MieleLogicPanel);
}
