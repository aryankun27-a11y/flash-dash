// ---------- Unified Custom Modal Overlay Manager ----------
const ModalManager = {
  overlay: document.getElementById('customModalOverlay'),
  content: document.getElementById('customModalContent'),
  confirmBtn: document.getElementById('customModalConfirmBtn'),
  cancelBtn: document.getElementById('customModalCancelBtn'),
  currentResolve: null,

  init() {
    this.confirmBtn.addEventListener('click', () => this.handleAction(true));
    this.cancelBtn.addEventListener('click', () => this.handleAction(false));
    
    // Close on clicking outside the modal card
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.handleAction(false);
      }
    });

    // Close drawer overlay on Esc press (unless focus is on forms)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
        this.handleAction(false);
      }
    });
  },

  handleAction(value) {
    if (this.currentResolve) {
      this.currentResolve(value);
      this.currentResolve = null;
    }
    this.close();
  },

  close() {
    this.overlay.classList.remove('active');
    setTimeout(() => {
      this.content.innerHTML = '';
      this.confirmBtn.style.display = 'inline-block';
      this.cancelBtn.style.display = 'inline-block';
      this.confirmBtn.textContent = 'Confirm';
      this.cancelBtn.textContent = 'Cancel';
    }, 250);
  },

  async confirm(message) {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `<div style="font-size: 14px; line-height: 1.5; font-weight: 500; text-align: center; margin: 10px 0;">${message}</div>`;
      this.confirmBtn.textContent = 'Confirm';
      this.cancelBtn.textContent = 'Cancel';
      this.overlay.classList.add('active');
    });
  },

  async alert(message) {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `<div style="font-size: 14px; line-height: 1.5; font-weight: 500; text-align: center; margin: 10px 0;">${message}</div>`;
      this.confirmBtn.textContent = 'OK';
      this.cancelBtn.style.display = 'none';
      this.overlay.classList.add('active');
    });
  },

  async promptShortcut() {
    return new Promise((resolve) => {
      this.content.innerHTML = `
        <div class="modal-welcome-title" style="font-size: 18px; margin-bottom: 12px;">Add Shortcut</div>
        <div class="modal-form-group">
          <label for="shortcutTitleInput">Name (Max 15 chars)</label>
          <input type="text" id="shortcutTitleInput" class="modal-input" placeholder="e.g. Google" maxlength="15" autocomplete="off" />
        </div>
        <div class="modal-form-group" style="margin-top: 12px;">
          <label for="shortcutUrlInput">URL</label>
          <input type="text" id="shortcutUrlInput" class="modal-input" placeholder="e.g. google.com" autocomplete="off" />
        </div>
      `;
      this.confirmBtn.textContent = 'Add';
      this.cancelBtn.textContent = 'Cancel';
      this.overlay.classList.add('active');

      const titleInput = document.getElementById('shortcutTitleInput');
      const urlInput = document.getElementById('shortcutUrlInput');
      
      // Auto-focus the title input
      setTimeout(() => titleInput.focus(), 50);

      const handleKey = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmBtn.click();
        }
      };
      titleInput.addEventListener('keydown', handleKey);
      urlInput.addEventListener('keydown', handleKey);

      this.currentResolve = (confirmed) => {
        if (confirmed) {
          const title = titleInput.value.trim();
          let url = urlInput.value.trim();
          if (title && url) {
            resolve({ title, url });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
    });
  },

  async showWelcomeModal() {
    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.content.innerHTML = `
        <h2 class="modal-welcome-title">⚡ Welcome to Flash Dash!</h2>
        <p class="modal-welcome-desc">A beautiful, premium, distraction-free dashboard. Let's look at the core mechanics:</p>
        <ul class="modal-welcome-list">
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">🕐</span>
            <div class="modal-welcome-text">
              <strong>Typographic Focus Countdown</strong>
              <span>Double-click background/clock to enter a sleek countdown space. Select sequential duration presets (5m, 10m, 25m, 50m) with micro-tick animations.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">✨</span>
            <div class="modal-welcome-text">
              <strong>Adaptive Color Accent</strong>
              <span>Set custom background images inside settings. Checkboxes, buttons, and glowing accents will extract and match its dominant colors.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">↔️</span>
            <div class="modal-welcome-text">
              <strong>Zero-Distraction Sidebars</strong>
              <span>Left vertical toolbar and right tasks card slide out on hover near the screen edges, leaving a completely clean view.</span>
            </div>
          </li>
          <li class="modal-welcome-item">
            <span class="modal-welcome-icon">🖼️</span>
            <div class="modal-welcome-text">
              <strong>Goal Whiteboard</strong>
              <span>Drag &amp; drop images directly. Resizing and dragging snaps alignment to borders. Sidebars auto-hide during adjustments.</span>
            </div>
          </li>
        </ul>
      `;
      this.confirmBtn.textContent = "Let's Go!";
      this.cancelBtn.style.display = 'none';
      this.overlay.classList.add('active');
    });
  }
};
ModalManager.init();
window.ModalManager = ModalManager;
