-- Migration: Remove admin_center_assignments join table and ensure center_id exists in User table

-- 1. Drop the join table if it exists
DROP TABLE IF EXISTS admin_center_assignments;

-- 2. Add center_id to User table if not present
ALTER TABLE users
ADD COLUMN IF NOT EXISTS center_id INTEGER REFERENCES centers(id);

-- 3. (Optional) If you want to enforce one-to-one, add a unique constraint for admin users
-- This assumes 'role' column exists and 'admin' is the value for admin users
-- Uncomment if you want strict enforcement:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_center ON users(center_id) WHERE role = 'admin';

-- 4. (Optional) Remove any old data or references to join table in code/models
-- Manual cleanup may be needed in Sequelize models and associations.
