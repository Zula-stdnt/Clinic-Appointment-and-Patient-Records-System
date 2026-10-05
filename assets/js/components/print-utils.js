// assets/js/components/print-utils.js
// Shared helpers for the print-ready clinical documents.
// Renders a self-contained HTML document in a hidden iframe and triggers the
// browser's native print dialog (same approach as print-appointment-form.js).
// ITE 387 Lessons applied: 02 DOM and UI/dom_create_and_remove_elements
// (temporary iframe created, used, then removed)

export function openPrintFrame(html) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 1px; height: 1px; border: 0; opacity: 0; pointer-events: none; z-index: -1;';
    document.body.appendChild(frame);

    const frameDoc = frame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    let removed = false;
    const removeFrame = () => {
        if (removed) return;
        removed = true;
        if (frame.parentNode) {
            frame.parentNode.removeChild(frame);
        }
    };

    const triggerPrint = () => {
        try {
            frame.contentWindow.focus();
            frame.contentWindow.print();
        } finally {
            setTimeout(removeFrame, 1000);
        }
    };

    // Wait for the logo (and any other subresources) before printing
    const images = Array.from(frameDoc.images || []);
    Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
    }))).then(() => setTimeout(triggerPrint, 150));

    // Safety net so a stuck resource never leaves the iframe in the DOM
    setTimeout(removeFrame, 60000);
}

export function fullName(last, first, middle) {
    const mi = middle ? ` ${middle}.` : '';
    return `${last || ''}, ${first || ''}${mi}`.trim();
}

export function computeAge(dateOfBirth) {
    if (!dateOfBirth) return '';
    const dob = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return '';
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        age--;
    }
    return age >= 0 ? `${age} y/o` : '';
}

export function formatDate(value) {
    if (!value) return '—';
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatNow() {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function orDash(value) {
    return value === null || value === undefined || value === '' ? '—' : value;
}

export function capitalize(value) {
    if (!value) return 'Unknown';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}
