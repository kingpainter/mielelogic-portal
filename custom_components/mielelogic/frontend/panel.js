// MieleLogic Panel — Main UI Component
// VERSION = "1.9.1"
// Architecture: vanilla HTMLElement + shadow DOM
// Same pattern as Heat Manager (0.3.0) and Indeklima (2.4.0)
// element name: mielelogic-panel-v2 (bumped to force fresh customElements registration)

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
    const root = this.shadowRoot;
    if (!root.querySelector("style")) {
      const st = document.createElement("style");
      st.textContent = this._css();
      root.appendChild(st);
    }
    if (!root.querySelector(".page")) {
      const wrap = document.createElement("div");
      wrap.className = "page";
      wrap.innerHTML = `<div class="loading-wrap"><span class="spin">↻</span> Indlæser MieleLogic…</div>`;
      root.appendChild(wrap);
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
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="12" cy="13" r="4"/><circle cx="12" cy="13" r="1.8" stroke-width="1"/><line x1="7" y1="8" x2="9" y2="8" stroke-width="1"/><circle cx="6" cy="8" r="0.8" fill="currentColor" stroke="none"/></svg>`;
  }

  _svgStorvask() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2.5"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2.2" stroke-width="1"/><line x1="6" y1="8" x2="9" y2="8" stroke-width="1"/><circle cx="5" cy="8" r="0.8" fill="currentColor" stroke="none"/><path d="M5 14 Q6 11 8 12" stroke-width="1" fill="none"/></svg>`;
  }

  _render() {
    const root = this.shadowRoot;
    if (!root.querySelector("style")) {
      const st = document.createElement("style");
      st.textContent = this._css();
      root.appendChild(st);
    }
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
    return `<div class="topbar"><div class="topbar-left"><span class="app-name">🧺 MieleLogic</span><span class="app-meta">${count}${max ? ` / ${max}` : ""} booking${count !== 1 ? "er" : ""}${bal}</span></div><button class="refresh-btn" data-action="refresh" ${this._loading ? "disabled" : ""}><span class="${this._loading ? "spin" : ""}">↻</span> Opdater</button></div>`;
  }

  _htmlTabs() {
    const tabs = [{ id: "booking", label: "Oversigt" }, { id: "notifications", label: "Notifikationer" }, { id: "stats", label: "Historik" }, { id: "admin", label: "Konfiguration" }];
    return `<div class="tabs-row">${tabs.map(t => `<button class="tab-btn${this._tab === t.id ? " tab-active" : ""}" data-tab="${t.id}">${t.label}</button>`).join("")}</div>`;
  }

  _htmlBooking() {
    const s = this._admin, locked = s.booking_locked;
    const canBook = !locked && this._bookings.length < (this._status.max_reservations || 99);
    const infoMsg = s.info_message ? `<div class="info-strip">${s.info_message}</div>` : "";
    const lockMsg = locked ? `<div class="lock-strip">🔒 ${s.lock_message || "Booking er midlertidigt spærret"}</div>` : "";
    const slotsOpts = this._slots.length === 0 ? `<option>Henter tidslots…</option>` : this._slots.map(sl => `<option value="${sl.start}" ${this._selectedSlot === sl.start ? "selected" : ""} ${sl.booked ? "disabled" : ""}>${sl.booked ? sl.label + " — Optaget" : sl.label}</option>`).join("");
    const bookBtn = this._loading ? `<button class="book-btn btn-locked" disabled><span class="spin">↻</span> Booker…</button>` : locked ? `<button class="book-btn btn-locked" disabled>🔒 ${s.lock_message || "Booking spærret"}</button>` : !canBook ? `<button class="book-btn btn-full" disabled>Max bookinger nået</button>` : `<button class="book-btn btn-ready" data-action="book">Book nu</button>`;
    const chips = this._slots.map(sl => `<span class="slot-chip ${sl.booked ? "chip-booked" : "chip-free"}">${sl.start} ${sl.booked ? "✕" : "✓"}</span>`).join("");
    const bookingsHtml = this._bookings.length === 0 ? `<div class="empty-row">Ingen aktive bookinger</div>` : this._bookings.map(b => this._htmlBookingRow(b)).join("");
    return `<div class="section">${infoMsg}${lockMsg}<div class="section-label">NY BOOKING</div><div class="vhus-toggle"><button class="vhus-btn${this._vaskehus === "Klatvask" ? " vhus-active" : ""}" data-vhus="Klatvask">${this._svgKlatvask()} Klatvask</button><button class="vhus-btn${this._vaskehus === "Storvask" ? " vhus-active" : ""}" data-vhus="Storvask">${this._svgStorvask()} Storvask</button></div><div class="field-blk"><span class="field-lbl">TIDSBLOK</span><div class="sel-wrap"><select class="field-sel" data-field="slot" ${this._loading || !this._slots.length ? "disabled" : ""}>${slotsOpts}</select><span class="sel-arr">▾</span></div></div><div class="slot-chips">${chips}</div><div class="field-blk"><span class="field-lbl">DATO</span><input type="date" class="field-inp" data-field="date" value="${this._selectedDate}" ${this._loading ? "disabled" : ""}/></div>${bookBtn}</div><div class="section"><div class="section-label-row"><span class="section-label">AKTIVE BOOKINGER</span><span class="cnt-badge">${this._bookings.length}</span></div>${bookingsHtml}</div>`;
  }

  _htmlBookingRow(b) {
    const dur = (() => { const d = b.Duration ?? b.duration; if (d != null && !isNaN(+d)) return +d + " min"; try { const m = Math.round((new Date(b.End) - new Date(b.Start)) / 60000); if (m > 0) return m + " min"; } catch(e) {} return ""; })();
    return `<div class="brow"><div class="brow-accent ${b.vaskehus === "Storvask" ? "ba-stor" : "ba-klat"}"></div><div class="brow-info"><span class="brow-name">${b.vaskehus || "Booking"}</span><span class="brow-meta">${this._fmtDate(b.Start)}${dur ? " · " + dur : ""}${b.created_by ? " · " + b.created_by : ""}</span></div><button class="del-btn" data-cancel='${JSON.stringify({MachineNumber:b.MachineNumber,Start:b.Start,End:b.End,vaskehus:b.vaskehus})}' ${this._loading ? "disabled" : ""} title="Slet">✕</button></div>`;
  }

  _htmlNotifications() {
    const devHtml = this._availableDevices.length === 0 ? `<div class="empty-row">Ingen mobile apps — installer HA Companion</div>` : `<div class="dev-list">${this._availableDevices.map(d => `<label class="dev-chip${this._devices.includes(d.service) ? " dev-on" : ""}"><span class="dev-dot${this._devices.includes(d.service) ? " dot-on" : ""}"></span><span>${d.name}</span><input type="checkbox" data-device="${d.service}" ${this._devices.includes(d.service) ? "checked" : ""} style="display:none"/></label>`).join("")}</div><button class="act-btn" data-action="save-devices">Gem enheder</button>`;
    const notifHtml = Object.keys(this._notifications).length === 0 ? `<div class="empty-row">Ingen notifikationer konfigureret</div>` : `<div class="notif-list">${Object.entries(this._notifications).map(([id,n]) => `<div class="notif-row${n.enabled ? " notif-on" : ""}"><div class="notif-left"><label class="tog-wrap"><input type="checkbox" data-toggle-notif="${id}" ${n.enabled ? "checked" : ""}/><span class="tog-track"><span class="tog-thumb${n.enabled ? " thumb-on" : ""}"></span></span></label><div class="notif-texts"><span class="notif-name">${n.title}</span><span class="notif-msg">${n.message}</span></div></div><div class="notif-acts"><button class="ghost-btn" data-edit-notif="${id}">Rediger</button><button class="ghost-btn ghost-green" data-test-notif="${id}" ${!n.enabled || !this._devices.length ? "disabled" : ""}>Test</button></div></div>`).join("")}</div>`;
    return `<div class="section"><div class="section-label">MOBILE ENHEDER</div><p class="sec-desc">Vælg enheder der modtager notifikationer</p>${devHtml}</div><div class="section"><div class="section-label">NOTIFIKATIONER</div><p class="sec-desc">Aktiver og tilpas beskedskabeloner</p>${notifHtml}</div>`;
  }

  _htmlModal() {
    const n = this._notifications[this._editingId]; if (!n) return "";
    return `<div class="modal-bg" data-action="close-modal"><div class="modal-box"><div class="modal-head"><span class="modal-title">Rediger skabelon</span><button class="modal-close" data-action="close-modal">✕</button></div><div class="modal-field"><label class="field-lbl">TITEL</label><input class="field-inp" type="text" data-modal-field="title" value="${this._esc(this._editTitle)}" placeholder="Notifikationstitel"/><div class="preview-line"><span class="preview-k">Eksempel:</span> ${this._preview(this._editTitle)}</div></div><div class="modal-field"><label class="field-lbl">BESKED</label><textarea class="field-ta" data-modal-field="message" rows="3" placeholder="Beskedtekst">${this._esc(this._editMessage)}</textarea><div class="preview-line"><span class="preview-k">Eksempel:</span> ${this._preview(this._editMessage)}</div></div><div class="var-row">${["{vaskehus}","{time}","{date}","{duration}","{machine}"].map(v=>`<code class="var-tag">${v}</code>`).join("")}</div><div class="modal-acts"><button class="ghost-btn" data-action="reset-notif">Nulstil</button><div class="modal-acts-r"><button class="ghost-btn" data-action="close-modal">Annuller</button><button class="act-btn" data-action="save-edit">Gem skabelon</button></div></div></div></div>`;
  }

  _htmlStats() {
    const fmt = e => { const s=e.start_time||"",d=s.split(" ")[0]||s.split("T")[0]||"–",t=(s.split(" ")[1]||s.split("T")[1]||"").slice(0,5)||"–",p=d.split("-"); return {ds:p.length===3?`${p[2]}.${p[1]}`:d,t,dur:e.duration?e.duration+" min":"–",u:e.created_by||"–",v:e.vaskehus||`Maskine ${e.machine}`}; };
    const items = this._historyLoading ? `<div class="stats-empty">⏳ Henter historik…</div>` : !this._history.length ? `<div class="stats-empty">📭 Ingen afsluttede bookinger de seneste 30 dage</div>` : `<div class="stats-count">${this._history.length} booking${this._history.length!==1?"er":""} fundet</div><div class="history-list">${this._history.map(e=>{const f=fmt(e);return `<div class="history-item"><div class="history-left"><span class="history-name">${f.v}</span><span class="history-meta">${f.ds} · ${f.t} · ${f.dur}</span></div><span class="history-user">👤 ${f.u}</span></div>`;}).join("")}</div>`;
    return `<div class="section"><h2 class="section-h2">📊 Statistik</h2><p class="sec-desc">Afsluttede bookinger de seneste 30 dage</p>${items}<div class="mt16"><button class="cleanup-btn" data-action="cleanup-history">🧹 Ryd metadata ældre end 30 dage</button>${this._cleanupResult?`<p class="cleanup-result">${this._cleanupResult}</p>`:""}</div></div>`;
  }

  _htmlAdmin() {
    const a = this._admin;
    return `<div class="section"><h2 class="section-h2">⚙️ Admin</h2><div class="admin-section"><h3 class="admin-h3">📢 Driftsbesked</h3><p class="admin-desc">Vises øverst i booking kortet til alle brugere.</p><textarea class="admin-ta" data-admin="info_message" placeholder="f.eks. Vaskehuset rengøres fredag...">${this._esc(a.info_message||"")}</textarea></div><div class="admin-section"><h3 class="admin-h3">🔒 Booking spærring</h3><p class="admin-desc">Spærrer for nye bookinger. Eksisterende påvirkes ikke.</p><label class="admin-toggle"><input type="checkbox" data-admin-check="booking_locked" ${a.booking_locked?"checked":""}/><span class="tog-slider"></span><span class="tog-label">${a.booking_locked?"🔒 Booking spærret":"🔓 Booking åben"}</span></label>${a.booking_locked?`<input type="text" class="field-inp mt8" data-admin="lock_message" placeholder="Besked til brugerne..." value="${this._esc(a.lock_message||"")}"/>`:"" }</div><button class="act-btn btn-full-w${this._adminSaving?" saving":""}" data-action="save-admin" ${this._adminSaving?"disabled":""}>${this._adminSaving?"💾 Gemmer…":"💾 Gem indstillinger"}</button></div>`;
  }

  _bindEvents(page) {
    if (!page) return;
    page.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this._tab=b.dataset.tab; if(this._tab==="stats"&&!this._history.length) this._loadHistory(); else this._render(); }));
    page.querySelectorAll("[data-vhus]").forEach(b => b.addEventListener("click", () => { this._vaskehus=b.dataset.vhus; this._selectedSlot=""; this._loadSlots().then(()=>this._render()); }));
    const slotSel=page.querySelector("[data-field='slot']"); if(slotSel) slotSel.addEventListener("change",e=>{this._selectedSlot=e.target.value;});
    const dateIn=page.querySelector("[data-field='date']"); if(dateIn) dateIn.addEventListener("change",e=>{this._selectedDate=e.target.value;this._selectedSlot="";this._loadSlots().then(()=>this._render());});
    page.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", e => {
      const a=el.dataset.action;
      if(a==="book") this._doBook();
      else if(a==="refresh") this._loadAll();
      else if(a==="clear-error"){this._error=null;this._render();}
      else if(a==="save-devices") this._doSaveDevices();
      else if(a==="save-edit") this._doSaveEdit();
      else if(a==="reset-notif") this._doResetNotification();
      else if(a==="close-modal"){e.stopPropagation();this._closeModal();}
      else if(a==="save-admin") this._doSaveAdmin();
      else if(a==="cleanup-history") this._doCleanupHistory();
    }));
    const mb=page.querySelector(".modal-bg"); if(mb) mb.addEventListener("click",e=>{if(e.target===mb)this._closeModal();});
    page.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click",()=>{try{this._doCancel(JSON.parse(b.dataset.cancel));}catch(e){}}));
    page.querySelectorAll("[data-device]").forEach(cb => cb.addEventListener("change",()=>{const s=cb.dataset.device;this._devices=cb.checked?[...this._devices.filter(d=>d!==s),s]:this._devices.filter(d=>d!==s);cb.closest("label")?.classList.toggle("dev-on",cb.checked);}));
    page.querySelectorAll("[data-toggle-notif]").forEach(cb => cb.addEventListener("change",()=>this._doToggleNotification(cb.dataset.toggleNotif)));
    page.querySelectorAll("[data-edit-notif]").forEach(b => b.addEventListener("click",()=>{const id=b.dataset.editNotif,n=this._notifications[id];if(!n)return;this._editingId=id;this._editTitle=n.title;this._editMessage=n.message;this._render();}));
    page.querySelectorAll("[data-test-notif]").forEach(b => b.addEventListener("click",()=>this._doTestNotification(b.dataset.testNotif)));
    const ti=page.querySelector("[data-modal-field='title']"); if(ti) ti.addEventListener("input",e=>{this._editTitle=e.target.value;});
    const ta=page.querySelector("[data-modal-field='message']"); if(ta) ta.addEventListener("input",e=>{this._editMessage=e.target.value;});
    page.querySelectorAll("[data-admin]").forEach(el=>el.addEventListener("input",e=>{this._admin={...this._admin,[el.dataset.admin]:e.target.value};}));
    page.querySelectorAll("[data-admin-check]").forEach(cb=>cb.addEventListener("change",()=>{this._admin={...this._admin,[cb.dataset.adminCheck]:cb.checked};this._render();}));
  }

  _css() {
    return `
:host,*{box-sizing:border-box}
:host{display:block;width:100%;padding:16px;max-width:900px;margin:0 auto;font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);color:var(--primary-text-color,#212121)}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.topbar-left{display:flex;flex-direction:column;gap:2px}
.app-name{font-size:20px;font-weight:700}
.app-meta{font-size:12px;color:var(--secondary-text-color)}
.refresh-btn{background:var(--card-background-color,#2a2a2a);border:1px solid var(--divider-color,rgba(255,255,255,0.12));border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;color:var(--primary-text-color);font-family:inherit;transition:border-color 0.15s,color 0.15s}
.refresh-btn:hover{border-color:#03a9f4;color:#03a9f4}
.tabs-row{display:flex;gap:2px;border-bottom:2px solid var(--divider-color,rgba(255,255,255,0.12));margin-bottom:16px}
.tab-btn{background:none;border:none;padding:10px 16px;font-size:14px;font-weight:500;color:var(--secondary-text-color);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;font-family:inherit;transition:color 0.2s,border-color 0.2s}
.tab-btn:hover{color:#03a9f4}
.tab-active{color:#03a9f4!important;border-bottom-color:#03a9f4!important}
.content{display:flex;flex-direction:column;gap:12px}
.error-strip{background:#ffebee;color:#c62828;padding:10px 14px;border-radius:8px;border-left:4px solid #c62828;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.error-strip button{background:none;border:none;cursor:pointer;font-size:16px;color:#c62828}
.section{background:var(--card-background-color,rgba(255,255,255,0.04));border-radius:10px;padding:16px}
.section-h2{margin:0 0 8px;font-size:18px;font-weight:600}
.section-label{font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--secondary-text-color);margin-bottom:10px;display:block}
.section-label-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cnt-badge{background:var(--divider-color,rgba(255,255,255,0.12));color:var(--secondary-text-color);font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px}
.sec-desc{font-size:12px;color:var(--secondary-text-color);margin:0 0 12px}
.info-strip{background:rgba(255,152,0,0.12);color:#ff9800;padding:10px 14px;border-radius:8px;margin-bottom:12px;border-left:4px solid #ff9800;font-size:13px}
.lock-strip{background:rgba(239,83,80,0.12);color:#ef5350;padding:10px 14px;border-radius:8px;margin-bottom:12px;border-left:4px solid #ef5350;font-size:13px}
.vhus-toggle{display:flex;gap:8px;margin-bottom:12px}
.vhus-btn{display:flex;align-items:center;gap:6px;flex:1;padding:10px 14px;border-radius:8px;cursor:pointer;background:var(--primary-background-color,rgba(255,255,255,0.05));border:2px solid var(--divider-color,rgba(255,255,255,0.12));color:var(--secondary-text-color);font-size:14px;font-weight:500;font-family:inherit;transition:all 0.15s;justify-content:center}
.vhus-btn:hover{border-color:#03a9f4;color:#03a9f4}
.vhus-active{border-color:#03a9f4!important;color:#03a9f4!important;background:rgba(3,169,244,0.08)!important}
.field-blk{margin-bottom:10px}
.field-lbl{display:block;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;color:var(--secondary-text-color);margin-bottom:5px}
.sel-wrap{position:relative}
.sel-arr{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--secondary-text-color);font-size:12px}
.field-sel,.field-inp{width:100%;padding:10px 14px;border-radius:8px;font-size:14px;background:var(--primary-background-color,rgba(255,255,255,0.05));border:1px solid var(--divider-color,rgba(255,255,255,0.12));color:var(--primary-text-color);appearance:none;font-family:inherit;cursor:pointer}
.field-sel:disabled,.field-inp:disabled{opacity:0.5;cursor:not-allowed}
.field-inp:focus,.field-sel:focus{outline:none;border-color:#03a9f4}
.slot-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.slot-chip{font-size:11px;padding:3px 7px;border-radius:6px;font-weight:600}
.chip-free{background:rgba(76,175,80,0.15);color:#4caf50}
.chip-booked{background:rgba(239,83,80,0.12);color:#ef5350}
.book-btn{width:100%;padding:13px;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity 0.15s}
.book-btn:disabled{cursor:not-allowed;opacity:0.6}
.btn-ready{background:linear-gradient(135deg,#03a9f4,#0288d1);color:#fff}
.btn-ready:hover{opacity:0.9}
.btn-full,.btn-locked{background:#424242;color:#bdbdbd}
.btn-full-w{width:100%;padding:13px;font-size:15px}
.brow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:6px;background:var(--primary-background-color,rgba(255,255,255,0.04));border:1px solid var(--divider-color,rgba(255,255,255,0.08))}
.brow:last-child{margin-bottom:0}
.brow-accent{width:4px;height:36px;border-radius:2px;flex-shrink:0}
.ba-klat{background:#03a9f4}
.ba-stor{background:#4caf50}
.brow-info{flex:1;min-width:0}
.brow-name{font-size:14px;font-weight:600;display:block}
.brow-meta{font-size:12px;color:var(--secondary-text-color);display:block;margin-top:2px}
.del-btn{background:none;border:1px solid var(--divider-color,rgba(255,255,255,0.2));border-radius:6px;padding:5px 9px;cursor:pointer;font-size:14px;color:var(--secondary-text-color);font-family:inherit;transition:all 0.15s}
.del-btn:hover:not(:disabled){border-color:#dc2626;color:#dc2626}
.del-btn:disabled{opacity:0.3;cursor:not-allowed}
.empty-row{text-align:center;color:var(--secondary-text-color);padding:20px;font-size:13px}
.dev-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.dev-chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;cursor:pointer;background:var(--primary-background-color,rgba(255,255,255,0.04));border:1px solid var(--divider-color,rgba(255,255,255,0.12));font-size:13px;transition:all 0.15s}
.dev-chip.dev-on{border-color:#03a9f4;background:rgba(3,169,244,0.08);color:#03a9f4}
.dev-dot{width:8px;height:8px;border-radius:50%;background:var(--divider-color,#555);flex-shrink:0}
.dev-dot.dot-on{background:#03a9f4}
.notif-list{display:flex;flex-direction:column;gap:8px}
.notif-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:var(--primary-background-color,rgba(255,255,255,0.04));border:1px solid var(--divider-color,rgba(255,255,255,0.08))}
.notif-left{display:flex;align-items:center;gap:10px}
.notif-texts{display:flex;flex-direction:column}
.notif-name{font-size:14px;font-weight:500}
.notif-msg{font-size:12px;color:var(--secondary-text-color);margin-top:2px}
.notif-acts{display:flex;gap:6px}
.tog-wrap{display:flex;align-items:center;cursor:pointer}
.tog-wrap input{display:none}
.tog-track{width:36px;height:20px;background:var(--divider-color,#555);border-radius:10px;position:relative;transition:background 0.2s;flex-shrink:0}
.tog-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:left 0.2s}
.tog-wrap input:checked~.tog-track{background:#03a9f4}
.thumb-on{left:18px!important}
.ghost-btn{background:none;border:1px solid var(--divider-color,rgba(255,255,255,0.2));border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;color:var(--secondary-text-color);font-family:inherit;transition:all 0.15s}
.ghost-btn:hover:not(:disabled){border-color:#03a9f4;color:#03a9f4}
.ghost-btn:disabled{opacity:0.4;cursor:not-allowed}
.ghost-green:hover:not(:disabled){border-color:#4caf50;color:#4caf50}
.act-btn{background:linear-gradient(135deg,#03a9f4,#0288d1);color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit}
.act-btn.saving{opacity:0.6;cursor:not-allowed}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
.modal-box{background:var(--card-background-color,#2a2a2a);border-radius:12px;padding:24px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.modal-title{font-size:16px;font-weight:700}
.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--secondary-text-color);padding:4px;font-family:inherit}
.modal-field{margin-bottom:14px}
.field-ta{width:100%;padding:10px 12px;border-radius:8px;font-size:14px;background:var(--primary-background-color,rgba(255,255,255,0.05));border:1px solid var(--divider-color,rgba(255,255,255,0.15));color:var(--primary-text-color);font-family:inherit;resize:vertical;min-height:70px}
.field-ta:focus{outline:none;border-color:#03a9f4}
.preview-line{font-size:12px;color:var(--secondary-text-color);margin-top:4px}
.preview-k{font-weight:600;margin-right:4px}
.var-row{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.var-tag{background:rgba(3,169,244,0.1);color:#03a9f4;border-radius:4px;padding:2px 6px;font-size:12px;font-family:monospace}
.modal-acts{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}
.modal-acts-r{display:flex;gap:8px}
.stats-empty{text-align:center;padding:32px;color:var(--secondary-text-color);font-size:14px}
.stats-count{font-size:12px;color:var(--secondary-text-color);margin-bottom:8px}
.history-list{background:var(--primary-background-color,rgba(255,255,255,0.03));border-radius:8px;overflow:hidden}
.history-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--divider-color,rgba(255,255,255,0.06))}
.history-item:last-child{border-bottom:none}
.history-left{display:flex;flex-direction:column;gap:2px}
.history-name{font-size:14px;font-weight:600}
.history-meta,.history-user{font-size:12px;color:var(--secondary-text-color)}
.cleanup-btn{width:100%;padding:11px;background:var(--primary-background-color,rgba(255,255,255,0.04));border:1px solid var(--divider-color,rgba(255,255,255,0.12));color:var(--primary-text-color);border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit}
.cleanup-btn:hover{background:rgba(255,255,255,0.07)}
.cleanup-result{font-size:13px;text-align:center;margin:8px 0 0}
.admin-section{background:var(--primary-background-color,rgba(255,255,255,0.04));border-radius:8px;padding:14px;margin-bottom:14px}
.admin-h3{margin:0 0 4px;font-size:14px;font-weight:600}
.admin-desc{font-size:12px;color:var(--secondary-text-color);margin:0 0 10px}
.admin-ta{width:100%;min-height:65px;padding:10px;box-sizing:border-box;background:var(--card-background-color,rgba(255,255,255,0.03));border:1px solid var(--divider-color,rgba(255,255,255,0.12));border-radius:8px;color:var(--primary-text-color);font-family:inherit;font-size:13px;resize:vertical}
.admin-toggle{display:flex;align-items:center;gap:12px;cursor:pointer}
.admin-toggle input{display:none}
.tog-slider{width:44px;height:24px;background:var(--divider-color,#555);border-radius:12px;position:relative;transition:background 0.2s;flex-shrink:0}
.tog-slider::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left 0.2s}
.admin-toggle input:checked~.tog-slider{background:#e53935}
.admin-toggle input:checked~.tog-slider::after{left:22px}
.tog-label{font-size:14px;font-weight:500}
.mt8{margin-top:8px}
.mt16{margin-top:16px}
.spin{display:inline-block;animation:sp 0.7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
    `;
  }
}

if (!customElements.get("mielelogic-panel-v2")) {
  customElements.define("mielelogic-panel-v2", MieleLogicPanel);
}
