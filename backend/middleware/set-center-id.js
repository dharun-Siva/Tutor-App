const { pgClient } = require('../db');

// Middleware to set center_id for new users based on the admin who creates them
const setCenterIdFromAdmin = async (req, res, next) => {
    try {
        // Get the admin user who is creating this new user
        const adminId = req.user.id;
        
        // Skip for admin users
        if (req.body.role === 'admin') {
            return next();
        }

        // Get the admin's center_id from the database
        const query = `
            SELECT center_id 
            FROM users 
            WHERE id = $1 AND role = 'admin'
        `;
        
        const { rows } = await pgClient.query(query, [adminId]);
        
        if (!rows || rows.length === 0 || !rows[0].center_id) {
            return res.status(400).json({
                success: false,
                message: 'Admin user does not have an associated center'
            });
        }

        // Set the center_id in the request body
        req.body.center_id = rows[0].center_id;
        
        // Log for debugging
        console.log(`Setting center_id ${rows[0].center_id} for new ${req.body.role}`);
        
        next();
    } catch (error) {
        console.error('Error in setCenterIdFromAdmin:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting center ID',
            error: error.message
        });
    }
};

module.exports = {
    setCenterIdFromAdmin
};