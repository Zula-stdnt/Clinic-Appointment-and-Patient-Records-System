// assets/js/ui.js
// UI Utilities: Modals with focus trapping, Non-blocking Toasts, XSS escaping, and Confirmations
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

// Toast Notification System
export function showToast(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div style="flex: 1;">
            <strong>${type === 'success' ? 'Success' : (type === 'danger' ? 'Error' : 'Notice')}</strong>
            <p style="margin: 0.2rem 0 0 0;">${escapeHtml(message)}</p>
        </div>
        <button type="button" class="btn-close" style="font-size: 1.1rem; line-height: 1;">&times;</button>
    `;

    const closeBtn = toast.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    container.appendChild(toast);

    // Trigger CSS slide-in
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const timer = setTimeout(() => {
        removeToast(toast);
    }, duration);

    function removeToast(el) {
        clearTimeout(timer);
        el.classList.remove('show');
        el.addEventListener('transitionend', () => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        }, { once: true });
    }
}

// Global active modal and focus tracking for accessibility
let activeModal = null;
let previousActiveElement = null;

export function openModal(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (!modal) return;

    previousActiveElement = document.activeElement;
    modal.classList.add('active');
    activeModal = modal;

    // Focus the first focusable element inside the modal
    const focusableElements = getFocusableElements(modal);
    if (focusableElements.length > 0) {
        focusableElements[0].focus();
    }

    // Attach trap focus listener
    modal.addEventListener('keydown', handleModalKeydown);
}

export function closeModal(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (!modal) return;

    modal.classList.remove('active');
    modal.removeEventListener('keydown', handleModalKeydown);

    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
    }
    activeModal = null;
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

// Confirmation Modals: Soft Delete (Archive), Restore, and Hard Delete
export function confirmSoftDelete({ title, message, itemName, btnText = 'Archive Record', btnClass = 'btn btn-warning', onConfirm }) {
    const modal = document.getElementById('global-confirm-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const confirmBtn = modal.querySelector('#global-confirm-btn');

    modalTitle.textContent = title || 'Confirm Archive';
    modalBody.innerHTML = `
        <div class="alert alert-warning" style="margin-bottom: 1rem;">
            <strong>Warning:</strong> Archiving this record will mark it as inactive and move it to Manage Archive.
        </div>
        <p>${escapeHtml(message || `Are you sure you want to archive "${itemName}"?`)}</p>
    `;

    confirmBtn.className = btnClass;
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

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
        <div class="alert alert-info" style="margin-bottom: 1rem;">
            <strong>Notice:</strong> Restoring this record will return it to active status and make it available across standard transactions and lists.
        </div>
        <p>${escapeHtml(message || `Are you sure you want to restore "${itemName}"?`)}</p>
    `;

    confirmBtn.className = 'btn btn-success';
    confirmBtn.textContent = btnText;
    confirmBtn.disabled = false;

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
        <div class="alert alert-danger" style="margin-bottom: 1rem;">
            <strong>Danger:</strong> This action cannot be undone! The record will be permanently purged from the database.
        </div>
        <p style="margin-bottom: 1rem;">${escapeHtml(message || `You are about to permanently delete "${itemName}".`)}</p>
        <div class="form-group" style="margin-bottom: 0;">
            <label for="hard-delete-input">To confirm, type <strong style="color: var(--danger); font-family: monospace;">${escapeHtml(typeToConfirmText)}</strong> below:</label>
            <input type="text" id="hard-delete-input" class="form-control" autocomplete="off" placeholder="${escapeHtml(typeToConfirmText)}">
        </div>
    `;

    confirmBtn.className = 'btn btn-danger';
    confirmBtn.textContent = 'Permanently Delete';
    confirmBtn.disabled = true;

    const input = modalBody.querySelector('#hard-delete-input');
    input.addEventListener('input', () => {
        confirmBtn.disabled = (input.value.trim() !== typeToConfirmText);
    });

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

    openModal(modal);
    // Focus input after modal opens
    setTimeout(() => input.focus(), 50);
}

// Global event delegation for modal backdrops and close buttons
document.addEventListener('click', (e) => {
    // 1. Check if clicked directly on a modal backdrop
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
        closeModal(e.target);
        return;
    }

    // 2. Check if clicked on or inside a close/cancel button
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
        // Find the parent modal
        const modal = closeBtn.closest('.modal-backdrop');
        if (modal) {
            closeModal(modal);
        } else if (activeModal) {
            // Fallback just in case
            closeModal(activeModal);
        }
    }
});

