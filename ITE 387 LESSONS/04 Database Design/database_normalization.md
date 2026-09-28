# Database Normalization

## Related Lessons

- [[03 APIs and Database Operations/header_detail_forms]]
- [[03 APIs and Database Operations/mysql_insert_records]]
- [[03 APIs and Database Operations/mysql_update_records]]

## 1. Lesson Summary

### Main Idea
Database normalization is the process of structuring a relational database to reduce data redundancy and improve data integrity. It prevents anomalies (insert, update, and delete anomalies) that occur when all data is stuffed into a single, unorganized table. Normalization is achieved by applying a set of formal rules called "Normal Forms."

### First Normal Form (1NF)
A table is in 1NF if:
* **Atomic Values:** Every attribute (column) contains only individual, indivisible (atomic) values. There are no repeating groups or multiple values in a single cell.
* **Primary Key:** Each row can be uniquely identified. If a single column isn't unique, a **composite primary key** (combining two columns, like `student_id` + `subject_code`) is used.

### Second Normal Form (2NF)
A table is in 2NF if:
* It is already in 1NF.
* **No Partial Dependencies:** Every non-primary-key column must be fully dependent on the *entire* primary key. If a column (like `subject_description`) only depends on part of a composite primary key (like `subject_code`, but not `student_id`), it is partially dependent.
* **Solution:** Split the data into separate tables (e.g., separating Subjects from Students).

### Third Normal Form (3NF)
A table is in 3NF if:
* It is already in 2NF.
* **No Transitive Dependencies:** A non-prime attribute (a normal column) must not depend on *another* non-prime attribute. For example, if `Province` dictates the `Region`, `Region` is transitively dependent.
* **Solution:** Separate these linked attributes into their own lookup tables (e.g., creating a `TBL_Region` or `TBL_Province`) and link them back using Foreign Keys.

## 2. Coding Writing Style

Since database normalization deals with structural architecture rather than procedural programming, the "coding style" focuses on strict relational integrity, naming conventions, and SQL table design.

### Table and Column Naming Conventions
**How to write it:** Use clear prefixes to distinguish tables from other database objects, and use consistent suffixes for keys to make relationships obvious.

```sql
-- Table names prefixed with 'TBL_'
CREATE TABLE TBL_Students (...);
CREATE TABLE TBL_Subjects (...);

-- Primary and Foreign Keys suffixed with '_ID'
student_ID INT PRIMARY KEY
province_ID INT FOREIGN KEY
```

### Eliminating Partial Dependencies (2NF Structure)
**How to structure it:** When dealing with a composite primary key (e.g., a student taking a subject), never place subject details in the junction table. Create a separate table for the entity, and a linking table for the relationship.

```sql
-- BAD: Partial dependency (subject_desc depends only on subject_code)
CREATE TABLE TBL_Student_Subjects (
    student_ID INT,
    subject_code INT,
    subject_desc VARCHAR(50),
    PRIMARY KEY (student_ID, subject_code)
);

-- GOOD: Separated tables linked by Foreign Keys
CREATE TABLE TBL_Subjects (
    subject_code INT PRIMARY KEY,
    subject_desc VARCHAR(50)
);

CREATE TABLE TBL_Student_Subjects (
    student_ID INT,
    subject_code INT,
    PRIMARY KEY (student_ID, subject_code) -- Foreign Keys acting as Composite PK
);
```

### Eliminating Transitive Dependencies (3NF Structure)
**How to structure it:** If Column B depends on Column A, and neither is the Primary Key, pull them out into a new "Lookup" table to prevent redundant data entry.

```sql
-- BAD: Transitive dependency (Region depends on Province)
CREATE TABLE TBL_Students (
    student_ID INT PRIMARY KEY,
    province VARCHAR(50),
    region VARCHAR(50) 
);

-- GOOD: Separated lookup table
CREATE TABLE TBL_Provinces (
    province_ID INT PRIMARY KEY,
    province_name VARCHAR(50),
    region_name VARCHAR(50)
);

CREATE TABLE TBL_Students (
    student_ID INT PRIMARY KEY,
    province_ID INT -- Acts as a Foreign Key to the Lookup Table
);
```

## 3. Quick Review

### The Three Normal Forms
```text
1NF -> Ensure atomic values (no lists in a single cell) & set Primary Key.
2NF -> Remove partial dependencies (split tables if columns don't need the full composite key).
3NF -> Remove transitive dependencies (move non-key dependencies to lookup tables).
```

### Core Idea
**Normalization strictly separates data into distinct, linked tables (using Primary and Foreign Keys) to guarantee that you only ever insert, update, or delete a specific piece of information in exactly one place.**