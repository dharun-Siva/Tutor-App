const express = require('express');
const router = express.Router();
const { pool, pgClient } = require('../db');
const auth = require('../middleware/auth-postgres');

// Define valid message types for different roles
const MESSAGE_TYPES = {
    ADMIN: ['general', 'announcement', 'reminder', 'alert'],
    PARENT: ['parent_inquiry']
};
const PRIORITIES = ['urgent', 'normal', 'info'];

// Get database client from pool
const getClient = async () => {
    return await pool.connect();
};

// Helper function to generate MongoDB-style ID
const generateId = () => {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    return timestamp + machineId + processId + counter;
};

// Send a message
router.post('/', auth, async (req, res) => {
    const client = await getClient();
    try {
        const { recipientId, title, content, priority, type, isBroadcast } = req.body;
        const senderId = req.user.id;
        const centerId = req.user.center_id;

        // Validate required fields
        if ((!recipientId && !isBroadcast) || !title || !content || !priority || !type) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate message type based on user role
        const validTypes = req.user.role === 'admin' ? MESSAGE_TYPES.ADMIN : MESSAGE_TYPES.PARENT;
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid message type. Allowed types for ${req.user.role}: ${validTypes.join(', ')}`
            });
        }
        
        // Convert type to lowercase to match database constraint
        const messageType = type.toLowerCase();

        if (isBroadcast) {
            // For broadcast messages, get all parent users in the center
            const parentsQuery = `
                SELECT id FROM users 
                WHERE role = 'parent' 
                AND center_id = $1
            `;
            const { rows: parents } = await client.query(parentsQuery, [centerId]);
            
            // Create a message for each parent
            for (const parent of parents) {
                const id = generateId().substring(0, 24); // Ensure ID is not longer than 24 chars
                await client.query(
                    `INSERT INTO messages (id, sender_id, recipient_id, center_id, title, content, is_broadcast, priority, type)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [id, senderId, parent.id, centerId, title, content, true, priority, type]
                );
            }
        } else {
            // For individual messages
            // For individual messages, ensure recipient exists
            const { rows: recipient } = await client.query(
                'SELECT id FROM users WHERE id = $1 AND role = $2',
                [recipientId, 'parent']
            );

            if (!recipient.length) {
                throw new Error('Invalid recipient');
            }

            const id = generateId().substring(0, 24); // Ensure ID is not longer than 24 chars
            await client.query(
                `INSERT INTO messages (id, sender_id, recipient_id, center_id, title, content, is_broadcast, priority, type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [id, senderId, recipientId, centerId, title, content, false, priority, type]
            );
        }

        res.json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    } finally {
        client.release();
    }
});

// Get messages for parent
router.get('/parent', auth(['parent']), async (req, res) => {
    const client = await getClient();
    try {
        const parentId = req.user.id;
        const { page = 1, limit = 20, priority, unreadOnly } = req.query;
        const offset = (page - 1) * limit;

        let queryParams = [parentId];
        let queryConditions = ['(m.recipient_id = $1 OR m.is_broadcast = true)'];

        if (priority) {
            queryParams.push(priority);
            queryConditions.push(`m.priority = $${queryParams.length}`);
        }

        if (unreadOnly === 'true') {
            queryConditions.push('m.is_read = false');
        }

        const query = `
            SELECT 
                m.*,
                sender.first_name as sender_first_name,
                sender.last_name as sender_last_name,
                sender.role as sender_role,
                sender.email as sender_email
            FROM messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE ${queryConditions.join(' AND ')}
            ORDER BY 
                CASE WHEN m.priority = 'urgent' THEN 1
                     WHEN m.priority = 'normal' THEN 2
                     ELSE 3 END,
                m.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
        `;

        const unreadCountQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
            AND m.is_read = false
        `;

        queryParams.push(limit, offset);

        const [messages, totalCount, unreadCount] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, queryParams.slice(0, -2)),
            client.query(unreadCountQuery, queryParams.slice(0, -2))
        ]);

        const totalMessages = parseInt(totalCount.rows[0].count);
        
        res.json({
            success: true,
            data: {
                messages: messages.rows.map(msg => ({
                    ...msg,
                    isReadByUser: msg.is_read,
                    senderId: {
                        _id: msg.sender_id,
                        firstName: msg.sender_first_name,
                        lastName: msg.sender_last_name,
                        email: msg.sender_email,
                        role: msg.sender_role
                    }
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMessages / limit),
                    totalMessages: totalMessages,
                    limit: parseInt(limit)
                },
                unreadCount: parseInt(unreadCount.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching parent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    } finally {
        client.release();
    }
});

// Parent sends a message to admin
router.post('/parent', auth(['parent']), async (req, res) => {
    const client = await getClient();
    try {
        const { title, content, priority = 'normal' } = req.body;
        const senderId = req.user.id;
        const centerId = req.user.center_id;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        // Find admin of the center
        const adminQuery = `
            SELECT id FROM users 
            WHERE role = 'admin' 
            AND center_id = $1 
            LIMIT 1
        `;
        const { rows: [admin] } = await client.query(adminQuery, [centerId]);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'No admin found for your center'
            });
        }

        // For parents, always set type as parent_inquiry
        const id = generateId();
        const type = 'parent_inquiry'; // Force parent_inquiry type for parents
        
        await client.query(`
            INSERT INTO messages (
                id, sender_id, recipient_id, center_id, title, content, 
                is_read, priority, type, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `, [id, senderId, admin.id, centerId, title, content, false, priority, type]);

        res.status(201).json({
            success: true,
            message: 'Message sent to admin successfully'
        });
    } catch (error) {
        console.error('Error sending parent message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Get messages for admin
router.get('/admin', auth(['admin', 'superadmin']), async (req, res) => {
    const client = await getClient();
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, priority, unreadOnly } = req.query;
        const offset = (page - 1) * limit;

        // Get total count of messages
        let countQuery = `
            SELECT COUNT(*) 
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            WHERE (m.recipient_id = $1 OR (m.recipient_id IS NULL AND m.center_id = $2))
            AND sender.role = 'parent'
        `;

        let queryParams = [userId, req.user.center_id];
        
        if (priority) {
            countQuery += ` AND m.priority = $3`;
            queryParams.push(priority);
        }

        const totalCount = await client.query(countQuery, queryParams);

        // Get unread count
        const unreadQuery = `
            SELECT COUNT(*) 
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            WHERE (m.recipient_id = $1 OR (m.recipient_id IS NULL AND m.center_id = $2))
            AND sender.role = 'parent'
            AND m.is_read = false
        `;

        const unreadCount = await client.query(unreadQuery, [userId, req.user.center_id]);

        // Main query for messages
        let query = `
            SELECT 
                m.*,
                sender.first_name as sender_first_name,
                sender.last_name as sender_last_name,
                sender.email as sender_email,
                sender.role as sender_role
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            WHERE (m.recipient_id = $1 OR (m.recipient_id IS NULL AND m.center_id = $2))
            AND sender.role = 'parent'
        `;

        queryParams = [userId, req.user.center_id];
        let paramCount = 2;

        if (priority) {
            paramCount++;
            query += ` AND m.priority = $${paramCount}`;
            queryParams.push(priority);
        }

        if (unreadOnly === 'true') {
            paramCount++;
            query += ` AND m.is_read = false`;
        }

        query += ` ORDER BY m.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        queryParams.push(limit, offset);

        const { rows: messages } = await client.query(query, queryParams);

        res.json({
            success: true,
            data: {
                messages: messages.map(msg => ({
                    ...msg,
                    senderId: {
                        _id: msg.sender_id,
                        firstName: msg.sender_first_name,
                        lastName: msg.sender_last_name,
                        email: msg.sender_email,
                        role: msg.sender_role
                    }
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount.rows[0].count / limit),
                    totalMessages: parseInt(totalCount.rows[0].count),
                    limit: parseInt(limit)
                },
                unreadCount: parseInt(unreadCount.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching admin messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin messages'
        });
    } finally {
        client.release();
    }
});

// Get messages for parent
router.get('/parent', auth(['parent']), async (req, res) => {
    const client = await getClient();
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, priority, unreadOnly, messageType } = req.query;
        const offset = (page - 1) * limit;

        let queryParams = [userId];
        let queryConditions = [];

        // If getting sent messages (My Inquiries)
        if (messageType === 'sent') {
            queryConditions.push('m.sender_id = $1 AND m.type = \'parent_inquiry\'');
        } else {
            // If getting received messages
            queryConditions.push('(m.recipient_id = $1 OR (m.recipient_id IS NULL AND m.center_id = $2))');
        }
        queryParams.push(req.user.center_id);

        if (priority) {
            queryParams.push(priority);
            queryConditions.push(`m.priority = $${queryParams.length}`);
        }

        if (unreadOnly === 'true') {
            queryConditions.push('m.is_read = false');
        }

        const query = `
            SELECT 
                m.*,
                sender.first_name as sender_first_name,
                sender.last_name as sender_last_name,
                sender.role as sender_role,
                sender.email as sender_email
            FROM messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE ${queryConditions.join(' AND ')}
            ORDER BY 
                CASE WHEN m.priority = 'urgent' THEN 1
                     WHEN m.priority = 'normal' THEN 2
                     ELSE 3 END,
                m.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
        `;

        const unreadCountQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
            AND m.is_read = false
        `;

        queryParams.push(limit, offset);

        const [messages, totalCount, unreadCount] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, queryParams.slice(0, -2)),
            client.query(unreadCountQuery, queryParams.slice(0, -2))
        ]);

        const totalMessages = parseInt(totalCount.rows[0].count);
        
        res.json({
            success: true,
            data: {
                messages: messages.rows.map(msg => ({
                    ...msg,
                    isReadByUser: msg.is_read,
                    senderId: {
                        _id: msg.sender_id,
                        firstName: msg.sender_first_name,
                        lastName: msg.sender_last_name,
                        email: msg.sender_email,
                        role: msg.sender_role
                    }
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMessages / limit),
                    totalMessages: totalMessages,
                    limit: parseInt(limit)
                },
                unreadCount: parseInt(unreadCount.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching parent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    } finally {
        client.release();
    }
});

// Get messages for a user
router.get('/', auth, async (req, res) => {
    const client = await getClient();
    try {
        const userId = req.user.id;
        const { isParentInquiries } = req.query;

        let query = `
            SELECT 
                m.*,
                sender.first_name as sender_first_name,
                sender.last_name as sender_last_name,
                sender.role as sender_role,
                recipient.first_name as recipient_first_name,
                recipient.last_name as recipient_last_name,
                recipient.role as recipient_role
            FROM messages m
            JOIN users sender ON m.sender_id = sender.id
            JOIN users recipient ON m.recipient_id = recipient.id
            WHERE (m.recipient_id = $1 OR m.sender_id = $1)
        `;

        // If viewing parent inquiries (for admin), filter messages from parents
        if (req.user.role === 'admin' && isParentInquiries === 'true') {
            query += ' AND sender.role = \'parent\'';
        }

        query += ' ORDER BY m.created_at DESC';

        const { rows: messages } = await client.query(query, [userId]);

        res.json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    } finally {
        client.release();
    }
});

// Mark message as read (allow both admin and parent to mark, with appropriate checks)
router.put('/:id/read', auth(['admin', 'parent', 'superadmin']), async (req, res) => {
    const client = await getClient();
    try {
        const messageId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;
        const centerId = req.user.center_id;

        // Fetch the message first
        const { rows: messageRows } = await client.query(`SELECT * FROM messages WHERE id = $1`, [messageId]);
        if (!messageRows || messageRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        const message = messageRows[0];

        // Authorization rules:
        // - Admin / Superadmin: may mark messages that belong to their center (center_id match)
        // - Parent: may mark messages where recipient_id equals their user id (individual messages only)
        if (userRole === 'admin' || userRole === 'superadmin') {
            if (!centerId || message.center_id !== centerId) {
                return res.status(403).json({ success: false, message: 'Not authorized to mark this message' });
            }
        } else if (userRole === 'parent') {
            // Parents can only mark messages specifically sent to them (recipient_id = userId)
            if (!message.recipient_id || message.recipient_id !== userId) {
                return res.status(403).json({ success: false, message: 'Parents can only mark their own messages as read' });
            }
        } else {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Update the message as read
        const updateQuery = `
            UPDATE messages
            SET is_read = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const { rows: updatedRows } = await client.query(updateQuery, [messageId]);

        if (!updatedRows || updatedRows.length === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update message' });
        }

        res.json({ success: true, message: 'Message marked as read', data: updatedRows[0] });

    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ success: false, message: 'Failed to mark message as read' });
    } finally {
        client.release();
    }
});

// Delete a message
router.delete('/:messageId', auth, async (req, res) => {
    const client = await getClient();
    try {
        const { messageId } = req.params;
        const userId = req.user.id;

        // Only sender or recipient can delete the message
        await client.query(
            `DELETE FROM messages 
             WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2)`,
            [messageId, userId]
        );

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message'
        });
    } finally {
        client.release();
    }
});

// Admin sends a message
router.post('/admin', auth(['admin', 'superadmin']), async (req, res) => {
    const client = await getClient();
    try {
        const { title, content, recipientId, type = 'general', priority = 'normal' } = req.body;
        const senderId = req.user.id;
        const centerId = req.user.center_id;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        if (recipientId) {
            // Send to specific recipient
            const id = generateId();
            await client.query(`
                INSERT INTO messages (
                    id, sender_id, recipient_id, center_id, title, content, 
                    is_read, priority, type, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            `, [id, senderId, recipientId, centerId, title, content, false, priority, type]);
        } else {
            // Broadcast to all parents in the center
            const parentsQuery = `
                SELECT id FROM users 
                WHERE role = 'parent' 
                AND center_id = $1
            `;
            const { rows: parents } = await client.query(parentsQuery, [centerId]);
            
            // Create a message for each parent
            for (const parent of parents) {
                const id = generateId();
                await client.query(`
                    INSERT INTO messages (
                        id, sender_id, recipient_id, center_id, title, content, 
                        is_read, priority, type, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                `, [id, senderId, parent.id, centerId, title, content, false, priority, type]);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Message sent successfully'
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Get admin's sent messages
router.get('/admin/sent', auth(['admin', 'superadmin']), async (req, res) => {
    const client = await getClient();
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, priority } = req.query;
        const offset = (page - 1) * limit;

        let queryParams = [userId];
        let queryConditions = ['m.sender_id = $1'];

        if (priority) {
            queryParams.push(priority);
            queryConditions.push(`m.priority = $${queryParams.length}`);
        }

        const query = `
            SELECT 
                m.*,
                recipient.first_name as recipient_first_name,
                recipient.last_name as recipient_last_name,
                recipient.email as recipient_email,
                recipient.role as recipient_role
            FROM messages m
            LEFT JOIN users recipient ON m.recipient_id = recipient.id
            WHERE ${queryConditions.join(' AND ')}
            ORDER BY m.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
        `;

        queryParams.push(limit, offset);

        const [messages, totalCount] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, queryParams.slice(0, -2))
        ]);

        const totalMessages = parseInt(totalCount.rows[0].count);
        
        res.json({
            success: true,
            data: {
                messages: messages.rows.map(msg => ({
                    ...msg,
                    recipientId: msg.recipient_id ? {
                        _id: msg.recipient_id,
                        firstName: msg.recipient_first_name,
                        lastName: msg.recipient_last_name,
                        email: msg.recipient_email,
                        role: msg.recipient_role
                    } : null
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMessages / limit),
                    totalMessages: totalMessages,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching sent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sent messages'
        });
    } finally {
        client.release();
    }
});

// Get messages for parent (sent messages)
router.get('/parent/sent', auth(['parent']), async (req, res) => {
    const client = await getClient();
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, priority } = req.query;
        const offset = (page - 1) * limit;

        let queryParams = [userId];
        let queryConditions = ['m.sender_id = $1 AND m.type = \'parent_inquiry\''];

        if (priority) {
            queryParams.push(priority);
            queryConditions.push(`m.priority = $${queryParams.length}`);
        }

        const query = `
            SELECT 
                m.*,
                recipient.first_name as recipient_first_name,
                recipient.last_name as recipient_last_name,
                recipient.email as recipient_email,
                recipient.role as recipient_role
            FROM messages m
            LEFT JOIN users recipient ON m.recipient_id = recipient.id
            WHERE ${queryConditions.join(' AND ')}
            ORDER BY m.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
        `;

        queryParams.push(limit, offset);

        const [messages, totalCount] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, queryParams.slice(0, -2))
        ]);

        const totalMessages = parseInt(totalCount.rows[0].count);
        
        res.json({
            success: true,
            data: {
                messages: messages.rows.map(msg => ({
                    ...msg,
                    recipientId: msg.recipient_id ? {
                        _id: msg.recipient_id,
                        firstName: msg.recipient_first_name,
                        lastName: msg.recipient_last_name,
                        email: msg.recipient_email,
                        role: msg.recipient_role
                    } : null
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMessages / limit),
                    totalMessages: totalMessages,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Error fetching sent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sent messages'
        });
    } finally {
        client.release();
    }
});

// Get messages for parent (received messages)
router.get('/parent', auth(['parent']), async (req, res) => {
    const client = await getClient();
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, priority, unreadOnly } = req.query;
        const offset = (page - 1) * limit;

        let queryParams = [userId];
        let queryConditions = ['(m.recipient_id = $1 OR (m.recipient_id IS NULL AND m.center_id = $2))'];
        queryParams.push(req.user.center_id);

        if (priority) {
            queryParams.push(priority);
            queryConditions.push(`m.priority = $${queryParams.length}`);
        }

        if (unreadOnly === 'true') {
            queryConditions.push('m.is_read = false');
        }

        const query = `
            SELECT 
                m.*,
                sender.first_name as sender_first_name,
                sender.last_name as sender_last_name,
                sender.role as sender_role,
                sender.email as sender_email
            FROM messages m
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE ${queryConditions.join(' AND ')}
            ORDER BY 
                CASE WHEN m.priority = 'urgent' THEN 1
                     WHEN m.priority = 'normal' THEN 2
                     ELSE 3 END,
                m.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const countQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
        `;

        const unreadCountQuery = `
            SELECT COUNT(*) 
            FROM messages m
            WHERE ${queryConditions.join(' AND ')}
            AND m.is_read = false
        `;

        queryParams.push(limit, offset);

        const [messages, totalCount, unreadCount] = await Promise.all([
            client.query(query, queryParams),
            client.query(countQuery, queryParams.slice(0, -2)),
            client.query(unreadCountQuery, queryParams.slice(0, -2))
        ]);

        const totalMessages = parseInt(totalCount.rows[0].count);
        
        res.json({
            success: true,
            data: {
                messages: messages.rows.map(msg => ({
                    ...msg,
                    isReadByUser: msg.is_read,
                    senderId: {
                        _id: msg.sender_id,
                        firstName: msg.sender_first_name,
                        lastName: msg.sender_last_name,
                        email: msg.sender_email,
                        role: msg.sender_role
                    }
                })),
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalMessages / limit),
                    totalMessages: totalMessages,
                    limit: parseInt(limit)
                },
                unreadCount: parseInt(unreadCount.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    } finally {
        client.release();
    }
});

// Mark message as read
router.put('/:id/read', auth(['admin', 'parent']), async (req, res) => {
    const client = await getClient();
    try {
        const messageId = req.params.id;
        const userId = req.user.id;
        const centerId = req.user.center_id;

        // Update message as read for either direct messages or broadcast messages
        const updateQuery = `
            UPDATE messages 
            SET is_read = true 
            WHERE id = $1 
            AND (recipient_id = $2 OR (recipient_id IS NULL AND center_id = $3))
            RETURNING *
        `;
        
        const { rows } = await client.query(updateQuery, [messageId, userId, centerId]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found or not authorized'
            });
        }

        res.json({
            success: true,
            message: 'Message marked as read',
            data: rows[0]
        });
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark message as read'
        });
    } finally {
        client.release();
    }
});

module.exports = router;
