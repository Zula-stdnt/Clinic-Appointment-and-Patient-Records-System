# JavaScript: Objects and Arrays of Objects

## Related Lessons

- [[01 JavaScript Foundations/javascript_arrays]]
- [[02 DOM and UI/dom_create_and_remove_elements]]
- [[03 APIs and Database Operations/javascript_working_with_apis]]

## 1. Lesson Summary

### Main Idea

An object is a composite data type that allows you to store and manipulate collections of data using **key-value pairs**. The key is a string (or symbol), and the value can be any valid JavaScript data type (string, number, array, function, etc.).

### 1. Object Declaration Methods

There are three primary ways to create an object in JavaScript.

#### Object Literal Syntax

The most common and straightforward approach, using curly braces `{}`.

```javascript
const person = {
  name: "Pto",
  course: "BSIT",
  age: 23
};
```

#### Constructor Pattern

Instantiates an empty object using `new Object()`, then assigns properties individually.

```javascript
const person = new Object();
person.name = "Pto";
person.course = "BSIT";
person.age = 23;
```

#### Factory Functions

A reusable function that returns an object. Highly recommended when you need to generate multiple similar objects dynamically.

```javascript
function createPerson(name, course, age) {
  return {
    name: name,
    course: course,
    age: age
  };
}

const person1 = createPerson("Pto", "BSIT", 23);
const person2 = createPerson("Kulas", "BSN", 22);
```

### 2. Accessing Properties

You can extract values from an object using two notations:

#### Dot Notation

The standard and most readable way to access properties.

```javascript
console.log(person.name); // Returns "Pto"
```

#### Bracket Notation

Useful when property names are dynamic, stored in variables, or contain special characters.

```javascript
console.log(person["name"]); // Returns "Pto"
```

### 3. Working with Arrays of Objects

Instead of a simple list of strings, you can have an array where every element is an object representing a complete record.

```javascript
const students = [
  { name: "Anna", course: "BSIT" },
  { name: "Mel", course: "BSIT" },
  { name: "Lens", course: "CRIM" }
];
```

Accessing a nested property requires selecting the array index first, then the object key:

```javascript
console.log(students[0].name); // Returns "Anna"
```

### 4. Array Methods for Objects

JavaScript array methods are incredibly powerful when applied to arrays of objects.

| Method | Action on Array of Objects | 
| ----- | ----- | 
| `forEach()` | Iterates through the array to perform operations on each object (e.g., displaying names). | 
| `filter()` | Returns a **new array** of only the objects that meet a specific condition (e.g., course === "BSIT"). | 
| `reduce()` | Calculates a single value from all objects (e.g., multiplying `stock` by `price` for total inventory value). | 

### 5. DOM Integration & Events

You can map arrays of objects into HTML interface elements, such as `<select>` drop-downs.

```javascript
const select = document.createElement("select");

students.forEach(student => {
  const option = document.createElement("option");
  option.innerText = student.name;       // User sees the name
  option.value = student.schoolID;       // System tracks the ID
  select.appendChild(option);
});

mainDiv.appendChild(select);
```

You can handle interactions by assigning functions directly to element events, like `onchange`.

```javascript
select.onchange = () => {
  console.log(select.value); // Returns the selected schoolID
};
```

## 2. Coding Writing Style

The coding style focuses on structured data modeling, efficient reusability, and clean DOM manipulation.

### Object Declaration Strategy

*   Use **Object Literals** for single, unique, one-off configuration objects.
*   Use **Factory Functions** when you need to instantiate multiple records of the same type to keep your code DRY (Don't Repeat Yourself).

### Data Access Preference

*   Default to **Dot Notation** (`object.property`) for better readability. 
*   Only use **Bracket Notation** (`object["property"]`) when the key is dynamic or not known until runtime.

### Declarative Array Manipulation

Never use manual `for` loops to search or tally data inside an array of objects.

*   Use `.filter()` to extract specific records (avoids mutating the original data).
*   Use `.reduce()` to compute aggregate totals (e.g., financial sums, inventory counts).
*   Use `.forEach()` purely for side effects, like rendering items to the DOM.

### DOM Component Mapping Pattern

When generating UI components (like a `<select>` list) from object data, clearly separate the **display value** from the **reference value**:

1.  Assign user-friendly data (like `student.name`) to the element's text (e.g., `innerText`).
2.  Assign unique identifiers (like `student.schoolID` or database keys) to the hidden `value` property.

## 3. Quick Review

### Access Methods

```javascript
// DOT NOTATION
student.name

// BRACKET NOTATION
student["name"]
```

### Important Array-of-Object Methods

```javascript
// Perform action on each
array.forEach(item => ...)

// Extract matches to new array
array.filter(item => item.course === "BSIT")

// Tally a total value
array.reduce((sum, item) => sum + item.price, 0)
```

### Core Idea

**Objects group related data into key-value pairs, and Arrays of Objects allow you to efficiently store, filter, tally, and render complex database-like records in JavaScript.**