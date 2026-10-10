-- Migration 007: Enforce 1-to-1 cardinality for vital signs
--
-- The UI and API logic (consultation retrieval and appointment booking) assume a 1-to-1 
-- relationship between appointments and vital_signs (one triage reading per appointment).
-- However, the schema originally allowed multiple rows (1-to-many).
-- This migration enforces the uniqueness to prevent duplicate vital readings per appointment
-- and aligns the schema with the functional behavior and UI design.
--
-- PREREQUISITES AND SAFETY:
-- 1. This migration applies ONLY to legacy databases originally created from `migrations/hospital_db.sql`.
-- 2. Do NOT run this on fresh installs (via `setup/schema.sql`); they already contain the constraint and lack the `fk_vitals_appointment` index, so running this will fail.
-- 3. This migration expects the non-unique `fk_vitals_appointment` index to exist.
-- 4. If duplicate vital sign records already exist for the same appointment_id, the `ADD UNIQUE KEY` command will safely abort without deleting data. An administrator must manually deduplicate those rows before applying this migration.

ALTER TABLE vital_signs
    DROP INDEX fk_vitals_appointment,
    ADD UNIQUE KEY unique_appointment_vitals (appointment_id);
