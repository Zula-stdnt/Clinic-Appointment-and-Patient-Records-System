# Bootstrap: Responsive Design & Vanilla JS

## Related Lessons

- [[02 DOM and UI/dom_apply_styles]]
- [[02 DOM and UI/dom_create_and_remove_elements]]

## 1. Lesson Summary

### Main Idea
Bootstrap is a popular front-end framework that combines pre-defined HTML, CSS, and JavaScript. It allows developers to build sleek, responsive, and mobile-first web applications quickly, without needing to write custom CSS from scratch.

### Setup and Integration
To use Bootstrap without downloading files locally, include the CSS and JS Content Delivery Network (CDN) links directly inside the `<head>` of your HTML document.

### Layouts and Grid System
* **Containers (`.container`):** Wraps the site content, centering it and automatically managing margins.
* **Rows and Columns:** The core layout uses a row-column structure (`.row` and `.col`). 
* **The 12-Column Rule:** A single row is divided into 12 units. Columns within a row must add up to 12 (e.g., `col-8` and `col-4`).
* **Responsive Breakpoints:** Bootstrap uses prefixes like `sm` (small), `md` (medium), and `lg` (large) to dictate layout behavior based on screen size. For instance, `col-md-6` means the element takes up half the screen on medium and larger devices, but automatically stacks vertically on smaller mobile screens.

### Component Styling
Instead of writing custom CSS, styles are applied by adding Bootstrap utility classes directly to HTML elements:
* **Forms:** Use `form-control` for text inputs and `form-select` for dropdown menus.
* **Buttons:** Use `btn` as the base class, followed by a color variant (e.g., `btn-primary` for blue, `btn-danger` for red) and width utilities (e.g., `w-100` for full width).
* **Tables:** Apply `table`, `table-hover`, `table-striped`, and `table-sm` to create beautiful, interactive tables effortlessly.
* **Spacing:** Use classes like `mt-5` or `mt-2` to add a specific amount of margin to the top of an element.

---

## 2. Coding Writing Style

The coding style demonstrated focuses on **Bootstrap's class-based utility approach** to rapid front-end development, avoiding custom CSS files while relying on vanilla JavaScript for backend data rendering.

### CDN Integration
Rather than hosting local files, use Content Delivery Networks (CDN) for Bootstrap’s CSS and JavaScript files, placing them directly within the HTML document's `<head>`.

### Containerized Layouts
Rely on the `<div class="container">` class as your core wrapper. This automatically manages margin and alignment, ensuring that headers, tables, and forms remain consistently centered and responsive across different screen widths.

### Grid System Architecture
Follow a strict **row-column structure**:
1. Create a parent `<div class="row">`.
2. Nest columns inside using breakpoint prefixes (e.g., `col-md-6`). 
3. Ensure the total width units of all columns in a single row sum exactly to 12.

```html
<div class="row mt-2">
  <div class="col-md-6">
    <input type="text" class="form-control" placeholder="First Name" />
  </div>
  <div class="col-md-6">
    <select class="form-select"></select>
  </div>
</div>
```

### Utility-First Component Styling
Transform standard HTML elements using Bootstrap-specific class additions rather than writing custom CSS rules:
* **Inputs & Selects:** `form-control`, `form-select`
* **Buttons:** `btn`, `btn-primary`, `w-100`
* **Tables:** `table`, `table-hover`, `table-striped`
* **Spacing:** `mt-5` (margin-top level 5)

### Vanilla JavaScript Logic
While Bootstrap handles the static UI layout in HTML, dynamic component states and interactions are managed through standard DOM manipulation. 

When generating elements from an API using JavaScript, apply Bootstrap styling programmatically using `classList.add()`:

```javascript
const displayStudentsTable = (students) => {
  const table = document.createElement("table");
  
  // Injecting Bootstrap utility classes dynamically via JS
  table.classList.add("table", "table-hover", "table-striped", "table-sm");
  
  // ... continue appending thead and tbody
};
```

---

## 3. Quick Review

### Key Grid Classes
```text
.container    // Centered responsive wrapper
.row          // Row container for columns
.col-md-6     // Column taking up 50% (6/12) on medium+ screens
```

### Key Component Classes
```text
.form-control       // Standard input styling
.form-select        // Dropdown menu styling
.btn .btn-primary   // Standard blue button styling
.table .table-hover // Table with interactive row hover effects
.mt-2               // Margin-top (spacing utility)
```

### Core Idea
**Bootstrap enables rapid, responsive UI development by providing pre-defined utility classes for layouts (the 12-column grid) and components (forms, buttons, tables). These classes can be written directly in HTML or injected dynamically via JavaScript's `classList` API.**