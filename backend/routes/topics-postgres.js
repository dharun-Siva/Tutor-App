const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');
const Topic = require('../models/Topic.postgres');
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
    const sortField = query.sortField || 'topic_name';
    const sortDirection = (query.sortDirection || 'asc').toUpperCase();
    return { limit, offset, sortField, sortDirection };
};

// GET /api/dashboard/admin/topics - Get all topics with subject and grade info
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { search } = req.query;
        const { limit, offset, sortField, sortDirection } = getPaginationParams(req.query);

        // Build base query with joins
        const baseQuery = `
            FROM topics t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN grades g ON s."gradeId"::varchar = g.id::varchar
            WHERE t.center_id = :centerId`;

        const whereClause = search 
            ? ` AND (t.topic_name ILIKE :search 
                OR s."subjectName" ILIKE :search
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
        const validSortFields = ['topic_name', 'created_at'];
        const safeSortField = validSortFields.includes(sortField) ? sortField : 'topic_name';
        const safeSortDir = ['ASC', 'DESC'].includes(sortDirection) ? sortDirection : 'ASC';

        // Get paginated data
        const dataQuery = `
            SELECT 
                t.id,
                t.topic_name as "topicName",
                t.subject_id as "subjectId",
                s.id as "subjectId",
                s."subjectName",
                s."gradeId",
                g.id as "gradeId",
                g.grade_name as "gradeName",
                t.created_at as "createdAt",
                t.updated_at as "updatedAt"
            FROM topics t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN grades g ON s."gradeId" = g.id
            WHERE t.center_id = :centerId
            ${whereClause}
            ORDER BY t.${safeSortField} ${safeSortDir}
            LIMIT :limit OFFSET :offset`;

        const topics = await sequelize.query(dataQuery, {
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
            topics,
            total,
            page: Math.floor(offset / limit) + 1,
            limit
        });
    } catch (error) {
        console.error('Error fetching topics:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching topics'
        });
    }
});

// POST /api/dashboard/admin/topics - Create a new topic
router.post('/', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { topicName, subjectId } = req.body;

        // Validation
        if (!topicName || !subjectId || subjectId === 'undefined' || subjectId === 'null') {
            return res.status(400).json({
                success: false,
                message: 'Topic name and subject are required'
            });
        }

        // Check for duplicate topic name within the same subject and center
        const existingTopic = await sequelize.query(
            `SELECT id FROM topics 
             WHERE topic_name = :topicName 
             AND subject_id = :subjectId 
             AND center_id = :centerId`,
            {
                replacements: {
                    topicName: topicName.trim(),
                    subjectId,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (existingTopic.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Topic name already exists for this subject'
            });
        }

        // Create new topic
        const topic = await sequelize.query(
            `INSERT INTO topics (id, topic_name, subject_id, center_id)
             VALUES (:id, :topicName, :subjectId, :centerId)
             RETURNING id, topic_name as "topicName", subject_id as "subjectId", 
                      center_id as "centerId", created_at as "createdAt"`,
            {
                replacements: {
                    id: generateObjectId(),
                    topicName: topicName.trim(),
                    subjectId,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.INSERT
            }
        );

        // Get full topic data with subject and grade info
        const fullTopic = await sequelize.query(
            `SELECT 
                t.id,
                t.topic_name as "topicName",
                t.subject_id as "subjectId",
                s."subjectName" as "subjectName",
                s."gradeId" as "gradeId",
                g.grade_name as "gradeName",
                t.created_at as "createdAt",
                t.updated_at as "updatedAt"
             FROM topics t
             LEFT JOIN subjects s ON t.subject_id = s.id
             LEFT JOIN grades g ON CAST(s."gradeId" AS VARCHAR) = CAST(g.id AS VARCHAR)
             WHERE t.id = :topicId`,
            {
                replacements: { topicId: topic[0][0].id },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        res.status(201).json({
            success: true,
            message: 'Topic created successfully',
            topic: fullTopic[0]
        });
    } catch (error) {
        console.error('Error creating topic:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating topic'
        });
    }
});

// PUT /api/dashboard/admin/topics/:id - Update a topic
router.put('/:id', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { topicName, subjectId } = req.body;
        const topicId = req.params.id;

        // Validation
        if (!topicName || !subjectId || subjectId === 'undefined' || subjectId === 'null') {
            return res.status(400).json({
                success: false,
                message: 'Topic name and subject are required'
            });
        }

        // Check if topic exists and belongs to admin's center
        const topic = await sequelize.query(
            `SELECT id FROM topics 
             WHERE id = :topicId AND center_id = :centerId`,
            {
                replacements: {
                    topicId,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (!topic.length) {
            return res.status(404).json({
                success: false,
                message: 'Topic not found'
            });
        }

        // Check for duplicate topic name within the same subject and center
        const existingTopic = await sequelize.query(
            `SELECT id FROM topics 
             WHERE topic_name = :topicName 
             AND subject_id = :subjectId 
             AND center_id = :centerId
             AND id != :topicId`,
            {
                replacements: {
                    topicName: topicName.trim(),
                    subjectId,
                    centerId: req.user.center_id,
                    topicId
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (existingTopic.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Topic name already exists for this subject'
            });
        }

        // Update topic
        await sequelize.query(
            `UPDATE topics 
             SET topic_name = :topicName, 
                 subject_id = :subjectId,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :topicId AND center_id = :centerId`,
            {
                replacements: {
                    topicName: topicName.trim(),
                    subjectId,
                    topicId,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.UPDATE
            }
        );

        // Get updated topic data
        const updatedTopic = await sequelize.query(
            `SELECT 
                t.id,
                t.topic_name as "topicName",
                t.subject_id as "subjectId",
                s."subjectName" as "subjectName",
                s."gradeId" as "gradeId",
                g.grade_name as "gradeName",
                t.created_at as "createdAt",
                t.updated_at as "updatedAt"
             FROM topics t
             LEFT JOIN subjects s ON t.subject_id = s.id
             LEFT JOIN grades g ON CAST(s."gradeId" AS VARCHAR) = CAST(g.id AS VARCHAR)
             WHERE t.id = :topicId`,
            {
                replacements: { topicId },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        res.json({
            success: true,
            message: 'Topic updated successfully',
            topic: updatedTopic[0]
        });
    } catch (error) {
        console.error('Error updating topic:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating topic'
        });
    }
});

// DELETE /api/dashboard/admin/topics/:id - Delete a topic
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
    try {
        const { id } = req.params;

        // Check if topic exists and belongs to the center
        const [topic] = await sequelize.query(
            `SELECT id FROM topics 
             WHERE id = :id AND center_id = :centerId`,
            {
                replacements: {
                    id,
                    centerId: req.user.center_id
                },
                type: Sequelize.QueryTypes.SELECT
            }
        );

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Topic not found or not authorized'
            });
        }

        // Start a transaction
        const transaction = await sequelize.transaction();

        try {
            // Step 1: Find all subtopics for this topic
            const subtopics = await sequelize.query(
                `SELECT id FROM subtopics WHERE topic_id = :id`,
                {
                    replacements: { id },
                    type: Sequelize.QueryTypes.SELECT,
                    transaction
                }
            );

            const subtopicIds = subtopics.map(st => st.id);

            if (subtopicIds.length > 0) {
                // Step 2: Delete all homeworks for these subtopics
                await sequelize.query(
                    `DELETE FROM homeworks WHERE "subtopicId" IN (:subtopicIds)`,
                    {
                        replacements: { subtopicIds },
                        type: Sequelize.QueryTypes.DELETE,
                        transaction
                    }
                );

                // Step 3: Delete all subtopics
                await sequelize.query(
                    `DELETE FROM subtopics WHERE topic_id = :id`,
                    {
                        replacements: { id },
                        type: Sequelize.QueryTypes.DELETE,
                        transaction
                    }
                );
            }

            // Step 4: Delete the topic
            await sequelize.query(
                `DELETE FROM topics WHERE id = :id AND center_id = :centerId`,
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
                message: 'Topic and all related subtopics and homeworks deleted successfully'
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error deleting topic:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting topic'
        });
    }
});

module.exports = router;