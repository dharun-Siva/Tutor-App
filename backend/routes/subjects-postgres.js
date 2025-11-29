const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');
const authMiddleware = require('../middleware/auth-postgres');
const crypto = require('crypto');

// Generate MongoDB-style ObjectId (24 hex chars): 4-byte timestamp + 8 random bytes
function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = crypto.randomBytes(8).toString('hex'); // 16 hex chars
    return (timestamp + random).toLowerCase();
}

// Helper function to parse pagination and sorting parameters
const getPaginationParams = (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const offset = (page - 1) * limit;
    const sortField = query.sortField || 'subjectName';
    const sortDirection = (query.sortDirection || 'asc').toUpperCase();
    return { limit, offset, sortField, sortDirection };
};

// GET /api/dashboard/admin/subjects - Get all subjects with grade names
router.get('/', authMiddleware(['admin']), async (req, res) => {
    try {
        console.log('GET /subjects request from user:', {
            userId: req.user.id,
            centerId: req.user.center_id,
            role: req.user.role
        });
        
        const { search, all } = req.query;
        
        // If all=true, return all subjects without pagination
        if (all === 'true') {
            console.log('Fetching all subjects with grade info');
            console.log('Current user center_id:', req.user.center_id);
            
            const query = `
                SELECT 
                    s.id,
                    s."subjectCode",
                    s."subjectName",
                    g.grade_name,
                    g.id as "gradeId",
                    s."centerId",
                    s."createdAt",
                    s."gradeId" as "grade_ref"
                FROM subjects s
                INNER JOIN grades g ON s."gradeId" = g.id
                WHERE s."centerId" = :center_id
                ORDER BY g.grade_name ASC, s."subjectName" ASC`;
                
            console.log('Query:', query);

            console.log('Executing query with center_id:', req.user.center_id);

            const subjects = await sequelize.query(query, {
                type: Sequelize.QueryTypes.SELECT,
                replacements: { center_id: req.user.center_id }
            });

            console.log('Found subjects:', subjects);

            console.log('Raw subjects from DB:', subjects);
            
            // Transform data to match frontend expectations
            const formattedSubjects = subjects.map(subject => ({
                _id: subject.id, // Use _id for frontend mapping
                subjectCode: subject.subjectcode,
                subjectName: subject.subjectname,
                gradeId: subject.gradeid || subject.grade_ref,  // handle both column names
                gradeName: subject.grade_name,
                centerId: subject.centerid,
                createdAt: subject.createdat
            }));
            
            // Debug log to check the data
            console.log('Original DB subject:', subjects[0]);
            console.log('Formatted subject:', formattedSubjects[0]);
            
            console.log('Formatted subjects for frontend:', formattedSubjects);
            
            // Structure the response exactly as frontend expects
            return res.json({
                status: 'success',
                data: formattedSubjects,
                message: 'Subjects retrieved successfully'
            });
        }

        const { limit, offset, sortField, sortDirection } = getPaginationParams(req.query);

        // Build queries
        const baseQuery = `
            FROM subjects s
            LEFT JOIN grades g ON s."gradeId" = g.id
            WHERE s."centerId" = :center_id`;

        const whereClause = search 
            ? ` AND (s."subjectCode" ILIKE :search 
                OR s."subjectName" ILIKE :search
                OR g.grade_name ILIKE :search)`
            : '';

        // Count total records
        const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
        const countResult = await sequelize.query(countQuery, {
            replacements: { 
                search: search ? `%${search}%` : null,
                center_id: req.user.center_id 
            },
            type: Sequelize.QueryTypes.SELECT
        });

        // Determine valid sort field and direction
        const validSortFields = ['subjectCode', 'subjectName'];
        const safeSortField = validSortFields.includes(sortField) ? sortField : 'subjectName';
        const safeSortDir = ['ASC', 'DESC'].includes(sortDirection) ? sortDirection : 'ASC';

        // Get paginated data
        const dataQuery = `
            SELECT 
                s.id,
                s."subjectCode",
                s."subjectName",
                g.grade_name as "gradeName",
                g.id as "gradeId",
                s."centerId",
                s."createdAt",
                s."updatedAt"
            ${baseQuery}
            ${whereClause}
            ORDER BY g.grade_name ASC, s."${safeSortField}" ${safeSortDir}
            LIMIT :limit OFFSET :offset`;

        console.log('Executing subject query:', {
            query: dataQuery,
            center_id: req.user.center_id
        });

        const subjects = await sequelize.query(dataQuery, {
            replacements: { 
                search: search ? `%${search}%` : null,
                center_id: req.user.center_id,
                limit,
                offset
            },
            type: Sequelize.QueryTypes.SELECT
        });

        // Calculate pagination info
        const total = parseInt(countResult[0].total);
        const totalPages = Math.ceil(total / limit);

        // Transform the results
            const mappedSubjects = subjects.map(subject => ({
                _id: subject.id, // Use _id for frontend mapping
                subjectCode: subject.subjectCode,
                subjectName: subject.subjectName,
                gradeId: subject.gradeId,
                gradeName: subject.gradeName,
                centerId: subject.centerId,
                createdAt: subject.createdAt
            }));

        res.json({
            success: true,
            data: mappedSubjects,
            pagination: {
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: Math.floor(offset / limit) + 1,
                perPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/dashboard/admin/subjects - Create a new subject
router.post('/', authMiddleware(['admin']), async (req, res) => {
    try {
        // Detailed debug logging
        console.log('=== Subject Creation Debug ===');
        console.log('Request body:', req.body);
        console.log('User:', { id: req.user.id, center_id: req.user.center_id, role: req.user.role });

        const { subjectCode, subjectName, gradeId } = req.body;
        const center_id = req.user.center_id;

        // Validate required fields
        if (!subjectCode || !subjectName || !gradeId) {
            return res.status(400).json({ error: 'Subject code, name, and grade are required' });
        }

        if (!center_id) {
            return res.status(400).json({ error: 'Admin must be associated with a center' });
        }

        console.log('Checking grade with:', { gradeId, center_id });

        // Check if grade exists and belongs to the center
        const gradeExists = await sequelize.query(`
            SELECT id, grade_name, grade_code
            FROM grades 
            WHERE (id = :gradeId OR grade_name = :gradeId OR grade_code = :gradeId)
            AND center_id = :center_id
        `, {
            replacements: { gradeId, center_id },
            type: Sequelize.QueryTypes.SELECT
        });

        console.log('Grade check result:', gradeExists);

        if (!gradeExists.length) {
            return res.status(400).json({ error: 'Invalid grade or grade does not belong to your center' });
        }

        // Use the actual grade ID from the database
        const actualGradeId = gradeExists[0].id;

        // Check if subject code already exists in this center and grade
        const existingSubject = await sequelize.query(`
            SELECT id 
            FROM subjects 
            WHERE "subjectCode" = :subjectCode 
            AND "gradeId" = :actualGradeId 
            AND "centerId" = :center_id
        `, {
            replacements: { 
                subjectCode,
                actualGradeId, 
                center_id 
            },
            type: Sequelize.QueryTypes.SELECT
        });

        console.log('Existing subject check:', {
            subjectCode,
            actualGradeId,
            center_id,
            exists: existingSubject.length > 0
        });

        if (existingSubject.length) {
            return res.status(400).json({ error: 'Subject code already exists for this grade in your center' });
        }

        // Debug log
        console.log('Inserting subject with values:', {
            subjectCode,
            subjectName,
            actualGradeId,
            center_id
        });

        const newId = generateObjectId();

        // Insert new subject
        console.log('Inserting new subject:', {
            subjectCode,
            subjectName,
            gradeId: actualGradeId,
            centerId: center_id
        });

        const result = await sequelize.query(`
            INSERT INTO subjects (
                id,
                "subjectCode",
                "subjectName",
                "gradeId",
                "centerId",
                "createdAt",
                "updatedAt"
            ) VALUES (
                :id,
                :subjectCode,
                :subjectName,
                :gradeId,
                :centerId,
                NOW(),
                NOW()
            ) RETURNING *
        `, {
            replacements: {
                id: newId,
                subjectCode,
                subjectName,
                gradeId: actualGradeId,
                centerId: center_id
            },
            type: Sequelize.QueryTypes.INSERT
        });

        // Debug log
        console.log('Query result:', result);

        if (!result || !result[0] || !result[0][0]) {
            console.error('No result returned from insert query');
            return res.status(500).json({ error: 'Failed to create subject' });
        }

        res.status(201).json(result[0][0]);
    } catch (error) {
        console.error('Error creating subject:', error);
        
        // Send more specific error message
        const errorMessage = error.parent ? error.parent.detail || error.message : error.message;
        res.status(500).json({ 
            error: 'Internal server error', 
            details: errorMessage,
            code: error.parent ? error.parent.code : null
        });
    }
});

// DELETE /api/dashboard/admin/subjects/:id - Delete a subject
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if subject exists
        const subject = await sequelize.query(`
            SELECT id FROM subjects WHERE id = :id
        `, {
            replacements: { id },
            type: Sequelize.QueryTypes.SELECT
        });

        if (!subject.length) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        // Start a transaction
        const transaction = await sequelize.transaction();

        try {
            // Step 1: Find all topics for this subject
            const topics = await sequelize.query(`
                SELECT id FROM topics WHERE subject_id = :id
            `, {
                replacements: { id },
                type: Sequelize.QueryTypes.SELECT,
                transaction
            });

            const topicIds = topics.map(t => t.id);

            if (topicIds.length > 0) {
                // Step 2: Find all subtopics for these topics
                const subtopics = await sequelize.query(`
                    SELECT id FROM subtopics WHERE topic_id IN (:topicIds)
                `, {
                    replacements: { topicIds },
                    type: Sequelize.QueryTypes.SELECT,
                    transaction
                });

                const subtopicIds = subtopics.map(st => st.id);

                if (subtopicIds.length > 0) {
                    // Step 3: Delete all homeworks for these subtopics
                    await sequelize.query(`
                        DELETE FROM homeworks WHERE "subtopicId" IN (:subtopicIds)
                    `, {
                        replacements: { subtopicIds },
                        type: Sequelize.QueryTypes.DELETE,
                        transaction
                    });
                }

                // Step 4: Delete all subtopics
                await sequelize.query(`
                    DELETE FROM subtopics WHERE topic_id IN (:topicIds)
                `, {
                    replacements: { topicIds },
                    type: Sequelize.QueryTypes.DELETE,
                    transaction
                });

                // Step 5: Delete all topics
                await sequelize.query(`
                    DELETE FROM topics WHERE subject_id = :id
                `, {
                    replacements: { id },
                    type: Sequelize.QueryTypes.DELETE,
                    transaction
                });
            }

            // Step 6: Delete the subject
            await sequelize.query(`
                DELETE FROM subjects WHERE id = :id
            `, {
                replacements: { id },
                type: Sequelize.QueryTypes.DELETE,
                transaction
            });

            await transaction.commit();
            res.json({ 
                success: true,
                message: 'Subject and all related topics, subtopics, and homeworks deleted successfully' 
            });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
});

module.exports = router;