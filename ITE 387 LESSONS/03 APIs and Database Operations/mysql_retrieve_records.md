# JavaScript: Retrieve MySQL Records via PHP API

## Related Lessons

- [[03 APIs and Database Operations/javascript_working_with_apis]]
- [[03 APIs and Database Operations/mysql_retrieve_specific_record]]
- [[03 APIs and Database Operations/mysql_insert_records]]
- [[03 APIs and Database Operations/mysql_update_records]]

## 1. Lesson Summary

### Main Idea
JavaScript running in a browser cannot (and should not) connect directly to a MySQL database for security and architectural reasons. Instead, it must communicate with a backend API (like PHP). The API acts as a middleman: it receives the request, securely queries the database, formats the result into JSON, and sends it back to the frontend.

```text
Frontend (JS/Axios)  → Request →  API (PHP)  → Query →  Database (MySQL)
Frontend (DOM Table) ← JSON Response ← API (PHP) ← Recordset ← Database
```

### 1. The Database Connection (PDO)
Connections to the database use **PHP Data Objects (PDO)** rather than older `mysqli` functions. PDO is highly secure, supports multiple database types, and throws catchable exceptions on failure.

### 2. API Template Architecture
The API uses a standardized template (`students.php`) to handle all incoming requests efficiently.
1. **Headers:** Forces the response to be JSON (`application/json`) and allows Cross-Origin Resource Sharing (CORS).
2. **Method Validation:** Checks if the client used `GET` or `POST`.
3. **Parameters:** Expects an `operation` parameter (e.g., "getAllStudents") to know what task to perform, and an optional `json` data parameter.
4. **Routing:** Uses a `switch` statement to trigger the specific class method corresponding to the requested `operation`.

### 3. Backend Data Retrieval & SQL
When the API triggers a retrieval method (e.g., `getAllStudents()`), it executes a SQL statement.
* **Relational Data:** `INNER JOIN` is used to combine tables (e.g., `tblstudents` and `tblcourses`) based on their foreign/primary keys.
* **Prepared Statements:** The query is prepared and executed securely.
* **Fetching:** Data is fetched using `PDO::FETCH_ASSOC`, which returns the rows as an **associative array** (key-value pairs where the column name is the key).
* **JSON Encoding:** The associative array is converted into a JSON string using `json_encode()` so the JavaScript application can read it.

### 4. API Testing (Postman)
Before connecting the JavaScript frontend, always test the API endpoint using a tool like **Postman** (or a VS Code extension). You can manually simulate a request (e.g., `GET http://localhost/jslecture/api/students.php?operation=getAllStudents`) to verify the JSON data returns without syntax or SQL errors.

### 5. Frontend Dynamic Rendering
Once the API is verified, the JavaScript frontend uses **Axios** to fetch the data and dynamically renders it into an HTML table.
1. Await the Axios `GET` request.
2. Create `<table>`, `<thead>`, and `<tbody>` elements using `document.createElement()`.
3. Iterate through the JSON array (`response.data`) using a `.forEach()` loop.
4. For each object, create a `<tr>` (table row).
5. Inject the object's properties into `<td>` tags using template literals inside `.innerHTML`.
6. Append the rows to the `tbody`, the `tbody` to the `table`, and the `table` to the target `main-div`.

---

## 2. Coding Writing Style

The coding style emphasizes a **modular, structured architecture** designed for strict separation of concerns between the database connection, API logic, and frontend rendering.

### Database Connection Strategy
* **PDO Implementation:** Utilize *PHP Data Objects (PDO)* for secure database interactions.
* **Configuration:** Define server name, username, password, and database name as standalone variables to improve readability and maintainability.
* **Error Handling:** Wrap connection logic in a `try-catch` block, explicitly throwing *PDOExceptions*.

```php
// connection-pdo.php
try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname", $dbusername, $dbpassword);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
```

### API Design and Routing
* **Template-Driven Architecture:** Use standard HTTP headers to force JSON-formatted responses and handle CORS.
* **Method Handling & Parameter Logic:** Validate `GET` or `POST` requests. Mandate an `operation` parameter to group related tasks (e.g., CRUD for students).
* **Switch Statement Routing:** Map incoming operations to specific class methods, encapsulating logic tightly within classes.

```php
// students.php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");

$student = new Student();
switch($operation){
  case "getAllStudents":
    echo $student->getAllStudents();
    break;
}
```

### Backend Logic and SQL
* **Prepared Statements:** Employ `$conn->prepare($sql)` and `$stmt->execute()` to maintain security and prevent SQL injection.
* **Data Fetching & Serialization:** Retrieve data as an associative array using `fetch(PDO::FETCH_ASSOC)` and immediately serialize it with `json_encode()`.

```php
$stmt = $conn->prepare($sql);
$stmt->execute();
$rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rs);
```

### Frontend Integration
* **Asynchronous Requests:** Use *Axios* with an `async/await` pattern, ensuring the data retrieval is handled cleanly before proceeding to render.
* **Dynamic DOM Manipulation:** Focus on direct DOM interaction. Instead of static HTML, create elements dynamically (`document.createElement`), loop through JSON (`forEach`), and inject content (`innerHTML`).

```javascript
// index.js
const displayStudents = async () => {
  const response = await axios.get(`${baseApiUrl}/students.php`, {
    params: { operation: "getAllStudents" }
  });
  
  if(response.status == 200){
    displayStudentsTable(response.data);
  }
}
```

---

## 3. Quick Review

### Core API Flow Components

**1. Fetch & Encode Data (PHP API)**
```php
$stmt = $conn->prepare("SELECT * FROM tblstudents");
$stmt->execute();
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
```

**2. Fetch & Render (JavaScript)**
```javascript
const response = await axios.get(url, { params: { operation: "getAllStudents" } });

response.data.forEach(student => {
   const row = document.createElement("tr");
   row.innerHTML = `<td>${student.stud_last_name}</td>`;
   tbody.appendChild(row);
});
```

### Most Important Methods & Concepts
```text
PDO (PHP Data Objects)
PDO::FETCH_ASSOC
json_encode()
switch($operation)
document.createElement("table")
element.innerHTML
parent.appendChild()
```

### Core Idea
**JavaScript relies on a strictly structured, template-driven PHP API to securely query a MySQL database, converting the associative relational records into JSON format that the frontend can dynamically loop through and render as HTML UI components.**