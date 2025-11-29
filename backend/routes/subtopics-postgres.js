const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');
const auth = require('../middleware/auth-postgres');
const crypto = require('crypto');

// Helper function to generate MongoDB-style ObjectId
function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = crypto.randomBytes(8).toString('hex');
    return (timestamp + random).toLowerCase();
}

// Helper function to parse pagination and sorting parameters
const getPaginationParams = (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortField = query.sortField || 'subtopic_name';
    const sortDirection = (query.sortDirection || 'asc').toUpperCase();
    return { limit, offset, sortField, sortDirection };
};

// GET /api/dashboard/admin/subtopics - Get all subtopics with topic info
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { search } = req.query;
        const { limit, offset, sortField, sortDirection } = getPaginationParams(req.query);

        // Build base query with joins
        const baseQuery = `
            FROM subtopics s
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN subjects sub ON t.subject_id = sub.id
            LEFT JOIN grades g ON sub."gradeId"::varchar = g.id::varchar
            WHERE s.center_id = :centerId`;

        const whereClause = search 
            ? ` AND (s.subtopic_name ILIKE :search 
                OR t.topic_name ILIKE :search
                OR sub."subjectName" ILIKE :search
                OR g.grade_name ILIKE :search)`
            : '';

        // Count total records
        const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
        const countResult = await sequelize.query(countQuery, {
            replacements: { 
                search: search ? `%${search}%` : null,
                centerId: req.user.center_id
            },
            type: Sequelize.QueryTypes.SELECT
        });

        // Determine valid sort field and direction
        const validSortFields = ['subtopic_name', 'created_at'];
        const safeSortField = validSortFields.includes(sortField) ? sortField : 'subtopic_name';
        const safeSortDir = ['ASC', 'DESC'].includes(sortDirection) ? sortDirection : 'ASC';

        // Get paginated data
        const dataQuery = `
            SELECT 
                s.id,
                s.subtopic_name as "subtopicName",
                s.topic_id as "topicId",
                t.topic_name as "topicName",
                t.subject_id as "subjectId",
                sub."subjectName",
                sub."gradeId",
                g.id as "gradeId",
                g.grade_name as "gradeName",
                s.created_at as "createdAt",
                s.updated_at as "updatedAt"
            ${baseQuery}
            ${whereClause}
            ORDER BY s.${safeSortField} ${safeSortDir}
            LIMIT :limit OFFSET :offset`;

        const subtopics = await sequelize.query(dataQuery, {
            replacements: { 
                search: search ? `%${search}%` : null,
                centerId: req.user.center_id,
                limit,
                offset
            },
            type: Sequelize.QueryTypes.SELECT
        });

        // Calculate pagination info
        const total = parseInt(countResult[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            subtopics,
            total,
            page: Math.floor(offset / limit) + 1,
            limit
        });
    } catch (error) {
        console.error('Error fetching subtopics:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching subtopics'
        });
    }
});

// POST /api/dashboard/admin/subtopics - Create a new subtopic
router.post('/', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { subtopic_name, topic_id } = req.body;
        
        console.log('Creating subtopic:', {
            subtopic_name,
            topic_id,
            center_id: req.user.center_id
        });

        // Validation
        if (!subtopic_name || !topic_id || topic_id === 'undefined' || topic_id === 'null') {
            return res.status(400).json({
                success: false,
                message: 'Subtopic name and topic are required'
            });
        }

        // Check for duplicate subtopic name within the same topic and center
        const existingSubtopic = await sequelize.query(
            `SELECT id FROM subtopics 
             WHERE subtopic_name = :subtopicName 
             AND topic_id = :topicId 
             AND center_id = :centerId`,
            {
                replacements: {
                    subtopicName: subtopic_name.trim(),
                    topicId: topic_id,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (existingSubtopic.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Subtopic name already exists for this topic'
            });
        }

        // Create new subtopic
        const id = generateObjectId();
        await sequelize.query(
            `INSERT INTO subtopics (id, subtopic_name, topic_id, center_id, created_at, updated_at)
             VALUES (:id, :subtopicName, :topicId, :centerId, NOW(), NOW())
             RETURNING id, subtopic_name as "subtopicName", topic_id as "topicId", 
                       created_at as "createdAt", updated_at as "updatedAt"`,
            {
                replacements: {
                    id,
                    subtopicName: subtopic_name.trim(),
                    topicId: topic_id,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        // Get the created subtopic with topic info
        const [subtopic] = await sequelize.query(
            `SELECT 
                s.id,
                s.subtopic_name as "subtopicName",
                s.topic_id as "topicId",
                t.topic_name as "topicName",
                t.subject_id as "subjectId",
                sub."subjectName",
                s.created_at as "createdAt",
                s.updated_at as "updatedAt"
            FROM subtopics s
            LEFT JOIN topics t ON s.topic_id = t.id
            LEFT JOIN subjects sub ON t.subject_id = sub.id
            WHERE s.id = :id`,
            {
                replacements: { id },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        res.status(201).json({
            success: true,
            subtopic
        });
    } catch (error) {
        console.error('Error creating subtopic:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating subtopic'
        });
    }
});

// DELETE /api/dashboard/admin/subtopics/:id - Delete a subtopic
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if subtopic exists and belongs to the center
        const [subtopic] = await sequelize.query(
            `SELECT id FROM subtopics 
             WHERE id = :id AND center_id = :centerId`,
            {
                replacements: {
                    id,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (!subtopic) {
            return res.status(404).json({
                success: false,
                message: 'Subtopic not found or not authorized'
            });
        }

        // Start a transaction
        const transaction = await sequelize.transaction();

        try {
            // Step 1: Delete all homeworks for this subtopic
            await sequelize.query(
                `DELETE FROM homeworks WHERE "subtopicId" = :id`,
                {
                    replacements: { id },
                    type: Sequelize.QueryTypes.DELETE,
                    transaction
                }
            );

            // Step 2: Delete the subtopic
            await sequelize.query(
                `DELETE FROM subtopics WHERE id = :id AND center_id = :centerId`,
                {
                    replacements: {
                        id,
                        centerId: req.user.center_id
                    },
                    type: Sequelize.QueryTypes.DELETE,
                    transaction
                }
            );

            await transaction.commit();
            res.json({
                success: true,
                message: 'Subtopic and all related homeworks deleted successfully'
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error deleting subtopic:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting subtopic'
        });
    }
});

module.exports = router;