# Database Design: Conceptual to Logical Design

## Related Lessons

- [[entity_relationship_diagrams]]
- [[04 Database Design/database_normalization]]
- [[04 Database Design/database_master_detail_design_part_2]]

## 1. Lesson Summary

### Main Idea

Database design occurs in phases. You first build a **Conceptual Design** (like an Entity Relationship Diagram or ERD) to map high-level business rules. You then translate that into a **Logical Design**, which defines the exact tables, columns, data types, and primary/foreign keys, but remains independent of any specific database software (like MySQL or Oracle).

### 1. Conceptual vs. Logical Design

* **Conceptual Design (ERD):** A visual blueprint of entities and relationships using shapes (rectangles, diamonds, ovals).

* **Logical Design:** A structured table schema detailing columns, data types, constraints, and explicit Primary Key (PK) / Foreign Key (FK) mappings.

### 2. Resolving One-to-Many (1:M) Relationships

When translating a 1:M relationship from an ERD to a Logical schema, you do not need new tables.

* **The Rule:** Take the Primary Key from the "One" side (the lookup table) and place it into the "Many" side as a **Foreign Key**.

* *Example:* One `Course` has many `Students`. The `Student` table gets a `course_id (FK)`.

### 3. Resolving Many-to-Many (M:N) Relationships

In a relational schema, a single foreign-key column on either endpoint represents a one-to-many relationship, not a many-to-many relationship. A many-to-many relationship is normally represented by an associative (junction) table containing foreign keys to both related tables.

* **The Rule:** Create an **Associative Entity** (also called a junction or bridge table).

* **Structure:** This table holds the Primary Keys of both original tables as Foreign Keys. A composite key made from those keys is one common choice; a separate key may be used when the relationship needs its own identity.

* *Example:* `Students` and `Subjects` use an `Enrolled_Subjects` bridge table containing `student_id (FK)` and `subject_id (FK)`, plus relationship-specific data such as an enrollment date if needed.

## 2. Coding Writing Style (Logical Schema Definition)

When writing out a logical schema, you are not writing raw SQL yet. Instead, you are using a structured, modular notation to map out the exact architecture of your tables, focusing on explicit key labeling and relationship mapping.

### Schema Structure & Naming Convention

**How to write it:** Use clear, singular entity names. Explicitly label Primary Keys as **(PK)** and Foreign Keys as **(FK)**.

```
Table: EntityName
- column_name (PK)
- column_name (FK)
- normal_column

```

### Data Definition & Constraints

**How to write it:** Next to each column, explicitly state its expected data type (e.g., `int`, `varchar`) and any hard constraints required for data integrity (e.g., `Auto Increment`, `Not Null`).

```
Table: Publisher
- publisher_id (PK) : int, Auto Increment
- publisher_name    : varchar, Not Null

```

### Relationship Patterns (Pseudo-Schema Examples)

**How to structure a One-to-Many (1:M):**
Place the PK of the parent into the child table.

```
Table: Course (The "One" side)
- course_id (PK)    : int, Auto Increment
- course_title      : varchar, Not Null

Table: Student (The "Many" side)
- student_id (PK)   : int, Auto Increment
- student_name      : varchar, Not Null
- course_id (FK)    : int, Not Null  <-- Links back to Course

```

**How to structure a Many-to-Many (M:N):**
Build a bridge table containing both FKs, plus any specific metadata about that interaction (like the date the transaction occurred).

```
Table: Book
- book_id (PK)      : int, Auto Increment
- title             : varchar, Not Null

Table: Borrower
- borrower_id (PK)  : int, Auto Increment
- name              : varchar, Not Null

Table: Transaction (The Bridge Entity)
- transaction_id (PK): int, Auto Increment
- book_id (FK)       : int, Not Null
- borrower_id (FK)   : int, Not Null
- date_borrowed      : date, Not Null <-- Metadata attribute

```

## 3. Quick Review

### Key Resolution Rules

```
1:M Relationship -> Add FK to the "Many" table.
M:N Relationship -> Create a new Bridge Table with 2 FKs.

```

### Core Idea

**Translating from conceptual to logical design means turning an ERD into tables, columns, keys, constraints, and associative tables that represent the relationships accurately.**