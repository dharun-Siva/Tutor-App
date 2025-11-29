const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');
const authMiddleware = require('../middleware/auth-postgres');

// GET /api/homework-form/data - Get all form data (grades, subjects, topics, subtopics)
router.get('/data', authMiddleware(['tutor']), async (req, res) => {
    try {
        const tutorId = req.user.id;
        const centerId = req.user.center_id;
        const gradeId = req.query.gradeId;
        
        console.log('Query parameters:', req.query);
        console.log('Center ID:', centerId);
        console.log('Grade ID:', gradeId);
        console.log('Grade ID:', req.query.gradeId);

        // Get grades for tutor's center
        const gradesQuery = `
            SELECT id, grade_name
            FROM grades 
            WHERE center_id = :centerId
            ORDER BY grade_name`;

        const grades = await sequelize.query(gradesQuery, {
            replacements: { centerId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log('Grades found:', grades);

        if (grades.length === 0) {
            console.log('No grades found for centerId:', centerId);
        }
        
        // Map grades to match frontend expectations
        const mappedGrades = grades.map(grade => ({
            id: grade.id,
            grade_name: grade.grade_name
        }));

        // Get subjects for the specified grade
        let subjects = [];
        console.log('Request query params:', req.query);
        if (req.query.gradeId) {
            console.log('Fetching subjects with gradeId:', req.query.gradeId, 'and centerId:', centerId);
            console.log('Fetching subjects for gradeId:', req.query.gradeId);
            const subjectsQuery = `
                SELECT 
                    s.id,
                    s."subjectCode",
                    s."subjectName"
                FROM subjects s
                WHERE s."centerId" = :centerId 
                AND s."gradeId" = :gradeId
                ORDER BY s."subjectName"`;
            
            console.log('Executing subjects query with params:', {
                centerId,
                gradeId: req.query.gradeId
            });

            try {
                subjects = await sequelize.query(subjectsQuery, {
                    replacements: { 
                        centerId,
                        gradeId: req.query.gradeId 
                    },
                    type: Sequelize.QueryTypes.SELECT
                });
                console.log('Raw subjects query result:', subjects);
            } catch (error) {
                console.error('Error fetching subjects:', error);
                console.error('Query:', subjectsQuery);
                console.error('Parameters:', { centerId, gradeId: req.query.gradeId });
                subjects = [];
            }
            console.log('Subjects query result:', subjects);
            
            // Map subjects to match frontend expectations
            subjects = subjects.map(subject => ({
                id: subject.id,
                subjectName: subject.subjectName,
                subjectCode: subject.subjectCode
            }));
        }

        // Get topics if subjectId is provided
        let topics = [];
        if (req.query.subjectId) {
            console.log('Fetching topics for subjectId:', req.query.subjectId);
            const topicsQuery = `
                SELECT 
                    t.id,
                    t.topic_name as "topicName"
                FROM topics t 
                WHERE t.center_id = :centerId 
                AND t.subject_id = :subjectId
                ORDER BY t.topic_name`;
            
            console.log('Executing topics query with params:', {
                centerId,
                subjectId: req.query.subjectId
            });

            topics = await sequelize.query(topicsQuery, {
                replacements: { 
                    centerId,
                    subjectId: req.query.subjectId 
                },
                type: Sequelize.QueryTypes.SELECT
            });
        }

        // Get subtopics if topicId is provided
        let subtopics = [];
        if (req.query.topicId) {
            const subtopicsQuery = `
                SELECT id, subtopic_name as "subtopicName"
                FROM subtopics 
                WHERE center_id = :centerId 
                AND topic_id = :topicId
                ORDER BY subtopic_name`;

            subtopics = await sequelize.query(subtopicsQuery, {
                replacements: { 
                    centerId,
                    topicId: req.query.topicId 
                },
                type: Sequelize.QueryTypes.SELECT
            });
        }

        // Get homeworks if subtopicId is provided
        let homeworks = [];
        if (req.query.subtopicId) {
            const homeworksQuery = `
                SELECT 
                    id, 
                    "homeworkName",
                    description,
                    "fileName",
                    "mimeType",
                    "exerciseData"
                FROM homeworks 
                WHERE center = :centerId 
                AND "subtopicId" = :subtopicId
                AND "isActive" = true
                ORDER BY "homeworkName"`;

            homeworks = await sequelize.query(homeworksQuery, {
                replacements: { 
                    centerId,
                    subtopicId: req.query.subtopicId 
                },
                type: Sequelize.QueryTypes.SELECT
            });
        }

        console.log('Final response data:', {
            gradesCount: mappedGrades.length,
            subjectsCount: subjects.length,
            topicsCount: topics.length,
            subtopicsCount: subtopics.length,
            homeworksCount: homeworks.length
        });

        const responseData = {
            success: true,
            data: {
                grades: mappedGrades,
                subjects: subjects,
                topics: topics,
                subtopics: subtopics,
                homeworks: homeworks
            }
        };
        
        console.log('Sending response:', responseData);
        res.json(responseData);

    } catch (error) {
        console.error('Error fetching form data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch form data',
            message: error.message
        });
    }
});

module.exports = router;
