-- 006_remove_financial_schema.sql
-- Purpose: Remove all financial data, columns, and tables to transition to a pure Patient Information System.
-- WARNING: DDL commands (DROP, ALTER) cannot be rolled back in MySQL/MariaDB.
-- If this script fails mid-execution (e.g. unknown column), it will leave partial schema changes.
-- A full database backup MUST be created before running this script.

-- 1. Database Safety Guard
-- Explicitly bind execution to hospital_db to prevent accidentally altering another database.
USE hospital_db;

-- Clean up any leftover procedure from a previously aborted run
DROP PROCEDURE IF EXISTS migrate_006_remove_financials;

DELIMITER //

CREATE PROCEDURE migrate_006_remove_financials()
BEGIN
    DECLARE v_missing_schema INT DEFAULT 0;
    DECLARE v_unexpected_deps INT DEFAULT 0;
    DECLARE v_cashier_count INT DEFAULT 0;

    -- 2. Complete Schema-Baseline Gate
    -- Verifies every required table and exact column used by this migration matches perfectly.
    SELECT COUNT(*) INTO v_missing_schema
    FROM (
        SELECT 'billing' AS tbl, 'invoice_id' AS col UNION ALL
        SELECT 'invoice_items', 'invoice_item_id' UNION ALL
        SELECT 'discounts', 'discount_id' UNION ALL
        SELECT 'roles', 'role_name' UNION ALL
        SELECT 'roles', 'role_id' UNION ALL
        SELECT 'users', 'user_id' UNION ALL
        SELECT 'users', 'role_id' UNION ALL
        SELECT 'users', 'username' UNION ALL
        SELECT 'services', 'price' UNION ALL
        SELECT 'medications', 'unit_price'
    ) AS req
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = req.tbl AND COLUMN_NAME = req.col
    );

    IF v_missing_schema > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ABORTED: Baseline verification failed. A required table or column is missing.';
    END IF;

    -- 3. Strict Dependency Gate
    -- Prevents execution if unexpected clinical or custom tables depend on financial catalogs.
    SELECT COUNT(*) INTO v_unexpected_deps
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE REFERENCED_TABLE_SCHEMA = DATABASE() 
      AND (
          REFERENCED_TABLE_NAME IN ('billing', 'invoice_items', 'discounts', 'services')
          OR TABLE_NAME IN ('billing', 'invoice_items', 'discounts')
      )
      AND NOT (TABLE_NAME = 'invoice_items' AND REFERENCED_TABLE_NAME = 'billing')
      AND NOT (TABLE_NAME = 'invoice_items' AND REFERENCED_TABLE_NAME = 'services')
      AND NOT (TABLE_NAME = 'billing' AND REFERENCED_TABLE_NAME = 'discounts')
      AND NOT (TABLE_NAME = 'billing' AND REFERENCED_TABLE_NAME = 'consultation')
      AND NOT (TABLE_NAME = 'billing' AND REFERENCED_TABLE_NAME = 'patients');

    IF v_unexpected_deps > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ABORTED: Unexpected foreign key dependencies detected. Owner review required.';
    END IF;

    -- 4. Cashier Dependency Gate
    -- Ensure no users rely on the Cashier role before proceeding with destructive changes.
    SELECT COUNT(*) INTO v_cashier_count 
    FROM users u
    JOIN roles r ON u.role_id = r.role_id
    WHERE r.role_name = 'Cashier';

    IF v_cashier_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ABORTED: Users are still assigned to the Cashier role. Owner decision required.';
    END IF;

    -- DESTRUCTIVE DDL SECTION
    -- If execution reaches this point, the baseline and dependencies are perfectly validated.

    -- 5. Safely eliminate Cashier role
    DELETE FROM roles WHERE role_name = 'Cashier';

    -- 6. Drop dependent financial tables in strict dependency order
    DROP TABLE invoice_items;
    DROP TABLE billing;
    DROP TABLE discounts;

    -- 7. Preserve catalogs but drop financial columns
    ALTER TABLE medications DROP COLUMN unit_price;
    ALTER TABLE services DROP COLUMN price;

END //

DELIMITER ;

CALL migrate_006_remove_financials();
DROP PROCEDURE IF EXISTS migrate_006_remove_financials;
