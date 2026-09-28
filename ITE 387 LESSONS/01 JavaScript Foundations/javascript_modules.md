# JavaScript: Modules (ESM)

## Related Lessons

- [[01 JavaScript Foundations/javascript_fundamentals]]
- [[03 APIs and Database Operations/javascript_working_with_apis]]

## 1. Lesson Summary

### Main Idea

JavaScript Modules (ECMAScript Modules or ESM) provide a standardized way to organize code into separate, self-contained files. This prevents "spaghetti code"—monolithic, unmaintainable single files—by breaking logic down into smaller, reusable chunks.

Modules enforce **lexical scoping**, meaning variables and functions inside a module are not globally accessible by default. This prevents name collisions across your application.

### 1. Browser Configuration

To use modules in a browser environment, you must explicitly instruct the HTML file to treat the JavaScript file as a module using the `type="module"` attribute.

```html
<script type="module" src="index.js"></script>
```

### 2. Exporting and Importing

The core mechanism of modules relies on the `export` keyword to expose code, and the `import` keyword to pull that code into other files.

#### Named Exports

Used to export multiple specific functions, objects, or variables from a single file.

*   **Exporting:** Add the `export` keyword before the declaration.
*   **Importing:** Must use **curly braces `{}`** and the exact name used in the export.
*   **Pathing:** In vanilla JS browser environments, the file path must include the `.js` extension (e.g., `./utilities.js`).

```javascript
// utilities.js (Export)
export const getHeader = () => {
  return "JS MODULE";
};

// index.js (Import)
import { getHeader } from "./utilities.js";
```

#### Default Exports

Used to designate a single, primary value or function for the module. A file can only have **one** default export.

*   **Exporting:** Use `export default`.
*   **Importing:** Do **not** use curly braces. You can name the import **anything** you want in the receiving file.

```javascript
// utilities.js (Export)
const add = (x, y) => { return x + y; };
export default add;

// index.js (Import)
// You can name it 'add', 'mathAdd', or even 'anything'
import anything from "./utilities.js"; 
```

### 3. Combined Imports

A single module can contain both one default export and multiple named exports. You import them together by placing the default name outside the braces, followed by the named exports inside the braces.

```javascript
import add, { getHeader, gId } from "./utilities.js";
```

### 4. Inter-module Dependencies

Modules are highly composable. A module can import functionality from another module, not just the main `index.js` file. This creates a clean dependency tree (e.g., `creator.js` importing helper functions from `utilities.js`).

---

## 2. Coding Writing Style

The coding style focuses on architecture, preventing code bloat, and aggressive abstraction through encapsulation.

### Architecture and Encapsulation
Never write all application logic in one file. Separate logic into specific modules based on their domain to prevent name collisions and ensure self-contained functionality:
*   `index.js`: Main entry point, handles global event listeners (`DOMContentLoaded`) and ties modules together.
*   `utilities.js`: Reusable helper functions (e.g., DOM selection aliases, math operations).
*   `creator.js`: Functions dedicated exclusively to creating, assembling, and returning DOM structures (like tables or lists).

### Code Abstraction Pattern (Helpers)
To keep the main logic clean and highly readable, abstract repetitive native DOM methods into short, exported helper functions within a utility module.

**1. Create the Utility Aliases (`utilities.js`):**
```javascript
// Abstracts document.createElement
export const create = (element) => {
  return document.createElement(element);
}

// Abstracts document.getElementById
export const gId = (id) => {
  return document.getElementById(id);
}
```

**2. Use the Aliases in Other Modules (`creator.js` / `index.js`):**
Instead of cluttering your UI generation code with long `document.` chains, import and use the short aliases:
```javascript
import { create, gId } from "./utilities.js";

const table = create("table"); // Much cleaner than document.createElement
const mainDiv = gId("main-div");
```

### DOM Generation Strategy
When generating complex elements (like a data table) inside a module like `creator.js`, use a hybrid approach:
1.  Use the abstracted `create("element")` for structural wrappers (`<table>`, `<thead>`, `<tbody>`, `<tr>`).
2.  Use Template Literals (backticks) and `.innerHTML` for the inner content of those wrappers to avoid creating individual `<td>` or `<th>` nodes one by one.
3.  Always `appendChild` the finished, nested element back to the parent container, and **return** the parent element to the main script.

```javascript
// creator.js
import { create } from "./utilities.js";

export const createStudentsTable = (students) => {
  const table = create("table");
  
  const thead = create("thead");
  thead.innerHTML = `<tr><th>NAME</th><th>COURSE</th></tr>`;
  table.appendChild(thead);
  
  return table; // Return the fully constructed object
}
```

---

## 3. Quick Review

### Named vs Default Exports

```javascript
// NAMED EXPORT
export const myFunc = () => {}
import { myFunc } from './file.js'

// DEFAULT EXPORT
export default myFunc
import customName from './file.js'
```

### Most Important Keywords & Attributes

```html
type="module" // HTML script attribute required for ESM
```
```javascript
export
export default
import
```

### Core Idea

**JavaScript Modules isolate code into separate, purposeful files (preventing spaghetti code), utilizing strict lexical scoping and an import/export system to share logic predictably and safely across an application.**