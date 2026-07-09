// InfoPanel — DOM-based glassmorphism information panel (Tech Spec §8).
//
// Opens when a node is selected (M5 onSelect → panel.open). Shows title + colored
// banner + description. Closes via: click empty space, walk away (auto), or ESC.
// Only one panel open at a time — selecting a new node replaces the content.
//
// The panel is a pure DOM overlay. Pointer lock stays active while it's open
// (the player can keep moving). The close button is visual-only under pointer
// lock; actual closing is handled by Application via click-on-empty-space.

export class InfoPanel {
  constructor() {
    this.el = document.getElementById('info-panel');
    this._banner = this.el?.querySelector('.panel-banner');
    this._title = this.el?.querySelector('.panel-title');
    this._desc = this.el?.querySelector('.panel-description');
    this._currentId = null;
    this._visible = false;
  }

  /**
   * Open the panel with the given content. If already open, replace the content.
   * @param {{ title:string, banner:string, description:string }} content
   * @param {string} id  The node id (for tracking / single-panel logic)
   */
  open(content, id) {
    if (!this.el) return;

    this._currentId = id;

    // Fill content
    if (this._title) this._title.textContent = content.title;
    if (this._desc) this._desc.textContent = content.description;
    if (this._banner) this._banner.style.background = content.banner;

    // Trigger entrance animation
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
