# JavaScript: Retrieve a Specific Record

## Related Lessons

- [[03 APIs and Database Operations/mysql_retrieve_records]]
- [[03 APIs and Database Operations/mysql_update_records]]

## 1. Lesson Summary

### Main Idea

When displaying data in a table, showing every single database column can clutter the UI. A better approach is to display a summary in the table and provide a "View" button that fetches the specific record via its primary key and displays the full details inside a pop-up modal.

### 1. The "Blank" Reusable Modal

Instead of creating multiple hidden modals in your HTML, create a single "blank" Bootstrap modal. This template serves as an empty container whose title, body, and action buttons are dynamically updated by JavaScript depending on whether the user is viewing, updating, or deleting a record.

### 2. Global State Persistence (`sessionStorage`)

When separating logic into multiple JavaScript files (modules), you often need to share configuration variables like the API URL. Instead of redefining it in every file, store it in the browser's `sessionStorage`.

```javascript
// In index.js (Main Entry Point)
sessionStorage.setItem("baseAPIUrl", "http://localhost/jslecture/api");

// In view.js (Module)
const url = sessionStorage.baseAPIUrl;
```

### 3. Dynamic Action Buttons

When iterating through records to build the table, append action buttons (View, Update, Delete) to each row. Pass the specific record's primary key (`stud_id`) directly to the event listener attached to the "View" button.

```javascript
row.querySelector(".btn-view").addEventListener("click", () =>{
  viewModal(student.stud_id); // Pass the unique primary key
});
```

### 4. Backend Retrieval Logic (PHP)

The PHP API needs a new method (`getStudent`) to handle fetching a single record. 

* Use a `WHERE` clause matched to the specific primary key passed by the frontend.
* Use parameterized queries (`:studId`) to prevent SQL injection.
* **Important:** Even though you are querying a single record, the API still uses `fetchAll()` to return an array of objects. This maintains a consistent JSON structure across all endpoints.

### 5. Displaying the Data

Once the specific data is returned, the frontend injects it into the blank modal's body using template literals and triggers the Bootstrap modal to show. 

Because the API returns an array, you must access the specific record using index `[0]` (e.g., `student[0].stud_first_name`).

## 2. Coding Writing Style

The coding style follows a **modular, vanilla JavaScript approach**, avoiding heavy frontend frameworks while adhering to strict structural patterns.

### Frontend Modularization Pattern

Isolate specific functionalities into dedicated JavaScript modules. For example, logic for viewing a record should live in a `view.js` module rather than cluttering the main `index.js` file.

```javascript
// view.js
export const viewModal = async (studId) => { ... }

// index.js
import { viewModal } from "./modules/view.js";
```

### Dynamic Event Delegation (Hook Classes)

Do not use native Bootstrap classes (like `btn-primary`) as selectors for JavaScript event listeners. Add custom, semantic class names (e.g., `btn-view`, `btn-delete`) specifically acting as hooks for JS logic. Use `querySelector` *within* the dynamically created row to attach the event locally.

```javascript
// Attaching the event exclusively to the button within the current row
row.querySelector(".btn-view").addEventListener("click", callback);
```

### Consistent API Response Handling

Design backend APIs to consistently return arrays for read operations, regardless of whether you expect multiple records or just one. The frontend should reliably expect an array format and handle the single record extraction.

```javascript
// Extracting data from the consistent array response
const firstName = student[0].stud_first_name;
```

### Reusable UI Component Strategy

Minimize HTML bloat by using a single, ID-targeted Bootstrap modal (`#blank-modal`). Update its components (`#blank-modal-title`, `#blank-main-div`) programmatically before invoking the `.show()` method.

```javascript
// 1. Update text/HTML
document.getElementById("blank-modal-title").innerText = "View Details";
document.getElementById("blank-main-div").innerHTML = dynamicHTML;

// 2. Instantiate and show modal
const myModal = new bootstrap.Modal(document.getElementById("blank-modal"));
myModal.show();
```

## 3. Quick Review

### Core Workflow Snippets

**1. Store Global API URL:**
```javascript
sessionStorage.setItem("baseAPIUrl", "http://...");
```

**2. Secure PHP Single Fetch:**
```php
$sql = "SELECT * FROM table WHERE id = :id";
$stmt = $conn->prepare($sql);
$stmt->bindParam(":id", $json['id']);
$stmt->execute();
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
```

**3. Populate & Show Modal (JS):**
```javascript
const student = await getStudentDetails(id);
modalBody.innerHTML = `<td>${student[0].name}</td>`;
new bootstrap.Modal(document.getElementById("blank-modal")).show();
```

### Core Idea

**To prevent UI clutter, list views should show summarized data. Detailed views are managed by passing a unique ID to a modular JavaScript function, requesting the specific record from a parameterized PHP endpoint, and rendering the result inside a reusable, dynamically populated Bootstrap modal.**