// assets/js/components/time-picker.js
// Reusable "Time to take" picker for medication prescriptions: common time
// chips (one click) plus a native time input for exact custom times. Supports
// multiple times per medication (e.g. "8:00 AM, 8:00 PM" for BID dosing).
// The dropdown is portaled to <body> with fixed positioning so it is never
// clipped by scrollable containers.
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements
// (Create -> Configure -> Listen -> Append chips) & 02 DOM and UI/dom_apply_styles
// (classList toggling for active states)

let instanceSeq = 0;

const COMMON_TIMES = [
    '6:00 AM', '8:00 AM', '10:00 AM', '12:00 PM', '2:00 PM',
    '4:00 PM', '6:00 PM', '8:00 PM', '10:00 PM'
];

function parseTimeToken(token) {
    const match = String(token).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]\.?M\.?)?$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    let meridiem = match[3] ? match[3].replace(/\./g, '').toUpperCase() : null;

    if (minutes > 59) return null;

    if (!meridiem) {
        if (hours > 23) return null;
        meridiem = hours >= 12 ? 'PM' : 'AM';
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
    } else if (hours < 1 || hours > 12) {
        return null;
    }

    return { hours, minutes, meridiem };
}

function toLabel(parsed) {
    return `${parsed.hours}:${String(parsed.minutes).padStart(2, '0')} ${parsed.meridiem}`;
}

function toSortValue(parsed) {
    const hour24 = parsed.meridiem === 'PM'
        ? (parsed.hours === 12 ? 12 : parsed.hours + 12)
        : (parsed.hours === 12 ? 0 : parsed.hours);
    return hour24 * 60 + parsed.minutes;
}

function parseValue(value) {
    const result = [];
    if (!value) return result;

    const tokens = String(value).split(/,|&|;|\band\b/i).map(t => t.trim()).filter(Boolean);
    tokens.forEach(token => {
        const parsed = parseTimeToken(token);
        if (parsed) {
            const label = toLabel(parsed);
            if (!result.some(entry => entry.label === label)) {
                result.push({ label, sort: toSortValue(parsed), custom: false });
            }
        } else if (!result.some(entry => entry.label === token)) {
            result.push({ label: token, sort: null, custom: true });
        }
    });

    return result.sort((a, b) => {
        if (a.sort === null && b.sort === null) return 0;
        if (a.sort === null) return 1;
        if (b.sort === null) return -1;
        return a.sort - b.sort;
    });
}

function serialize(entries) {
    return entries.map(entry => entry.label).join(', ');
}

function fromTimeInput(value) {
    // value is "HH:MM" from <input type="time">
    const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours > 23 || minutes > 59) return null;
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return { label: `${hours}:${String(minutes).padStart(2, '0')} ${meridiem}`, sort: parseInt(match[1], 10) * 60 + minutes, custom: false };
}

export class TimePicker {
    constructor(options = {}) {
        this.placeholder = options.placeholder || 'Set time...';
        this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
        this.inputId = options.inputId || `time-picker-input-${++instanceSeq}`;
        this.disabled = !!options.disabled;

        this.value = options.value ? String(options.value) : '';
        this.entries = parseValue(this.value);
        this.open = false;
        this.rafId = null;

        this._onDocPointerDown = this._onDocPointerDown.bind(this);
        this._onScrollOrResize = this._onScrollOrResize.bind(this);

        this._buildDom();
        this._renderControl();
    }

