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
      // Tab system
      currentTab: { type: String },
      adminSettings: { type: Object },
      adminSaving: { type: Boolean },
      // Notification state
      devices: { type: Array },
      availableDevices: { type: Array },
      notifications: { type: Object },
      // Template editing
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

  async loadAdminSettings() {
    try {
      const result = await this.hass.callWS({ type: "mielelogic/get_admin" });
      this.adminSettings = result || this.adminSettings;
    } catch (e) {
      console.warn("MieleLogic: Could not load admin settings", e);
    }
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
      this.showNotification("✅ Admin indstillinger gemt", "success");
    } catch (e) {
      this.showNotification("❌ Kunne ikke gemme", "error");
    }
    this.adminSaving = false;
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
  
  // ✨ v1.8.0: Template editing methods
  
  editNotification(notifId) {
    const notif = this.notifications[notifId];
    if (!notif) return;
    
    this.editingNotificationId = notifId;
    this.editTitle = notif.title;
    this.editMessage = notif.message;
  }
  
  cancelEdit() {
    this.editingNotificationId = null;
    this.editTitle = "";
    this.editMessage = "";
  }
  
  async saveEdit() {
    if (!this.editingNotificationId) return;
    
    try {
      const notif = this.notifications[this.editingNotificationId];
      
      await this.hass.callWS({
        type: "mielelogic/save_notification",
        notification_id: this.editingNotificationId,
        config: {
          ...notif,
          title: this.editTitle,
          message: this.editMessage,
        },
      });
      
      // Update local state - spread to trigger reactivity
      this.notifications = {
        ...this.notifications,
        [this.editingNotificationId]: {
          ...notif,
          title: this.editTitle,
          message: this.editMessage,
        },
      };
      
      this.showNotification("✅ Skabelon gemt!", "success");
      this.cancelEdit();
    } catch (err) {
      console.error("Error saving template:", err);
      this.showNotification("❌ Kunne ikke gemme", "error");
    }
  }
  
  async resetToDefault() {
    if (!this.editingNotificationId) return;
    
    if (!confirm("Nulstil til standard skabelon?")) {
      return;
    }
    
    try {
      const result = await this.hass.callWS({
        type: "mielelogic/reset_notification",
        notification_id: this.editingNotificationId,
      });
      
      // Update local state with default - spread to trigger reactivity
      this.notifications = {
        ...this.notifications,
        [this.editingNotificationId]: result.config,
      };
      this.editTitle = result.config.title;
      this.editMessage = result.config.message;
      
      this.showNotification("✅ Nulstillet til standard!", "success");
    } catch (err) {
      console.error("Error resetting template:", err);
      this.showNotification("❌ Kunne ikke nulstille", "error");
    }
  }
  
  getPreviewText(template, type) {
    // Replace variables with example values
    const examples = {
      "{vaskehus}": type.includes("reminder") || type.includes("created") ? "Klatvask" : "Storvask",
      "{time}": "14:30",
      "{date}": "28-05-2026",
      "{duration}": "120 minutter",
      "{machine}": "Maskine 1",
    };
    
    let result = template;
    for (const [key, value] of Object.entries(examples)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    return result;
  }
  
  renderEditModal() {
    const notif = this.notifications[this.editingNotificationId];
    if (!notif) return '';
    
    return html`
      <div class="modal-overlay" @click=${this.cancelEdit}>
        <div class="modal-content" @click=${(e) => e.stopPropagation()}>
          <h2>✏️ Rediger Skabelon</h2>
          
          <div class="form-group">
            <label for="edit-title">Titel:</label>
            <input
              id="edit-title"
              type="text"
              .value=${this.editTitle}
              @input=${(e) => { this.editTitle = e.target.value; this.requestUpdate(); }}
              placeholder="Titel"
            />
            <div class="preview">
              <strong>Eksempel:</strong> ${this.getPreviewText(this.editTitle, this.editingNotificationId)}
            </div>
          </div>
          
          <div class="form-group">
            <label for="edit-message">Besked:</label>
            <textarea
              id="edit-message"
              .value=${this.editMessage}
              @input=${(e) => { this.editMessage = e.target.value; this.requestUpdate(); }}
              placeholder="Besked"
              rows="3"
            ></textarea>
            <div class="preview">
              <strong>Eksempel:</strong> ${this.getPreviewText(this.editMessage, this.editingNotificationId)}
            </div>
          </div>
          
          <div class="variable-help">
            <strong>Tilgængelige variable:</strong><br>
            <code>{vaskehus}</code> - Klatvask / Storvask<br>
            <code>{time}</code> - 14:30<br>
            <code>{date}</code> - 28-05-2026<br>
            <code>{duration}</code> - 120 minutter
          </div>
          
          <div class="modal-actions">
            <button class="btn-secondary" @click=${this.resetToDefault}>
              🔄 Nulstil
            </button>
            <button class="btn-secondary" @click=${this.cancelEdit}>
              Annuller
            </button>
            <button class="btn-primary" @click=${this.saveEdit}>
              💾 Gem
            </button>
          </div>
        </div>
      </div>
    `;
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
        ${this.currentTab === "booking" ? this.renderBookingTab() : this.currentTab === "notifications" ? this.renderNotificationTab() : this.renderAdminTab()}
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
        <button 
          class="tab ${this.currentTab === 'admin' ? 'active' : ''}"
          @click=${() => { this.currentTab = 'admin'; this.requestUpdate(); }}
        >
          ⚙️ Admin
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

  renderAdminTab() {
    const a = this.adminSettings;
    return html`
      <div class="admin-tab">
        <h2>⚙️ Admin</h2>

        <section class="admin-section">
          <h3>📢 Driftsbesked</h3>
          <p class="admin-desc">Vises øverst i booking kortet til alle brugere. Efterlad tom for ingen besked.</p>
          <textarea
            class="admin-textarea"
            placeholder="f.eks. Vaskehuset rengøres fredag d. 3/3 kl. 10-12"
            .value=${a.info_message || ""}
            @input=${(e) => { this.adminSettings = { ...this.adminSettings, info_message: e.target.value }; }}
          ></textarea>
        </section>

        <section class="admin-section">
          <h3>🔒 Booking spærring</h3>
          <p class="admin-desc">Spærrer for nye bookinger i booking kortet. Eksisterende bookinger påvirkes ikke.</p>
          
          <label class="admin-toggle">
            <input
              type="checkbox"
              .checked=${a.booking_locked}
              @change=${(e) => { this.adminSettings = { ...this.adminSettings, booking_locked: e.target.checked }; }}
            />
            <span class="toggle-slider"></span>
            <span class="toggle-label">${a.booking_locked ? "🔒 Booking spærret" : "🔓 Booking åben"}</span>
          </label>

          ${a.booking_locked ? html`
            <input
              type="text"
              class="admin-input"
              placeholder="Besked til brugerne..."
              .value=${a.lock_message || ""}
              @input=${(e) => { this.adminSettings = { ...this.adminSettings, lock_message: e.target.value }; }}
            />
          ` : ""}
        </section>

        <button
          class="admin-save-btn ${this.adminSaving ? "saving" : ""}"
          @click=${() => this.saveAdminSettings()}
          ?disabled=${this.adminSaving}
        >
          ${this.adminSaving ? "💾 Gemmer…" : "💾 Gem indstillinger"}
        </button>
      </div>
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
            <div class="booking-duration">${(() => { const d = booking.Duration ?? booking.duration; if (d != null && !isNaN(+d)) return +d + " min"; try { const m = Math.round((new Date(booking.End)-new Date(booking.Start))/60000); if (m>0) return m+" min"; } catch(e){} return ""; })()}</div>
            ${booking.created_by ? html`
              <div class="booking-user">👤 ${booking.created_by}</div>
            ` : ''}
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
                <div class="notification-actions">
                  <button 
                    class="edit-btn"
                    @click=${() => this.editNotification(id)}
                    title="Rediger skabelon"
                  >
                    ✏️ Rediger
                  </button>
                  <button 
                    class="test-btn"
                    @click=${() => this.testNotification(id)}
                    ?disabled=${!notif.enabled || this.devices.length === 0}
                    title="Send test notifikation"
                  >
                    ✉️ Test
                  </button>
                </div>
              </div>
              <div class="notification-message">${notif.message}</div>
            </div>
          `)}
        </div>
        
        ${this.editingNotificationId ? this.renderEditModal() : ''}
      </div>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
        padding: 16px;
        max-width: 1200px; /* Increased from 800px for better grid layout */
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

      .booking-user {
        font-size: 11px;
        color: var(--secondary-text-color, #757575);
        margin-top: 4px;
        font-style: italic;
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
      /* Admin tab */
      .admin-tab { padding: 16px; max-width: 600px; }
      .admin-tab h2 { margin: 0 0 20px; font-size: 18px; }
      .admin-section { margin-bottom: 24px; background: var(--card-background-color, #1e1e1e); border-radius: 10px; padding: 16px; }
      .admin-section h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
      .admin-desc { font-size: 12px; color: var(--secondary-text-color); margin: 0 0 12px; }
      .admin-textarea {
        width: 100%; min-height: 70px; padding: 10px; box-sizing: border-box;
        background: var(--input-fill-color, rgba(255,255,255,0.05));
        border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        border-radius: 8px; color: var(--primary-text-color); font-family: inherit;
        font-size: 13px; resize: vertical;
      }
      .admin-input {
        width: 100%; padding: 10px; margin-top: 10px; box-sizing: border-box;
        background: var(--input-fill-color, rgba(255,255,255,0.05));
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

      /* Device List - Responsive Grid */
      .device-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 8px;
        margin-bottom: 16px;
        justify-content: center;
        max-width: 800px; /* Limit width for better centering */
        margin-left: auto;
        margin-right: auto;
      }

      .device-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        background: var(--card-background-color, #fff);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        border: 2px solid transparent;
        min-width: 0; /* Allow flex items to shrink */
      }

      .device-item:hover {
        background: var(--primary-background-color, #f5f5f5);
        border-color: #03a9f4;
      }

      .device-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .device-name {
        font-size: 13px;
        color: var(--primary-text-color, #212121);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }

      /* Notification List - 2 Column Grid Centered */
      .notification-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 12px;
        max-width: 900px; /* Limit to ~2 columns width */
        margin-left: auto;
        margin-right: auto;
        justify-content: center;
      }

      .notification-item {
        background: var(--card-background-color, #fff);
        padding: 14px;
        border-radius: 8px;
        border: 2px solid transparent;
        transition: border-color 0.2s;
        min-width: 0; /* Allow flex items to shrink */
      }

      .notification-item:hover {
        border-color: #03a9f4;
      }

      .notification-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      
      .notification-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      .notification-toggle {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        flex: 1;
        min-width: 0;
      }

      .notification-toggle input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .notification-title {
        font-weight: 600;
        font-size: 15px;
        color: var(--primary-text-color, #212121);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .notification-message {
        font-size: 13px;
        color: var(--secondary-text-color, #757575);
        margin-left: 28px;
        line-height: 1.3;
      }

      .test-btn {
        background: #4caf50;
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .test-btn:hover:not(:disabled) {
        background: #45a049;
      }
      
      .test-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .edit-btn {
        background: #ff9800;
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap;
        flex-shrink: 0;
      }
      
      .edit-btn:hover {
        background: #fb8c00;
      }
      
      /* ✨ v1.8.0: Modal styles */
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
      }
      
      .modal-content {
        background: var(--card-background-color, #fff);
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }
      
      .modal-content h2 {
        margin-top: 0;
        margin-bottom: 20px;
        color: var(--primary-text-color);
      }
      
      .form-group {
        margin-bottom: 20px;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      
      .form-group input,
      .form-group textarea {
        width: 100%;
        padding: 10px;
        border: 2px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        box-sizing: border-box;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }
      
      .form-group textarea {
        resize: vertical;
        min-height: 80px;
      }
      
      .form-group input:focus,
      .form-group textarea:focus {
        outline: none;
        border-color: #03a9f4;
      }
      
      .preview {
        margin-top: 8px;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 6px;
        font-size: 13px;
        color: #666;
      }
      
      .variable-help {
        background: #e3f2fd;
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 20px;
        font-size: 13px;
        line-height: 1.6;
      }
      
      .variable-help code {
        background: #fff;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
        color: #d32f2f;
      }
      
      .modal-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      
      .btn-primary,
      .btn-secondary {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: #03a9f4;
        color: white;
      }
      
      .btn-primary:hover {
        background: #0288d1;
      }
      
      .btn-secondary {
        background: #e0e0e0;
        color: #333;
      }
      
      .btn-secondary:hover {
        background: #d0d0d0;
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

        /* Device grid: 1 column on small mobile */
        .device-list {
          grid-template-columns: 1fr;
        }

        /* Notification list: 1 column on mobile */
        .notification-list {
          grid-template-columns: 1fr;
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

        /* Device grid: Same compact sizing */
        .device-list {
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
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
          max-width: 1400px; /* Even wider on desktop for better grid layout */
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
      @media (orientation: landscape) and (max-width: 1199px) {
        :host {
          max-width: 98%; /* Almost edge to edge (but not on desktop) */
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
