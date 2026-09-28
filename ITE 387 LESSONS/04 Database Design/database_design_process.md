# Database Design: The 6-Step Process

## Related Lessons

- [[entity_relationship_diagrams]]
- [[04 Database Design/database_conceptual_to_logical_design]]
- [[04 Database Design/database_normalization]]

## 1. Lesson Summary

### Main Idea
Designing a robust database requires a systematic, step-by-step approach starting from gathering business requirements to actual deployment and maintenance. This ensures the database is efficient, scalable, and accurately reflects real-world operations.

### The 6 Steps of Database Design

**1. Requirement Analysis**
*   **Gather Requirements:** Interview stakeholders (users, business analysts, IT staff) to understand exactly what data needs to be stored and how it will be used.
*   **Identify Entities & Relationships:** Determine the main objects (e.g., Customers, Books, Loans) and how they interact with each other based on business rules.

**2. Conceptual Design (ERD)**
*   Create an **Entity Relationship Diagram (ERD)** to visually map out the entities, their relationships, and cardinalities (1:1, 1:M, M:N).
*   Identify specific attributes (columns) for each entity (e.g., Name, Address, ISBN).

**3. Logical Design**
*   **Normalization:** Apply normalization rules to break large, redundant tables into smaller, related ones.
*   **Define Keys:** Assign **Primary Keys (PK)** for unique identification and **Foreign Keys (FK)** to link tables and enforce referential integrity.

**4. Physical Design**
*   Choose the specific DBMS (e.g., MySQL, PostgreSQL) and determine the hardware/cloud storage requirements.
*   **Optimization:** Implement performance techniques like **indexing** to ensure fast data retrieval as the database grows to millions of records.

**5. Testing and Evaluation**
*   Connect the database to a front-end application to simulate real-world usage.
*   Test for data integrity, security, and performance. Gather feedback from users and make necessary schema adjustments before going live.

**6. Deployment and Maintenance**
*   Deploy the database to a live production environment so users can access it.
*   Continuously monitor performance, perform routine maintenance, run backups, and execute security checks.

## 2. Coding Writing Style (Architectural Schema Design)

The instructional style emphasizes a **structured, modular approach** to database design. Even before writing physical SQL, the architecture must follow strict rules for separation, integrity, and scalability.

### Core Architectural Principles

*   **Object-Entity Separation:** Treat entities as distinct, modular objects defined by specific attributes.
*   **Normalization Rules:** Logically partition large, monolithic data sets into smaller, linked tables to maintain efficiency and eliminate redundancy.
*   **Referential Integrity:** Mandate the use of **Primary Keys (PK)** for unique identification and **Foreign Keys (FK)** to prevent orphaned records.
*   **Standardized Constraints:** Enforce programmatic rules at the database level (e.g., uniqueness for emails/ISBNs, non-negative numeric checks, valid date formats).
*   **Scalability Mindset:** Plan for early optimization (like indexing) to ensure high performance as data scales.
*   **Systematic Evaluation:** Treat testing as an integration phase where backend structures are validated against frontend requirements.

### How to Write It (SQL Schema Implementation)

When translating this design philosophy into actual code (Data Definition Language or DDL), you must explicitly write out the constraints and relational links to enforce the design rules.

```sql
-- 1. Object-Entity Separation (Distinct Tables with specific attributes)
CREATE TABLE Members (
    member_id INT AUTO_INCREMENT PRIMARY KEY, -- Primary Key enforcement
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,       -- Standardized Constraint (Uniqueness)
    phone VARCHAR(20)
);

CREATE TABLE Books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    isbn VARCHAR(20) UNIQUE NOT NULL
);

-- 2. Normalization & Referential Integrity (Junction Table for M:N relationship)
CREATE TABLE Loans (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    book_id INT NOT NULL,
    loan_date DATE NOT NULL,
    loan_period_days INT NOT NULL CHECK (loan_period_days > 0),
    
    -- Explicit Foreign Keys enforcing Referential Integrity
    -- These ensure a loan cannot be created for a non-existent member or book
    FOREIGN KEY (member_id) REFERENCES Members(member_id),
    FOREIGN KEY (book_id) REFERENCES Books(book_id)
);

-- 3. Scalability Mindset (Performance Optimization)
-- Creating an index on frequently searched columns to speed up retrieval
CREATE INDEX idx_loan_date ON Loans(loan_date);
```

## 3. Quick Review

### The Design Pipeline
```text
Requirements -> Conceptual (ERD) -> Logical (Keys/Normalization) -> Physical (DBMS/SQL) -> Test -> Deploy
```

### Core Idea
**A reliable database design starts with business requirements, then moves through conceptual and logical models before physical implementation, testing, deployment, and maintenance.**