    _buildDom() {
        this.root = document.createElement('div');
        this.root.classList.add('time-picker');

        this.control = document.createElement('button');
        this.control.type = 'button';
        this.control.classList.add('form-control', 'time-picker-control');
        this.control.id = this.inputId;
        this.control.setAttribute('aria-haspopup', 'true');
        this.control.setAttribute('aria-expanded', 'false');
        this.control.disabled = this.disabled;
        this.control.innerHTML = `
            <svg class="time-picker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span class="time-picker-value"></span>
        `;
        this.valueEl = this.control.querySelector('.time-picker-value');

        this.root.appendChild(this.control);

        this.menu = document.createElement('div');
        this.menu.classList.add('time-picker-menu');
        this.menu.id = `${this.inputId}-menu`;
        this.menu.hidden = true;

        this.menu.innerHTML = `
            <div class="time-picker-section-label">Common times</div>
            <div class="time-picker-chips" data-role="common-chips"></div>
            <div class="time-picker-section-label" data-role="selected-label" hidden>Selected</div>
            <div class="time-picker-chips" data-role="selected-chips"></div>
            <div class="time-picker-custom">
                <input type="time" class="form-control time-picker-custom-input" aria-label="Custom time">
                <button type="button" class="btn btn-secondary btn-sm" data-role="add-custom">Add</button>
            </div>
            <button type="button" class="time-picker-clear" data-role="clear">Clear all times</button>
        `;

        this.commonChips = this.menu.querySelector('[data-role="common-chips"]');
        this.selectedLabel = this.menu.querySelector('[data-role="selected-label"]');
        this.selectedChips = this.menu.querySelector('[data-role="selected-chips"]');
        this.customInput = this.menu.querySelector('.time-picker-custom-input');
        this.addCustomBtn = this.menu.querySelector('[data-role="add-custom"]');
        this.clearBtn = this.menu.querySelector('[data-role="clear"]');

        this.control.addEventListener('click', () => this.toggle());
        this.menu.addEventListener('click', (e) => this._onMenuClick(e));
        this.addCustomBtn.addEventListener('click', () => this._addCustomTime());
        this.clearBtn.addEventListener('click', () => this._clear());
        this.customInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                this._addCustomTime();
            }
        });

        this._renderChips();
    }

    mount(target) {
        const host = typeof target === 'string' ? document.querySelector(target) : target;
        if (!host) return this;

        this.host = host;
        host.innerHTML = '';
        host.appendChild(this.root);
        document.body.appendChild(this.menu);
        return this;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    getValue() {
        return this.value;
    }

    setValue(value) {
        this.value = value ? String(value) : '';
        this.entries = parseValue(this.value);
        this._renderControl();
        this._renderChips();
    }

    clear() {
        this.entries = [];
        this.value = '';
        this._renderControl();
        this._renderChips();
        this.onChange(this.value);
    }

    setInvalid(isInvalid) {
        this.control.classList.toggle('is-invalid', !!isInvalid);
    }

    destroy() {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this._close();
        if (this.menu.parentNode) this.menu.parentNode.removeChild(this.menu);
        if (this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }

    // ------------------------------------------------------------------
    // Menu open/close & positioning
    // ------------------------------------------------------------------

    toggle() {
        if (this.open) this._close();
        else this._open();
    }

    _open() {
        if (this.open || this.disabled) return;
        this.open = true;
        this.menu.hidden = false;
        this.root.classList.add('is-open');
        this.control.setAttribute('aria-expanded', 'true');
        this._positionMenu();
        document.addEventListener('pointerdown', this._onDocPointerDown, true);
        document.addEventListener('scroll', this._onScrollOrResize, true);
        window.addEventListener('resize', this._onScrollOrResize);
    }

    _close() {
        if (!this.open) return;
        this.open = false;
        this.menu.hidden = true;
        this.root.classList.remove('is-open');
        this.control.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this._onDocPointerDown, true);
        document.removeEventListener('scroll', this._onScrollOrResize, true);
        window.removeEventListener('resize', this._onScrollOrResize);
    }

    _positionMenu() {
        const rect = this.control.getBoundingClientRect();
        const gap = 4;
        const menuWidth = Math.max(rect.width, 260);
        const menuHeight = Math.min(this.menu.scrollHeight || 0, 320);
        const spaceBelow = window.innerHeight - rect.bottom;

        this.menu.style.width = `${menuWidth}px`;
        this.menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))}px`;

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
        this._close();
    }

    // ------------------------------------------------------------------
    // Selection
    // ------------------------------------------------------------------

    _onMenuClick(e) {
        const chip = e.target.closest('[data-time-label]');
        if (!chip) return;
        const label = chip.getAttribute('data-time-label');
        const existing = this.entries.find(entry => entry.label === label);
        if (existing) {
            this.entries = this.entries.filter(entry => entry.label !== label);
        } else {
            const parsed = parseTimeToken(label);
            this.entries.push({
                label,
                sort: parsed ? toSortValue(parsed) : null,
                custom: !parsed
            });
            this.entries.sort((a, b) => {
                if (a.sort === null && b.sort === null) return 0;
                if (a.sort === null) return 1;
                if (b.sort === null) return -1;
                return a.sort - b.sort;
            });
        }
        this._commit();
    }

    _addCustomTime() {
        const parsed = fromTimeInput(this.customInput.value);
        if (!parsed) return;
        if (!this.entries.some(entry => entry.label === parsed.label)) {
            this.entries.push({ label: parsed.label, sort: parsed.sort, custom: false });
            this.entries.sort((a, b) => {
                if (a.sort === null && b.sort === null) return 0;
                if (a.sort === null) return 1;
                if (b.sort === null) return -1;
                return a.sort - b.sort;
            });
        }
        this.customInput.value = '';
        this._commit();
    }

    _clear() {
        this.entries = [];
        this._commit();
    }

    _commit() {
        this.value = serialize(this.entries);
        this._renderControl();
        this._renderChips();
        this.onChange(this.value);
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    _renderControl() {
        if (this.value) {
            this.valueEl.textContent = this.value;
            this.valueEl.classList.remove('is-placeholder');
            this.control.classList.add('has-value');
        } else {
            this.valueEl.textContent = this.placeholder;
            this.valueEl.classList.add('is-placeholder');
            this.control.classList.remove('has-value');
        }
    }

    _renderChips() {
        const selectedLabels = new Set(this.entries.map(entry => entry.label));

        this.commonChips.innerHTML = COMMON_TIMES.map(label =>
            `<button type="button" class="time-chip ${selectedLabels.has(label) ? 'is-selected' : ''}" data-time-label="${label}">${label}</button>`
        ).join('');

        const customEntries = this.entries.filter(entry => !COMMON_TIMES.includes(entry.label));
        this.selectedLabel.hidden = customEntries.length === 0;
        this.selectedChips.innerHTML = customEntries.map(entry =>
            `<button type="button" class="time-chip is-selected" data-time-label="${entry.label}" title="Remove">${entry.label} &times;</button>`
        ).join('');
    }
}

export default TimePicker;
