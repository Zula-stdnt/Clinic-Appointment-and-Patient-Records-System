// assets/js/components/confirm-dialog.js
// Reusable confirmation dialog for destructive or irreversible actions.
// Built on the shared modal styles and ui.js open/close helpers.
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements (dialog created
// on demand and reused) & dom_apply_styles (existing modal classes)

import { escapeHtml, openModal, closeModal, setButtonClassList } from '../ui.js?v=26';

let modalEl = null;

const ensureModal = () => {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.classList.add('modal');
    modalEl.id = 'shared-confirm-modal';
    modalEl.setAttribute('tabindex', '-1');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.setAttribute('aria-labelledby', 'shared-confirm-title');
    modalEl.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title" id="shared-confirm-title">Confirm Action</h3>
                    <button type="button" class="btn-close" data-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Keep Appointment</button>
                    <button type="button" id="shared-confirm-btn" class="btn btn-danger">Confirm</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalEl);

    modalEl.querySelectorAll('[data-dismiss="modal"]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(modalEl));
    });

    return modalEl;
};

export const confirmDialog = (options = {}) => {
    const modal = ensureModal();
    const title = options.title || 'Confirm Action';
    const message = options.message || 'Are you sure?';
    const confirmText = options.btnText || 'Confirm';
    const confirmClass = options.btnClass || 'btn btn-danger';
    let cancelText = options.cancelText || 'Go Back';
    if (cancelText === 'Cancel' && (/^cancel/i.test(confirmText.trim()) || confirmText.trim().toLowerCase() === 'cancel')) {
        cancelText = 'Close';
    }

    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-body').innerHTML = `<p class="mb-0">${escapeHtml(message)}</p>`;

    const cancelBtn = modal.querySelector('.modal-footer [data-dismiss="modal"]');
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const confirmBtn = modal.querySelector('#shared-confirm-btn');
    setButtonClassList(confirmBtn, confirmClass);
    confirmBtn.textContent = confirmText;
    confirmBtn.disabled = false;
    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        try {
            await options.onConfirm?.();
        } finally {
            confirmBtn.disabled = false;
            closeModal(modal);
        }
    };

    openModal(modal);
}
