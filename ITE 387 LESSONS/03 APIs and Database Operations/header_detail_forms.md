# JavaScript: Header-Detail Forms (Master-Detail)

## Related Lessons

- [[03 APIs and Database Operations/javascript_working_with_apis]]
- [[03 APIs and Database Operations/mysql_insert_records]]
- [[03 APIs and Database Operations/mysql_update_records]]
- [[04 Database Design/database_normalization]]

## 1. Lesson Summary

### Main Idea
A **Header-Detail form** (or Master-Detail form) is used when you need to save data to multiple related tables at the exact same time. A perfect example is an **Invoice**: it has one main "Header" (customer, date, total) and multiple "Details" or line items (the specific products bought).

The challenge is saving the Header, getting its newly created ID, and instantly using that ID to save all the Details, ensuring no incomplete data is left in the database if an error occurs.

### 1. Frontend State Management
Instead of trying to read data out of the HTML table when the user clicks "Save", the JavaScript uses **arrays as the single source of truth**.
* `products = []`: Stores the list of available products fetched from the database.
* `details = []`: Temporarily stores the line items the user adds to their invoice. 
When the user adds an item, it goes into the `details` array, and the HTML table is instantly redrawn based on that array.

### 2. Finding Data & Calculating Totals
* **`.find()`**: When a user selects a product from the dropdown, the script uses `.find()` to search the `products` array and instantly retrieve the correct price.
* **`.reduce()`**: To calculate the total sales on the fly, the script uses `.reduce()` to loop through the `details` array and add up all the amounts.

### 3. The Nested JSON Payload
To send everything to the API at once, the data must be packaged into a nested structure. It sends a single JSON object containing:
1.  **`header`**: An object containing the main info (Student ID, Date, Total).
2.  **`details`**: An array of objects containing the line items (Product ID, Qty, Price).

### 4. Backend "All or Nothing" Transactions (PDO)
When saving to multiple tables, you cannot risk saving a Header without its Details (e.g., if the server crashes halfway through). PHP solves this using **Database Transactions**:
* **`beginTransaction()`**: Tells MySQL to pause auto-saving.
* **`commit()`**: Tells MySQL "Everything succeeded, save it all permanently."
* **`rollBack()`**: Tells MySQL "An error happened, undo everything we just tried to do."

### 5. The Foreign Key Solution
The Detail table needs to know which Header it belongs to. But the Header's Auto-Increment ID doesn't exist until it is saved!
* The API inserts the Header first.
* It immediately uses `$conn->lastInsertId()` to fetch the new Auto-Increment ID.
* It then loops through the Details array, injecting that new ID into every row before saving them.

---

## 2. Coding Writing Style

The coding style strictly separates frontend state from the DOM, and enforces absolute data integrity on the backend using transactions.

### Backend Structure: PDO Transactions & Relational Inserts
**How to write it:** Always wrap Master-Detail inserts in a `try...catch` block. Turn off auto-saving with `beginTransaction()`. Insert the master record, grab the new ID, and use a `foreach` loop to insert the child records. If anything fails, `rollBack()`.

```php
try {
  $conn->beginTransaction(); // 1. Start transaction (pause auto-save)

  // 2. Save the Header
  $sqlHeader = "INSERT INTO tbl_invoice_header (date, total) VALUES (:date, :total)";
  $stmt = $conn->prepare($sqlHeader);
  $stmt->bindParam(":date", $header['invoiceDate']);
  $stmt->bindParam(":total", $header['amount']);
  $stmt->execute();
  
  // 3. Fetch the newly created Auto-Increment ID
  $newHeaderId = $conn->lastInsertId(); 

  // 4. Save Details in a Loop
  $sqlDetail = "INSERT INTO tbl_invoice_details (header_id, item) VALUES (:hId, :item)";
  $stmtDtl = $conn->prepare($sqlDetail);
  
  foreach ($details as $row) {
    $stmtDtl->bindParam(":hId", $newHeaderId); // Inject the Foreign Key!
    $stmtDtl->bindParam(":item", $row['productName']);
    $stmtDtl->execute();
  }

  $conn->commit(); // 5. Success! Save everything permanently.
  $returnValue = 1;

} catch (Exception $e) {
  $conn->rollBack(); // 6. Error! Undo everything.
  $returnValue = 0;
}
```

### Frontend Structure: State-Driven Payloads
**How to write it:** Keep your details in a global array. When saving, build an object holding both the header and the details array. `JSON.stringify` it and send it via Axios `POST` using `FormData`.

```javascript
let details = []; // Global array holding line items

const saveInvoice = async () => {
  // 1. Build the Header object
  const header = {
    studentId: document.getElementById("students-select").value,
    amount: getTotalSales(),
  };

  // 2. Bundle Header and Details together
  const jsonData = { 
    header: header, 
    details: details 
  };

  // 3. Package and Send
  const formData = new FormData();
  formData.append("operation", "saveInvoice");
  formData.append("json", JSON.stringify(jsonData));

  const response = await axios({
    url: "http://localhost/api/invoice.php",
    method: "POST",
    data: formData,
  });
};
```

### Frontend Structure: Array Helpers & Formatting
**How to write it:** Abstract calculations and formatting into short, reusable arrow functions. Use `.reduce()` for totals, and `Intl.NumberFormat` for perfect currency displays.

```javascript
// Calculate Total Sales using Reduce
const getTotalSales = () => {
  return details.reduce((sum, item) => sum + item.amount, 0);
};

// Standardize Currency Formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
};
```

---

## 3. Quick Review

### The PDO Transaction Flow
```text
beginTransaction()  -->  Stops auto-saving
execute()           -->  Saves Header
lastInsertId()      -->  Gets Header ID
execute() loop      -->  Saves Details using Header ID
commit()            -->  Permanently writes to database
(or rollBack())     -->  Undoes changes if error occurs
```

### JSON Payload Structure
```json
{
  "header": { "studentId": 12, "amount": 5000 },
  "details": [
    { "productId": 1, "qty": 2, "price": 1000 },
    { "productId": 3, "qty": 1, "price": 3000 }
  ]
}
```

### Core Idea
**To handle complex forms like Invoices, the JavaScript frontend bundles header data and detail arrays into a single JSON payload. The PHP backend receives this, pauses database auto-saving (Transactions), securely links the tables using the newly generated Master ID, and only saves permanently if every single record succeeds.**