/**
 * MieleLogic Booking Card
 * VERSION = "2.0.0"
 *
 * Custom Lovelace card der fungerer som et "remote" til MieleLogic panelet.
 * Registreres automatisk af integrationen - ingen manuel installation nødvendig.
 *
 * Brug i Lovelace dashboard YAML:
 *   type: custom:mielelogic-booking-card
 *
 * Ingen ekstra konfiguration nødvendig!
 */

class MieleLogicBookingCard extends HTMLElement {
  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // State
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
    const firstSet = !this._hass;
    this._hass = hass;

    if (firstSet && !this._initialized) {
      this._initialized = true;
      this._render();
      this._loadData();

      // Auto-refresh hvert 30. sekund (samme som panel)
      this._refreshTimer = setInterval(() => {
        if (this._errorCount > 3) {
          clearInterval(this._refreshTimer);
          return;
        }
        if (!this._loading && document.visibilityState === "visible") {
          this._loadData().catch(() => this._errorCount++);
        }
      }, 30000);
    }
  }

  setConfig(config) {
    this._config = config || {};
  }

  disconnectedCallback() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  // ── Data Loading ───────────────────────────────────────────────────────────

  async _loadData() {
    try {
      await Promise.all([
        this._loadSlots(),
        this._loadBookings(),
        this._loadStatus(),
        this._loadMachines(),
      ]);
      this._errorCount = 0;
    } catch (e) {
      this._errorCount++;
      throw e;
    }
  }

  async _loadSlots() {
    try {
      const result = await this._hass.callWS({
        type: "mielelogic/get_slots",
        vaskehus: this._vaskehus,
      });
      this._slots = result.slots || [];
      if (this._slots.length > 0 && !this._selectedSlot) {
        this._selectedSlot = this._slots[0].start;
      }
    } catch (e) {
      this._error = "Kunne ikke hente tidslots";
    }
    this._update();
  }

  async _loadBookings() {
    try {
      const result = await this._hass.callWS({ type: "mielelogic/get_bookings" });
      this._bookings = result.bookings || [];
    } catch (e) {
      console.error("[MieleLogic Card] Bookings load error:", e);
    }
    this._update();
  }

  async _loadStatus() {
    try {
      const result = await this._hass.callWS({ type: "mielelogic/get_status" });
      this._status = result || {};
    } catch (e) {
      console.error("[MieleLogic Card] Status load error:", e);
    }
    this._update();
  }

  async _loadMachines() {
    try {
      const result = await this._hass.callWS({ type: "mielelogic/get_machines" });
      this._machines = result.machines || [];
    } catch (e) {
      console.error("[MieleLogic Card] Machines load error:", e);
      this._machines = [];
    }
    this._update();
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async _handleVaskehusChange(value) {
    this._vaskehus = value;
    this._selectedSlot = "";
    this._slots = [];
    this._update();
    await this._loadSlots();
  }

  async _handleBooking() {
    if (!this._selectedSlot || !this._selectedDate) {
      this._showToast("Vælg tidslot og dato", "warning");
      return;
    }

    const slot = this._slots.find((s) => s.start === this._selectedSlot);
    const confirmMsg = `Book ${this._vaskehus} d. ${this._selectedDate} kl. ${slot?.label || this._selectedSlot}?`;
    if (!confirm(confirmMsg)) return;

    this._loading = true;
    this._error = null;
    this._update();

    try {
      const result = await this._hass.callWS({
        type: "mielelogic/make_booking",
        vaskehus: this._vaskehus,
        slot_start: this._selectedSlot,
        date: this._selectedDate,
      });

      if (result.success) {
        this._showToast("✅ " + result.message, "success");
        await new Promise((r) => setTimeout(r, 500));
        await this._loadData();
      } else {
        this._error = result.message;
        this._showToast("❌ " + result.message, "error");
        this._update();
      }
    } catch (e) {
      this._error = e.message;
      this._showToast("❌ Booking fejlede", "error");
      this._update();
    }

    this._loading = false;
    this._update();
  }

  async _handleCancel(booking) {
    const confirmMsg = `Slet ${booking.vaskehus} booking ${this._formatDate(booking.Start)}?`;
    if (!confirm(confirmMsg)) return;

    this._loading = true;
    this._update();

    try {
      const result = await this._hass.callWS({
        type: "mielelogic/cancel_booking",
        machine_number: booking.MachineNumber,
        start_time: booking.Start,
        end_time: booking.End,
      });

      if (result.success) {
        this._showToast("✅ Booking slettet", "success");
        await new Promise((r) => setTimeout(r, 500));
        await this._loadData();
      } else {
        this._showToast("❌ " + result.message, "error");
      }
    } catch (e) {
      this._showToast("❌ Sletning fejlede", "error");
    }

    this._loading = false;
    this._update();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleString("da-DK", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  }

  _formatCurrency(amount) {
    try {
      return new Intl.NumberFormat("da-DK", {
        style: "currency",
        currency: "DKK",
      }).format(amount);
    } catch (e) {
      return `${amount} kr.`;
    }
  }

  _showToast(message, type = "success") {
    this._toast = { message, type };
    this._update();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = null;
      this._update();
    }, 3500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _render() {
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><div id="root"></div>`;
    this._update();
  }

  _update() {
    const root = this.shadowRoot.querySelector("#root");
    if (!root) return;

    const s = this._status;
    const isOpen = s.is_open !== false;  // default true if unknown
    const bookingLocked = s.booking_locked === true;
    const lockMessage = s.lock_message || "Booking er midlertidigt spærret";
    const canBook = s.can_book !== false && !bookingLocked;
    const bookingCount = this._bookings.length;
    const maxRes = s.max_reservations ?? "–";
    const balance = s.balance != null ? this._formatCurrency(s.balance) : null;
    const openingTime = s.opening_time ?? "07:00";
    const closingTime = s.closing_time ?? "21:00";
    const infoMessage = s.info_message || "";

    root.innerHTML = `
      <div class="card-root">
        ${this._toast ? `
          <div class="toast toast-${this._toast.type}">${this._toast.message}</div>
        ` : ""}

        <div class="card-content">

          <!-- Header -->
          <div class="card-header">
            <div class="header-left">
              <div>
                <div class="header-title">Vaskehus</div>
                <div class="header-title">Booking</div>
              </div>
            </div>
            ${balance ? `<div class="balance-chip">${balance}</div>` : ""}
          </div>

          ${this._error ? `
            <div class="error-banner">⚠️ ${this._error}</div>
          ` : ""}

          <!-- Maskine status -->
          ${infoMessage ? `<div class="info-banner">📢 ${infoMessage}</div>` : ""}
          ${this._renderMachines()}

          <!-- Booking formular -->
          <div class="form-block">

            <div class="field-group">
              <span class="field-label">Vaskehus</span>
              <div class="select-wrapper">
                <select id="vaskehus-select" class="field-select" ${this._loading ? "disabled" : ""}>
                  <option value="Klatvask" ${this._vaskehus === "Klatvask" ? "selected" : ""}>Klatvask</option>
                  <option value="Storvask" ${this._vaskehus === "Storvask" ? "selected" : ""}>Storvask</option>
                </select>
                <span class="select-arrow">▾</span>
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Tidsblok</span>
              <div class="select-wrapper">
                <select id="slot-select" class="field-select" ${this._loading || this._slots.length === 0 ? "disabled" : ""}>
                  ${this._slots.length === 0
                    ? `<option>Henter tidslots…</option>`
                    : this._slots.map((sl) =>
                        `<option value="${sl.start}" ${this._selectedSlot === sl.start ? "selected" : ""}>${sl.label}</option>`
                      ).join("")}
                </select>
                <span class="select-arrow">▾</span>
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Dato</span>
              <input
                id="date-input"
                type="date"
                class="field-input"
                value="${this._selectedDate}"
                ${this._loading ? "disabled" : ""}
              />
            </div>

            <button
              id="book-btn"
              class="book-button ${this._loading ? "is-loading" : !isOpen ? "is-closed-btn" : bookingCount === 0 ? "is-empty" : !canBook ? "is-full" : "is-partial"}"
              ${!canBook || this._loading ? "disabled" : ""}
            >
              ${this._loading
                ? `<span class="spinner"></span> Booker…`
                : bookingLocked
                ? `🔒 ${lockMessage}`
                : bookingCount === 0
                ? "✅ Ingen bookinger – book nu"
                : canBook
                ? `📅 ${bookingCount} booking${bookingCount !== 1 ? "er" : ""} – book endnu en`
                : `🚫 Max bookinger nået (${bookingCount}/${maxRes})`}
            </button>

          </div>

          <!-- Aktive bookinger -->
          <div class="bookings-block">
          <div class="section-title">
            <span>📋 Mine Bookinger</span>
            <span class="booking-badge">${bookingCount}</span>
          </div>

          ${bookingCount === 0
            ? `<div class="empty-state">📭 Ingen aktive bookinger</div>`
            : `<div class="bookings-list${bookingCount === 1 ? " is-single" : ""}">
                ${this._bookings.map((b) => `
                  <div class="booking-card">
                    
                    <div class="booking-info">
                      <div class="booking-name">${b.vaskehus || "Vaskehus"}</div>
                      <div class="booking-meta">${this._formatDate(b.Start)} · ${(() => { const d = b.Duration ?? b.duration; if (d != null && !isNaN(+d)) return +d + " min"; try { const m = Math.round((new Date(b.End)-new Date(b.Start))/60000); if (m>0) return m+" min"; } catch(e){} return ""; })()}${b.created_by ? ` · 📱 ${b.created_by}` : ""}</div>
                    </div>
                    <button
                      class="delete-btn"
                      data-start="${b.Start}"
                      data-machine="${b.MachineNumber}"
                      data-end="${b.End}"
                      ${this._loading ? "disabled" : ""}
                      title="Slet booking"
                    >🗑️</button>
                  </div>
                `).join("")}
              </div>`}

          </div><!-- /bookings-block -->
        </div>
      </div>
    `;

    this._attachListeners();
  }

  _renderMachines() {
    if (!this._machines || this._machines.length === 0) return "";
    const stateColors = {
      available: "#4caf50",
      running:   "#ff9800",
      reserved:  "#03a9f4",
      closed:    "#9e9e9e",
      unknown:   "#9e9e9e",
    };
    const stateLabels = {
      available: "Ledig",
      running:   "I gang",
      reserved:  "Reserveret",
      closed:    "Lukket",
      unknown:   "Ukendt",
    };
    const icons = { washer: "🫧", dryer: "♨️" };

    const isOpen = this._status?.is_open !== false;

    const items = this._machines.map(m => {
      const icon  = icons[m.machine_type] || "🔧";
      // When laundry is closed, show all machines as closed visually
      // but preserve real API state in tooltip
      const displayState = (!isOpen && m.state === "available") ? "closed" : m.state;
      const color = stateColors[displayState] || "#9e9e9e";
      const label = stateLabels[displayState] || displayState;
      const tooltip = !isOpen && m.state === "available"
        ? `${m.name}: Lukket (API: ${m.status})`
        : `${m.name}: ${m.status}`;
      const shortName = m.name.replace(/klatvask|storvask/gi, "").trim() || m.name;
      return [
        `<div class="machine-item" title="${tooltip}">`,
        `  <div class="machine-icon-wrap" style="background:${color}22;border:2px solid ${color}">`,
        `    <span class="machine-icon">${icon}</span>`,
        `  </div>`,
        `  <div class="machine-label">${shortName}</div>`,
        `  <div class="machine-state" style="color:${color}">${label}</div>`,
        `</div>`,
      ].join("");
    }).join("");

    return `<div class="machines-block">${items}</div>`;
  }

  _attachListeners() {
    const root = this.shadowRoot;

    const vaskeSelect = root.querySelector("#vaskehus-select");
    if (vaskeSelect) {
      vaskeSelect.addEventListener("change", (e) =>
        this._handleVaskehusChange(e.target.value)
      );
    }

    const slotSelect = root.querySelector("#slot-select");
    if (slotSelect) {
      slotSelect.addEventListener("change", (e) => {
        this._selectedSlot = e.target.value;
      });
    }

    const dateInput = root.querySelector("#date-input");
    if (dateInput) {
      dateInput.addEventListener("change", (e) => {
        this._selectedDate = e.target.value;
      });
    }

    const bookBtn = root.querySelector("#book-btn");
    if (bookBtn) {
      bookBtn.addEventListener("click", () => this._handleBooking());
    }

    root.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const booking = this._bookings.find(
          (b) =>
            b.Start === btn.dataset.start &&
            String(b.MachineNumber) === String(btn.dataset.machine)
        );
        if (booking) this._handleCancel(booking);
      });
    });
  }

  // ── CSS ────────────────────────────────────────────────────────────────────

  _css() {
    return `
      :host { display: block; }

      #root {
        display: block;
        width: 100%;
      }

      .card-root {
        position: relative;
        display: block;
        width: 100%;
        background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
        border-width: var(--ha-card-border-width, 1px);
        border-style: solid;
        border-color: var(--ha-card-border-color, var(--divider-color, rgba(255,255,255,0.12)));
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.3));
        box-sizing: border-box;
        overflow: hidden;
      }

      /* Toast */
      .toast {
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        padding: 8px 18px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        z-index: 100;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        animation: toastIn 0.25s ease;
        pointer-events: none;
      }
      .toast-success { background: #1b5e20; color: #fff; }
      .toast-error   { background: #b71c1c; color: #fff; }
      .toast-warning { background: #e65100; color: #fff; }
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }

      /* Content */
      .card-content { padding: 16px; }

      /* Header */
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--divider-color, #e0e0e0);
      }
      .header-left { display: flex; align-items: center; gap: 10px; }
      .header-icon { font-size: 26px; width: 32px; height: 32px; display: flex; align-items: center; }
      .header-icon ha-icon { --mdc-icon-size: 30px; }
      .header-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text-color, #212121);
        line-height: 1.2;
      }
      .header-sub {
        font-size: 12px;
        color: var(--secondary-text-color, #757575);
        margin-top: 2px;
      }
      .hours-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 20px;
        letter-spacing: 0.3px;
      }
      .hours-chip.is-open {
        background: rgba(67,160,71,0.15);
        color: #81c784;
      }
      .hours-chip.is-closed {
        background: rgba(229,57,53,0.15);
        color: #ef9a9a;
      }
      .book-button.is-closed-btn {
        background: linear-gradient(135deg, #616161, #424242);
        box-shadow: none;
        cursor: not-allowed;
        color: #bdbdbd;
      }
      .balance-chip {
        background: linear-gradient(135deg, #03a9f4, #0288d1);
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: 12px;
        box-shadow: 0 2px 6px rgba(3,169,244,0.3);
        white-space: nowrap;
      }

      /* Error banner */
      .error-banner {
        background: #ffebee;
        color: #c62828;
        padding: 10px 14px;
        border-radius: 8px;
        margin-bottom: 14px;
        border-left: 4px solid #c62828;
        font-size: 13px;
      }

      /* Form block */
      .form-block {
        background: var(--primary-background-color, #fafafa);
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 16px;
      }
      .field-group { margin-bottom: 12px; }
      .field-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color, #757575);
        text-transform: uppercase;
        letter-spacing: 0.4px;
        margin-bottom: 5px;
      }

      /* Select wrapper */
      .select-wrapper { position: relative; }
      .select-arrow {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: var(--secondary-text-color, #757575);
        font-size: 12px;
      }

      .field-select,
      .field-input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 14px;
        border: 2px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        appearance: none;
        -webkit-appearance: none;
        transition: border-color 0.2s;
        cursor: pointer;
        font-family: inherit;
      }
      .field-select:focus,
      .field-input:focus { outline: none; border-color: #03a9f4; }
      .field-select:disabled,
      .field-input:disabled { opacity: 0.5; cursor: not-allowed; }

      /* Book button */
      .book-button {
        width: 100%;
        padding: 13px;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 4px;
        font-family: inherit;
      }
      /* Grøn — ingen bookinger */
      .book-button.is-empty {
        background: linear-gradient(135deg, #43a047, #2e7d32);
        box-shadow: 0 4px 12px rgba(67,160,71,0.3);
      }
      .book-button.is-empty:hover {
        background: linear-gradient(135deg, #388e3c, #1b5e20);
        box-shadow: 0 6px 16px rgba(67,160,71,0.4);
        transform: translateY(-1px);
      }
      /* Blå — 1+ booking, kan stadig booke */
      .book-button.is-partial {
        background: linear-gradient(135deg, #03a9f4, #0288d1);
        box-shadow: 0 4px 12px rgba(3,169,244,0.3);
      }
      .book-button.is-partial:hover {
        background: linear-gradient(135deg, #0288d1, #01579b);
        box-shadow: 0 6px 16px rgba(3,169,244,0.4);
        transform: translateY(-1px);
      }
      /* Gul — max nået */
      .book-button.is-full {
        background: linear-gradient(135deg, #f9a825, #f57f17);
        box-shadow: 0 4px 12px rgba(249,168,37,0.3);
        cursor: not-allowed;
        color: #1a1a1a;
      }
      /* Loading */
      .info-banner {
        background: rgba(255, 160, 0, 0.12);
        border: 1px solid rgba(255, 160, 0, 0.3);
        color: #ffa000;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        margin-bottom: 8px;
      }
      .book-button.is-locked {
        background: linear-gradient(135deg, #616161, #424242);
        box-shadow: none;
        cursor: not-allowed;
        color: #bdbdbd;
      }
      .book-button.is-loading {
        background: linear-gradient(135deg, #03a9f4, #0288d1);
        opacity: 0.7;
        cursor: not-allowed;
      }
      .book-button:disabled { transform: none; }

      /* Loading spinner */
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        display: inline-block;
        flex-shrink: 0;
      }
      @keyframes spin { to { transform: rotate(360deg); } }



      /* Bookings block - matcher form-block stil */
      .bookings-block {
        background: var(--primary-background-color, #fafafa);
        border-radius: 10px;
        padding: 10px 14px;
      }

      /* Maskine status */
      .machines-block {
        display: flex;
        gap: 8px;
        padding: 12px 14px;
        background: var(--primary-background-color, #fafafa);
        border-radius: 10px;
        margin-bottom: 16px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .machines-block::-webkit-scrollbar { display: none; }

      .machine-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        flex: 1;
        min-width: 52px;
        cursor: default;
      }
      .machine-icon-wrap {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s;
      }
      .machine-item:hover .machine-icon-wrap {
        transform: scale(1.08);
      }
      .machine-icon {
        font-size: 20px;
        line-height: 1;
      }
      .machine-label {
        font-size: 10px;
        font-weight: 600;
        color: var(--secondary-text-color, #757575);
        text-align: center;
        white-space: nowrap;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .machine-state {
        font-size: 9px;
        font-weight: 500;
        text-align: center;
        white-space: nowrap;
      }

      /* Section title */
      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 14px;
        font-weight: 600;
        color: var(--primary-text-color, #212121);
        margin-bottom: 10px;
      }
      .booking-badge {
        background: var(--divider-color, #e0e0e0);
        color: var(--secondary-text-color, #757575);
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
      }

      /* Empty state */
      .empty-state {
        text-align: center;
        color: var(--secondary-text-color, #757575);
        font-size: 13px;
        padding: 16px;
        background: var(--primary-background-color, #fafafa);
        border-radius: 8px;
      }

      /* Bookings list */
      .bookings-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .bookings-list.is-single {
        display: flex;
        justify-content: center;
      }
      .bookings-list.is-single .booking-card {
        width: 100%;
        max-width: 460px;
      }

      /* Booking card */
      .booking-card {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.08));
        transition: opacity 0.2s;
      }
      .booking-card:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .booking-card:hover {
        opacity: 0.85;
      }

      .booking-info { flex: 1; min-width: 0; }
      .booking-name {
        font-weight: 600;
        font-size: 13px;
        color: var(--primary-text-color, #212121);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .booking-meta {
        font-size: 11px;
        color: var(--secondary-text-color, #757575);
        margin-top: 2px;
      }

      /* Delete button */
      .delete-btn {
        background: #f44336;
        color: #fff;
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .delete-btn:hover:not(:disabled) {
        background: #d32f2f;
        transform: scale(1.1);
      }
      .delete-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      /* Responsive */
      @media (max-width: 400px) {
        .card-content { padding: 10px; }
      }
    `;
  }

  // ── Card meta ──────────────────────────────────────────────────────────────

  static getConfigElement() {
    return document.createElement("div");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() { return 8 + (this._bookings ? this._bookings.length * 2 : 0); }
}

// Registrer custom element
if (!customElements.get("mielelogic-booking-card")) {
  customElements.define("mielelogic-booking-card", MieleLogicBookingCard);
}

// HACS / Lovelace card info
window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === "mielelogic-booking-card")) {
  window.customCards.push({
    type: "mielelogic-booking-card",
    name: "MieleLogic Booking Card",
    description:
      "Book, vis og slet vaskehus-bookinger direkte fra dit dashboard.",
    preview: false,
    documentationURL: "https://github.com/kingpainter/mielelogic",
  });
}
