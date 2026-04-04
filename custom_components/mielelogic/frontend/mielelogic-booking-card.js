/**
 * MieleLogic Booking Card
 * VERSION = "2.0.0"
 *
 * Custom Lovelace card — same visual language as Heat Manager / Indeklima.
 * Dark background, uppercase section labels, clean metric rows.
 *
 * v1.9.2: Date-aware slot availability — booked slots shown as disabled grey chips
 */

class MieleLogicBookingCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._vaskehus = "Klatvask";
    this._slots = [];
    this._selectedSlot = "";
    this._selectedDate = new Date().toISOString().split("T")[0];
    this._bookings = [];
    this._status = {};
    this._loading = false;
    this._error = null;
    this._machines = [];
    this._toast = null;
    this._toastTimer = null;
    this._refreshTimer = null;
    this._errorCount = 0;
    this._initialized = false;
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && !this._initialized) {
      this._initialized = true;
      this._render();
      this._loadData();
      this._refreshTimer = setInterval(() => {
        if (this._errorCount > 3) { clearInterval(this._refreshTimer); return; }
        if (!this._loading && document.visibilityState === "visible") {
          this._loadData().catch(() => this._errorCount++);
        }
      }, 30000);
    }
  }

  setConfig(config) { this._config = config || {}; }

  disconnectedCallback() {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
  }

  // ── DATA ────────────────────────────────────────────────────────────────────

  async _loadData() {
    try {
      await Promise.all([this._loadSlots(), this._loadBookings(), this._loadStatus(), this._loadMachines()]);
      this._errorCount = 0;
    } catch (e) { this._errorCount++; throw e; }
  }

  async _loadSlots() {
    try {
      // v1.9.2: Pass current date so backend can annotate booked slots
      const r = await this._hass.callWS({
        type: "mielelogic/get_slots",
        vaskehus: this._vaskehus,
        date: this._selectedDate,
      });
      this._slots = r.slots || [];

      // Auto-select first FREE slot; fall back to first slot if all booked
      const firstFree = this._slots.find(s => !s.booked);
      const candidate = firstFree || this._slots[0];
      if (candidate && !this._selectedSlot) {
        this._selectedSlot = candidate.start;
      } else if (candidate && this._slots.every(s => s.start !== this._selectedSlot)) {
        // Previously selected slot is no longer in list (vaskehus changed)
        this._selectedSlot = candidate.start;
      }
    } catch (e) {
      this._error = "Kunne ikke hente tidslots";
    }
    this._update();
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

  async _loadMachines() {
    try {
      const r = await this._hass.callWS({ type: "mielelogic/get_machines" });
      this._machines = r.machines || [];
    } catch (e) { this._machines = []; }
    this._update();
  }

  async _handleVaskehusChange(v) {
    this._vaskehus = v;
    this._selectedSlot = "";
    this._slots = [];
    this._update();
    await this._loadSlots();
  }

  // v1.9.2: When date changes, reload slots with new date for availability check
  async _handleDateChange(date) {
    this._selectedDate = date;
    this._selectedSlot = "";
    this._update();
    await this._loadSlots();
  }

  async _handleBooking() {
    if (!this._selectedSlot || !this._selectedDate) { alert("Vælg tidslot og dato"); return; }
    const slot = this._slots.find(s => s.start === this._selectedSlot);
    if (slot && slot.booked) { alert("Dette tidslot er allerede booket for den valgte dato."); return; }
    if (!confirm(`Book ${this._vaskehus} ${this._selectedDate} ${slot?.label || ""}?`)) return;

    this._loading = true; this._error = null; this._update();
    try {
      const r = await this._hass.callWS({ type: "mielelogic/make_booking", vaskehus: this._vaskehus, slot_start: this._selectedSlot, date: this._selectedDate });
      if (r.success) { this._showToast(r.message, "success"); await new Promise(res => setTimeout(res, 500)); await this._loadData(); }
      else { this._showToast(r.message, "error"); this._error = r.message; }
    } catch (e) { this._showToast("Booking fejlede", "error"); }
    this._loading = false; this._update();
  }

  async _handleCancel(b) {
    if (!confirm(`Slet ${b.vaskehus} booking ${this._fmt(b.Start)}?`)) return;
    this._loading = true; this._update();
    try {
      const r = await this._hass.callWS({ type: "mielelogic/cancel_booking", machine_number: b.MachineNumber, start_time: b.Start, end_time: b.End });
      if (r.success) { this._showToast("Booking slettet", "success"); await new Promise(res => setTimeout(res, 500)); await this._loadData(); }
      else { this._showToast(r.message, "error"); }
    } catch (e) { this._showToast("Sletning fejlede", "error"); }
    this._loading = false; this._update();
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  _fmt(ds) {
    try {
      return new Date(ds).toLocaleString("da-DK", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ds; }
  }

  _fmtCur(a) {
    try { return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(a); } catch (e) { return `${a} kr.`; }
  }

  _dur(b) {
    const d = b.Duration ?? b.duration;
    if (d != null && !isNaN(+d)) return +d + " min";
    try { const m = Math.round((new Date(b.End) - new Date(b.Start)) / 60000); if (m > 0) return m + " min"; } catch (e) {}
    return "";
  }

  _showToast(msg, type = "success") {
    this._toast = { msg, type };
    this._update();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this._toast = null; this._update(); }, 3500);
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────

  _render() {
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><div id="root"></div>`;
    this._update();
  }

  _update() {
    const root = this.shadowRoot.querySelector("#root");
    if (!root) return;

    const s = this._status;
    const isOpen     = s.is_open !== false;
    const locked     = s.booking_locked === true;
    const lockMsg    = s.lock_message || "Booking er midlertidigt spærret";
    const canBook    = s.can_book !== false && !locked;
    const count      = this._bookings.length;
    const maxRes     = s.max_reservations ?? "–";
    const balance    = s.balance != null ? this._fmtCur(s.balance) : null;
    const infoMsg    = s.info_message || "";

    // v1.9.2: Determine if the currently-selected slot is booked
    const selectedSlotObj = this._slots.find(sl => sl.start === this._selectedSlot);
    const selectedIsBooked = selectedSlotObj?.booked === true;

    const btnClass = this._loading ? "btn-loading"
      : !isOpen    ? "btn-closed"
      : locked     ? "btn-locked"
      : selectedIsBooked ? "btn-locked"
      : canBook    ? "btn-ready"
      : "btn-full";

    const btnLabel = this._loading
      ? `<span class="spin">↻</span> Booker…`
      : locked         ? `🔒 ${lockMsg}`
      : !isOpen        ? `Vaskehuset lukket`
      : selectedIsBooked ? `Tidslot allerede booket`
      : canBook        ? `Book nu`
      : `Max nået (${count}/${maxRes})`;

    const btnDisabled = !canBook || this._loading || selectedIsBooked || !isOpen || locked;

    root.innerHTML = `
      <div class="card-root">

        ${this._toast ? `<div class="toast toast-${this._toast.type}">${this._toast.msg}</div>` : ""}

        <!-- HEADER -->
        <div class="card-header">
          <div class="card-icon"><img src="/api/mielelogic-logo" alt="MieleLogic" style="width:24px;height:24px;border-radius:4px"></div>
          <div class="card-title-block">
            <span class="card-title">Vaskehus Booking</span>
            <span class="card-sub">
              ${count}${maxRes !== "–" ? ` / ${maxRes}` : ""} booking${count !== 1 ? "er" : ""}
              ${balance ? ` · ${balance}` : ""}
              ${isOpen
                ? `<span class="pill pill-open">· Åbent</span>`
                : `<span class="pill pill-closed">· Lukket</span>`}
            </span>
          </div>
        </div>

        ${this._error ? `<div class="error-bar">⚠ ${this._error}</div>` : ""}
        ${infoMsg     ? `<div class="info-bar"><span class="info-dot"></span>${infoMsg}</div>` : ""}

        <!-- MASKINER -->
        ${this._machines.length > 0 ? this._renderMachines(isOpen) : ""}

        <!-- NY BOOKING -->
        <div class="section">
          <div class="sec-label">NY BOOKING</div>

          <div class="vhus-row">
            <button class="vhus-btn ${this._vaskehus === "Klatvask" ? "vhus-on" : ""}" data-v="Klatvask" ${this._loading ? "disabled" : ""}>🫧 Klatvask</button>
            <button class="vhus-btn ${this._vaskehus === "Storvask" ? "vhus-on" : ""}" data-v="Storvask" ${this._loading ? "disabled" : ""}>♨️ Storvask</button>
          </div>

          <div class="field-blk">
            <span class="field-label">TIDSBLOK</span>
            <div class="sel-wrap">
              <select id="slot-sel" class="field-select" ${this._loading || this._slots.length === 0 ? "disabled" : ""}>
                ${this._slots.length === 0
                  ? `<option>Henter tidslots…</option>`
                  : this._slots.map(sl => `<option value="${sl.start}" ${this._selectedSlot === sl.start ? "selected" : ""} ${sl.booked ? "disabled" : ""}>${sl.label}${sl.booked ? " — optaget" : ""}</option>`).join("")}
              </select>
              <span class="sel-arr">▾</span>
            </div>
          </div>

          <!-- v1.9.2: Availability chips — clickable for free, greyed-out for booked -->
          ${this._slots.length > 0 ? `
            <div class="slot-chips">
              ${this._slots.map(sl => `
                <button
                  class="slot-chip ${sl.booked ? "chip-booked" : "chip-free"} ${this._selectedSlot === sl.start && !sl.booked ? "chip-active" : ""}"
                  data-start="${sl.start}"
                  ${sl.booked || this._loading ? "disabled" : ""}
                  title="${sl.booked ? sl.label + " — optaget" : sl.label + " — ledig"}"
                >${sl.start} ${sl.booked ? "✕" : "✓"}</button>
              `).join("")}
            </div>
          ` : ""}

          <div class="field-blk">
            <span class="field-label">DATO</span>
            <input id="date-inp" type="date" class="field-input" value="${this._selectedDate}" ${this._loading ? "disabled" : ""} />
          </div>

          <button id="book-btn" class="book-btn ${btnClass}" ${btnDisabled ? "disabled" : ""}>${btnLabel}</button>
        </div>

        <!-- AKTIVE BOOKINGER -->
        <div class="section">
          <div class="sec-label-row">
            <span class="sec-label">AKTIVE BOOKINGER</span>
            <span class="cnt-badge">${count}</span>
          </div>

          ${count === 0
            ? `<div class="empty-row">Ingen aktive bookinger</div>`
            : this._bookings.map(b => `
                <div class="brow">
                  <div class="brow-accent ${b.vaskehus === "Storvask" ? "ba-stor" : "ba-klat"}"></div>
                  <div class="brow-info">
                    <span class="brow-name">${b.vaskehus || "Booking"}</span>
                    <span class="brow-meta">${this._fmt(b.Start)}${this._dur(b) ? ` · ${this._dur(b)}` : ""}${b.created_by ? ` · <span class="brow-via">${b.created_by}</span>` : ""}</span>
                  </div>
                  <button class="del-btn" data-start="${b.Start}" data-machine="${b.MachineNumber}" data-end="${b.End}" ${this._loading ? "disabled" : ""} title="Slet booking">✕</button>
                </div>
              `).join("")}
        </div>

      </div>
    `;

    this._bind();
  }

  _renderMachines(isOpen) {
    const colors = { available: "#4ade80", running: "#fb923c", reserved: "#60a5fa", closed: "#374151", unknown: "#374151" };
    const labels = { available: "Ledig", running: "I gang", reserved: "Reserveret", closed: "Lukket", unknown: "Ukendt" };
    const icons  = { washer: "🫧", dryer: "♨️" };

    const items = this._machines.map(m => {
      const icon  = icons[m.machine_type] || "🔧";
      const dState = (!isOpen && m.state === "available") ? "closed" : m.state;
      const color = colors[dState] || colors.unknown;
      const label = labels[dState] || dState;
      const tip   = (!isOpen && m.state === "available") ? `${m.name}: Lukket (API: ${m.status})` : `${m.name}: ${m.status}`;
      const short = m.name.replace(/klatvask|storvask/gi, "").trim() || m.name;
      return `
        <div class="mach-item" title="${tip}">
          <div class="mach-ring" style="--c:${color}">
            <span class="mach-icon">${icon}</span>
          </div>
          <div class="mach-name">${short}</div>
          <div class="mach-state" style="color:${color}">${label}</div>
        </div>
      `;
    }).join("");

    return `
      <div class="section">
        <div class="sec-label">MASKINER</div>
        <div class="mach-row">${items}</div>
      </div>
    `;
  }

  _bind() {
    const root = this.shadowRoot;

    root.querySelectorAll(".vhus-btn").forEach(btn => {
      btn.addEventListener("click", () => this._handleVaskehusChange(btn.dataset.v));
    });

    const slotSel = root.querySelector("#slot-sel");
    if (slotSel) slotSel.addEventListener("change", e => {
      this._selectedSlot = e.target.value;
      this._update();
    });

    // v1.9.2: Slot chips — clicking a free chip selects it and updates the dropdown too
    root.querySelectorAll(".slot-chip:not([disabled])").forEach(chip => {
      chip.addEventListener("click", () => {
        this._selectedSlot = chip.dataset.start;
        const sel = root.querySelector("#slot-sel");
        if (sel) sel.value = this._selectedSlot;
        this._update();
      });
    });

    // v1.9.2: Date change now triggers slot reload for availability
    const dateInp = root.querySelector("#date-inp");
    if (dateInp) dateInp.addEventListener("change", e => {
      this._handleDateChange(e.target.value);
    });

    const bookBtn = root.querySelector("#book-btn");
    if (bookBtn) bookBtn.addEventListener("click", () => this._handleBooking());

    root.querySelectorAll(".del-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const b = this._bookings.find(b => b.Start === btn.dataset.start && String(b.MachineNumber) === String(btn.dataset.machine));
        if (b) this._handleCancel(b);
      });
    });
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  _css() {
    return `
      :host { display: block; }
      #root { display: block; width: 100%; }

      /* ── CARD SHELL ──────────────────────── */
      .card-root {
        position: relative;
        display: block;
        width: 100%;
        background: #111;
        border: 1px solid #1e1e1e;
        border-radius: 14px;
        box-sizing: border-box;
        overflow: hidden;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        color: #e8e8e8;
      }

      /* ── TOAST ───────────────────────────── */
      .toast {
        position: absolute; top: 12px; left: 50%;
        transform: translateX(-50%);
        padding: 7px 18px; border-radius: 20px; font-size: 12px;
        font-weight: 500; z-index: 100; white-space: nowrap;
        pointer-events: none; animation: tIn 0.2s ease;
      }
      .toast-success { background: #14532d; color: #86efac; border: 1px solid rgba(134,239,172,0.2); }
      .toast-error   { background: #450a0a; color: #fca5a5; border: 1px solid rgba(252,165,165,0.2); }
      @keyframes tIn { from { opacity:0; transform: translateX(-50%) translateY(-6px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }

      /* ── HEADER ──────────────────────────── */
      .card-header {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 16px 14px;
        border-bottom: 1px solid #1e1e1e;
      }

      .card-icon {
        width: 40px; height: 40px; border-radius: 12px;
        background: #1a1a1a; border: 1px solid #2a2a2a;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0;
      }

      .card-title-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .card-title { font-size: 16px; font-weight: 700; color: #f0f0f0; letter-spacing: -0.2px; }
      .card-sub   { font-size: 12px; color: #555; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

      .pill { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 100px; letter-spacing: 0.3px; }
      .pill-open   { background: rgba(74,222,128,0.1); color: #4ade80; border: 1px solid rgba(74,222,128,0.2); }
      .pill-closed { background: rgba(248,113,113,0.1); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }

      /* ── ERROR / INFO BARS ───────────────── */
      .error-bar {
        margin: 0 14px 0; padding: 9px 12px;
        background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.2);
        border-radius: 8px; font-size: 12px; color: #f87171;
        margin-top: 12px;
      }
      .info-bar {
        display: flex; align-items: center; gap: 8px;
        margin: 12px 14px 0; padding: 9px 12px;
        background: rgba(240,192,64,0.07); border: 1px solid rgba(240,192,64,0.18);
        border-radius: 8px; font-size: 12px; color: #f0c040;
      }
      .info-dot { width: 6px; height: 6px; border-radius: 50%; background: #f0c040; flex-shrink: 0; }

      /* ── SECTION ─────────────────────────── */
      .section { padding: 14px 16px; border-bottom: 1px solid #1a1a1a; }
      .section:last-child { border-bottom: none; }

      .sec-label {
        font-size: 10px; font-weight: 700; letter-spacing: 0.9px;
        color: #333; margin-bottom: 12px;
      }
      .sec-label-row {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
      }
      .cnt-badge {
        background: #1a1a1a; color: #444; font-size: 11px; font-weight: 700;
        padding: 2px 8px; border-radius: 100px; border: 1px solid #2a2a2a;
      }

      /* ── MACHINES ────────────────────────── */
      .mach-row {
        display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px;
      }
      .mach-row::-webkit-scrollbar { display: none; }

      .mach-item {
        display: flex; flex-direction: column; align-items: center;
        gap: 4px; flex: 1; min-width: 48px; cursor: default;
      }
      .mach-ring {
        width: 36px; height: 36px; border-radius: 10px;
        background: color-mix(in srgb, var(--c) 12%, transparent);
        border: 1.5px solid var(--c);
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.15s;
      }
      .mach-item:hover .mach-ring { transform: scale(1.07); }
      .mach-icon  { font-size: 18px; line-height: 1; }
      .mach-name  { font-size: 9px; font-weight: 700; color: #333; text-align: center; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
      .mach-state { font-size: 9px; font-weight: 500; text-align: center; white-space: nowrap; }

      /* ── VASKEHUS TOGGLE ─────────────────── */
      .vhus-row { display: flex; gap: 8px; margin-bottom: 12px; }
      .vhus-btn {
        flex: 1; padding: 9px 8px;
        background: #1a1a1a; border: 1px solid #2a2a2a;
        border-radius: 8px; color: #444; font-size: 13px;
        font-weight: 500; font-family: inherit; cursor: pointer; transition: all 0.15s;
      }
      .vhus-btn:hover:not(:disabled) { border-color: #3a3a3a; color: #aaa; }
      .vhus-on { border-color: #888 !important; color: #e8e8e8 !important; background: #1e1e1e !important; font-weight: 600 !important; }
      .vhus-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      /* ── INPUTS ──────────────────────────── */
      .field-blk { margin-bottom: 10px; }
      .field-label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 0.7px; color: #333; margin-bottom: 6px; }

      .sel-wrap { position: relative; }
      .sel-arr { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #333; font-size: 11px; }

      .field-select, .field-input {
        width: 100%; padding: 9px 12px;
        background: #1a1a1a; border: 1px solid #2a2a2a;
        border-radius: 8px; font-size: 13px; font-family: inherit;
        color: #e8e8e8; transition: border-color 0.15s;
        appearance: none; -webkit-appearance: none; box-sizing: border-box;
      }
      .field-select { padding-right: 30px; cursor: pointer; }
      .field-select:focus, .field-input:focus { outline: none; border-color: #444; background: #1e1e1e; }
      .field-select:disabled, .field-input:disabled { opacity: 0.45; cursor: not-allowed; }

      /* ── SLOT CHIPS (v1.9.2) ─────────────── */
      .slot-chips {
        display: flex; flex-wrap: wrap; gap: 6px;
        margin-bottom: 12px; margin-top: -4px;
      }

      .slot-chip {
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px; font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        border: 1.5px solid transparent;
        transition: all 0.15s;
        white-space: nowrap;
        line-height: 1.4;
      }

      /* Free slot — clickable green */
      .chip-free {
        background: rgba(74,222,128,0.08);
        border-color: rgba(74,222,128,0.35);
        color: #4ade80;
      }
      .chip-free:hover:not(:disabled) {
        background: rgba(74,222,128,0.16);
        border-color: #4ade80;
      }

      /* Active/selected free slot */
      .chip-active {
        background: rgba(74,222,128,0.22) !important;
        border-color: #4ade80 !important;
        box-shadow: 0 0 0 2px rgba(74,222,128,0.18);
      }

      /* Booked slot — greyed out, not clickable */
      .chip-booked {
        background: rgba(55,65,81,0.35);
        border-color: rgba(55,65,81,0.5);
        color: #374151;
        cursor: not-allowed;
        opacity: 0.6;
        text-decoration: line-through;
      }
      .chip-booked:disabled { cursor: not-allowed; }

      /* ── BOOK BUTTON ─────────────────────── */
      .book-btn {
        width: 100%; padding: 12px; border: none; border-radius: 8px;
        font-size: 14px; font-weight: 600; font-family: inherit;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        gap: 7px; transition: all 0.2s; margin-top: 4px;
      }
      .btn-ready  { background: #1e1e1e; border: 1px solid #555; color: #e8e8e8; }
      .btn-ready:hover:not(:disabled) { background: #e8e8e8; color: #0d0d0d; border-color: #e8e8e8; }
      .btn-full, .btn-locked, .btn-closed { background: #1a1a1a; border: 1px solid #2a2a2a; color: #333; cursor: not-allowed; }
      .btn-loading { background: #1e1e1e; border: 1px solid #2a2a2a; color: #555; cursor: not-allowed; }
      .book-btn:disabled { opacity: 0.6; transform: none; }

      /* ── BOOKING ROWS ────────────────────── */
      .empty-row { font-size: 12px; color: #333; text-align: center; padding: 6px 0 2px; }

      .brow { display: flex; align-items: center; padding: 9px 0; border-bottom: 1px solid #1a1a1a; }
      .brow:last-child { border-bottom: none; padding-bottom: 0; }
      .brow:hover { opacity: 0.8; }

      .brow-accent { width: 3px; height: 30px; border-radius: 2px; margin-right: 12px; flex-shrink: 0; }
      .ba-klat { background: #555; }
      .ba-stor { background: #888; }

      .brow-info { flex: 1; min-width: 0; }
      .brow-name { display: block; font-size: 13px; font-weight: 600; color: #e8e8e8; }
      .brow-meta { display: block; font-size: 11px; color: #333; margin-top: 1px; }
      .brow-via  { color: #2a2a2a; }

      .del-btn {
        padding: 5px 10px; background: none; border: 1px solid #2a2a2a;
        border-radius: 6px; color: #2a2a2a; font-size: 11px; cursor: pointer;
        transition: all 0.15s; font-family: inherit; flex-shrink: 0;
      }
      .del-btn:hover:not(:disabled) { border-color: #dc2626; color: #dc2626; background: rgba(220,38,38,0.07); }
      .del-btn:disabled { opacity: 0.3; cursor: not-allowed; }

      /* ── SPINNER ─────────────────────────── */
      .spin { display: inline-block; animation: sp 0.7s linear infinite; }
      @keyframes sp { to { transform: rotate(360deg); } }
    `;
  }

  static getConfigElement() { return document.createElement("div"); }
  static getStubConfig()    { return {}; }
  getCardSize()             { return 6 + (this._bookings ? this._bookings.length : 0); }
}

if (!customElements.get("mielelogic-booking-card")) {
  customElements.define("mielelogic-booking-card", MieleLogicBookingCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === "mielelogic-booking-card")) {
  window.customCards.push({
    type: "mielelogic-booking-card",
    name: "MieleLogic Booking Card",
    description: "Book, vis og slet vaskehus-bookinger direkte fra dit dashboard.",
    preview: false,
    documentationURL: "https://github.com/kingpainter/mielelogic",
  });
}
