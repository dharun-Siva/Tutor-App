const express = require('express');
const router = express.Router();
const { pgClient } = require('../db');
const auth = require('../middleware/auth-postgres');

// Assign admin to center
router.post('/centers/:centerId/assign-admin', auth(['superadmin']), async (req, res) => {
    const { centerId } = req.params;
    const { adminId } = req.body;

    // Start a transaction
    await pgClient.query('BEGIN');

    try {
        // 1. Verify center exists
        const centerQuery = 'SELECT * FROM centers WHERE id = $1';
        const { rows: centers } = await pgClient.query(centerQuery, [centerId]);
        
        if (centers.length === 0) {
            await pgClient.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Center not found'
            });
        }

        // 2. Verify admin exists and is an admin
        const adminQuery = 'SELECT * FROM users WHERE id = $1 AND role = $2';
        const { rows: admins } = await pgClient.query(adminQuery, [adminId, 'admin']);
        
        if (admins.length === 0) {
            await pgClient.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Admin not found or user is not an admin'
            });
        }

        // 3. If center had a previous admin, clear their center_id
        const clearOldAdminQuery = `
            UPDATE users 
            SET center_id = NULL 
            WHERE id = (
                SELECT admin_id 
                FROM centers 
                WHERE id = $1 AND admin_id IS NOT NULL
            )
        `;
        await pgClient.query(clearOldAdminQuery, [centerId]);

        // 4. Update center with new admin
        const updateCenterQuery = 'UPDATE centers SET admin_id = $1 WHERE id = $2';
        await pgClient.query(updateCenterQuery, [adminId, centerId]);

        // 5. Update admin's center_id
        const updateAdminQuery = 'UPDATE users SET center_id = $1 WHERE id = $2';
        await pgClient.query(updateAdminQuery, [centerId, adminId]);

        // Commit transaction
        await pgClient.query('COMMIT');

        console.log(`✅ Successfully assigned admin ${adminId} to center ${centerId}`);
        
        res.json({
            success: true,
            message: 'Successfully assigned admin to center',
            data: {
                centerId,
                adminId
            }
        });

    } catch (error) {
        await pgClient.query('ROLLBACK');
        console.error('Error assigning admin to center:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign admin to center',
            error: error.message
        });
    }
});

module.exports = router;