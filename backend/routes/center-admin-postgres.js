const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-postgres');
const { pgClient } = require('../db');

// Assign admin to center
router.post('/centers/:centerId/assign-admin', auth(['superadmin']), async (req, res) => {
    const { centerId } = req.params;
    const { adminId } = req.body;

    // Start a transaction
    await pgClient.query('BEGIN');

    try {
        // Verify the center exists
        const centerQuery = 'SELECT * FROM centers WHERE id = $1';
        const { rows: centers } = await pgClient.query(centerQuery, [centerId]);
        
        if (centers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Center not found'
            });
        }

        // Verify the admin exists and is actually an admin
        const adminQuery = 'SELECT * FROM users WHERE id = $1 AND role = $2';
        const { rows: admins } = await pgClient.query(adminQuery, [adminId, 'admin']);
        
        if (admins.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found or user is not an admin'
            });
        }

        // Update the center's admin_id
        const updateCenterQuery = 'UPDATE centers SET admin_id = $1 WHERE id = $2';
        await pgClient.query(updateCenterQuery, [adminId, centerId]);

        // Update the admin's center_id
        const updateAdminQuery = 'UPDATE users SET center_id = $1 WHERE id = $2';
        await pgClient.query(updateAdminQuery, [centerId, adminId]);

        // Commit the transaction
        await pgClient.query('COMMIT');

        console.log(`✅ Assigned admin ${adminId} to center ${centerId}`);

        res.json({
            success: true,
            message: 'Successfully assigned admin to center',
            data: {
                centerId,
                adminId
            }
        });

    } catch (error) {
        // Rollback in case of error
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