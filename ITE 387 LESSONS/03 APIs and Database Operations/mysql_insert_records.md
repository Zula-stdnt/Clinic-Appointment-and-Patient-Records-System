# JavaScript: Insert MySQL Records via PHP API

## Related Lessons

- [[03 APIs and Database Operations/javascript_working_with_apis]]
- [[03 APIs and Database Operations/mysql_retrieve_records]]
- [[03 APIs and Database Operations/header_detail_forms]]

## 1. Lesson Summary

### Main Idea
Inserting data requires capturing user input on the frontend, sending it securely via a `POST` request to a PHP API, parsing it, and inserting it into a MySQL database using PDO prepared statements. 

### 1. Preparing Form Elements
Before a user can submit data, form elements like `<select>` dropdowns must be dynamically populated with relational data from the database (e.g., fetching a list of courses from `courses.php` to attach a `course_id` to a new student).

### 2. Frontend Data Submission (JavaScript)
To send user input to the API, you must gather the data, package it into a JSON string, and transmit it securely using a `POST` request.

1.  **Gather Data:** Extract values from HTML inputs and store them in a JavaScript object.
2.  **Package Data:** Use the `FormData` object to bundle the `operation` name (e.g., "insertStudent") and the stringified JSON data.
3.  **Transmit:** Use Axios to send the `POST` request to the backend.

### 3. Backend Insert Logic (PHP API)
The PHP backend receives the stringified JSON payload, processes it securely, and returns a success indicator.

1.  **Decode:** Use `json_decode($json, true)` to convert the incoming JSON string into a PHP associative array.
2.  **Prepare SQL:** Write the `INSERT INTO` query using **named placeholders** (e.g., `:lastName`) instead of direct variables to prevent SQL injection.
3.  **Bind Parameters:** Use `$stmt->bindParam()` to attach the decoded array values to the SQL placeholders.
4.  **Execute & Verify:** Execute the query and use `$stmt->rowCount()` to check if any rows were affected.
5.  **Respond:** Echo `1` for success or `0` for failure, encoded as JSON.

### 4. Dynamic UI Refresh
Upon receiving a successful response (`1`) from the API, the frontend immediately updates the UI without requiring a page reload. The existing table container is cleared, and the retrieval function is called again to fetch and display the updated database state.

---

## 2. Coding Writing Style

The coding style emphasizes a **modular, separation-of-concerns approach**, ensuring secure backend queries and clean, event-driven frontend logic.

### Endpoint-Based Routing Architecture
Organize the backend into distinct files for each database entity (e.g., `students.php`, `courses.php`). Within each file, use a `switch($operation)` statement to route incoming requests to the appropriate class methods.

### Secure Database Interaction Pattern
**Never** concatenate raw variables directly into SQL strings. Always use PDO prepared statements combined with `bindParam()`.

```php
// 1. Convert JSON to Associative Array
$data = json_decode($json, true);

// 2. Use Placeholders in SQL
$sql = "INSERT INTO tblstudents (stud_last_name) VALUES (:lastName)";
$stmt = $conn->prepare($sql);

// 3. Bind the Array Value to the Placeholder
$stmt->bindParam(":lastName", $data['lastName']);
$stmt->execute();
```

### Form Data Management Pattern
Do not build manual query strings for POST requests. Append the `operation` name and the stringified JavaScript object to a `FormData` object.

```javascript
const jsonData = {
  lastName: document.getElementById("last-name").value,
  courseId: document.getElementById("course").value
};

const formData = new FormData();
formData.append("operation", "insertStudent");
formData.append("json", JSON.stringify(jsonData));

const response = await axios({
  url: `${baseApiUrl}/students.php`,
  method: "POST",
  data: formData
});
```

### DOM Reset & Re-render Pattern
When updating a list or table in the UI after a successful database operation, always wipe the parent container's `innerHTML` clean *before* running the display/render function again. This prevents duplicate data from stacking up in the DOM.

```javascript
const displayStudentsTable = (students) => {
  const tableDiv = document.getElementById("table-div");
  
  // Wipe container clean before appending new tables
  tableDiv.innerHTML = ""; 
  
  // ... proceed to createElement and appendChild
};
```

### Naming Conventions
*   **HTML Elements:** Use dash-case for IDs (e.g., `button-submit`, `last-name`).
*   **JavaScript:** Use camelCase for variables and functions (e.g., `insertStudent`, `lastName`).

---

## 3. Quick Review

### Core API Insert Flow

**1. JS Post Request:**
```javascript
formData.append("json", JSON.stringify(data));
await axios({ url: api, method: "POST", data: formData });
```

**2. PHP Secure Insert:**
```php
$json = json_decode($json, true);
$stmt = $conn->prepare("INSERT INTO table (col) VALUES (:val)");
$stmt->bindParam(":val", $json['val']);
$stmt->execute();
echo json_encode($stmt->rowCount() > 0 ? 1 : 0);
```

**3. JS UI Refresh:**
```javascript
if(response.data == 1) {
  displayStudents(); // Re-fetches and renders the updated data
}
```

### Core Idea
**To securely insert records, the frontend packages data into a JSON string via `FormData` and sends it via a `POST` request to the backend. The PHP API decodes this data, binds it to a prepared SQL statement to prevent injection, executes the insert, and signals the frontend to clear and re-render the updated UI.**