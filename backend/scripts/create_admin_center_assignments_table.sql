-- Migration script to create admin_center_assignments table
CREATE TABLE IF NOT EXISTS admin_center_assignments (
    id SERIAL PRIMARY KEY,
    adminid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    centerid INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example: Assign admin with id=1 to center with id=1
-- INSERT INTO admin_center_assignments (adminid, centerid) VALUES (1, 1);

-- To assign your admin, replace 1 with your actual admin and center IDs.
