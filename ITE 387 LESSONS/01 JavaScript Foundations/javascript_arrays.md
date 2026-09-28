# JavaScript: Arrays and Lists

## Related Lessons

- [[01 JavaScript Foundations/javascript_fundamentals]]
- [[01 JavaScript Foundations/javascript_objects_and_arrays]]

## 1. Lesson Summary

### Main Idea

JavaScript arrays allow you to store multiple related values within a single variable, rather than creating separate variables for every item (e.g., avoiding `student1`, `student2`). You interact with them through basic mutating operations, iteration, and functional transformations.

### 1. Array Declaration and Access

Use square brackets `[]` to declare an array. 

```javascript
const students = ["kulas", "pto", "pablo"];
```

Elements are accessed via a **zero-based index**.

```javascript
console.log(students[0]); // Returns "kulas"
```

The index of the last element is always one less than the array's total length (`length - 1`).

### 2. Basic Operations (Mutating)

These methods directly modify the original array.

| Method | Action | Returns |
| :--- | :--- | :--- |
| `push(item)` | Adds item to the **end** | New array length |
| `pop()` | Removes item from the **end** | The removed item |
| `unshift(item)`| Adds item to the **beginning** | New array length |
| `shift()` | Removes item from the **beginning**| The removed item |

### 3. Iteration Techniques

JavaScript offers multiple ways to loop through an array based on the level of control needed.

#### Standard `for` Loop
Provides full manual control over the index, condition, and increment.
```javascript
for (let i = 0; i < students.length; i++) {
  console.log(students[i]);
}
```

#### `for...of` Loop
Clean, direct access to values without manually managing an index or monitoring the array length.
```javascript
for (let student of students) {
  console.log(student);
}
```

#### `forEach()` Method
A functional approach that uses a callback function for each element, providing access to the item and optionally its index.
```javascript
students.forEach((student, index) => {
  console.log(index, student);
});
```

### 4. Functional Transformations (Non-Mutating)

These methods prioritize immutability. They do not change the original array; instead, they return a new array or calculated value.

*   **`map()`:** Transforms each element based on specific logic (e.g., `.toUpperCase()`) and returns a new, modified array.
*   **`filter()`:** Creates a new array containing only elements that meet a specified condition (e.g., `student !== "pto"`).
*   **`reduce()`:** Consolidates an array into a single value (e.g., a running total of grades). It takes an accumulator, a current value, and an optional initial starting value.

---

## 2. Coding Writing Style

The coding style focuses on clean, declarative, and efficient JavaScript practices when working with arrays and injecting them into the DOM.

### Single Source of Truth
The style strongly discourages creating multiple individual variables for data of the same type. Always favor declaring a **single variable** assigned to an array.

### Loop Selection Logic
Progress from imperative to functional programming methods based on needs:
*   Use standard `for` loops only when manual index control is strictly required.
*   Use `for...of` for maximum readability when merely reading values.
*   Use functional methods (`map`, `filter`, `reduce`) to safely transform data without side effects (immutability).

### DOM Integration Pattern
When updating a webpage with array data, strictly follow this structured 4-step pattern:

```text
1. Reference Selection (document.getElementById)
         ↓
2. Element Creation (document.createElement in a loop)
         ↓
3. Content Assignment (Set innerText to the array value)
         ↓
4. Appension (appendChild to inject into the live DOM)
```

**Example Implementation:**
```javascript
// 1. Reference Selection
const mainDiv = document.getElementById("main-div");
const ul = document.createElement("ul");

// Iteration
students.forEach(student => {
  // 2. Element Creation
  const li = document.createElement("li");
  // 3. Content Assignment
  li.innerText = student;
  // 4. Appension (Child to Parent)
  ul.appendChild(li);
});

// Final Appension (List to DOM)
mainDiv.appendChild(ul);
```

---

## 3. Quick Review

### Mutating vs. Non-Mutating

```javascript
// MUTATING (Changes Original)
students.push("maria");

// NON-MUTATING (Returns New Data)
const filtered = students.filter(student => student !== "pto");
const total = grades.reduce((sum, grade) => sum + grade, 0);
```

### Most Important Methods

```javascript
// Modifiers
array.push()
array.pop()

// Iteration & Transformation
array.forEach()
array.map()
array.filter()
array.reduce()
```

### Core Idea

**Arrays efficiently store lists of data in a single variable. JavaScript provides mutating methods for basic adjustments, and powerful, immutable functional methods to iterate, transform, and render these lists cleanly into the DOM.**