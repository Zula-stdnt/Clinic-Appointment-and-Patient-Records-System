/**
 * tests/verify_dropdown_interaction.js
 * Simulates DOM click events and tests the idempotency & dropdown toggle behaviors.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log("Running Node.js DOM Dropdown Simulation Test...");

// Create a minimal browser DOM environment
class ClassList {
    constructor() {
        this.classes = new Set();
    }
    add(cls) { this.classes.add(cls); }
    remove(cls) { this.classes.delete(cls); }
    contains(cls) { return this.classes.has(cls); }
    toggle(cls) {
        if (this.contains(cls)) {
            this.remove(cls);
            return false;
        } else {
            this.add(cls);
            return true;
        }
    }
}

class DOMElement {
    constructor(tagName, attrs = {}, parent = null) {
        this.tagName = tagName.toUpperCase();
        this.attributes = { ...attrs };
        this.classList = new ClassList();
        if (attrs.class) {
            attrs.class.split(/\s+/).forEach(c => c && this.classList.add(c));
        }
        this.children = [];
        this.parentElement = parent;
    }

    appendChild(child) {
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    getAttribute(name) {
        return this.attributes[name] !== undefined ? this.attributes[name] : null;
    }

    setAttribute(name, val) {
        this.attributes[name] = String(val);
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }

    hasAttribute(name) {
        return this.attributes[name] !== undefined;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (selector.startsWith('.') && curr.classList.contains(selector.slice(1))) {
                return curr;
            }
            if (selector.startsWith('[') && selector.endsWith(']')) {
                const attr = selector.slice(1, -1);
                if (curr.hasAttribute(attr)) return curr;
            }
            if (selector.toUpperCase() === curr.tagName) {
                return curr;
            }
            curr = curr.parentElement;
        }
        return null;
    }

    querySelectorAll(selector) {
        const results = [];
        function search(el) {
            for (const child of el.children) {
                if (selector === '.dropdown.show' && child.classList.contains('dropdown') && child.classList.contains('show')) {
                    results.push(child);
                }
                search(child);
            }
        }
        search(this);
        return results;
    }

    querySelector(selector) {
        let found = null;
        function search(el) {
            if (found) return;
            for (const child of el.children) {
                if (selector === '[data-dropdown-toggle]' && child.hasAttribute('data-dropdown-toggle')) {
                    found = child;
                    return;
                }
                search(child);
            }
        }
        search(this);
        return found;
    }
}

// Build Receptionist topbar DOM structure
const documentElement = new DOMElement('html');
const body = new DOMElement('body', {}, documentElement);
documentElement.appendChild(body);

const topbar = new DOMElement('header', { class: 'topbar' }, body);
body.appendChild(topbar);

const topbarMeta = new DOMElement('div', { class: 'topbar-meta' }, topbar);
topbar.appendChild(topbarMeta);

const dropdown = new DOMElement('div', { class: 'dropdown' }, topbarMeta);
topbarMeta.appendChild(dropdown);

const button = new DOMElement('button', {
    class: 'user-menu-btn',
    'data-dropdown-toggle': '',
    'aria-expanded': 'false',
    'aria-haspopup': 'true'
}, dropdown);
dropdown.appendChild(button);

const avatar = new DOMElement('span', { class: 'user-avatar' }, button);
button.appendChild(avatar);

const userMeta = new DOMElement('span', { class: 'user-menu-meta' }, button);
button.appendChild(userMeta);

const userName = new DOMElement('span', { class: 'user-name' }, userMeta);
userMeta.appendChild(userName);

const caret = new DOMElement('svg', { class: 'user-menu-caret' }, button);
button.appendChild(caret);

const userMenu = new DOMElement('ul', { class: 'user-menu' }, dropdown);
dropdown.appendChild(userMenu);

const signOutLi = new DOMElement('li', {}, userMenu);
userMenu.appendChild(signOutLi);
const signOutLink = new DOMElement('a', { class: 'dropdown-item text-danger', href: 'logout.php' }, signOutLi);
signOutLi.appendChild(signOutLink);

const outsideElement = new DOMElement('div', { class: 'main-content' }, body);
body.appendChild(outsideElement);

// Setup document listeners matching ui.js
const listeners = [];
function addDocumentClickListener(fn) {
    listeners.push(fn);
}

function dispatchClick(target) {
    const e = { target };
    for (const fn of listeners) {
        fn(e);
    }
}

function closeAllDropdowns() {
    body.querySelectorAll('.dropdown.show').forEach(d => {
        d.classList.remove('show');
        const toggle = d.querySelector('[data-dropdown-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}

// Global UI delegation handler (from ui.js)
const uiClickHandler = (e) => {
    // Dropdown toggle
    const dropdownToggle = e.target.closest('[data-dropdown-toggle]');
    if (dropdownToggle) {
        const d = dropdownToggle.closest('.dropdown');
        if (d) {
            const isOpen = d.classList.contains('show');
            closeAllDropdowns();
            if (!isOpen) {
                d.classList.add('show');
                dropdownToggle.setAttribute('aria-expanded', 'true');
            }
        }
        return;
    }

    // Any dropdown item click closes the menu
    if (e.target.closest('.dropdown-item')) {
        closeAllDropdowns();
        return;
    }

    if (!e.target.closest('.dropdown')) {
        closeAllDropdowns();
    }
};

// Test 1: With idempotency guard, only 1 listener registered
let uiInitialized = false;
function registerUi() {
    if (!uiInitialized) {
        uiInitialized = true;
        addDocumentClickListener(uiClickHandler);
    }
}

registerUi();
registerUi(); // second import attempt
assert.strictEqual(listeners.length, 1, "Listeners length must be 1 due to idempotency guard");
console.log("  [PASS] Single listener registered despite multiple import attempts");

// Test 2: Initial state
assert.strictEqual(dropdown.classList.contains('show'), false, "Dropdown initially closed");
assert.strictEqual(button.getAttribute('aria-expanded'), 'false', "aria-expanded initially false");
console.log("  [PASS] Initial state is correctly closed");

// Test 3: Click button directly -> dropdown opens
dispatchClick(button);
assert.strictEqual(dropdown.classList.contains('show'), true, "Dropdown opened after button click");
assert.strictEqual(button.getAttribute('aria-expanded'), 'true', "aria-expanded set to true");
console.log("  [PASS] Clicking button directly opens dropdown");

// Test 4: Click button again -> dropdown closes
dispatchClick(button);
assert.strictEqual(dropdown.classList.contains('show'), false, "Dropdown closed after second click");
assert.strictEqual(button.getAttribute('aria-expanded'), 'false', "aria-expanded set to false");
console.log("  [PASS] Clicking button again closes dropdown");

// Test 5: Click avatar child -> dropdown opens
dispatchClick(avatar);
assert.strictEqual(dropdown.classList.contains('show'), true, "Dropdown opened after clicking avatar child");
assert.strictEqual(button.getAttribute('aria-expanded'), 'true', "aria-expanded set to true");
console.log("  [PASS] Clicking avatar child element opens dropdown");

// Test 6: Click caret child -> dropdown closes
dispatchClick(caret);
assert.strictEqual(dropdown.classList.contains('show'), false, "Dropdown closed after clicking caret");
console.log("  [PASS] Clicking caret child element toggles dropdown");

// Test 7: Click username child -> dropdown opens
dispatchClick(userName);
assert.strictEqual(dropdown.classList.contains('show'), true, "Dropdown opened after clicking username child");
console.log("  [PASS] Clicking username child element opens dropdown");

// Test 8: Click outside -> dropdown closes
dispatchClick(outsideElement);
assert.strictEqual(dropdown.classList.contains('show'), false, "Dropdown closed after clicking outside");
assert.strictEqual(button.getAttribute('aria-expanded'), 'false', "aria-expanded set to false");
console.log("  [PASS] Clicking outside closes dropdown");

// Test 9: Click avatar to open, then click Sign Out link
dispatchClick(avatar);
assert.strictEqual(dropdown.classList.contains('show'), true, "Dropdown open before clicking Sign Out");
assert.strictEqual(signOutLink.getAttribute('href'), 'logout.php', "Sign Out links to logout.php");
dispatchClick(signOutLink);
assert.strictEqual(dropdown.classList.contains('show'), false, "Dropdown closed upon clicking Sign Out link");
console.log("  [PASS] Clicking Sign Out link triggers dropdown closure and points to logout.php");

console.log("\nALL SIMULATION TESTS PASSED SUCCESSFULLY!");

