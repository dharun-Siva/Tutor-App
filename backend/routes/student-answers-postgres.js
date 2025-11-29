const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-postgres');
const StudentAnswer = require('../models/StudentAnswer.postgres');
const { pool } = require('../db');

// Save or update student answers for a page
router.post('/save-progress', auth(['student']), async (req, res) => {
    try {
        const {
            assignmentId,
            exerciseId,
            title,
            total_pages,
            pages
        } = req.body;

        const studentId = req.user.id;

        // Check if an answer record already exists
        let existingAnswer = await StudentAnswer.findOne({
            where: {
                assignment_id: assignmentId,
                student_id: studentId,
                exercise_id: exerciseId
            }
        });

        if (existingAnswer) {
            // Update existing record
            await existingAnswer.update({
                pages: pages,
                current_page: pages[pages.length - 1].pageId
            });
        } else {
            // Create new record
            await StudentAnswer.create({
                assignment_id: assignmentId,
                student_id: studentId,
                exercise_id: exerciseId,
                title,
                total_pages,
                current_page: pages[pages.length - 1].pageId,
                pages
            });
        }

        res.json({
            success: true,
            message: 'Progress saved successfully'
        });
    } catch (error) {
        console.error('Error saving student answers:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving progress'
        });
    }
});

// Submit and validate all answers
router.post('/submit', auth(['student']), async (req, res) => {
    try {
        const {
            assignmentId,
            exerciseId
        } = req.body;

        const studentId = req.user.id;

        // Get the student's answers
        const studentAnswer = await StudentAnswer.findOne({
            where: {
                assignment_id: assignmentId,
                student_id: studentId,
                exercise_id: exerciseId
            }
        });

        if (!studentAnswer) {
            return res.status(404).json({
                success: false,
                message: 'No answers found'
            });
        }

        // Validate each answer and mark correct/incorrect
        const pages = studentAnswer.pages.map(page => {
            return {
                ...page,
                components: page.components.map(component => {
                    // Here you would implement your validation logic
                    // For now, we'll just mark everything as validated
                    return {
                        ...component,
                        studentAnswer: {
                            ...component.studentAnswer,
                            isValidated: true
                        }
                    };
                })
            };
        });

        // Update with validation results
        await studentAnswer.update({
            pages,
            grading: {
                isSubmitted: true,
                submittedAt: new Date()
            }
        });

        res.json({
            success: true,
            message: 'Answers submitted and validated successfully',
            pages
        });
    } catch (error) {
        console.error('Error submitting answers:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting answers'
        });
    }
});

// Get stored answers for a specific homework assignment
router.get('/:assignmentId', auth(['student']), async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const studentId = req.user.id;
        
        console.log('Fetching answers for assignment:', assignmentId, 'student:', studentId);

        // Get the student's answers
        const studentAnswer = await StudentAnswer.findOne({
            where: {
                assignment_id: assignmentId,
                student_id: studentId
            }
        });

        if (!studentAnswer) {
            return res.status(404).json({
                success: false,
                message: 'No answers found for this assignment'
            });
        }

        // Return the answers with pages and validation status
        const processedPages = studentAnswer.pages.map(page => ({
            ...page,
            components: page.components.map(component => ({
                ...component,
                isEditable: component.studentAnswer?.isValidated && !component.studentAnswer?.isCorrect,
                studentAnswer: {
                    ...component.studentAnswer,
                    selected: component.studentAnswer?.selected || [],
                    isCorrect: component.studentAnswer?.isCorrect || false,
                    isValidated: component.studentAnswer?.isValidated || false
                }
            }))
        }));

        res.json({
            success: true,
            data: {
                title: studentAnswer.title,
                total_pages: studentAnswer.total_pages,
                current_page: studentAnswer.current_page,
                pages: processedPages,
                grading: studentAnswer.grading
            }
        });
    } catch (error) {
        console.error('Error fetching student answers:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching answers'
        });
    }
});

module.exports = router;
