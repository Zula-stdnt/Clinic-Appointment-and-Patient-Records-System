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

export const APPOINTMENT_STATUS_MAP = {
    scheduled: 'Scheduled',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show'
};

export const formatStatusLabel = (status) => {
    if (!status) return '';
    const s = String(status).trim().toLowerCase();
    if (APPOINTMENT_STATUS_MAP[s]) {
        return APPOINTMENT_STATUS_MAP[s];
    }
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

// Secure HTML escaping to prevent Cross-Site Scripting (XSS)
export const escapeHtml = (str) => {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

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

export const showToast = (message, type = 'success', duration = 4000) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.classList.add('toast-container');
        document.body.appendChild(container);
    }

    const meta = TOAST_TONES[type] || TOAST_TONES.info;

    const toastEl = document.createElement('div');
    toastEl.classList.add('toast', `toast-${meta.tone}`);
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
};

const removeToast = (el) => {
    if (!el || el._removing) return;
    el._removing = true;
    clearTimeout(el._removeTimer);
    el.classList.remove('show');
    setTimeout(() => {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }, 300);
};

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

let activeModal = null;
let previousActiveElement = null;

const resolveModal = (modalId) => typeof modalId === 'string' ? document.getElementById(modalId) : modalId;

const NON_DIRTY_MODAL_IDS = new Set([
    'global-confirm-modal',
    'shared-confirm-modal',
    'blank-modal',
    'after-visit-modal',
    'print-prompt-modal'
]);

const isTrackableFormModal = (modal) => {
    if (!modal || !modal.id) return false;
    if (NON_DIRTY_MODAL_IDS.has(modal.id) || modal.id.endsWith('-view-modal')) return false;
    return Boolean(modal.querySelector('form, input, select, textarea'));
};

const attachDirtyTracker = (modal) => {
    if (!isTrackableFormModal(modal)) return;
    modal._isDirty = false;
    if (modal._dirtyTrackerAttached) return;
    modal._dirtyTrackerAttached = true;

    const markDirty = (e) => {
        if (!modal.classList.contains('show')) return;
        const target = e.target;
        if (target && (target.matches('input, select, textarea') || target.closest('form'))) {
            modal._isDirty = true;
        }
    };

    modal.addEventListener('input', markDirty);
    modal.addEventListener('change', markDirty);

    modal.querySelectorAll('form').forEach(form => {
        form.addEventListener('reset', () => {
            modal._isDirty = false;
        });
    });
};

export const markModalClean = (modalId) => {
    const modal = resolveModal(modalId);
    if (modal) {
        modal._isDirty = false;
    }
};

export const ensureGlobalConfirmModal = () => {
    let modal = document.getElementById('global-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'global-confirm-modal';
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'global-confirm-title');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title" id="global-confirm-title">Confirm Action</h3>
                        <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
                        <button type="button" id="global-confirm-btn" class="btn btn-danger">Confirm</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    return modal;
};

export const openModal = (modalId) => {
    const modal = resolveModal(modalId);
    if (!modal || modal.classList.contains('show')) return;

    if (activeModal && activeModal !== modal && activeModal.classList.contains('show')) {
        modal._previousModal = activeModal;
        modal._previousActiveElement = document.activeElement;
    } else {
        modal._previousModal = null;
        modal._previousActiveElement = document.activeElement;
        previousActiveElement = document.activeElement;
    }

    attachDirtyTracker(modal);

    modal.classList.add('show');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    activeModal = modal;
    window.__cprms_active_modal = modal;

    // Wait for the visibility change to apply before moving focus inside
    requestAnimationFrame(() => {
        const focusable = getFocusableElements(modal);
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    });

    modal.addEventListener('keydown', handleModalKeydown);
};

export const closeModal = (modalId, force = false) => {
    const modal = resolveModal(modalId) || window.__cprms_active_modal || activeModal || document.querySelector('.modal.show');
    if (!modal) return;

    if (!force) {
        const event = new CustomEvent('beforeModalClose', { cancelable: true });
        modal.dispatchEvent(event);
        if (event.defaultPrevented) return;

        if (modal._isDirty && !NON_DIRTY_MODAL_IDS.has(modal.id)) {
            confirmAction({
                title: 'Discard Changes?',
                message: 'You have unsaved changes. Are you sure you want to discard them?',
                btnText: 'Discard',
                btnClass: 'btn btn-danger',
                cancelBtnText: 'Keep Editing',
                onConfirm: () => {
                    modal._isDirty = false;
                    closeModal(modal, true);
                }
            });
            return;
        }
    }

    modal._isDirty = false;
    modal.classList.remove('show');
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modal.removeEventListener('keydown', handleModalKeydown);

    const prevModal = (modal._previousModal && modal._previousModal.classList.contains('show'))
        ? modal._previousModal
        : document.querySelector('.modal.show');
    const prevFocus = modal._previousActiveElement || previousActiveElement;

    modal._previousModal = null;
    modal._previousActiveElement = null;

    if (prevModal) {
        activeModal = prevModal;
        window.__cprms_active_modal = prevModal;
    } else {
        if (activeModal === modal) {
            activeModal = null;
        }
        if (window.__cprms_active_modal === modal) {
            window.__cprms_active_modal = null;
        }
        document.body.classList.remove('modal-open');
    }

    if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus();
    }
    if (!prevModal) {
        previousActiveElement = null;
    }
};

