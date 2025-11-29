const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const auth = require('../middleware/auth-postgres');
const sequelize = require('../config/database/config');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/homework');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// GET /api/dashboard/admin/homeworks - Get all homeworks
router.get('/', auth(['admin']), async (req, res) => {
    try {
        const query = `
            SELECT 
                h.id,
                h."homeworkName",
                h.description,
                h."gradeId",
                g.grade_name as "gradeName",
                h."subjectId",
                s."subjectName",
                h."topicId",
                t.topic_name as "topicName",
                h."subtopicId",
                st.subtopic_name as "subtopicName",
                h."fileName",
                h."mimeType",
                h."exerciseData",
                h."csvContent",
                h."correctAnswersSummary",
                h."totalQuestions",
                h."questionTypes",
                h."exerciseIds",
                h."createdBy",
                h."createdAt",
                h."updatedAt"
            FROM homeworks h
            LEFT JOIN grades g ON h."gradeId" = g.id
            LEFT JOIN subjects s ON h."subjectId" = s.id
            LEFT JOIN topics t ON h."topicId" = t.id
            LEFT JOIN subtopics st ON h."subtopicId" = st.id
            WHERE h.center = :centerId
            ORDER BY h."createdAt" DESC`;

        const homeworks = await sequelize.query(query, {
            replacements: {
                centerId: req.user.center_id
            },
            type: Sequelize.QueryTypes.SELECT
        });

        res.json({
            success: true,
            homeworks
        });
    } catch (error) {
        console.error('Error fetching homeworks:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching homeworks'
        });
    }
});

// POST /api/dashboard/admin/homeworks - Create a new homework
router.post('/', auth(['admin']), upload.single('file'), async (req, res) => {
    try {
        const {
            homeworkName,
            description,
            gradeId,
            subjectId,
            topicId,
            subtopicId,
            exerciseData,
            csvContent
        } = req.body;

        // Validation
        if (!homeworkName || !gradeId || !subjectId || !topicId || !subtopicId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Generate MongoDB-style ObjectId (24 characters hex)
        const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
        const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
        const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
        const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
        const id = timestamp + machineId + processId + counter;

        // Create homework
        const query = `
            INSERT INTO homeworks (
                id,
                "homeworkName",
                description,
                "gradeId",
                "subjectId",
                "topicId",
                "subtopicId",
                "fileName",
                "mimeType",
                "exerciseData",
                "csvContent",
                "correctAnswersSummary",
                "totalQuestions",
                "questionTypes",
                "exerciseIds",
                "createdBy",
                center,
                created_at,
                updated_at
            ) VALUES (
                :id,
                :homeworkName,
                :description,
                :gradeId,
                :subjectId,
                :topicId,
                :subtopicId,
                :fileName,
                :mimeType,
                :exerciseData,
                :csvContent,
                :correctAnswersSummary,
                :totalQuestions,
                :questionTypes,
                :exerciseIds,
                :createdBy,
                :centerId,
                NOW(),
                NOW()
            ) RETURNING *`;

        console.log('Creating homework with data:', {
            homeworkName,
            description,
            gradeId,
            subjectId,
            topicId,
            subtopicId,
            fileName: req.file?.filename,
            exerciseData,
            csvContent
        });

        const insertQuery = `
            INSERT INTO homeworks (
                id,
                "homeworkName",
                description,
                "gradeId",
                "subjectId",
                "topicId",
                "subtopicId",
                "fileName",
                "mimeType",
                "exerciseData",
                "csvContent",
                "correctAnswersSummary",
                "totalQuestions",
                "questionTypes",
                "exerciseIds",
                "createdBy",
                center,
                "isActive",
                "createdAt",
                "updatedAt"
            ) VALUES (
                :id,
                :homeworkName,
                :description,
                :gradeId,
                :subjectId,
                :topicId,
                :subtopicId,
                :fileName,
                :mimeType,
                :exerciseData::jsonb,
                :csvContent,
                :correctAnswersSummary::jsonb,
                :totalQuestions,
                :questionTypes,
                :exerciseIds,
                :createdBy,
                :center,
                :isActive,
                NOW(),
                NOW()
            ) RETURNING *`;

        // Calculate total questions from exerciseData if available
        let totalQuestions = 0;
        let questionTypes = [];
        let exerciseIds = [];
        
        if (exerciseData && Array.isArray(exerciseData)) {
            exerciseData.forEach(exercise => {
                if (exercise.questions) {
                    totalQuestions += exercise.questions.length;
                    exercise.questions.forEach(q => {
                        if (q.type && !questionTypes.includes(q.type)) {
                            questionTypes.push(q.type);
                        }
                    });
                }
                if (exercise.id) {
                    exerciseIds.push(exercise.id);
                }
            });
        }

        console.log('Inserting homework with data:', {
            id,
            homeworkName,
            description,
            gradeId,
            subjectId,
            topicId,
            subtopicId,
            totalQuestions,
            questionTypes,
            exerciseIds
        });

        // Ensure arrays are properly formatted for PostgreSQL
        const formattedQuestionTypes = questionTypes && questionTypes.length > 0 
            ? `{${questionTypes.map(t => `"${t}"`).join(',')}}` 
            : '{}';
        const formattedExerciseIds = exerciseIds && exerciseIds.length > 0 
            ? `{${exerciseIds.map(id => `"${id}"`).join(',')}}` 
            : '{}';

        const [homework] = await sequelize.query(insertQuery, {
            replacements: {
                id,
                homeworkName,
                description: description || null,
                gradeId,
                subjectId,
                topicId,
                subtopicId,
                fileName: req.file ? req.file.filename : null,
                mimeType: req.file ? req.file.mimetype : null,
                exerciseData: exerciseData ? JSON.stringify(exerciseData) : '{}',
                csvContent: csvContent || null,
                correctAnswersSummary: JSON.stringify({}),
                totalQuestions: totalQuestions || 0,
                questionTypes: formattedQuestionTypes,
                exerciseIds: formattedExerciseIds,
                createdBy: req.user.id,
                center: req.user.center_id,
                isActive: true
            },
            type: Sequelize.QueryTypes.INSERT
        });

        // Get full homework data with related info
        const fullHomeworkQuery = `
            SELECT 
                h.id,
                h."homeworkName",
                h.description,
                h."gradeId",
                g.grade_name as "gradeName",
                h."subjectId",
                s."subjectName",
                h."topicId",
                t.topic_name as "topicName",
                h."subtopicId",
                st.subtopic_name as "subtopicName",
                h."fileName",
                h."mimeType",
                h."exerciseData",
                h."csvContent",
                h."correctAnswersSummary",
                h."totalQuestions",
                h."questionTypes",
                h."exerciseIds",
                h."createdBy",
                h."createdAt",
                h."updatedAt"
            FROM homeworks h
            LEFT JOIN grades g ON h."gradeId" = g.id
            LEFT JOIN subjects s ON h."subjectId" = s.id
            LEFT JOIN topics t ON h."topicId" = t.id
            LEFT JOIN subtopics st ON h."subtopicId" = st.id
            WHERE h.id = :id`;

        const [fullHomework] = await sequelize.query(fullHomeworkQuery, {
            replacements: { id },
            type: Sequelize.QueryTypes.SELECT
        });

        res.status(201).json({
            success: true,
            homework: fullHomework
        });
    } catch (error) {
        console.error('Error creating homework:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating homework'
        });
    }
});

