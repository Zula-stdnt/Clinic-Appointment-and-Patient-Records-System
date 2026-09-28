# Database Design: Entity Relationship Diagrams (ERD)

## Related Lessons

- [[database_design_process]]
- [[04 Database Design/database_conceptual_to_logical_design]]
- [[04 Database Design/database_normalization]]

## 1. Lesson Summary

### Main Idea

An **Entity Relationship Diagram (ERD)** is a visual model used to describe data and relationships during conceptual or logical database design. It shows entities, attributes, and relationship cardinalities. The exact symbols depend on the notation being used; conceptual entities do not always map one-to-one to database tables.

### 1. Entities (Tables)

Entities are definable things, objects, or concepts within a system (e.g., Student, Book, Course). Think of them as nouns.

* **Standard Entity:** A standalone object (e.g., `Student`).
* **Weak Entity:** An entity that is entirely dependent on another entity to exist (e.g., a `Profile` cannot exist without a `Student`).

### 2. Attributes (Columns)

Attributes are the properties or characteristics that belong to an entity. 

* **Key Attribute:** Uniquely identifies a record (the Primary Key, like `Student_ID`).
* **Simple Attribute:** A basic data point that cannot be further subdivided (e.g., `Gender`).
* **Composite Attribute:** An attribute made of multiple components (e.g., `Name` divided into `First`, `Middle`, `Last`, or `Address` divided into `Street`, `City`).
* **Derived Attribute:** Data that is not physically stored in the database but calculated from other attributes (e.g., `Age` calculated from `Date of Birth`).

### 3. Relationships & Cardinality

Relationships signify how two entities interact. **Cardinality** defines the specific numerical constraints of that relationship using Crow's Foot notation:

* **One-to-One (1:1):** One instance links to exactly one other instance (e.g., Student to Profile).
* **One-to-Many (1:M):** One instance links to many instances (e.g., one Course taken by many Students).
* **Many-to-Many (M:N):** Many instances link to many instances (e.g., Students enrolling in Subjects).
* *Constraints can also specify optional/mandatory minimums (e.g., Zero or One, One and Only One, Zero or Many, One or Many).*

---

## 2. Modeling Methodology and Notation

ERD notation varies. Choose the notation required by the course or tool, identify it in a legend, and use its symbols consistently. Chen notation and Crow's Foot notation are common examples.

### Core Modeling Components

**Chen notation:** Entities are rectangles, attributes are ovals, and relationships are diamonds. Singular entity names are a useful naming convention, not a requirement of every notation.

* **Entities:** Represented as **rectangles** containing the name of the entity. These are always labeled as **nouns** and should be written in the **singular form** (e.g., 'Student', not 'Students'). 
* **Weak Entities:** Represented by **double-lined rectangles**, signaling an entity that cannot exist without a parent entity.
* **Attributes:** Represented as **ovals** (ellipses) connected to an entity by lines.

### Attribute Classifications & Styling

**In Chen notation:** Use text formatting and line styling within the ovals to denote attribute types.

* **Key Attributes:** Designated as the **primary key**, represented by an oval with the text **underlined**.
* **Simple Attributes:** Standard ovals for data points that cannot be further subdivided.
* **Composite Attributes:** Ovals connected to sub-components, representing data that is grouped.
* **Derived Attributes:** Represented by **dashed/dotted ovals**, indicating fields that are calculated and not physically stored.

### Relational Syntax

**Chen notation:** Relationships are often shown as diamonds between entities, with relationship names such as *enrolls in*.

**Crow's Foot notation:** Relationships are drawn as lines between entity boxes. Endpoint marks indicate whether participation is optional or mandatory and whether it is one or many; this notation generally does not use Chen-style relationship diamonds.

### Notation Comparison

```text
Chen:       [Entity] -- <Relationship> -- [Entity]
               |                            |
             (id)                         (name)

Crow's Foot: [Entity] |------o{ [Related Entity]
             one, mandatory   zero or many
```

### Structural Conventions

* Begin with a conceptual model, then add details as the design moves toward a logical schema.
* Keep diagrams readable, and include a legend when symbols or optionality could be unclear.
* Tools such as *draw.io* support different ERD styles; follow the selected tool's notation rather than mixing symbol systems.

---

## 3. Quick Review

### Visual Shape Dictionary

```
Chen rectangle      = Entity
Chen oval           = Attribute
Chen diamond        = Relationship
Crow's Foot marks   = Minimum/maximum cardinality at line endpoints
```

### Core Idea

**ERDs model entities, attributes, and relationships before implementation. Read each diagram using its stated notation, since Chen and Crow's Foot use different visual conventions.**