// Close every open modal. Safe to call before re-rendering a module view.
export const hideAllModals = () => {
    document.querySelectorAll('.modal.show').forEach(modal => closeModal(modal, true));
    document.body.classList.remove('modal-open');
};

const getFocusableElements = (container) => Array.from(container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
)).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

const handleModalKeydown = (e) => {
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
};

// Helper to set button class list safely via classList API
export const setButtonClassList = (btn, classStr) => {
    if (!btn) return;
    Array.from(btn.classList).forEach(cls => {
        if (cls !== 'btn') btn.classList.remove(cls);
    });
    btn.classList.add('btn');
    (classStr || '').split(/\s+/).forEach(cls => {
        if (cls) btn.classList.add(cls);
    });
};

// ---------------------------------------------------------------------------
// Course-Standard Reusable Blank Modal Pattern (mysql_retrieve_specific_record.md)
// ---------------------------------------------------------------------------

export const openBlankModal = ({ title, bodyHtml, footerButtons = [] }) => {
    let modal = document.getElementById('blank-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'blank-modal';
        modal.classList.add('modal');
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title" id="blank-modal-title"></h3>
                        <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="blank-modal-body"></div>
                    <div class="modal-footer" id="blank-modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const titleEl = modal.querySelector('#blank-modal-title');
    const bodyEl = modal.querySelector('#blank-modal-body');
    const footerEl = modal.querySelector('#blank-modal-footer');

    if (titleEl) titleEl.textContent = title || '';
    if (bodyEl) bodyEl.innerHTML = bodyHtml || '';

    if (footerEl && Array.isArray(footerButtons) && footerButtons.length > 0) {
        footerEl.innerHTML = '';
        footerButtons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.type = btnConfig.type || 'button';
            setButtonClassList(btn, btnConfig.btnClass || 'btn-secondary');
            btn.textContent = btnConfig.text || 'Button';
            if (btnConfig.dismiss) {
                btn.setAttribute('data-dismiss', 'modal');
            }
            if (typeof btnConfig.onClick === 'function') {
                btn.addEventListener('click', (e) => btnConfig.onClick(e, modal));
            }
            footerEl.appendChild(btn);
        });
    } else if (footerEl) {
        footerEl.innerHTML = '<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>';
    }

    openModal(modal);
    return modal;
};

// ---------------------------------------------------------------------------
// Confirmation Dialogs: Action, Soft Delete (Archive), Restore, and Hard Delete
// ---------------------------------------------------------------------------

const bindConfirmAction = (modal, confirmBtn, onConfirm) => {
    const cleanClone = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(cleanClone, confirmBtn);

    cleanClone.addEventListener('click', async () => {
        cleanClone.disabled = true;
        closeModal(modal, true);
        try {
            if (typeof onConfirm === 'function') {
                await onConfirm();
            }
        } catch (err) {
            cleanClone.disabled = false;
        }
    });

    return cleanClone;
};

export const confirmAction = ({ title, message, btnText = 'Confirm', btnClass = 'btn btn-primary', cancelBtnText = 'Cancel', cancelBtnClass = 'btn btn-secondary', onConfirm }) => {
    const modal = ensureGlobalConfirmModal();
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');
    const cancelBtn = modal.querySelector('.modal-footer [data-dismiss="modal"]');

    modalTitle.textContent = title || 'Confirm Action';
    modalBody.innerHTML = `<p class="mb-0" style="white-space: pre-line;">${escapeHtml(message)}</p>`;

    setButtonClassList(confirmBtn, btnClass);
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

    if (cancelBtn) {
        let resolvedCancelText = cancelBtnText;
        if (resolvedCancelText === 'Cancel' && (/^cancel/i.test(btnText.trim()) || btnText.trim().toLowerCase() === 'cancel')) {
            resolvedCancelText = 'Close';
        }
        cancelBtn.textContent = resolvedCancelText || 'Cancel';
        setButtonClassList(cancelBtn, cancelBtnClass || 'btn btn-secondary');
    }

    bindConfirmAction(modal, confirmBtn, onConfirm);
    openModal(modal);
};

export const confirmSoftDelete = ({ title, message, itemName, btnText = 'Archive Record', btnClass = 'btn btn-warning', cancelBtnText = 'Cancel', onConfirm }) => {
    const modal = ensureGlobalConfirmModal();
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');
    const cancelBtn = modal.querySelector('.modal-footer [data-dismiss="modal"]');

    modalTitle.textContent = title || 'Confirm Archive';
    modalBody.innerHTML = `
        <div class="alert alert-warning mb-3">
            <strong>Warning:</strong> Archiving this record will mark it as inactive and move it to Manage Archive.
        </div>
        <p class="mb-0">${escapeHtml(message || `Are you sure you want to archive "${itemName}"?`)}</p>
    `;

    setButtonClassList(confirmBtn, btnClass);
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

    if (cancelBtn) {
        cancelBtn.textContent = cancelBtnText || 'Cancel';
        setButtonClassList(cancelBtn, 'btn btn-secondary');
    }

    bindConfirmAction(modal, confirmBtn, onConfirm);
    openModal(modal);
};