// DELETE /api/dashboard/admin/homeworks/:id - Delete a homework
router.delete('/:id', auth(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ 
                success: false,
                message: 'Homework ID is required' 
            });
        }

        // First get the homework to check if it exists and get file info
        const getHomeworkQuery = `
            SELECT * FROM homeworks 
            WHERE id = :id AND center = :centerId`;

        const [homework] = await sequelize.query(getHomeworkQuery, {
            replacements: { 
                id,
                centerId: req.user.center_id 
            },
            type: Sequelize.QueryTypes.SELECT
        });

        if (!homework) {
            return res.status(404).json({ 
                success: false,
                message: 'Homework not found' 
            });
        }

        // First, delete all associated homework assignments
        const deleteAssignmentsQuery = `
            DELETE FROM homeworkassignments
            WHERE homework_id = :id`;

        await sequelize.query(deleteAssignmentsQuery, {
            replacements: { id },
            type: Sequelize.QueryTypes.DELETE
        });

        // Then delete the homework
        const deleteQuery = `
            DELETE FROM homeworks
            WHERE id = :id AND center = :centerId
            RETURNING *`;

        const [deletedHomework] = await sequelize.query(deleteQuery, {
            replacements: { 
                id,
                centerId: req.user.center_id 
            },
            type: Sequelize.QueryTypes.DELETE
        });

        // Delete the associated file if it exists
        if (homework.fileName) {
            const filePath = path.join(__dirname, '../uploads/homework', homework.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.json({
            success: true,
            message: 'Homework deleted successfully',
            data: homework
        });
    } catch (error) {
        console.error('Error deleting homework:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting homework'
        });
    }
});

module.exports = router;