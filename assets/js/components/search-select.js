// assets/js/components/search-select.js
// Reusable searchable combobox (type-ahead select) for record lookups with
// hundreds of rows. Replaces plain <select> lists that force users to scroll.
// The option menu is portaled to <body> with fixed positioning so it is never
// clipped by scrollable modal bodies.
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements (Create ->
// Configure -> Listen -> Append option rows) & 03 APIs and Database Operations/
// javascript_working_with_apis (debounced async lookup with stale-response guard)

let instanceSeq = 0;

function escapeHtml(str) {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export class SearchSelect {
    constructor(options = {}) {
        this.options = options.options || [];
        this.remote = typeof options.remote === 'function' ? options.remote : null;
        this.debounce = options.debounce ?? 250;
        this.placeholder = options.placeholder || 'Search...';
        this.emptyText = options.emptyText || 'No matching records found.';
        this.loadingText = options.loadingText || 'Searching...';
        this.errorText = options.errorText || 'Unable to load records. Please try again.';
        this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
        this.inputId = options.inputId || `search-select-input-${++instanceSeq}`;
        this.name = options.name || '';
        this.disabled = !!options.disabled;

        this.value = options.value !== undefined && options.value !== null ? String(options.value) : '';
        this.label = options.label || '';
        this.items = [];
        this.highlight = -1;
        this.open = false;
        this.loadedOnce = false;
        this.cachedQuery = null;
        this.timer = null;
        this.requestSeq = 0;
        this.rafId = null;

        this._onDocPointerDown = this._onDocPointerDown.bind(this);
        this._onScrollOrResize = this._onScrollOrResize.bind(this);
        this._onInputKeydown = this._onInputKeydown.bind(this);

        this._buildDom();
        this._syncFromValue();
    }

    // ------------------------------------------------------------------
    // DOM construction
    // ------------------------------------------------------------------

    _buildDom() {
        this.root = document.createElement('div');
        this.root.classList.add('search-select');

        this.control = document.createElement('div');
        this.control.classList.add('search-select-control');

        this.icon = document.createElement('span');
        this.icon.classList.add('search-select-icon');
        this.icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.id = this.inputId;
        this.input.classList.add('form-control', 'search-select-input');
        this.input.placeholder = this.placeholder;
        this.input.autocomplete = 'off';
        this.input.spellcheck = false;
        this.input.setAttribute('role', 'combobox');
        this.input.setAttribute('aria-autocomplete', 'list');
        this.input.setAttribute('aria-expanded', 'false');
        this.input.disabled = this.disabled;

        this.clearBtn = document.createElement('button');
        this.clearBtn.type = 'button';
        this.clearBtn.classList.add('search-select-clear');
        this.clearBtn.setAttribute('aria-label', 'Clear selection');
        this.clearBtn.innerHTML = '&times;';
        this.clearBtn.hidden = true;

        this.spinner = document.createElement('span');
        this.spinner.classList.add('search-select-spinner');
        this.spinner.setAttribute('aria-hidden', 'true');
        this.spinner.hidden = true;

        this.hidden = document.createElement('input');
        this.hidden.type = 'hidden';
        this.hidden.classList.add('search-select-value');
        if (this.name) this.hidden.name = this.name;

        this.control.appendChild(this.icon);
        this.control.appendChild(this.input);
        this.control.appendChild(this.spinner);
        this.control.appendChild(this.clearBtn);
        this.root.appendChild(this.control);
        this.root.appendChild(this.hidden);

        this.menu = document.createElement('div');
        this.menu.classList.add('search-select-menu');
        this.menu.id = `${this.inputId}-menu`;
        this.menu.setAttribute('role', 'listbox');
        this.menu.hidden = true;
        this.input.setAttribute('aria-controls', this.menu.id);

        this.input.addEventListener('focus', () => {
            if (this.disabled) return;
            this._openMenu();
            this._loadItems(this.input.value === this.label ? '' : this.input.value.trim());
        });

        this.input.addEventListener('click', () => {
            if (this.disabled) return;
            this._openMenu();
        });

        this.input.addEventListener('input', () => {
            if (this.disabled) return;
            // Typing diverges from the stored selection: keep the form honest
            this.value = '';
            this.label = '';
            this.hidden.value = '';
            this._syncClearButton();
            this._openMenu();
            this._loadItems(this.input.value.trim());
        });

        this.input.addEventListener('keydown', (e) => {
            if (this.disabled) return;
            this._onInputKeydown(e);
        });

        this.clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.disabled) return;
            this.clear();
            this.input.focus();
            this._loadItems('');
        });

        this.menu.addEventListener('pointerdown', (e) => {
            // Prevent the input blur before the option click lands
            e.preventDefault();
        });

        this.menu.addEventListener('click', (e) => {
            const optionEl = e.target.closest('.search-select-option');
            if (!optionEl) return;
            const item = this.items[Number(optionEl.getAttribute('data-index'))];
            if (item) {
                this._select(item);
            }
        });

        this.menu.addEventListener('mousemove', (e) => {
            const optionEl = e.target.closest('.search-select-option');
            if (!optionEl) return;
            const index = Number(optionEl.getAttribute('data-index'));
            if (index !== this.highlight) {
                this.highlight = index;
                this._syncHighlight();
            }
        });
    }

    mount(target) {
        const host = typeof target === 'string' ? document.querySelector(target) : target;
        if (!host) return this;

        this.host = host;
        host.classList.add('search-select-host');
        host.innerHTML = '';
        host.appendChild(this.root);
        // Portal the listbox to <body> so modal overflow never clips it
        document.body.appendChild(this.menu);
        return this;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    getValue() {
        return this.value;
    }

    getLabel() {
        return this.label;
    }

    getSelected() {
        return this.value !== '' ? { value: this.value, label: this.label } : null;
    }

    setValue(value, label) {
        this.value = value !== undefined && value !== null && value !== '' ? String(value) : '';
        this.label = label || '';
        this.hidden.value = this.value;
        this.input.value = this.label;
        this._syncClearButton();
    }

    clear() {
        this.setValue('', '');
    }

    setInvalid(isInvalid) {
        this.input.classList.toggle('is-invalid', !!isInvalid);
        if (this.host) this.host.classList.toggle('is-invalid', !!isInvalid);
    }

    setDisabled(isDisabled) {
        this.disabled = !!isDisabled;
        this.input.disabled = this.disabled;
        if (this.root) this.root.classList.toggle('is-disabled', this.disabled);
        this._syncClearButton();
        if (this.disabled) this._closeMenu();
    }

    reload() {
        this.cachedQuery = null;
        this.loadedOnce = false;
        this.items = [];
        if (this.open) {
            this._loadItems(this.input.value === this.label ? '' : this.input.value.trim());
        }
    }

    destroy() {
        clearTimeout(this.timer);
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this._closeMenu();
        this.input.removeEventListener('keydown', this._onInputKeydown);
        if (this.menu.parentNode) this.menu.parentNode.removeChild(this.menu);
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }

    // ------------------------------------------------------------------
    // Menu open/close & positioning
    // ------------------------------------------------------------------

    _openMenu() {
        if (this.open || this.disabled) return;
        this.open = true;
        this.menu.hidden = false;
        this.root.classList.add('is-open');
        this.input.setAttribute('aria-expanded', 'true');
        this._positionMenu();
        document.addEventListener('pointerdown', this._onDocPointerDown, true);
        document.addEventListener('scroll', this._onScrollOrResize, true);
        window.addEventListener('resize', this._onScrollOrResize);
    }

    _closeMenu() {
        if (!this.open) return;
        this.open = false;
        this.menu.hidden = true;
        this.root.classList.remove('is-open');
        this.input.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this._onDocPointerDown, true);
        document.removeEventListener('scroll', this._onScrollOrResize, true);
        window.removeEventListener('resize', this._onScrollOrResize);
    }

    _positionMenu() {
        const rect = this.control.getBoundingClientRect();
        const gap = 4;
        const menuHeight = Math.min(this.menu.scrollHeight || 0, 260);
        const spaceBelow = window.innerHeight - rect.bottom;

        this.menu.style.width = `${rect.width}px`;
        this.menu.style.left = `${rect.left}px`;

        if (spaceBelow < menuHeight + gap && rect.top > spaceBelow) {
            this.menu.style.top = `${Math.max(gap, rect.top - menuHeight - gap)}px`;
        } else {
            this.menu.style.top = `${rect.bottom + gap}px`;
        }
    }

    _onScrollOrResize(e) {
        if (e && e.target && this.menu.contains(e.target)) return;
        if (this.rafId) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            if (this.open) this._positionMenu();
        });
    }

    _onDocPointerDown(e) {
        if (this.root.contains(e.target) || this.menu.contains(e.target)) return;
        this._closeMenu();
    }

    // ------------------------------------------------------------------
    // Data loading
    // ------------------------------------------------------------------

    _loadItems(query) {
        if (this.cachedQuery === query && this.loadedOnce) {
            this._renderItems();
            if (this.open) this._positionMenu();
            return;
        }

        clearTimeout(this.timer);
        const delay = query === '' ? 0 : this.debounce;
        this.timer = setTimeout(() => this._fetch(query), delay);
    }

    async _fetch(query) {
        const requestSeq = ++this.requestSeq;
        if (!this.loadedOnce) this._renderLoading();

        try {
            let items;
            if (this.remote) {
                items = await this.remote(query);
            } else {
                const needle = query.toLowerCase();
                items = this.options.filter(item => {
                    const label = String(item.label || '').toLowerCase();
                    const meta = String(item.meta || '').toLowerCase();
                    return needle === '' || label.includes(needle) || meta.includes(needle);
                });
            }

            if (requestSeq !== this.requestSeq) return; // stale response

            this.items = Array.isArray(items) ? items : [];
            this.cachedQuery = query;
            this.loadedOnce = true;
            this.highlight = this.items.length ? 0 : -1;
            this._renderItems();
            if (this.open) this._positionMenu();
        } catch (err) {
            if (requestSeq !== this.requestSeq) return;
            this.items = [];
            this.loadedOnce = false;
            this.cachedQuery = null;
            this.spinner.hidden = true;
            this._renderMessage(this.errorText, 'is-error');
        }
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderLoading() {
        this.spinner.hidden = false;
        this._renderMessage(this.loadingText, 'is-loading');
    }

    _renderMessage(message, extraClass) {
        this.menu.innerHTML = `<div class="search-select-message ${extraClass || ''}">${escapeHtml(message)}</div>`;
    }

    _renderItems() {
        this.spinner.hidden = true;

        if (this.items.length === 0) {
            this._renderMessage(this.emptyText, '');
            return;
        }

        this.menu.innerHTML = this.items.map((item, index) => {
            const selected = String(item.value) === this.value;
            const meta = item.meta ? `<span class="search-select-option-meta">${escapeHtml(item.meta)}</span>` : '';
            return `
                <div class="search-select-option${index === this.highlight ? ' is-active' : ''}" role="option"
                     data-index="${index}" aria-selected="${selected ? 'true' : 'false'}">
                    <span class="search-select-option-label">${escapeHtml(item.label)}</span>
                    ${meta}
                </div>
            `;
        }).join('');
    }

    _syncHighlight() {
        this.menu.querySelectorAll('.search-select-option').forEach((el, index) => {
            el.classList.toggle('is-active', index === this.highlight);
        });
        const active = this.menu.querySelector('.search-select-option.is-active');
        if (active && typeof active.scrollIntoView === 'function') {
            active.scrollIntoView({ block: 'nearest' });
        }
    }

    _syncFromValue() {
        this.hidden.value = this.value;
        if (this.label) {
            this.input.value = this.label;
        }
        this._syncClearButton();
    }

    _syncClearButton() {
        this.clearBtn.hidden = this.disabled || (this.value === '' && this.input.value === '');
    }

    // ------------------------------------------------------------------
    // Selection & keyboard interaction
    // ------------------------------------------------------------------

    _select(item) {
        this.setValue(item.value, item.label);
        this.cachedQuery = this.input.value;
        this._closeMenu();
        this.onChange(item);
    }

    _onInputKeydown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (!this.open) {
                    this._openMenu();
                    this._loadItems(this.input.value === this.label ? '' : this.input.value.trim());
                    return;
                }
                if (this.items.length) {
                    this.highlight = Math.min(this.highlight + 1, this.items.length - 1);
                    this._syncHighlight();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!this.open) {
                    this._openMenu();
                    return;
                }
                if (this.items.length) {
                    this.highlight = Math.max(this.highlight - 1, 0);
                    this._syncHighlight();
                }
                break;
            case 'Enter':
                if (this.open && this.highlight >= 0 && this.items[this.highlight]) {
                    e.preventDefault();
                    this._select(this.items[this.highlight]);
                }
                break;
            case 'Escape':
                if (this.open) {
                    e.preventDefault();
                    e.stopPropagation();
                    this._closeMenu();
                }
                break;
            case 'Tab':
                this._closeMenu();
                break;
            default:
                break;
        }
    }
}

export default SearchSelect;
