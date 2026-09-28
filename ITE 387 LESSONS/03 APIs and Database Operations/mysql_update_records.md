# JavaScript: Update MySQL Records via API

## Related Lessons

- [[03 APIs and Database Operations/mysql_retrieve_records]]
- [[03 APIs and Database Operations/mysql_retrieve_specific_record]]
- [[03 APIs and Database Operations/mysql_insert_records]]

## 1. Lesson Summary

### Main Idea

Updating a database record is a multi-step process: you must fetch the existing record, display it inside interactive input fields so the user can modify it, send the modified data back to the server, execute an `UPDATE` SQL statement, and instantly refresh the UI.

### 1. Triggering the Update Modal

When iterating through records to build the table, attach an event listener to the "Update" button. You must pass three crucial pieces of data to the update module:
1. The unique primary key (`stud_id`).
2. Any arrays needed for dropdowns (e.g., `courses`).
3. A callback function to refresh the table later (`displayStudents`).

### 2. Pre-populating the Form (State Management)

Once the "Update" modal opens, the specific record is fetched from the database. Instead of just displaying the text, the data is injected into the `value` attributes of HTML `<input>` elements so the user can edit them.

```html
<!-- Injecting the fetched value into the input field -->
<input type="text" id="update-last-name" value="${student[0].stud_last_name}" />
```

### 3. Handling Dynamic Dropdowns (Select Elements)

Pre-selecting a dropdown menu requires looping through the list of options (e.g., courses) and comparing each option's ID to the student's current `course_id`. If they match, the `selected` HTML attribute is added to that `<option>`.

### 4. Sending the Updated Data

When the user clicks the "Update" save button, the values are extracted from the inputs, packaged into a JSON object, appended to a `FormData` object, and sent to the API via an Axios `POST` request.

### 5. Backend Update Logic (PHP API)

The API endpoint routes the request to an `updateStudent` function.
* **SQL Statement:** Uses the `UPDATE table SET col=:val WHERE id=:id` syntax.
* **Binding:** Secures the query using PDO prepared statements (`bindParam`).
* **Validation:** Uses `$stmt->rowCount() > 0` to verify if the record was successfully modified, returning `1` for success and `0` for failure.

### 6. Reflexive UI Refresh

If the Axios request returns a success (`1`), the frontend immediately calls the refresh function (passed earlier as a callback), alerts the user, and hides the modal using the Bootstrap Modal API (`myModal.hide()`).

---

## 2. Coding Writing Style

The coding style emphasizes a **modular, functional, and asynchronous approach** using vanilla JavaScript, focusing on data-driven UI rendering and reflexive callbacks.

### Modular Component Structure

Isolate UI workflows into distinct modules. The logic for updating a record lives entirely in `update.js` and is imported into the main application. This prevents code bloat in the main index file.

### State Management and Default Values Pattern

When generating UI templates dynamically with template literals, implement conditional logic to dictate element states directly inline. 

For example, when creating a `<select>` dropdown, use a ternary operator to conditionally inject the `selected` attribute:

```javascript
const createCourseSelect = (courses, currentCourseId) => {
  let myHtml = `<select id="update-course" class="form-select">`;
  
  courses.forEach(course => {
    // Ternary operator checks if the loop's course matches the student's course
    let selected = currentCourseId == course.crs_id ? "selected" : "";
    myHtml += `<option value="${course.crs_id}" ${selected}>${course.crs_title}</option>`;
  });

  myHtml += "</select>";
  return myHtml;
}
```

### Reflexive UI Updates (Callback Injection)

To ensure the user interface reflects the database state without page reloads, pass the main display/render function as a parameter (`refreshDisplay`) to the update module. This decouples the modules while still allowing the child module to trigger a global UI refresh upon a successful API transaction.

```javascript
// In index.js: Pass displayStudents as a callback
updateModal(student.stud_id, courses, displayStudents);

// In update.js: Execute the callback after a successful Axios request
if (await updateStudent(studId) == 1) {
  refreshDisplay(); // Triggers displayStudents() back in index.js
  myModal.hide();
}
```

### Asynchronous API Integration

Heavily utilize **async/await** patterns when interacting with the backend. Ensure that UI elements (like closing the modal or showing an alert) are strictly wrapped in conditional blocks that evaluate the awaited response from the server, preventing premature UI updates before the database transaction is finalized.

---

## 3. Quick Review

### Core Workflow Snippets

**1. Pre-selecting a Dropdown Option:**
```javascript
let isSelected = (currentId == loopId) ? "selected" : "";
`<option value="${loopId}" ${isSelected}>Text</option>`
```

**2. Passing a Callback for UI Refresh:**
```javascript
// Passing the function reference (no parentheses!)
updateModal(id, list, displayDataFunction);
```

**3. Secure PHP Update Statement:**
```php
$sql = "UPDATE tblstudents SET stud_last_name=:lastName WHERE stud_id=:studId";
$stmt = $conn->prepare($sql);
$stmt->bindParam(":lastName", $json['lastName']);
$stmt->bindParam(":studId", $json['studId']);
$stmt->execute();
echo json_encode($stmt->rowCount() > 0 ? 1 : 0);
```

### Core Idea
**Updating records combines the concepts of fetching specific data to pre-populate an interactive modal, dynamically managing default states (like dropdown selections), executing parameterized `UPDATE` queries on the backend, and utilizing callback functions to instantly refresh the frontend DOM upon success.**