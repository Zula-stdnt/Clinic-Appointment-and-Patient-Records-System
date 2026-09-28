# Database Design: Translating ERD to Logical Design (Part 2)

## Related Lessons

- [[04 Database Design/database_conceptual_to_logical_design]]
- [[04 Database Design/database_normalization]]
- [[03 APIs and Database Operations/header_detail_forms]]

## 1. Lesson Summary

### Main Idea

An associative (junction) table is the standard way to represent a many-to-many relationship and is not inherently unnormalized. When one business event contains multiple items, a header-detail design can store event-level facts once in a header and the individual items in detail rows. This avoids copying the same event data onto every item row.

### 1. The Redundancy Problem

Suppose one loan event records a borrower, a date, and several books. If the event-level data is copied onto each book row, the table might look like this:

| Loan_Event_ID | Borrower_ID | Date       | Book_ID |
| ------------- | ----------- | ---------- | ------- |
| 1             | 111         | 2026-10-01 | Book A  |
| 1             | 111         | 2026-10-01 | Book B  |
| 1             | 111         | 2026-10-01 | Book C  |

**The Issue:** All three rows describe one event, so the borrower and date are repeated with each item. Repetition alone does not prove a normal-form violation; the key question is which facts depend on the event and which depend on an individual line item.

### 2. The Master-Detail Solution

To solve this, divide the single transaction table into two separate tables:

1. **Master Table (Header):** Records the single event. (Who borrowed books and when?)
2. **Detail Table (Line Items):** Records the multiple items involved in that single event. (Which specific books were borrowed?)

This setup stores the borrower and date once in the header. Each detail row references the header and a book. Use this pattern when the domain has a multi-item event, not as a replacement for every many-to-many junction table.

## 2. Coding Writing Style (Schema Definition)

When mapping this logically, use the **Master-Detail Pattern**. Ensure strict Primary Key (PK) and Foreign Key (FK) referencing to maintain relational data integrity. 

### Structuring the Master-Detail Schema

**How to structure it:** The Master table holds its own Primary Key and a Foreign Key linking to the entity initiating the transaction (the Borrower). The Detail table holds a Foreign Key linking back to the Master table, and another Foreign Key linking to the items being transacted (the Books).

```
-- 1. The Entity Tables (Lookup tables)
Table: Borrower
- borrower_id (PK)
- borrower_name

Table: Book
- book_id (PK)
- book_title

-- 2. The Master Table (The Header)
Table: Transaction_Header
- header_id (PK)       <-- Unique ID for this single visit/transaction
- borrower_id (FK)     <-- Links to Borrower table
- transaction_date     <-- Metadata stored ONLY ONCE

-- 3. The Detail Table (The Items)
Table: Transaction_Detail
- detail_id (PK)       
- header_id (FK)       <-- Links to the Transaction_Header table
- book_id (FK)         <-- Links to the Book table
```

### Data Consistency Rules

**How to write it:** 
* **Primary Key (PK):** Each table needs a key that uniquely identifies its rows. A detail table may use a surrogate line ID or a suitable composite key; an auto-incrementing key is not mandatory.
* **Foreign Key (FK) Strictness:** Never store borrower names or book titles in the transaction tables. Only store the integer IDs. If you need the name, you query it using the FK.
* **3NF Compliance:** Ensure that every non-key attribute (like `transaction_date`) is strictly dependent *only* on the Master table's PK (`header_id`).

## 3. Quick Review

### Before and After Normalization

```
BAD (Data Duplication):
Transaction(Trans_ID, Borrower_ID, Date, Book_ID)

GOOD (Master-Detail):
Header(Header_ID, Borrower_ID, Date)
Detail(Detail_ID, Header_ID, Book_ID)
```

### Core Idea

**For a multi-item event, the header stores shared event facts and the detail stores its items. Choose keys and table structure from the actual functional dependencies; a header-detail pattern does not automatically guarantee 3NF.**