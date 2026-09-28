# JavaScript: Working with APIs

## Related Lessons

- [[01 JavaScript Foundations/javascript_modules]]
- [[03 APIs and Database Operations/mysql_retrieve_records]]
- [[03 APIs and Database Operations/mysql_insert_records]]
- [[03 APIs and Database Operations/header_detail_forms]]

## 1. Lesson Summary

### Main Idea

As projects grow, your JavaScript frontend will need to interact with external databases or backend applications (like PHP or Python). An **API (Application Programming Interface)** acts as the bridge, providing a formalized set of rules and protocols that allow these different software systems to communicate and share data.

### 1. Key API Terminology

To work with APIs, you must understand the core components of the request/response cycle:

| Term | Definition | 
| ----- | ----- | 
| **Endpoint** | A specific URL that represents a resource or service (e.g., `/api/greetings.php`). | 
| **HTTP Methods** | The action being requested: `GET` (retrieve), `POST` (send data), `PUT` (update), `DELETE` (remove). | 
| **Request Body** | The data sent *from* your app *to* the API. | 
| **Response Body** | The data sent *back* from the API to your app. | 
| **Status Codes** | Numbers indicating the result. `200` (OK), `404` (Not Found), `500` (Internal Server Error). | 

### 2. The Request-Response Cycle

APIs operate on a strict cycle between the Client (Browser/JS) and the Server (API/Database).

```text
Client Application (JavaScript)
      ↓
Sends HTTP Request (GET/POST)
      ↓
API Server (PHP/Backend) processes logic / interacts with Database
      ↓
Returns HTTP Response (JSON data + Status Code)
      ↓
Client Application receives and displays data
```

### 3. JSON (JavaScript Object Notation)

JSON is a lightweight, text-based format used to exchange structured data between the client and the server. It looks exactly like a JavaScript Object, but **all keys must be enclosed in double quotes**.

To pass data back and forth, it must be converted:

*   **JS Object to JSON String:** `JSON.stringify(object)`
*   **JSON String to JS Object:** `JSON.parse(string)` (Note: Axios often handles this automatically).
*   **PHP Equivalent:** `json_encode()` (Array to JSON) and `json_decode($data, true)` (JSON to Associative Array).

### 4. Axios and Asynchronous Operations

Network requests take time. When you call an API, it returns a **Promise** (an asynchronous operation that is "pending" until the data arrives).

Instead of native `fetch`, this lesson uses **Axios** (via CDN), a powerful 3rd-party library. To prevent the code from running ahead before the data arrives, you must use `async` and `await`.

```javascript
// The function must be labeled 'async'
const getData = async () => {
  // 'await' pauses execution until the API responds
  const response = await axios.get("URL");
  console.log(response.data);
};
```

### 5. Sending Data: GET vs POST

**GET Request:** Used for simple retrievals. Data is appended directly to the URL as parameters.

```javascript
const response = await axios.get(url, {
  params: { name: "Pto" }
});
```

**POST Request:** Used for sending complex or sensitive data. Data is securely packaged inside a `FormData` object.

```javascript
const formData = new FormData();
formData.append("name", "Pto");
formData.append("skill", JSON.stringify(skillObject));

const response = await axios({
  url: url,
  method: "POST",
  data: formData
});
```

---

## 2. Coding Writing Style

The coding style focuses on asynchronous patterns, modular URL handling, and strict error validation to ensure robust frontend-backend communication.

### Base URL Pattern

Never hardcode the full URL into every Axios request. Store the root path in a `baseApiUrl` variable. This makes it incredibly easy to switch between local development environments and live production servers.

```javascript
// Good
const baseApiUrl = "http://localhost/jslecture/api";
const response = await axios.get(`${baseApiUrl}/greetings.php`);
```

### Response Validation Pattern

Never blindly trust that an API request was successful. Always wrap the data extraction logic inside an `if` statement that checks the HTTP status code (e.g., `response.status == 200`).

```javascript
const response = await axios.get(url);

if (response.status == 200) {
  // Safe to use the data
  console.log(response.data);
} else {
  // Handle the error gracefully
  alert("Error communicating with server!");
}
```

### Data Submission Abstraction

When sending a `POST` request, separate the data packaging from the actual request execution. Use `FormData` to build the payload cleanly. If sending an object within that form data, explicitly stringify it.

```javascript
// 1. Prepare Data
const formData = new FormData();
formData.append("name", document.getElementById("name").value);
formData.append("skill", JSON.stringify({ language: "JS", level: 3 }));

// 2. Execute Request
const response = await axios({
  url: `${baseApiUrl}/endpoint.php`,
  method: "POST",
  data: formData
});
```

### Event-Driven Execution

Ensure that API calls triggered by UI elements (like buttons) are wrapped inside a `DOMContentLoaded` event listener so the DOM is fully parsed before attaching the click events.

---

## 3. Quick Review

### GET vs POST via Axios

```javascript
// GET (Read)
const res = await axios.get(url, { params: { id: 1 } });

// POST (Create/Send)
const form = new FormData();
form.append("key", "value");
const res = await axios({ url: url, method: "POST", data: form });
```

### Most Important Keywords & Methods

```javascript
async / await
axios.get()
axios({ method: "POST" })
new FormData()
formData.append()
JSON.stringify()
response.status
response.data
```

### Core Idea

**APIs allow your JavaScript frontend to securely communicate with external backends and databases. By utilizing asynchronous code (`async/await`) and the Axios library, you can effortlessly exchange JSON data via structured GET and POST requests.**