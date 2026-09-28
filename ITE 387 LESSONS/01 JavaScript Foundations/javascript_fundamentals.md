# JavaScript: Getting Started

## Related Lessons

- [[01 JavaScript Foundations/javascript_arrays]]
- [[01 JavaScript Foundations/javascript_objects_and_arrays]]
- [[01 JavaScript Foundations/javascript_modules]]
- [[02 DOM and UI/dom_create_and_remove_elements]]

## 1. Lesson Summary

### Main Idea

JavaScript (JS) is a programming language that adds interactivity and dynamic behavior to web pages. While HTML provides the structural backbone and CSS handles the visual layout, JavaScript allows the page to respond to user actions, update content on the fly, and create dynamic experiences without needing to reload the browser.

### 1. Where to Write JavaScript

JavaScript can be written in two primary locations:

*   **Inline (Internal):** Written directly within the HTML file using `<script>` tags, typically placed in the `<head>` or at the end of the `<body>`. Good for small, quick scripts.
*   **External:** Written in a separate `.js` file (e.g., `index.js`) and linked in the HTML using `<script src="index.js"></script>`. This is best practice for larger projects to keep HTML and JS clean and separated.

### 2. Functions

Functions encapsulate reusable blocks of code. JavaScript offers two main ways to declare them:

*   **Traditional Functions:** Use the `function` keyword. These are *hoisted*, meaning they can be called in the code before they are actually defined.
    ```javascript
    function add(a, b) {
      return a + b;
    }
    ```
*   **Arrow Functions:** Modern syntax using `const` and a "fat arrow" `=>`. These are *not hoisted* and must be defined before they are called. They are excellent for concise, one-line returns.
    ```javascript
    const add2 = (a, b) => a + b;
    ```

### 3. String Interpolation

Instead of using the plus sign (`+`) to concatenate strings and variables, use **backticks** (`` ` ``) and `${}` to inject variables directly into the string.
```javascript
console.log(`Hello ${name}`);
```

### 4. The DOM (Document Object Model)

The DOM is a bridge between your HTML web page and JavaScript. It represents the entire HTML document as a hierarchical tree of objects (e.g., Document -> HTML -> Body -> H1). JavaScript uses the `document` object to access and modify this tree.

### 5. DOM Manipulation

You can dynamically read, change, add, or remove HTML elements using DOM methods:

*   **Select an Element:** `document.getElementById("element-id")`
*   **Modify Content:** 
    *   `.innerText`: Changes the raw text.
    *   `.innerHTML`: Changes the text and parses any HTML tags inside it.
*   **Modify Styles/Attributes:** `element.style.color = 'green'` or `image.src = 'new_image.jpg'`
*   **Create Elements:** `document.createElement("h2")`
*   **Append/Remove:** `parent.appendChild(newElement)` and `parent.removeChild(targetElement)`

### 6. Events and Interactivity

Events make the page interactive. 

*   **Inline HTML Events:** Adding `onclick="myFunction()"` directly to the HTML tag.
*   **Event Listeners:** Attaching listeners via JavaScript using `.addEventListener('click', callback)`. 
*   **DOMContentLoaded:** A crucial event that fires when the HTML is fully loaded. This ensures JavaScript doesn't try to manipulate an element before it exists.

---

## 2. Coding Writing Style

The coding style demonstrated in the reference code emphasizes modern ES6 syntax, safe DOM initialization, and a structured sequence for dynamic element creation.

### Modern Function Syntax

Favor **Arrow Functions** (`const name = () => {}`) over traditional `function` declarations for event handlers and standard logic. This keeps the syntax modern, concise, and predictable regarding scope.

```javascript
// Preferred style
const buttonClicked = () => {
  // Logic here
};
```

### Safe DOM Initialization Pattern

Never manipulate the DOM immediately in the global scope of your script. Always wrap your initial startup logic and dynamic element creation inside a `DOMContentLoaded` event listener. This guarantees the browser has finished reading the HTML tree.

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // Safe to access and create elements here
  const mainDiv = document.getElementById('main-div');
});
```

### Dynamic Element Creation Pattern

When generating new HTML elements through JavaScript, strictly follow a 4-step sequential pattern: **Create → Configure → Listen → Append**.

1.  **Create:** Instantiate the element using `createElement()`.
2.  **Configure:** Set its content (`innerText`) or properties (`style`, `src`).
3.  **Listen (Optional):** Attach any event listeners (`addEventListener`) to the new element directly.
4.  **Append:** Target the parent container and use `appendChild()` to inject the finished element into the page.

```javascript
// 1. Create
var btn = document.createElement('button');

// 2. Configure
btn.innerText = "Button Inside the Div!";

// 3. Listen
btn.addEventListener('click', () => {
  alert('Button clicked!');
});

// 4. Append
var mainDiv = document.getElementById('main-div');
mainDiv.appendChild(btn);
```

### Variable Reference Pattern

Always cache your DOM queries into variables if you plan to manipulate the element.

```javascript
// Good
var hdr = document.getElementById('main-header');
hdr.style.color = 'green';

// Avoid chaining repeatedly if doing multiple operations
// document.getElementById('main-header').style.color = 'green';
```

---

## 3. Quick Review

### Important Function Syntaxes

```javascript
// Traditional
function greet(name) { ... }

// Arrow Function
const greet = (name) => { ... }
```

### Crucial DOM Methods

```javascript
document.getElementById('id')
document.createElement('tag')
element.appendChild(child)
element.removeChild(child)
element.addEventListener('event', callback)
```

### Core Idea

**JavaScript brings static HTML and CSS to life by utilizing the Document Object Model (DOM) to listen for events, dynamically create or remove elements, and update styling and content on the fly.**