-- 005a_drop_legacy_financial_remnants.sql
-- Pre-flight cleanup for databases that applied the experimental financial
-- migrations that have been removed from the project:
--   * 009_billing_payments.sql           -> payments table (FK to billing)
--   * 008_services_category_lab_link.sql -> services.category, lab_requests.service_id
-- Run this BEFORE 006_remove_financial_schema.sql. Every step checks
-- information_schema first, so it is safe on databases where those objects do
-- not exist (fresh setups using setup/schema.sql).

USE hospital_db;

DROP PROCEDURE IF EXISTS migrate_005a_drop_legacy_financial_remnants;

DELIMITER //

CREATE PROCEDURE migrate_005a_drop_legacy_financial_remnants()
BEGIN
    DECLARE v_name varchar(64);

    -- payments references billing, so it must go before 006 drops billing.
    IF EXISTS (SELECT 1 FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments') THEN
        DROP TABLE payments;
    END IF;

    -- experimental billing audit foreign key (created_by -> users) from
    -- 009_billing_payments.sql; the 006 dependency gate does not whitelist it.
    IF EXISTS (SELECT 1 FROM information_schema.TABLES
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing') THEN
        SET v_name = NULL;
        SELECT CONSTRAINT_NAME INTO v_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'billing'
          AND REFERENCED_TABLE_NAME = 'users'
        LIMIT 1;
        IF v_name IS NOT NULL THEN
            SET @s = CONCAT('ALTER TABLE billing DROP FOREIGN KEY `', v_name, '`');
            PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
        END IF;
    END IF;

    -- lab_requests.service_id (experimental lab<->service link)
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests' AND COLUMN_NAME = 'service_id') THEN
        SET v_name = NULL;
        SELECT CONSTRAINT_NAME INTO v_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests'
          AND COLUMN_NAME = 'service_id' AND REFERENCED_TABLE_NAME IS NOT NULL
        LIMIT 1;
        IF v_name IS NOT NULL THEN
            SET @s = CONCAT('ALTER TABLE lab_requests DROP FOREIGN KEY `', v_name, '`');
            PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
        END IF;

        SET v_name = NULL;
        SELECT INDEX_NAME INTO v_name
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lab_requests'
          AND COLUMN_NAME = 'service_id' AND INDEX_NAME <> 'PRIMARY'
        LIMIT 1;
        IF v_name IS NOT NULL THEN
            SET @s = CONCAT('ALTER TABLE lab_requests DROP KEY `', v_name, '`');
            PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
        END IF;

        ALTER TABLE lab_requests DROP COLUMN service_id;
    END IF;

    -- services.category (experimental lab filter)
    IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services' AND COLUMN_NAME = 'category') THEN
        SET v_name = NULL;
        SELECT INDEX_NAME INTO v_name
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services'
          AND COLUMN_NAME = 'category' AND INDEX_NAME <> 'PRIMARY'
        LIMIT 1;
        IF v_name IS NOT NULL THEN
            SET @s = CONCAT('ALTER TABLE services DROP KEY `', v_name, '`');
            PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
        END IF;

        ALTER TABLE services DROP COLUMN category;
    END IF;
END //

DELIMITER ;

CALL migrate_005a_drop_legacy_financial_remnants();
DROP PROCEDURE IF EXISTS migrate_005a_drop_legacy_financial_remnants;
