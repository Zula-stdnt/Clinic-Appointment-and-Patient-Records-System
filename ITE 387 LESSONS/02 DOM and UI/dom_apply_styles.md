# JavaScript: Apply Styles to Elements

## Related Lessons

- [[02 DOM and UI/dom_create_and_remove_elements]]
- [[02 DOM and UI/bootstrap_responsive_design]]

## 1. Lesson Summary

### Main Idea
JavaScript allows you to dynamically alter the visual presentation of HTML elements. You can achieve this in two primary ways: applying **inline styles** directly to the element or assigning **pre-defined CSS classes** from an external stylesheet.

### 1. Inline Styles (The `style` Property)
You can directly modify individual CSS properties using the `style` object. 

**CRITICAL RULE: The camelCase Convention**
When using JavaScript to change CSS properties that normally contain a hyphen (dash-case), you must remove the hyphen and capitalize the next letter (camelCase).

| CSS Property | JavaScript Property |
|---|---|
| `background-color` | `backgroundColor` |
| `margin-bottom` | `marginBottom` |
| `text-align` | `textAlign` |

```javascript
const headerDiv = document.getElementById("header-div");
headerDiv.style.color = "red";
headerDiv.style.backgroundColor = "#efffef";
```

### 2. Pre-defined CSS Classes
Instead of writing individual inline styles, it is often cleaner to toggle CSS classes that are already defined in your CSS file. 

#### `className` (Use with Caution)
The `className` property sets or returns the class attribute of an element.
**Warning:** Assigning a value to `className` completely overwrites *all* existing classes on that element.

```javascript
// Replaces all current classes with "guest-entry"
entryDiv.className = "guest-entry"; 
```

#### `classList` API (Recommended)
The `classList` API is the safest and most flexible way to manage classes because it preserves existing styles.

* **`classList.add()`**: Appends one or multiple classes.
* **`classList.remove()`**: Removes a specific class without touching the others.

```javascript
// Adds classes while preserving existing ones
headerDiv.classList.add("verde", "center-text");

// Removes only the "verde" class
headerDiv.classList.remove("verde");
```

### 3. Styling Dynamically Created Elements
When you create elements dynamically using `document.createElement()`, you can (and should) apply styles or classes to them *before* injecting them into the DOM.

```javascript
const newHeader = document.createElement("h1");
newHeader.innerText = "Welcome to my world";

// Style it before it appears on the page
newHeader.classList.add("verde", "center-text");

// Finally, append it so it becomes visible
headerDiv.appendChild(newHeader);
```

---

## 2. Coding Writing Style

The coding style focuses on strict naming conventions for styles and safe class manipulation to prevent accidentally destroying existing layouts.

### Inline Styling Pattern
* Access the style property directly on the referenced element: `element.style.propertyName = "value";`
* **Strict Adherence:** Always use `camelCase` for CSS properties. Never use strings with dashes for property names in standard dot notation.

### CSS Class Management Pattern
* **Avoid `className` for updates:** Only use `className` when you explicitly want to wipe a slate clean and assign a single new class.
* **Default to `classList`:** Use `classList.add()` and `classList.remove()` for all standard styling logic. This prevents the accidental loss of classes that might control critical layout structure elsewhere.

### DOM Component Styling Sequence
When generating new UI components, follow this chronological structure to ensure the browser paints the styled element efficiently:

```text
1. createElement()         (Create the node in memory)
         ↓
2. Apply innerText/HTML    (Populate the content)
         ↓
3. classList.add()         (Apply styling/classes)
         ↓
4. appendChild()           (Inject into the live DOM)
```

### Event-Driven Initialization
Styles and DOM manipulations should only execute once the HTML is fully parsed. Always wrap initialization functions inside a `DOMContentLoaded` event listener to avoid null reference errors.

```javascript
document.addEventListener("DOMContentLoaded", () => {
    drawHeader();
});
```

---

## 3. Quick Review

### Syntax Comparison

```javascript
// INLINE STYLING
element.style.textAlign = "center";

// CSS CLASS MANIPULATION
element.className = "overwrite-everything";
element.classList.add("safe-append");
element.classList.remove("safe-remove");
```

### Most Important Properties & Methods
```javascript
element.style
element.className
element.classList.add()
element.classList.remove()
```

### Core Idea
**JavaScript can dynamically style web pages by directly injecting camelCased inline CSS properties, or more preferably, by adding and removing pre-defined CSS classes using the `classList` API.**