export const confirmRestore = ({ title = 'Restore Record', message, itemName, btnText = 'Restore', cancelBtnText = 'Cancel', onConfirm }) => {
    const modal = ensureGlobalConfirmModal();
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');
    const cancelBtn = modal.querySelector('.modal-footer [data-dismiss="modal"]');

    modalTitle.textContent = title || 'Restore Record';
    modalBody.innerHTML = `
        <div class="alert alert-info mb-3">
            <strong>Notice:</strong> Restoring this record will return it to active status and make it available across standard transactions and lists.
        </div>
        <p class="mb-0">${escapeHtml(message || `Are you sure you want to restore "${itemName}"?`)}</p>
    `;

    setButtonClassList(confirmBtn, 'btn btn-success');
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

    if (cancelBtn) {
        cancelBtn.textContent = cancelBtnText || 'Cancel';
        setButtonClassList(cancelBtn, 'btn btn-secondary');
    }

    bindConfirmAction(modal, confirmBtn, onConfirm);
    openModal(modal);
};

export const confirmHardDelete = ({ title, message, itemName, typeToConfirmText = 'DELETE', cancelBtnText = 'Cancel', onConfirm }) => {
    const modal = ensureGlobalConfirmModal();
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');
    const cancelBtn = modal.querySelector('.modal-footer [data-dismiss="modal"]');

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

    setButtonClassList(confirmBtn, 'btn btn-danger');
    confirmBtn.textContent = 'Permanently Delete';
    confirmBtn.disabled = true;

    if (cancelBtn) {
        cancelBtn.textContent = cancelBtnText || 'Cancel';
        setButtonClassList(cancelBtn, 'btn btn-secondary');
    }

    const cleanClone = bindConfirmAction(modal, confirmBtn, onConfirm);

    const input = modalBody.querySelector('#hard-delete-input');
    input.addEventListener('input', () => {
        cleanClone.disabled = (input.value.trim() !== typeToConfirmText);
    });

    openModal(modal);
    setTimeout(() => input.focus(), 50);
};

// ---------------------------------------------------------------------------
// Dropdown menus (top-bar account menu)
// ---------------------------------------------------------------------------

export const closeAllDropdowns = () => {
    document.querySelectorAll('.dropdown.show').forEach(dropdown => {
        dropdown.classList.remove('show');
        const toggle = dropdown.querySelector('[data-dropdown-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
};

// ---------------------------------------------------------------------------
// Off-canvas and Collapsible sidebar
// ---------------------------------------------------------------------------

export const closeSidebar = () => {
    if (document.body.classList.contains('sidebar-open')) {
        document.body.classList.remove('sidebar-open');
        const toggle = document.querySelector('[data-sidebar-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
};

export const toggleSidebar = () => {
    if (window.matchMedia('(min-width: 992px)').matches) {
        // Desktop: toggle collapsed state
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('cprms_sidebar_collapsed', isCollapsed ? '1' : '0');
        const toggle = document.querySelector('[data-sidebar-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    } else {
        // Mobile: toggle off-canvas
        const isOpen = document.body.classList.toggle('sidebar-open');
        const toggle = document.querySelector('[data-sidebar-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
};

const initSidebarState = () => {
    if (window.matchMedia('(min-width: 992px)').matches) {
        if (localStorage.getItem('cprms_sidebar_collapsed') === '1') {
            document.body.classList.add('sidebar-collapsed');
        }
    }
};

// ---------------------------------------------------------------------------
// Global event delegation (Idempotent: attached once per window lifetime)
// ---------------------------------------------------------------------------

if (!window.__cprms_ui_events_initialized) {
    window.__cprms_ui_events_initialized = true;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebarState);
    } else {
        initSidebarState();
    }

    document.addEventListener('click', (e) => {
        // Toasts
        const toastClose = e.target.closest('[data-dismiss="toast"]');
        if (toastClose) {
            removeToast(toastClose.closest('.toast'));
            return;
        }

        // Modals: explicit close buttons and backdrop clicks
        const modalDismiss = e.target.closest('[data-dismiss="modal"], [data-close-modal]');
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
            if (dropdown) {
                const isOpen = dropdown.classList.contains('show');
                closeAllDropdowns();
                if (!isOpen) {
                    dropdown.classList.add('show');
                    dropdownToggle.setAttribute('aria-expanded', 'true');
                }
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
            const currentModal = window.__cprms_active_modal || activeModal || document.querySelector('.modal.show');
            if (currentModal) {
                closeModal(currentModal);
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
}
