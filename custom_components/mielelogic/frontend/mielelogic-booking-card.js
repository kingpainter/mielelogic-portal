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
          <div class="card-icon"><img src="data:image/png;base64,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" alt="MieleLogic"></div>
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
        overflow: hidden; flex-shrink: 0;
      }
      .card-icon img {
        width: 100%; height: 100%; object-fit: cover; display: block;
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
