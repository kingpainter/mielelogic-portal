// MieleLogic Panel - Main UI Component
// VERSION = "1.5.1"

import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

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
    
    // ✨ NEW v1.5.1: Tab system
    this.currentTab = "booking"; // "booking" or "notifications"
    
    // ✨ NEW v1.5.1: Notification state
    this.devices = [];
    this.availableDevices = [];
    this.notifications = {};
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
    this._errorCount = 0;
    
    // ✨ Auto-refresh every 30 seconds (not 10 - too aggressive)
    // Only when panel is visible and not loading
    this._refreshInterval = setInterval(() => {
      // Stop refreshing if we have too many consecutive errors
      if (this._errorCount > 3) {
        console.warn('Too many refresh errors - stopping auto-refresh');
        clearInterval(this._refreshInterval);
        this._refreshInterval = null;
        return;
      }
      
      // Check if panel is still connected and not loading
      if (this.isConnected && !this.loading && document.visibilityState === 'visible') {
        this.loadData().catch(err => {
          this._errorCount++;
          console.debug('Refresh failed (connection may be closing):', err.message);
        });
      }
    }, 30000); // 30 seconds - more reasonable
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up interval when panel is closed
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  async loadData() {
    try {
      await Promise.all([
        this.loadSlots(),
        this.loadBookings(),
        this.loadStatus(),
        this.loadNotificationData(), // ✨ NEW v1.5.1
      ]);
      // Reset error count on successful load
      this._errorCount = 0;
    } catch (err) {
      // Just log, don't throw - let caller handle it
      console.debug('loadData error:', err.message);
      throw err;
    }
  }

  async loadSlots() {
    try {
      const result = await this.hass.callWS({
        type: "mielelogic/get_slots",
        vaskehus: this.vaskehus,
      });
      
      this.slots = result.slots || [];
      if (this.slots.length > 0 && !this.selectedSlot) {
        this.selectedSlot = this.slots[0].start;
      }
    } catch (err) {
      console.error("Error loading slots:", err);
      this.error = "Kunne ikke hente tidslots";
    }
  }

  async loadBookings() {
    try {
      const result = await this.hass.callWS({
        type: "mielelogic/get_bookings",
      });
      
      this.bookings = result.bookings || [];
    } catch (err) {
      console.error("Error loading bookings:", err);
    }
  }

  async loadStatus() {
    try {
      const result = await this.hass.callWS({
        type: "mielelogic/get_status",
      });
      
      this.status = result || {};
    } catch (err) {
      console.error("Error loading status:", err);
    }
  }

  async handleVaskehusChange(e) {
    this.vaskehus = e.target.value;
    this.selectedSlot = ""; // Reset selection
    await this.loadSlots();
  }

  async handleBooking() {
    if (!this.selectedSlot || !this.selectedDate) {
      alert("Vælg tidslot og dato");
      return;
    }

    // Confirmation
    const selectedSlotObj = this.slots.find(s => s.start === this.selectedSlot);
    const confirmMsg = `Book ${this.vaskehus} ${this.selectedDate} ${selectedSlotObj?.label || ''}?`;
    
    if (!confirm(confirmMsg)) return;

    this.loading = true;
    this.error = null;

    try {
      const result = await this.hass.callWS({
        type: "mielelogic/make_booking",
        vaskehus: this.vaskehus,
        slot_start: this.selectedSlot,
        date: this.selectedDate,
      });

      if (result.success) {
        this.showNotification("✅ " + result.message, "success");
        // Wait a moment for coordinator to refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.loadData(); // Reload everything
      } else {
        this.showNotification("❌ " + result.message, "error");
        this.error = result.message;
      }
    } catch (err) {
      console.error("Booking error:", err);
      this.showNotification("❌ Booking fejlede: " + err.message, "error");
      this.error = err.message;
    } finally {
      this.loading = false;
    }
  }

  async handleCancelBooking(booking) {
    const confirmMsg = `Slet ${booking.vaskehus} booking ${this.formatDate(booking.Start)}?`;
    
    if (!confirm(confirmMsg)) return;

    this.loading = true;

    try {
      const result = await this.hass.callWS({
        type: "mielelogic/cancel_booking",
        machine_number: booking.MachineNumber,
        start_time: booking.Start,
        end_time: booking.End,
      });

      if (result.success) {
        this.showNotification("✅ Booking slettet", "success");
        // Wait a moment for coordinator to refresh
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.loadData();
      } else {
        this.showNotification("❌ " + result.message, "error");
      }
    } catch (err) {
      console.error("Cancel error:", err);
      this.showNotification("❌ Sletning fejlede: " + err.message, "error");
    } finally {
      this.loading = false;
    }
  }

  showNotification(message, type) {
    // Use Home Assistant's notification service
    this.hass.callService("persistent_notification", "create", {
      message: message,
      title: "MieleLogic",
      notification_id: `mielelogic_${Date.now()}`,
    });
  }

  // ✨ NEW v1.5.1: Notification management methods
  async loadNotificationData() {
    try {
      // Load devices
      const devicesResult = await this.hass.callWS({
        type: "mielelogic/get_devices",
      });
      
      this.availableDevices = devicesResult.available || [];
      this.devices = devicesResult.configured || [];
      
      // Load notification configs
      const notifResult = await this.hass.callWS({
        type: "mielelogic/get_notifications",
      });
      
      this.notifications = notifResult.notifications || {};
      this.requestUpdate();
    } catch (err) {
      console.error("Error loading notification data:", err);
    }
  }

  handleDeviceToggle(device) {
    const index = this.devices.indexOf(device);
    if (index > -1) {
      this.devices = this.devices.filter(d => d !== device);
    } else {
      this.devices = [...this.devices, device];
    }
    this.requestUpdate();
  }

  async saveDevices() {
    try {
      await this.hass.callWS({
        type: "mielelogic/save_devices",
        devices: this.devices,
      });
      
      this.showNotification("✅ Enheder gemt", "success");
    } catch (err) {
      console.error("Error saving devices:", err);
      this.showNotification("❌ Kunne ikke gemme enheder", "error");
    }
  }

  async toggleNotification(notifId) {
    const notif = this.notifications[notifId];
    if (!notif) return;
    
    const updated = { ...notif, enabled: !notif.enabled };
    await this.saveNotification(notifId, updated);
  }

  async saveNotification(notifId, config) {
    try {
      await this.hass.callWS({
        type: "mielelogic/save_notification",
        notification_id: notifId,
        config: config,
      });
      
      this.showNotification("✅ Notifikation gemt", "success");
      await this.loadNotificationData();
    } catch (err) {
      console.error("Error saving notification:", err);
      this.showNotification("❌ Kunne ikke gemme", "error");
    }
  }

  async testNotification(notifId) {
    try {
      await this.hass.callWS({
        type: "mielelogic/test_notification",
        notification_id: notifId,
      });
      
      this.showNotification("✅ Test besked sendt!", "success");
    } catch (err) {
      console.error("Error testing notification:", err);
      this.showNotification("❌ Test fejlede", "error");
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString("da-DK", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
    }).format(amount);
  }

  render() {
    return html`
      <div class="panel">
        ${this.renderHeader()}
        ${this.renderTabs()}
        ${this.error ? this.renderError() : ""}
        ${this.currentTab === "booking" ? this.renderBookingTab() : this.renderNotificationTab()}
      </div>
    `;
  }

  renderTabs() {
    return html`
      <div class="tabs">
        <button 
          class="tab ${this.currentTab === 'booking' ? 'active' : ''}"
          @click=${() => { this.currentTab = 'booking'; this.requestUpdate(); }}
        >
          📅 Booking
        </button>
        <button 
          class="tab ${this.currentTab === 'notifications' ? 'active' : ''}"
          @click=${() => { this.currentTab = 'notifications'; this.requestUpdate(); }}
        >
          🔔 Notifikationer
        </button>
      </div>
    `;
  }

  renderBookingTab() {
    return html`
      ${this.renderBookingForm()}
      ${this.renderStatus()}
      ${this.renderBookings()}
    `;
  }

  renderNotificationTab() {
    return html`
      <div class="notification-tab">
        ${this.renderDeviceSelector()}
        ${this.renderNotificationList()}
      </div>
    `;
  }

  renderHeader() {
    return html`
      <div class="header">
        <h1>🧺 Vaskehus Booking</h1>
        <p class="subtitle">
          ${this.bookings.length} booking${this.bookings.length !== 1 ? "er" : ""}
          ${this.status.max_reservations ? ` af ${this.status.max_reservations}` : ""}
        </p>
      </div>
    `;
  }

  renderError() {
    return html`
      <div class="error-banner">
        ⚠️ ${this.error}
      </div>
    `;
  }

  renderBookingForm() {
    return html`
      <div class="booking-form">
        <div class="form-title">
          <h2>📅 Ny Booking</h2>
        </div>

        <!-- Vaskehus Dropdown -->
        <label>
          <span class="label-text">Vælg Vaskehus</span>
          <select
            .value=${this.vaskehus}
            @change=${this.handleVaskehusChange}
            ?disabled=${this.loading}
            class="select-input"
          >
            <option value="Klatvask">🧺 Klatvask</option>
            <option value="Storvask">🧺 Storvask</option>
          </select>
        </label>

        <!-- Time Slot Dropdown -->
        <label>
          <span class="label-text">Vælg Tidsblok</span>
          <select
            .value=${this.selectedSlot}
            @change=${(e) => (this.selectedSlot = e.target.value)}
            ?disabled=${this.loading || this.slots.length === 0}
            class="select-input"
          >
            ${this.slots.length === 0
              ? html`<option>Ingen tidslots tilgængelige</option>`
              : this.slots.map(
                  (slot) => html`
                    <option value=${slot.start}>${slot.label}</option>
                  `
                )}
          </select>
        </label>

        <!-- Date Picker -->
        <label>
          <span class="label-text">Vælg Dato</span>
          <input
            type="date"
            .value=${this.selectedDate}
            @change=${(e) => (this.selectedDate = e.target.value)}
            ?disabled=${this.loading}
            class="date-input"
          />
        </label>

        <!-- Book Button -->
        <button
          class="book-button"
          @click=${this.handleBooking}
          ?disabled=${this.loading || !this.status.can_book}
        >
          ${this.loading
            ? "⏳ Booker..."
            : this.status.can_book
            ? "📅 BOOK NU"
            : "🚫 Max bookinger nået"}
        </button>

        ${!this.status.can_book && this.status.current_count >= this.status.max_reservations
          ? html`
              <p class="warning-text">
                Du har ${this.status.current_count} bookinger.
                Slet en booking for at booke igen.
              </p>
            `
          : ""}
      </div>
    `;
  }

  renderStatus() {
    if (!this.status.balance) return "";

    return html`
      <div class="status-card">
        <div class="status-item">
          <span class="status-label">Saldo</span>
          <span class="status-value">${this.formatCurrency(this.status.balance)}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Bookinger</span>
          <span class="status-value">
            ${this.status.current_count} / ${this.status.max_reservations}
          </span>
        </div>
      </div>
    `;
  }

  renderBookings() {
    if (this.bookings.length === 0) {
      return html`
        <div class="empty-state">
          <p>📭 Ingen aktive bookinger</p>
        </div>
      `;
    }

    // Dynamic class based on number of bookings
    const listClass = this.bookings.length === 1 ? 'bookings-list single' : 'bookings-list double';

    return html`
      <div class="bookings-section">
        <h2>📋 Mine Bookinger</h2>
        <div class="${listClass}">
          ${this.bookings.map((booking) => this.renderBookingCard(booking))}
        </div>
      </div>
    `;
  }

  renderBookingCard(booking) {
    return html`
      <div class="booking-card">
        <div class="booking-main">
          <div class="booking-icon">🧺</div>
          <div class="booking-details">
            <div class="booking-vaskehus">${booking.vaskehus}</div>
            <div class="booking-time">${this.formatDate(booking.Start)}</div>
            <div class="booking-duration">${booking.Duration} minutter</div>
          </div>
        </div>
        <button
          class="delete-button"
          @click=${() => this.handleCancelBooking(booking)}
          ?disabled=${this.loading}
          title="Slet booking"
        >
          🗑️
        </button>
      </div>
    `;
  }

  // ✨ NEW v1.5.1: Notification tab rendering
  renderDeviceSelector() {
    return html`
      <div class="notification-section">
        <h2>📱 Mobile Enheder</h2>
        <p class="section-description">Vælg hvilke enheder der skal modtage notifikationer</p>
        
        ${this.availableDevices.length === 0 ? html`
          <div class="empty-state">
            <p>Ingen mobile apps fundet</p>
            <p style="font-size: 12px; color: var(--secondary-text-color);">
              Installer Home Assistant Companion app på din mobil
            </p>
          </div>
        ` : html`
          <div class="device-list">
            ${this.availableDevices.map(device => html`
              <label class="device-item">
                <input 
                  type="checkbox" 
                  .checked=${this.devices.includes(device.service)}
                  @change=${() => this.handleDeviceToggle(device.service)}
                />
                <span class="device-name">${device.name}</span>
              </label>
            `)}
          </div>
          <button 
            class="save-btn"
            @click=${() => this.saveDevices()}
            ?disabled=${this.loading}
          >
            💾 Gem Enheder
          </button>
        `}
      </div>
    `;
  }

  renderNotificationList() {
    const notifEntries = Object.entries(this.notifications);
    
    if (notifEntries.length === 0) {
      return html`<div class="empty-state"><p>Ingen notifikationer konfigureret</p></div>`;
    }

    return html`
      <div class="notification-section">
        <h2>🔔 Notifikationer</h2>
        <p class="section-description">Aktiver og test notifikationer</p>
        
        <div class="notification-list">
          ${notifEntries.map(([id, notif]) => html`
            <div class="notification-item">
              <div class="notification-header">
                <label class="notification-toggle">
                  <input 
                    type="checkbox" 
                    .checked=${notif.enabled}
                    @change=${() => this.toggleNotification(id)}
                  />
                  <span class="notification-title">${notif.title}</span>
                </label>
                <button 
                  class="test-btn"
                  @click=${() => this.testNotification(id)}
                  ?disabled=${!notif.enabled || this.devices.length === 0}
                  title="Send test notifikation"
                >
                  ✉️ Test
                </button>
              </div>
              <div class="notification-message">${notif.message}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
        padding: 16px;
        max-width: 800px; /* Default for portrait/desktop */
        margin: 0 auto;
        box-sizing: border-box;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
      }

      * {
        box-sizing: border-box;
      }

      .panel {
        background: var(--card-background-color, #fff);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        width: 100%; /* Always fill :host */
      }

      /* Header */
      .header {
        margin-bottom: 32px;
        border-bottom: 2px solid var(--divider-color, #e0e0e0);
        padding-bottom: 16px;
      }

      .header h1 {
        margin: 0 0 8px 0;
        font-size: 28px;
        font-weight: 600;
        color: var(--primary-text-color, #212121);
      }

      .subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--secondary-text-color, #757575);
      }

      /* Error Banner */
      .error-banner {
        background: #ffebee;
        color: #c62828;
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        border-left: 4px solid #c62828;
      }

      /* Booking Form */
      .booking-form {
        background: var(--primary-background-color, #fafafa);
        padding: 24px;
        border-radius: 12px;
        margin-bottom: 24px;
      }

      .form-title h2 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-text-color, #212121);
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }

      .label-text {
        font-size: 14px;
        font-weight: 500;
        color: var(--primary-text-color, #212121);
      }

      .select-input,
      .date-input {
        padding: 12px 16px;
        border: 2px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        font-size: 16px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        transition: border-color 0.2s;
      }

      .select-input:focus,
      .date-input:focus {
        outline: none;
        border-color: #03a9f4;
      }

      .select-input:disabled,
      .date-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Book Button */
      .book-button {
        width: 100%;
        padding: 16px;
        background: linear-gradient(135deg, #03a9f4 0%, #0288d1 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 4px 12px rgba(3, 169, 244, 0.3);
        margin-top: 8px;
      }

      .book-button:hover:not(:disabled) {
        background: linear-gradient(135deg, #0288d1 0%, #01579b 100%);
        box-shadow: 0 6px 16px rgba(3, 169, 244, 0.4);
        transform: translateY(-2px);
      }

      .book-button:active:not(:disabled) {
        transform: translateY(0);
      }

      .book-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      .warning-text {
        margin: 12px 0 0 0;
        padding: 12px;
        background: #fff3e0;
        color: #e65100;
        border-radius: 6px;
        font-size: 14px;
        text-align: center;
      }

      /* Status Card */
      .status-card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        padding: 16px;
        background: var(--primary-background-color, #fafafa);
        border-radius: 8px;
        margin-bottom: 24px;
      }

      .status-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .status-label {
        font-size: 12px;
        color: var(--secondary-text-color, #757575);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .status-value {
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-text-color, #212121);
      }

      /* Bookings Section */
      .bookings-section h2 {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--primary-text-color, #212121);
      }

      .bookings-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Smart Layout: 1 booking = centered, 2 bookings = side-by-side */
      .bookings-list.single {
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .bookings-list.single .booking-card {
        max-width: 500px; /* Centered single booking */
        width: 100%;
      }

      .bookings-list.double {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        justify-items: stretch;
      }

      /* Booking Card */
      .booking-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: var(--primary-background-color, #fafafa);
        border-radius: 8px;
        border: 2px solid transparent;
        transition: all 0.2s;
      }

      .booking-card:hover {
        border-color: #03a9f4;
        box-shadow: 0 4px 12px rgba(3, 169, 244, 0.15);
      }

      .booking-main {
        display: flex;
        gap: 12px;
        align-items: center;
        flex: 1;
      }

      .booking-icon {
        font-size: 24px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--card-background-color, #fff);
        border-radius: 8px;
      }

      .booking-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .booking-vaskehus {
        font-weight: 600;
        font-size: 16px;
        color: var(--primary-text-color, #212121);
      }

      .booking-time {
        font-size: 14px;
        color: var(--secondary-text-color, #757575);
      }

      .booking-duration {
        font-size: 12px;
        color: var(--disabled-text-color, #9e9e9e);
      }

      /* Delete Button */
      .delete-button {
        background: #f44336;
        color: white;
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        cursor: pointer;
        font-size: 20px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .delete-button:hover:not(:disabled) {
        background: #d32f2f;
        transform: scale(1.1);
      }

      .delete-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      /* Empty State */
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--secondary-text-color, #757575);
      }

      .empty-state p {
        margin: 0;
        font-size: 16px;
      }

      /* ✨ NEW v1.5.1: Tabs */
      .tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
        border-bottom: 2px solid var(--divider-color, #e0e0e0);
      }

      .tab {
        background: none;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        font-weight: 500;
        color: var(--secondary-text-color, #757575);
        cursor: pointer;
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
        margin-bottom: -2px;
      }

      .tab:hover {
        color: var(--primary-color, #03a9f4);
        background: var(--primary-background-color, #fafafa);
      }

      .tab.active {
        color: var(--primary-color, #03a9f4);
        border-bottom-color: var(--primary-color, #03a9f4);
      }

      /* ✨ NEW v1.5.1: Notification Tab */
      .notification-tab {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .notification-section {
        background: var(--primary-background-color, #fafafa);
        padding: 20px;
        border-radius: 8px;
      }

      .notification-section h2 {
        font-size: 20px;
        margin: 0 0 8px 0;
        color: var(--primary-text-color, #212121);
      }

      .section-description {
        font-size: 14px;
        color: var(--secondary-text-color, #757575);
        margin: 0 0 16px 0;
      }

      /* Device List */
      .device-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }

      .device-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--card-background-color, #fff);
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .device-item:hover {
        background: var(--primary-background-color, #fafafa);
      }

      .device-item input[type="checkbox"] {
        width: 20px;
        height: 20px;
        cursor: pointer;
      }

      .device-name {
        font-size: 15px;
        color: var(--primary-text-color, #212121);
      }

      /* Notification List */
      .notification-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .notification-item {
        background: var(--card-background-color, #fff);
        padding: 16px;
        border-radius: 8px;
        border: 2px solid transparent;
        transition: border-color 0.2s;
      }

      .notification-item:hover {
        border-color: #03a9f4;
      }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .notification-toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }

      .notification-toggle input[type="checkbox"] {
        width: 20px;
        height: 20px;
        cursor: pointer;
      }

      .notification-title {
        font-weight: 600;
        font-size: 16px;
        color: var(--primary-text-color, #212121);
      }

      .notification-message {
        font-size: 14px;
        color: var(--secondary-text-color, #757575);
        margin-left: 32px;
      }

      .test-btn {
        background: #4caf50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }

      .test-btn:hover:not(:disabled) {
        background: #45a049;
      }

      .test-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .save-btn {
        background: #03a9f4;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: background 0.2s;
      }

      .save-btn:hover:not(:disabled) {
        background: #0288d1;
      }

      .save-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      /* Responsive Design - Mobile First */
      
      /* Small Mobile Portrait (< 600px) */
      @media (max-width: 600px) {
        :host {
          padding: 8px;
        }

        .panel {
          padding: 16px;
          max-width: 100%;
        }

        .header h1 {
          font-size: 24px;
        }

        .header p {
          font-size: 13px;
        }

        .status-card {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        /* Stack bookings on mobile even if double */
        .bookings-list.double {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .booking-card {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .booking-info h3 {
          font-size: 16px;
        }

        .booking-time {
          font-size: 13px;
        }

        .delete-btn {
          align-self: stretch;
          width: 100%;
        }
      }

      /* Mobile Landscape / Small Tablet (600px - 900px) */
      @media (min-width: 600px) and (max-width: 900px) {
        :host {
          padding: 12px;
          max-width: 100%; /* Full width in landscape */
        }

        .panel {
          padding: 20px;
          max-width: none; /* Remove max-width constraint */
        }

        .header h1 {
          font-size: 28px;
        }

        /* Two-column layout for landscape */
        .status-card {
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* Keep booking cards horizontal in landscape */
        .booking-card {
          flex-direction: row;
        }

        .form-group {
          margin-bottom: 16px;
        }
      }

      /* Tablet Portrait (900px - 1200px) */
      @media (min-width: 900px) and (max-width: 1200px) {
        :host {
          max-width: 95%; /* Almost full width */
        }

        .panel {
          max-width: none;
          padding: 24px;
        }

        .header h1 {
          font-size: 32px;
        }

        .status-card {
          grid-template-columns: 1fr 1fr;
        }

        .form-group {
          margin-bottom: 20px;
        }
      }

      /* Desktop / Large Tablet (> 1200px) */
      @media (min-width: 1200px) {
        :host {
          max-width: 1000px; /* Wider on desktop */
        }

        .panel {
          max-width: none;
          padding: 32px;
        }

        .header h1 {
          font-size: 36px;
        }

        .status-card {
          grid-template-columns: 1fr 1fr;
        }
      }

      /* Landscape Orientation Specific - Full Width! */
      @media (orientation: landscape) {
        :host {
          max-width: 98%; /* Almost edge to edge */
          padding: 8px;
        }

        .panel {
          max-width: none; /* No restrictions */
          border-radius: 8px; /* Slightly smaller radius for edge-to-edge look */
        }
      }

      /* Landscape on short screens - Extra compact */
      @media (orientation: landscape) and (max-height: 600px) {
        /* Compact layout for landscape on short screens */
        .panel {
          padding: 12px;
        }

        .header {
          margin-bottom: 16px;
        }

        .header h1 {
          font-size: 24px;
        }

        .header p {
          font-size: 12px;
        }

        .form-section h2 {
          font-size: 18px;
          margin-bottom: 12px;
        }

        .form-group {
          margin-bottom: 12px;
        }

        label {
          font-size: 13px;
          margin-bottom: 4px;
        }

        input, select {
          padding: 10px;
          font-size: 14px;
        }

        .book-btn {
          padding: 12px;
          font-size: 15px;
        }

        .section {
          margin-bottom: 16px;
        }
      }

      /* High DPI screens (Retina, etc) */
      @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        /* Ensure sharp rendering on high-DPI displays */
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      }
    `;
  }
}

// Only define if not already defined
if (!customElements.get("mielelogic-panel")) {
  customElements.define("mielelogic-panel", MieleLogicPanel);
}
