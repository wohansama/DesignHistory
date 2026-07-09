// InfoPanel — DOM-based glassmorphism information panel (Tech Spec §8).
//
// Opens when a node is selected. Shows title + colored banner + guide (short,
// emphasized) + body (longer paragraph) + unified footer. Closes via click empty,
// walk away, or ESC.

import { PANEL_FOOTER } from './panel-content.js';

export class InfoPanel {
  constructor() {
    this.el = document.getElementById('info-panel');
    this._banner = this.el?.querySelector('.panel-banner');
    this._title = this.el?.querySelector('.panel-title');
    this._guide = this.el?.querySelector('.panel-guide');
    this._body = this.el?.querySelector('.panel-description');
    this._footer = this.el?.querySelector('.panel-footer');
    this._currentId = null;
    this._visible = false;

    // Set the unified footer once (same for all panels).
    if (this._footer) this._footer.textContent = PANEL_FOOTER;
  }

  open(content, id) {
    if (!this.el) return;

    this._currentId = id;

    if (this._title) this._title.textContent = content.title;
    if (this._guide) this._guide.textContent = content.guide;
    if (this._body) this._body.textContent = content.body;
    if (this._banner) this._banner.style.background = content.banner;

    this.el.classList.add('visible');
    this._visible = true;

    console.log(`[InfoPanel] Opened: ${content.title} (${id})`);
  }

  close() {
    if (!this._visible) return;
    this.el?.classList.remove('visible');
    this._visible = false;
    this._currentId = null;
    console.log('[InfoPanel] Closed.');
  }

  isOpen() {
    return this._visible;
  }

  getCurrentId() {
    return this._currentId;
  }
}
