// assets/js/ui.js
// UI engine for the Hospital Patient Information System front end: custom modals with focus
// trapping, non-blocking toasts, the top-bar dropdown menu, and the
// off-canvas sidebar. No third-party framework required.
// ITE 387 Lessons applied: 01 JavaScript Foundations/javascript_modules (DOM helper aliases create/gId), 02 DOM and UI/dom_apply_styles (classList API), and 03 APIs and Database Operations/header_detail_forms (Intl.NumberFormat PHP currency helper)

// Reusable DOM & formatting helpers (javascript_modules.md / header_detail_forms.md)
export const create = (tagName) => document.createElement(tagName);
export const gId = (id) => document.getElementById(id);
export const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
}).format(Number(amount) || 0);

// Secure HTML escaping to prevent Cross-Site Scripting (XSS)
export function escapeHtml(str) {
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

// ---------------------------------------------------------------------------
// Inline SVG icons (stroke-based, 24x24 viewBox)
// ---------------------------------------------------------------------------

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const ICONS = {
    check: `<svg ${SVG_ATTRS}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg ${SVG_ATTRS}><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg ${SVG_ATTRS}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
};

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

const TOAST_TONES = {
    success: { tone: 'success', title: 'Success', icon: ICONS.check },
    danger: { tone: 'danger', title: 'Error', icon: ICONS.error },
    error: { tone: 'danger', title: 'Error', icon: ICONS.error },
    warning: { tone: 'warning', title: 'Notice', icon: ICONS.warning },
    info: { tone: 'info', title: 'Notice', icon: ICONS.info }
};

export function showToast(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const meta = TOAST_TONES[type] || TOAST_TONES.info;

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${meta.tone}`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `
        <div class="toast-header">
            <span class="toast-icon">${meta.icon}</span>
            <strong>${meta.title}</strong>
            <button type="button" class="btn-close" data-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">${escapeHtml(message)}</div>
    `;

    container.appendChild(toastEl);

    requestAnimationFrame(() => {
        toastEl.classList.add('show');
    });

    const timer = setTimeout(() => removeToast(toastEl), duration);
    toastEl._removeTimer = timer;
}

function removeToast(el) {
    if (!el || el._removing) return;
    el._removing = true;
    clearTimeout(el._removeTimer);
    el.classList.remove('show');
    setTimeout(() => {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }, 300);
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

let activeModal = null;
let previousActiveElement = null;

function resolveModal(modalId) {
    return typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
}

export function openModal(modalId) {
    const modal = resolveModal(modalId);
    if (!modal || modal.classList.contains('show')) return;

    previousActiveElement = document.activeElement;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    activeModal = modal;

    // Wait for the visibility change to apply before moving focus inside
    requestAnimationFrame(() => {
        const focusable = getFocusableElements(modal);
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    });

    modal.addEventListener('keydown', handleModalKeydown);
}

export function closeModal(modalId, force = false) {
    const modal = resolveModal(modalId) || activeModal;
    if (!modal) return;

    if (!force) {
        const event = new CustomEvent('beforeModalClose', { cancelable: true });
        modal.dispatchEvent(event);
        if (event.defaultPrevented) return;
    }

    modal.classList.remove('show');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeEventListener('keydown', handleModalKeydown);

    if (activeModal === modal) {
        activeModal = null;
    }

    if (!document.querySelector('.modal.show')) {
        document.body.classList.remove('modal-open');
    }

    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
    }
    previousActiveElement = null;
}

// Close every open modal. Safe to call before re-rendering a module view.
export function hideAllModals() {
    document.querySelectorAll('.modal.show').forEach(modal => closeModal(modal));
    document.body.classList.remove('modal-open');
}

function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

function handleModalKeydown(e) {
    if (!activeModal) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(activeModal);
        return;
    }

    if (e.key === 'Tab') {
        const focusable = getFocusableElements(activeModal);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Confirmation Dialogs: Action, Soft Delete (Archive), Restore, and Hard Delete
// ---------------------------------------------------------------------------

function bindConfirmAction(modal, confirmBtn, onConfirm) {
    const cleanClone = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(cleanClone, confirmBtn);

    cleanClone.addEventListener('click', async () => {
        cleanClone.disabled = true;
        try {
            await onConfirm();
            closeModal(modal);
        } catch (err) {
            cleanClone.disabled = false;
        }
    });

    return cleanClone;
}

export function confirmAction({ title, message, btnText = 'Confirm', btnClass = 'btn btn-primary', onConfirm }) {
    const modal = document.getElementById('global-confirm-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');

    modalTitle.textContent = title || 'Confirm Action';
    modalBody.innerHTML = `<p>${escapeHtml(message)}</p>`;

    confirmBtn.className = btnClass;
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

    bindConfirmAction(modal, confirmBtn, onConfirm);
    openModal(modal);
}

export function confirmSoftDelete({ title, message, itemName, btnText = 'Archive Record', btnClass = 'btn btn-warning', onConfirm }) {
    const modal = document.getElementById('global-confirm-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');

    modalTitle.textContent = title || 'Confirm Archive';
    modalBody.innerHTML = `
        <div class="alert alert-warning mb-3">
            <strong>Warning:</strong> Archiving this record will mark it as inactive and move it to Manage Archive.
        </div>
        <p class="mb-0">${escapeHtml(message || `Are you sure you want to archive "${itemName}"?`)}</p>
    `;

    confirmBtn.className = btnClass;
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

    bindConfirmAction(modal, confirmBtn, onConfirm);
    openModal(modal);
}

export function confirmRestore({ title = 'Restore Record', message, itemName, btnText = 'Restore', onConfirm }) {
    const modal = document.getElementById('global-confirm-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');

    modalTitle.textContent = title || 'Restore Record';
    modalBody.innerHTML = `
        <div class="alert alert-info mb-3">
            <strong>Notice:</strong> Restoring this record will return it to active status and make it available across standard transactions and lists.
        </div>
        <p class="mb-0">${escapeHtml(message || `Are you sure you want to restore "${itemName}"?`)}</p>
    `;

    confirmBtn.className = 'btn btn-success';
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

    bindConfirmAction(modal, confirmBtn, onConfirm);
    openModal(modal);
}

export function confirmHardDelete({ title, message, itemName, typeToConfirmText = 'DELETE', onConfirm }) {
    const modal = document.getElementById('global-confirm-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');

    modalTitle.textContent = title || 'Confirm Permanent Delete (Hard Delete)';
    modalBody.innerHTML = `
        <div class="alert alert-danger mb-3">
            <strong>Danger:</strong> This action cannot be undone! The record will be permanently purged from the database.
        </div>
        <p class="mb-3">${escapeHtml(message || `You are about to permanently delete "${itemName}".`)}</p>
        <div class="form-group mb-0">
            <label for="hard-delete-input">To confirm, type <strong class="text-danger font-monospace">${escapeHtml(typeToConfirmText)}</strong> below:</label>
            <input type="text" id="hard-delete-input" class="form-control" autocomplete="off" placeholder="${escapeHtml(typeToConfirmText)}">
        </div>
    `;

    confirmBtn.className = 'btn btn-danger';
    confirmBtn.textContent = 'Permanently Delete';
    confirmBtn.disabled = true;

    const cleanClone = bindConfirmAction(modal, confirmBtn, onConfirm);

    const input = modalBody.querySelector('#hard-delete-input');
    input.addEventListener('input', () => {
        cleanClone.disabled = (input.value.trim() !== typeToConfirmText);
    });

    openModal(modal);
    setTimeout(() => input.focus(), 50);
}

// ---------------------------------------------------------------------------
// Dropdown menus (top-bar account menu)
// ---------------------------------------------------------------------------

export function closeAllDropdowns() {
    document.querySelectorAll('.dropdown.show').forEach(dropdown => {
        dropdown.classList.remove('show');
        const toggle = dropdown.querySelector('[data-dropdown-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}

// ---------------------------------------------------------------------------
// Off-canvas sidebar
// ---------------------------------------------------------------------------

export function closeSidebar() {
    if (!document.body.classList.contains('sidebar-open')) return;
    document.body.classList.remove('sidebar-open');
    const toggle = document.querySelector('[data-sidebar-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleSidebar() {
    const isOpen = document.body.classList.toggle('sidebar-open');
    const toggle = document.querySelector('[data-sidebar-toggle]');
    if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

// ---------------------------------------------------------------------------
// Global event delegation
// ---------------------------------------------------------------------------

document.addEventListener('click', (e) => {
    // Toasts
    const toastClose = e.target.closest('[data-dismiss="toast"]');
    if (toastClose) {
        removeToast(toastClose.closest('.toast'));
        return;
    }

    // Modals: explicit close buttons and backdrop clicks
    const modalDismiss = e.target.closest('[data-dismiss="modal"]');
    if (modalDismiss) {
        closeModal(modalDismiss.closest('.modal'));
        return;
    }
    if (e.target.classList && e.target.classList.contains('modal') && e.target.classList.contains('show')) {
        closeModal(e.target);
        return;
    }

    // Dropdown toggle
    const dropdownToggle = e.target.closest('[data-dropdown-toggle]');
    if (dropdownToggle) {
        const dropdown = dropdownToggle.closest('.dropdown');
        const isOpen = dropdown.classList.contains('show');
        closeAllDropdowns();
        if (!isOpen) {
            dropdown.classList.add('show');
            dropdownToggle.setAttribute('aria-expanded', 'true');
        }
        return;
    }

    // Any dropdown item click closes the menu (hash links still navigate)
    if (e.target.closest('.dropdown-item')) {
        closeAllDropdowns();
        return;
    }

    if (!e.target.closest('.dropdown')) {
        closeAllDropdowns();
    }

    // Off-canvas sidebar
    const sidebarToggle = e.target.closest('[data-sidebar-toggle]');
    if (sidebarToggle) {
        toggleSidebar();
        return;
    }
    if (e.target.closest('#sidebar-backdrop')) {
        closeSidebar();
        return;
    }
    if (e.target.closest('.sidebar-nav .nav-link')) {
        closeSidebar();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (activeModal) {
            closeModal(activeModal);
            return;
        }
        closeAllDropdowns();
        closeSidebar();
    }
});

window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 992px)').matches) {
        closeSidebar();
    }
});
