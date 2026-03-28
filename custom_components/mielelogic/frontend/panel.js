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

  // ── RENDER ─────────────────────────────────────────────────────────────────

  render() {
    const count = this.bookings.length;
    const max   = this.status.max_reservations;
    return html`
      <div class="page">

        <div class="topbar">
          <div class="topbar-left">
            <div class="app-icon">🫧</div>
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
                ${v === "Klatvask" ? "🫧" : "♨️"} ${v}
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
        background: #1a1a1a; border: 1px solid #2a2a2a;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; flex-shrink: 0;
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
