// MieleLogic Panel — Main UI Component
// VERSION = "2.0.0"
// Architecture: vanilla HTMLElement + shadow DOM
// Design: Indeklima Designer (blue/cyan accent)
// element name: mielelogic-panel-v2


const _ML_LOGO = "data:image/png;base64,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";

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
    this._render();
    this._interval = setInterval(() => {
      if (this._errCount > 3) { clearInterval(this._interval); return; }
      if (document.visibilityState === "visible") this._loadAll();
    }, 30000);
  }

  disconnectedCallback() { clearInterval(this._interval); }

  async _init() { await this._loadAll(); await this._loadAdmin(); }

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
        if (!this._selectedSlot || this._slots.every(s => s.booked)) this._selectedSlot = preferred.start;
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

  /* ════════════════════ RENDER ════════════════════ */

  _render() {
    const root = this.shadowRoot;
    root.innerHTML = `<style>${this._css()}</style>${this._html()}`;
    this._bindEvents(root);
  }

  _html() {
    if (!this._hass) return `<div class="page"><div class="loading-wrap"><span class="spin">↻</span> Indlæser MieleLogic…</div></div>`;
    const count = this._bookings.length;
    const max = this._status.max_reservations;
    return `<div class="panel-topbar">${this._htmlHeader(count, max)}${this._htmlTabs()}</div><div class="panel-scroll">${this._error ? `<div class="error-strip"><span>⚠ ${this._error}</span><button data-action="clear-error">✕</button></div>` : ""}${this._tab === "booking" ? this._htmlBooking() : ""}${this._tab === "notifications" ? this._htmlNotifications() : ""}${this._tab === "stats" ? this._htmlStats() : ""}${this._tab === "admin" ? this._htmlAdmin() : ""}${this._editingId ? this._htmlModal() : ""}</div>`;
  }

  _htmlHeader(count, max) {
    const bal = this._status.balance ? ` · ${this._fmtCurrency(this._status.balance)}` : "";
    return `<div class="header"><div class="header-icon"><img src="${_ML_LOGO}" alt="MieleLogic"></div><div class="header-text"><h1>MieleLogic</h1><div class="header-meta">${count}${max ? ` / ${max}` : ""} booking${count !== 1 ? "er" : ""}${bal} · v2.0.0</div></div><button class="header-refresh" data-action="refresh" ${this._loading ? "disabled" : ""}><span class="${this._loading ? "spin" : ""}">↻</span> Opdater</button></div>`;
  }

  _htmlTabs() {
    const tabs = [{ id: "booking", icon: "📋", label: "Oversigt" }, { id: "notifications", icon: "🔔", label: "Notifikationer" }, { id: "stats", icon: "📊", label: "Historik" }, { id: "admin", icon: "⚙️", label: "Admin" }];
    return `<div class="tab-bar">${tabs.map(t => `<button class="tab${this._tab === t.id ? " active" : ""}" data-tab="${t.id}"><span class="tab-icon">${t.icon}</span><span class="tab-label">${t.label}</span></button>`).join("")}</div>`;
  }

  _htmlBooking() {
    const s = this._admin, locked = s.booking_locked;
    const canBook = !locked && this._bookings.length < (this._status.max_reservations || 99);
    const infoMsg = s.info_message ? `<div class="info-strip">📢 ${s.info_message}</div>` : "";
    const lockMsg = locked ? `<div class="lock-strip">🔒 ${s.lock_message || "Booking er midlertidigt spærret"}</div>` : "";
    const slotsOpts = this._slots.length === 0 ? `<option>Henter tidslots…</option>` : this._slots.map(sl => `<option value="${sl.start}" ${this._selectedSlot === sl.start ? "selected" : ""} ${sl.booked ? "disabled" : ""}>${sl.booked ? sl.label + " — Optaget" : sl.label}</option>`).join("");
    const bookBtn = this._loading ? `<button class="book-btn btn-loading" disabled><span class="spin">↻</span> Booker…</button>` : locked ? `<button class="book-btn btn-locked" disabled>🔒 ${s.lock_message || "Booking spærret"}</button>` : !canBook ? `<button class="book-btn btn-full" disabled>Max bookinger nået</button>` : `<button class="book-btn btn-ready" data-action="book">Book nu</button>`;
    const chips = this._slots.map(sl => `<span class="slot-chip ${sl.booked ? "chip-booked" : "chip-free"}">${sl.start} ${sl.booked ? "✕" : "✓"}</span>`).join("");
    const bookingsHtml = this._bookings.length === 0 ? `<div class="empty-row">Ingen aktive bookinger</div>` : this._bookings.map(b => this._htmlBookingRow(b)).join("");
    return `<div class="card">${infoMsg}${lockMsg}<div class="section-title">NY BOOKING</div><div class="vhus-toggle"><button class="vhus-btn${this._vaskehus === "Klatvask" ? " vhus-active" : ""}" data-vhus="Klatvask">${this._svgKlatvask()} Klatvask</button><button class="vhus-btn${this._vaskehus === "Storvask" ? " vhus-active" : ""}" data-vhus="Storvask">${this._svgStorvask()} Storvask</button></div><div class="field-blk"><span class="field-lbl">TIDSBLOK</span><div class="sel-wrap"><select class="field-sel" data-field="slot" ${this._loading || !this._slots.length ? "disabled" : ""}>${slotsOpts}</select><span class="sel-arr">▾</span></div></div><div class="slot-chips">${chips}</div><div class="field-blk"><span class="field-lbl">DATO</span><input type="date" class="field-inp" data-field="date" value="${this._selectedDate}" ${this._loading ? "disabled" : ""}/></div>${bookBtn}</div><div class="card"><div class="section-title-row"><span class="section-title">AKTIVE BOOKINGER</span><span class="cnt-badge">${this._bookings.length}</span></div>${bookingsHtml}</div>`;
  }

  _htmlBookingRow(b) {
    const dur = (() => { const d = b.Duration ?? b.duration; if (d != null && !isNaN(+d)) return +d + " min"; try { const m = Math.round((new Date(b.End) - new Date(b.Start)) / 60000); if (m > 0) return m + " min"; } catch(e) {} return ""; })();
    return `<div class="brow"><div class="brow-accent ${b.vaskehus === "Storvask" ? "ba-stor" : "ba-klat"}"></div><div class="brow-info"><span class="brow-name">${b.vaskehus || "Booking"}</span><span class="brow-meta">${this._fmtDate(b.Start)}${dur ? " · " + dur : ""}${b.created_by ? " · " + b.created_by : ""}</span></div><button class="del-btn" data-cancel='${JSON.stringify({MachineNumber:b.MachineNumber,Start:b.Start,End:b.End,vaskehus:b.vaskehus})}' ${this._loading ? "disabled" : ""} title="Slet">✕</button></div>`;
  }

  _htmlNotifications() {
    const devHtml = this._availableDevices.length === 0 ? `<div class="empty-row">Ingen mobile apps — installer HA Companion</div>` : `<div class="dev-list">${this._availableDevices.map(d => `<label class="dev-chip${this._devices.includes(d.service) ? " dev-on" : ""}"><span class="dev-dot${this._devices.includes(d.service) ? " dot-on" : ""}"></span><span>${d.name}</span><input type="checkbox" data-device="${d.service}" ${this._devices.includes(d.service) ? "checked" : ""} style="display:none"/></label>`).join("")}</div><button class="act-btn" data-action="save-devices">Gem enheder</button>`;
    const notifHtml = Object.keys(this._notifications).length === 0 ? `<div class="empty-row">Ingen notifikationer konfigureret</div>` : `<div class="notif-list">${Object.entries(this._notifications).map(([id,n]) => `<div class="notif-row${n.enabled ? " notif-on" : ""}"><div class="notif-left"><label class="tog-wrap"><input type="checkbox" data-toggle-notif="${id}" ${n.enabled ? "checked" : ""}/><span class="tog-track"><span class="tog-thumb${n.enabled ? " thumb-on" : ""}"></span></span></label><div class="notif-texts"><span class="notif-name">${n.title}</span><span class="notif-msg">${n.message}</span></div></div><div class="notif-acts"><button class="ghost-btn" data-edit-notif="${id}">Rediger</button><button class="ghost-btn ghost-green" data-test-notif="${id}" ${!n.enabled || !this._devices.length ? "disabled" : ""}>Test</button></div></div>`).join("")}</div>`;
    return `<div class="card"><div class="section-title">MOBILE ENHEDER</div><p class="sec-desc">Vælg enheder der modtager notifikationer</p>${devHtml}</div><div class="card"><div class="section-title">NOTIFIKATIONER</div><p class="sec-desc">Aktiver og tilpas beskedskabeloner</p>${notifHtml}</div>`;
  }

  _htmlModal() {
    const n = this._notifications[this._editingId]; if (!n) return "";
    return `<div class="modal-bg" data-action="close-modal"><div class="modal-box"><div class="modal-head"><span class="modal-title">Rediger skabelon</span><button class="modal-close" data-action="close-modal">✕</button></div><div class="modal-field"><label class="field-lbl">TITEL</label><input class="field-inp" type="text" data-modal-field="title" value="${this._esc(this._editTitle)}" placeholder="Notifikationstitel"/><div class="preview-line"><span class="preview-k">Eksempel:</span> ${this._preview(this._editTitle)}</div></div><div class="modal-field"><label class="field-lbl">BESKED</label><textarea class="field-ta" data-modal-field="message" rows="3" placeholder="Beskedtekst">${this._esc(this._editMessage)}</textarea><div class="preview-line"><span class="preview-k">Eksempel:</span> ${this._preview(this._editMessage)}</div></div><div class="var-row">${["{vaskehus}","{time}","{date}","{duration}","{machine}"].map(v=>`<code class="var-tag">${v}</code>`).join("")}</div><div class="modal-acts"><button class="ghost-btn" data-action="reset-notif">Nulstil</button><div class="modal-acts-r"><button class="ghost-btn" data-action="close-modal">Annuller</button><button class="act-btn" data-action="save-edit">Gem skabelon</button></div></div></div></div>`;
  }

  _htmlStats() {
    const fmt = e => { const s=e.start_time||"",d=s.split(" ")[0]||s.split("T")[0]||"–",t=(s.split(" ")[1]||s.split("T")[1]||"").slice(0,5)||"–",p=d.split("-"); return {ds:p.length===3?`${p[2]}.${p[1]}`:d,t,dur:e.duration?e.duration+" min":"–",u:e.created_by||"–",v:e.vaskehus||`Maskine ${e.machine}`}; };
    const items = this._historyLoading ? `<div class="empty-row">Henter historik…</div>` : !this._history.length ? `<div class="empty-row">Ingen afsluttede bookinger de seneste 30 dage</div>` : `<div class="stats-count">${this._history.length} booking${this._history.length!==1?"er":""} fundet</div><div class="history-list">${this._history.map(e=>{const f=fmt(e);return `<div class="history-item"><div class="history-left"><span class="history-name">${f.v}</span><span class="history-meta">${f.ds} · ${f.t} · ${f.dur}</span></div><span class="history-user">${f.u}</span></div>`;}).join("")}</div>`;
    return `<div class="card"><div class="section-title">STATISTIK</div><p class="sec-desc">Afsluttede bookinger de seneste 30 dage</p>${items}<div style="margin-top:16px"><button class="cleanup-btn" data-action="cleanup-history">Ryd metadata ældre end 30 dage</button>${this._cleanupResult?`<p class="cleanup-result">${this._cleanupResult}</p>`:""}</div></div>`;
  }

  _htmlAdmin() {
    const a = this._admin;
    return `<div class="card"><div class="section-title">ADMIN</div><div class="admin-section"><div class="admin-h3">Driftsbesked</div><p class="admin-desc">Vises øverst i booking kortet til alle brugere.</p><textarea class="admin-ta" data-admin="info_message" placeholder="f.eks. Vaskehuset rengøres fredag...">${this._esc(a.info_message||"")}</textarea></div><div class="admin-section"><div class="admin-h3">Booking spærring</div><p class="admin-desc">Spærrer for nye bookinger. Eksisterende påvirkes ikke.</p><label class="admin-toggle"><input type="checkbox" data-admin-check="booking_locked" ${a.booking_locked?"checked":""}/><span class="tog-slider"></span><span class="tog-label">${a.booking_locked?"🔒 Booking spærret":"🔓 Booking åben"}</span></label>${a.booking_locked?`<input type="text" class="field-inp" style="margin-top:8px" data-admin="lock_message" placeholder="Besked til brugerne..." value="${this._esc(a.lock_message||"")}"/>`:"" }</div><button class="act-btn act-btn-full${this._adminSaving?" saving":""}" data-action="save-admin" ${this._adminSaving?"disabled":""}>${this._adminSaving?"Gemmer…":"Gem indstillinger"}</button></div>`;
  }

  /* ════════════════════ EVENTS ════════════════════ */

  _bindEvents(root) {
    root.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this._tab=b.dataset.tab; if(this._tab==="stats"&&!this._history.length) this._loadHistory(); else this._render(); }));
    root.querySelectorAll("[data-vhus]").forEach(b => b.addEventListener("click", () => { this._vaskehus=b.dataset.vhus; this._selectedSlot=""; this._loadSlots().then(()=>this._render()); }));
    const slotSel=root.querySelector("[data-field='slot']"); if(slotSel) slotSel.addEventListener("change",e=>{this._selectedSlot=e.target.value;});
    const dateIn=root.querySelector("[data-field='date']"); if(dateIn) dateIn.addEventListener("change",e=>{this._selectedDate=e.target.value;this._selectedSlot="";this._loadSlots().then(()=>this._render());});
    root.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", e => {
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
    const mb=root.querySelector(".modal-bg"); if(mb) mb.addEventListener("click",e=>{if(e.target===mb)this._closeModal();});
    root.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click",()=>{try{this._doCancel(JSON.parse(b.dataset.cancel));}catch(e){}}));
    root.querySelectorAll("[data-device]").forEach(cb => cb.addEventListener("change",()=>{const s=cb.dataset.device;this._devices=cb.checked?[...this._devices.filter(d=>d!==s),s]:this._devices.filter(d=>d!==s);cb.closest("label")?.classList.toggle("dev-on",cb.checked);}));
    root.querySelectorAll("[data-toggle-notif]").forEach(cb => cb.addEventListener("change",()=>this._doToggleNotification(cb.dataset.toggleNotif)));
    root.querySelectorAll("[data-edit-notif]").forEach(b => b.addEventListener("click",()=>{const id=b.dataset.editNotif,n=this._notifications[id];if(!n)return;this._editingId=id;this._editTitle=n.title;this._editMessage=n.message;this._render();}));
    root.querySelectorAll("[data-test-notif]").forEach(b => b.addEventListener("click",()=>this._doTestNotification(b.dataset.testNotif)));
    const ti=root.querySelector("[data-modal-field='title']"); if(ti) ti.addEventListener("input",e=>{this._editTitle=e.target.value;});
    const ta=root.querySelector("[data-modal-field='message']"); if(ta) ta.addEventListener("input",e=>{this._editMessage=e.target.value;});
    root.querySelectorAll("[data-admin]").forEach(el=>el.addEventListener("input",e=>{this._admin={...this._admin,[el.dataset.admin]:e.target.value};}));
    root.querySelectorAll("[data-admin-check]").forEach(cb=>cb.addEventListener("change",()=>{this._admin={...this._admin,[cb.dataset.adminCheck]:cb.checked};this._render();}));
  }

  /* ════════════════════ CSS — Indeklima Designer ════════════════════ */

  _css() {
    return `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
:host,*{box-sizing:border-box;margin:0;padding:0}
:host{--bg:var(--primary-background-color,#0f1923);--bg2:var(--secondary-background-color,#1a2535);--bg3:#243044;--text:var(--primary-text-color,#e2e8f0);--sub:var(--secondary-text-color,#94a3b8);--div:var(--divider-color,rgba(148,163,184,0.12));--green:#10b981;--orange:#f59e0b;--red:#ef4444;--accent:#3b82f6;--accent2:#06b6d4;--accent-glow:rgba(59,130,246,0.15);--card-radius:18px;display:flex;flex-direction:column;height:100%;font-family:'DM Sans',var(--paper-font-body1_-_font-family,sans-serif);color:var(--text);background:var(--bg)}
.panel-topbar{flex-shrink:0;padding:16px 28px 12px;background:var(--bg);border-bottom:1px solid var(--div)}
.panel-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:20px 28px 48px}
.header{display:flex;align-items:center;gap:12px}
.header-icon{width:42px;height:42px;border-radius:12px;overflow:hidden;flex-shrink:0}
.header-icon img{width:100%;height:100%;object-fit:cover;display:block}
.header-text{flex:1;min-width:0}
.header-text h1{font-size:20px;font-weight:700;letter-spacing:-0.02em}
.header-meta{font-size:12px;color:var(--sub);font-weight:400;margin-top:2px}
.header-refresh{background:var(--bg2);border:1px solid var(--div);border-radius:10px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:500;color:var(--sub);font-family:inherit;transition:all 0.2s}
.header-refresh:hover{border-color:var(--accent);color:var(--accent)}
.tab-bar{display:flex;gap:4px;margin-top:12px}
.tab{padding:6px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;color:var(--sub);background:transparent;border:none;font-family:inherit;transition:all 0.2s;display:flex;align-items:center;gap:5px}
.tab:hover{background:var(--bg3);color:var(--text)}
.tab.active{background:var(--bg3);color:var(--accent)}
.tab-icon{font-size:14px}
@media(max-width:600px){.tab .tab-label{display:none}.tab-icon{font-size:18px}.panel-topbar{padding:12px 16px 8px}.panel-scroll{padding:12px 16px 32px}}
.card{background:var(--bg2);border-radius:var(--card-radius);border:1px solid var(--div);padding:16px 14px 12px;margin-bottom:14px;transition:border-color 0.2s}
.section-title{font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px 2px}
.section-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cnt-badge{background:var(--accent-glow);color:var(--accent);font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px}
.sec-desc{font-size:12px;color:var(--sub);margin:0 0 12px}
.error-strip{background:rgba(239,68,68,0.12);color:var(--red);padding:10px 14px;border-radius:10px;border-left:4px solid var(--red);font-size:13px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.error-strip button{background:none;border:none;cursor:pointer;font-size:16px;color:var(--red)}
.info-strip{background:rgba(245,158,11,0.12);color:var(--orange);padding:10px 14px;border-radius:10px;margin-bottom:12px;border-left:4px solid var(--orange);font-size:13px}
.lock-strip{background:rgba(239,68,68,0.12);color:var(--red);padding:10px 14px;border-radius:10px;margin-bottom:12px;border-left:4px solid var(--red);font-size:13px}
.vhus-toggle{display:flex;gap:8px;margin-bottom:12px}
.vhus-btn{display:flex;align-items:center;gap:6px;flex:1;padding:10px 14px;border-radius:10px;cursor:pointer;background:var(--bg);border:2px solid var(--div);color:var(--sub);font-size:14px;font-weight:500;font-family:inherit;transition:all 0.2s;justify-content:center}
.vhus-btn:hover{border-color:var(--accent);color:var(--accent)}
.vhus-active{border-color:var(--accent)!important;color:var(--accent)!important;background:var(--accent-glow)!important}
.field-blk{margin-bottom:10px}
.field-lbl{display:block;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--sub);margin-bottom:5px}
.sel-wrap{position:relative}
.sel-arr{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--sub);font-size:12px}
.field-sel,.field-inp{width:100%;padding:10px 14px;border-radius:10px;font-size:14px;background:var(--bg);border:1px solid var(--div);color:var(--text);appearance:none;font-family:inherit;cursor:pointer;transition:border-color 0.2s}
.field-sel:disabled,.field-inp:disabled{opacity:0.5;cursor:not-allowed}
.field-inp:focus,.field-sel:focus{outline:none;border-color:var(--accent)}
.slot-chips{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.slot-chip{font-size:11px;padding:3px 8px;border-radius:12px;font-weight:600;font-family:'DM Mono',monospace}
.chip-free{background:rgba(74,222,128,0.08);border:1.5px solid rgba(74,222,128,0.35);color:#4ade80;cursor:pointer;transition:all 0.15s}
.chip-free:hover{background:rgba(74,222,128,0.16);border-color:#4ade80}
.chip-booked{background:rgba(55,65,81,0.35);border:1.5px solid rgba(55,65,81,0.5);color:#374151;cursor:not-allowed;opacity:0.6;text-decoration:line-through}
.book-btn{width:100%;padding:13px;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity 0.2s}
.book-btn:disabled{cursor:not-allowed;opacity:0.6}
.btn-ready{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}
.btn-ready:hover{opacity:0.9}
.btn-full,.btn-locked,.btn-loading{background:var(--bg3);color:var(--sub)}
.brow{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:var(--bg);border:1px solid var(--div);transition:border-color 0.2s}
.brow:hover{border-color:rgba(148,163,184,0.28)}
.brow:last-child{margin-bottom:0}
.brow-accent{width:4px;height:36px;border-radius:2px;flex-shrink:0}
.ba-klat{background:var(--accent)}
.ba-stor{background:var(--green)}
.brow-info{flex:1;min-width:0}
.brow-name{font-size:14px;font-weight:600;display:block}
.brow-meta{font-size:12px;color:var(--sub);display:block;margin-top:2px}
.del-btn{background:none;border:1px solid var(--div);border-radius:8px;padding:5px 9px;cursor:pointer;font-size:14px;color:var(--sub);font-family:inherit;transition:all 0.2s}
.del-btn:hover:not(:disabled){border-color:var(--red);color:var(--red)}
.del-btn:disabled{opacity:0.3;cursor:not-allowed}
.empty-row{text-align:center;color:var(--sub);padding:20px;font-size:13px}
.dev-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.dev-chip{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:10px;cursor:pointer;background:var(--bg);border:1px solid var(--div);font-size:13px;transition:all 0.2s}
.dev-chip.dev-on{border-color:var(--accent);background:var(--accent-glow);color:var(--accent)}
.dev-dot{width:8px;height:8px;border-radius:50%;background:var(--bg3);flex-shrink:0}
.dev-dot.dot-on{background:var(--accent)}
.notif-list{display:flex;flex-direction:column;gap:8px}
.notif-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--div)}
.notif-left{display:flex;align-items:center;gap:10px}
.notif-texts{display:flex;flex-direction:column}
.notif-name{font-size:14px;font-weight:500}
.notif-msg{font-size:12px;color:var(--sub);margin-top:2px}
.notif-acts{display:flex;gap:6px}
.tog-wrap{display:flex;align-items:center;cursor:pointer}
.tog-wrap input{display:none}
.tog-track{width:36px;height:20px;background:var(--bg3);border-radius:10px;position:relative;transition:background 0.2s;flex-shrink:0}
.tog-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:left 0.2s}
.tog-wrap input:checked~.tog-track{background:var(--accent)}
.thumb-on{left:18px!important}
.ghost-btn{background:none;border:1px solid var(--div);border-radius:8px;padding:5px 10px;cursor:pointer;font-size:13px;color:var(--sub);font-family:inherit;transition:all 0.2s}
.ghost-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.ghost-btn:disabled{opacity:0.4;cursor:not-allowed}
.ghost-green:hover:not(:disabled){border-color:var(--green);color:var(--green)}
.act-btn{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit;transition:opacity 0.2s}
.act-btn:hover{opacity:0.9}
.act-btn.saving{opacity:0.6;cursor:not-allowed}
.act-btn-full{width:100%;padding:13px;font-size:15px;border-radius:10px}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
.modal-box{background:var(--bg2);border-radius:var(--card-radius);border:1px solid var(--div);padding:24px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.modal-title{font-size:16px;font-weight:700}
.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--sub);padding:4px;font-family:inherit}
.modal-field{margin-bottom:14px}
.field-ta{width:100%;padding:10px 12px;border-radius:10px;font-size:14px;background:var(--bg);border:1px solid var(--div);color:var(--text);font-family:inherit;resize:vertical;min-height:70px;transition:border-color 0.2s}
.field-ta:focus{outline:none;border-color:var(--accent)}
.preview-line{font-size:12px;color:var(--sub);margin-top:4px}
.preview-k{font-weight:600;margin-right:4px}
.var-row{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.var-tag{background:var(--accent-glow);color:var(--accent);border-radius:6px;padding:2px 8px;font-size:12px;font-family:'DM Mono',monospace}
.modal-acts{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}
.modal-acts-r{display:flex;gap:8px}
.stats-count{font-size:12px;color:var(--sub);margin-bottom:8px}
.history-list{background:var(--bg);border-radius:10px;overflow:hidden;border:1px solid var(--div)}
.history-item{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--div)}
.history-item:last-child{border-bottom:none}
.history-left{display:flex;flex-direction:column;gap:2px}
.history-name{font-size:14px;font-weight:600}
.history-meta,.history-user{font-size:12px;color:var(--sub)}
.cleanup-btn{width:100%;padding:11px;background:var(--bg);border:1px solid var(--div);color:var(--text);border-radius:10px;font-size:14px;cursor:pointer;font-family:inherit;transition:all 0.2s}
.cleanup-btn:hover{border-color:var(--accent);color:var(--accent)}
.cleanup-result{font-size:13px;text-align:center;margin:8px 0 0;color:var(--sub)}
.admin-section{background:var(--bg);border-radius:10px;border:1px solid var(--div);padding:14px;margin-bottom:14px}
.admin-h3{font-size:14px;font-weight:600;margin-bottom:4px}
.admin-desc{font-size:12px;color:var(--sub);margin-bottom:10px}
.admin-ta{width:100%;min-height:65px;padding:10px;background:var(--bg2);border:1px solid var(--div);border-radius:10px;color:var(--text);font-family:inherit;font-size:13px;resize:vertical;transition:border-color 0.2s}
.admin-ta:focus{outline:none;border-color:var(--accent)}
.admin-toggle{display:flex;align-items:center;gap:12px;cursor:pointer}
.admin-toggle input{display:none}
.tog-slider{width:44px;height:24px;background:var(--bg3);border-radius:12px;position:relative;transition:background 0.2s;flex-shrink:0}
.tog-slider::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:left 0.2s}
.admin-toggle input:checked~.tog-slider{background:var(--red)}
.admin-toggle input:checked~.tog-slider::after{left:22px}
.tog-label{font-size:14px;font-weight:500}
.loading-wrap{text-align:center;padding:60px 20px;color:var(--sub);font-size:15px}
.spin{display:inline-block;animation:sp 0.7s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
    `;
  }
}

if (!customElements.get("mielelogic-panel-v2")) {
  customElements.define("mielelogic-panel-v2", MieleLogicPanel);
}
