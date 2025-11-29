const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-postgres');
const HomeworkAssignment = require('../models/HomeworkAssignment.postgres');
const { Op, QueryTypes } = require('sequelize');
const { pool, pgClient, objectIdHelper, sequelize } = require('../db');

// GET /api/homework-assignments/parent - Get assignments for parent's children
router.get('/parent', auth(['parent', 'student']), async (req, res) => {
    try {
        const parentId = req.user.id;

        // Get children IDs from parent's user record
        const childrenQuery = `
            SELECT assignments->>'children' as children 
            FROM users 
            WHERE id = $1 AND role = 'parent'
        `;
        const childrenResult = await pool.query(childrenQuery, [parentId]);
        
        if (!childrenResult.rows[0] || !childrenResult.rows[0].children) {
            return res.json({
                success: true,
                data: [],
                message: 'No children found for this parent'
            });
        }

        // Parse children array from JSON string
        const childrenIds = JSON.parse(childrenResult.rows[0].children || '[]');
        
        if (childrenIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: 'No children found for this parent'
            });
        }

        // Get assignments for all children
        const assignmentsQuery = `
            SELECT 
                ha._id as assignment_id,
                c."title" as class_name,
                TRIM(CONCAT(student.first_name, ' ', student.last_name)) as student_name,
                g.grade_name,
                s."subjectName" as subject_name,
                tp.topic_name,
                st.subtopic_name,
                h."homeworkName" as homework_name,
                ha.status,
                ha.start_date::character varying as start_date,
                ha.due_date::character varying as due_date,
                TRIM(CONCAT(tutor.first_name, ' ', tutor.last_name)) as tutor_name,
                h."homeworkName" as homework_name,
                h."description" as homework_description,
                assigned_by.first_name as assigned_by_name,
                CASE 
                    WHEN sa.summary->>'status' IS NULL THEN 'pending'::character varying
                    ELSE sa.summary->>'status'::character varying
                END as status,
                (sa.grading->>'submitted_at')::character varying as submission_date,
                c.title as class_name,
                student.first_name as student_first_name,
                student.last_name as student_last_name,
                tutor.first_name as tutor_first_name,
                tutor.last_name as tutor_last_name
            FROM homeworkassignments ha
            JOIN "Classes" c ON ha.class_id = c.id
            JOIN grades g ON ha.grade_id = g.id
            JOIN subjects s ON ha.subject_id = s.id
            JOIN topics tp ON ha.topic_id = tp.id
            JOIN subtopics st ON ha.subtopic_id = st.id
            JOIN homeworks h ON ha.homework_id = h.id
            JOIN users student ON student.id::varchar = ANY(ha.student_ids)
            LEFT JOIN studentanswers sa ON ha._id = sa.assignment_id
            LEFT JOIN users tutor ON tutor.id = c."tutorId"
            LEFT JOIN users assigned_by ON ha.assigned_by = assigned_by.id
            WHERE ha.student_ids::character varying[] && ARRAY(SELECT CAST(unnest($1::text[]) AS character varying))
            ORDER BY ha.start_date DESC
        `;

        const assignments = await pool.query(assignmentsQuery, [childrenIds]);

        // Format the data to match frontend expectations
        const formattedAssignments = assignments.rows.map(row => ({
            _id: row.assignment_id,
            class: {
                title: row.class_name,
                subject: row.subject_name,
                tutor: {
                    fullName: row.tutor_name || ''
                }
            },
            student: {
                fullName: row.student_name
            },
            startDate: row.start_date,
            dueDate: row.due_date,
            homework: {
                title: row.homework_name,
                subjectId: {
                    name: row.subject_name
                }
            },
            assignedDate: row.start_date,
            startDate: row.start_date,
            dueDate: row.due_date,
            status: row.status || 'pending',
            grade: row.grade_name
        }));

        res.json({
            success: true,
            data: formattedAssignments
        });

    } catch (error) {
        console.error('Parent assignments fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch assignments',
            message: error.message
        });
    }
});

// PUT /api/homework-assignments/:assignmentId/update-status - Update assignment status
router.put('/:assignmentId/update-status', auth(['student']), async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const studentId = req.user.id;

        // First check if all answers are correct for this student
        const checkAnswersQuery = `
            SELECT 
                pages,
                summary
            FROM studentanswers 
            WHERE assignment_id = $1 AND student_id = $2
        `;
        const answersResult = await pool.query(checkAnswersQuery, [assignmentId, studentId]);
        
        if (answersResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No answers found for this assignment'
            });
        }

        const studentAnswer = answersResult.rows[0];
        let allCorrect = true;
        
        // Check if all questions are correct and validated
        if (studentAnswer.pages && Array.isArray(studentAnswer.pages)) {
            for (const page of studentAnswer.pages) {
                if (page.components) {
                    for (const component of page.components) {
                        if (component.studentAnswer) {
                            if (!component.studentAnswer.isCorrect || !component.studentAnswer.isValidated) {
                                allCorrect = false;
                                break;
                            }
                        }
                    }
                }
                if (!allCorrect) break;
            }
        }

        // Update student's individual status
        const updatedSummary = {
            ...studentAnswer.summary,
            status: allCorrect ? 'completed' : studentAnswer.summary?.status || 'inprogress'
        };

        const updateStudentAnswerQuery = `
            UPDATE studentanswers 
            SET summary = $1
            WHERE assignment_id = $2 AND student_id = $3
        `;
        await pool.query(updateStudentAnswerQuery, [updatedSummary, assignmentId, studentId]);

        // If this student's answers are all correct, check if all students have completed
        if (allCorrect) {
            // Get all student answers for this assignment
            const checkAllStudentsQuery = `
                SELECT sa.summary
                FROM homeworkassignments ha
                LEFT JOIN studentanswers sa ON sa.assignment_id = ha._id
                WHERE ha._id = $1 AND sa.student_id = ANY(ha.student_ids::text[])
            `;
            const allStudentsResult = await pool.query(checkAllStudentsQuery, [assignmentId]);
            
            const allStudentsCompleted = allStudentsResult.rows.every(row => 
                row.summary && row.summary.status === 'completed'
            );

            // If all students have completed, update homework assignment status
            if (allStudentsCompleted) {
                const updateAssignmentQuery = `
                    UPDATE homeworkassignments 
                    SET status = 'completed'
                    WHERE _id = $1
                `;
                await pool.query(updateAssignmentQuery, [assignmentId]);
            }
        }

        res.json({
            success: true,
            message: 'Status updated successfully',
            isCompleted: allCorrect
        });

    } catch (error) {
        console.error('Error updating assignment status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating assignment status'
        });
    }
});

// GET /api/homework-assignments/student - Get assignments for student
router.get('/student', auth(['student']), async (req, res) => {
    try {
        const studentId = req.user.id;
        console.log('Fetching assignments for student:', studentId);
        console.log('Student ID type:', typeof studentId);
        
        const query = `
            SELECT 
                ha._id,
                ha.instructions,
                ha.status,
                ha.start_date,
                ha.due_date,
                ha.homework_id,
                ha.class_id,
                h."homeworkName",
                h."fileName",
                h."mimeType",
                h."exerciseData"
            FROM homeworkassignments ha
            LEFT JOIN homeworks h ON ha.homework_id = h.id
            WHERE ha.student_ids::text[] @> ARRAY[$1::text]
            AND ha.is_active = true
            AND h.id IS NOT NULL
            ORDER BY ha.start_date DESC
        `;

        console.log('Executing query with params:', [studentId]);
        const result = await pool.query(query, [studentId]);
        console.log('Query result:', result.rows);
        
        res.json({
            success: true,
            assignments: result.rows
        });
    } catch (error) {
        console.error('Error fetching student assignments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignments'
        });
    }
});

// GET /api/homework-assignments/:id - Get a single homework assignment
router.get('/:id', auth(['student', 'tutor']), async (req, res) => {
    try {
        const assignmentId = req.params.id;
        const query = `
            SELECT 
                ha._id,
                ha.instructions,
                ha.status,
                ha.start_date,
                ha.due_date,
                ha.homework_id,
                ha.class_id,
                h."homeworkName",
                h."fileName",
                h."mimeType",
                h."exerciseData"
            FROM homeworkassignments ha
            LEFT JOIN homeworks h ON ha.homework_id = h.id
            WHERE ha._id = $1
            AND ha.is_active = true
        `;

        const result = await pool.query(query, [assignmentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        res.json({
            success: true,
            assignment: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignment'
        });
    }
});

// GET /api/homework-assignments/student - Get assignments for student
router.get('/student', auth(['student']), async (req, res) => {
    try {
        const studentId = req.user.id;
        console.log('Fetching assignments for student:', studentId);
        console.log('Student ID type:', typeof studentId);
        
        const query = `
            SELECT 
                ha._id,
                ha.instructions,
                ha.status,
                ha.start_date,
                ha.due_date,
                ha.homework_id,
                ha.class_id,
                h."homeworkName",
                h."fileName",
                h."mimeType",
                h."exerciseData"
            FROM homeworkassignments ha
            LEFT JOIN homeworks h ON ha.homework_id = h.id
            WHERE ha.student_ids::text[] @> ARRAY[$1::text]
            AND ha.is_active = true
            AND h.id IS NOT NULL
            ORDER BY ha.start_date DESC
        `;

        console.log('Executing query with params:', [studentId]);
        const result = await pool.query(query, [studentId]);
        console.log('Query result:', result.rows);
        
        res.json({
            success: true,
            assignments: result.rows
        });
    } catch (error) {
        console.error('Error fetching student assignments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignments'
        });
    }
});

// GET /api/homework-assignments/admin/expanded - Get assignments for admin's center
router.get('/admin/expanded', auth(['admin']), async (req, res) => {
    try {
        const adminCenterId = req.user.center_id;
        const { status, classId, page = 1, limit = 10 } = req.query;

        if (!adminCenterId) {
            return res.status(403).json({
                success: false,
                error: 'Admin must be associated with a center'
            });
        }

        const client = await pool.connect();
        try {
            const queryParams = [adminCenterId];
            let paramCount = 1;
            
            let baseQuery = `
                SELECT 
                    ha._id as assignment_id,
                    c.title as class_name,
                    TRIM(CONCAT(u.first_name, ' ', u.last_name)) as student_name,
                    g.grade_name,
                    s."subjectName" as subject_name,
                    tp.topic_name,
                    st.subtopic_name,
                    h."homeworkName" as homework_name,
                    ha.status,
                    ha.start_date,
                    ha.due_date
                FROM homeworkassignments ha
                JOIN "Classes" c ON ha.class_id = c.id
                JOIN grades g ON ha.grade_id = g.id
                JOIN subjects s ON ha.subject_id = s.id
                JOIN topics tp ON ha.topic_id = tp.id
                JOIN subtopics st ON ha.subtopic_id = st.id
                JOIN homeworks h ON ha.homework_id = h.id
                JOIN users u ON u.id::varchar = ANY(ha.student_ids)
                WHERE c."centerId" = $1
            `;

            if (status) {
                paramCount++;
                baseQuery += ` AND ha.status = $${paramCount}`;
                queryParams.push(status);
            }
            
            if (classId) {
                paramCount++;
                baseQuery += ` AND ha.class_id = $${paramCount}`;
                queryParams.push(classId);
            }

            // Add ordering and pagination
            const finalQuery = baseQuery + ` 
                ORDER BY ha.start_date DESC
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            
            queryParams.push(limit, (page - 1) * limit);

            // Count query
            const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as sub`;
            const countParams = queryParams.slice(0, paramCount);

            const [assignments, countResult] = await Promise.all([
                client.query(finalQuery, queryParams),
                client.query(countQuery, countParams)
            ]);

            console.log(`Found ${assignments.rows.length} assignments`);

            res.json({
                success: true,
                assignments: assignments.rows,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(countResult.rows[0].count / limit),
                    total: countResult.rows[0].count
                }
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error fetching expanded assignments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch assignments',
            message: error.message 
        });
    }
});

// GET /api/homework-assignments/tutor/expanded - Get assignments with individual student rows
router.get('/tutor/expanded', auth(['tutor']), async (req, res) => {
    try {
        console.log('Fetching expanded assignments for tutor:', req.user.id);
        const tutorId = req.user.id;
        const { status, classId, page = 1, limit = 10 } = req.query;

        // Using pool directly for better query control
        const client = await pool.connect();
        try {
            console.log('Connected to database, executing query...');

            // Build the query to get assignments with student details
            const queryParams = [tutorId];
            let paramCount = 1;
            
            let baseQuery = `
                WITH assignment_base AS (
                    SELECT 
                        ha._id as assignment_id,
                        ha.homework_id,
                        ha.class_id,
                        ha.start_date,
                        ha.due_date,
                        ha.status as assignment_status,
                        ha.instructions,
                        ha.is_active,
                        ha.student_ids,
                        h."homeworkName" as homework_name,
                        c.title as class_name,
                        g.grade_name,
                        s."subjectName" as subject_name,
                        t.topic_name,
                        st.subtopic_name
                    FROM homeworkassignments ha
                    JOIN homeworks h ON ha.homework_id = h.id
                    JOIN "Classes" c ON ha.class_id = c.id
                    JOIN grades g ON ha.grade_id = g.id
                    JOIN subjects s ON ha.subject_id = s.id
                    JOIN topics t ON ha.topic_id = t.id
                    JOIN subtopics st ON ha.subtopic_id = st.id
                    WHERE ha.assigned_by = $1 AND ha.is_active = true
                ),
                expanded_students AS (
                    SELECT 
                        a.*,
                        unnest(a.student_ids) as student_id
                    FROM assignment_base a
                ),
                student_assignments AS (
                    SELECT 
                        es.assignment_id,
                        es.homework_id,
                        es.class_id,
                        es.start_date,
                        es.due_date,
                        es.assignment_status,
                        es.instructions,
                        es.is_active,
                        es.homework_name,
                        es.class_name,
                        es.grade_name,
                        es.subject_name,
                        es.topic_name,
                        es.subtopic_name,
                        es.student_id,
                        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as student_name,
                        COALESCE(sa.summary->>'status', 'pending') as submission_status
                    FROM expanded_students es
                    JOIN "users" u ON es.student_id = u.id
                    LEFT JOIN studentanswers sa ON es.assignment_id = sa.assignment_id 
                        AND es.student_id = sa.student_id
                )
                SELECT * FROM student_assignments
            `;
            
            let whereClause = '';
            if (status) {
                paramCount++;
                whereClause += ` ${whereClause ? 'AND' : 'WHERE'} assignment_status = $${paramCount}`;
                queryParams.push(status);
            }
            
            if (classId) {
                paramCount++;
                whereClause += ` ${whereClause ? 'AND' : 'WHERE'} class_id = $${paramCount}`;
                queryParams.push(classId);
            }

            // Add ordering and pagination
            const finalQuery = baseQuery + whereClause + ` 
                ORDER BY start_date DESC, class_name, student_name
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            queryParams.push(limit, (page - 1) * limit);

// PUT /api/homework-assignments/:assignmentId/cancel-for-student/:studentId
router.put('/:assignmentId/cancel-for-student/:studentId', auth(['tutor']), async (req, res) => {
    try {
        const { assignmentId, studentId } = req.params;
        const tutorId = req.user.id;

        // First verify the assignment exists and belongs to this tutor
        const verifyQuery = `
            SELECT student_ids 
            FROM homeworkassignments 
            WHERE _id = $1::text AND assigned_by = $2::text`;

        const verifyResult = await pool.query(verifyQuery, [assignmentId, tutorId]);
        const assignment = verifyResult.rows[0];

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found or not authorized'
            });
        }

        // Remove this student from the student_ids array
            // Use the pool for PostgreSQL queries
            const updateQuery = `
                UPDATE homeworkassignments 
                SET student_ids = array_remove(student_ids, $1::text)
                WHERE _id = $2::text AND assigned_by = $3::text
                RETURNING *`;

            const result = await pool.query(updateQuery, [studentId, assignmentId, tutorId]);
            const updatedAssignment = result.rows[0];        // If all students are removed, mark the assignment as inactive
        if (updatedAssignment && updatedAssignment.student_ids.length === 0) {
            const deactivateQuery = `
                UPDATE homeworkassignments 
                SET is_active = false
                WHERE _id = $1::text`;

            await pool.query(deactivateQuery, [assignmentId]);
        }

        res.json({
            success: true,
            message: 'Student removed from assignment successfully'
        });

    } catch (error) {
        console.error('Error canceling assignment for student:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error canceling assignment for student'
        });
    }
});

            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*)::integer 
                FROM (${baseQuery + whereClause}) as sub`;

            // Create separate params array for count query (without pagination params)
            const countQueryParams = [...queryParams];
            countQueryParams.length = paramCount;  // Trim to only include the filter params

            const [assignments, countResult] = await Promise.all([
                client.query(finalQuery, queryParams),
                client.query(countQuery, countQueryParams)
            ]);

            console.log(`Found ${assignments.rows.length} assignments`);

            res.json({
                success: true,
                assignments: assignments.rows,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(countResult.rows[0].count / limit),
                    total: countResult.rows[0].count
                }
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error fetching expanded assignments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch assignments',
            message: error.message 
        });
    }
});

// GET /api/homework-assignments/tutor - Get assignments for tutor (original endpoint)
router.get('/tutor', auth(['tutor']), async (req, res) => {
    try {
        console.log('Fetching assignments for tutor:', req.user.id);
        const tutorId = req.user.id;
        const { status, classId, page = 1, limit = 10 } = req.query;

        // Using pool directly for better query control
        const client = await pool.connect();
        try {
            console.log('Connected to database, executing query...');

        // Get assignments with basic data
            // Build the base query with parameters
            const queryParams = [tutorId];
            let paramCount = 1;
            
            let whereClause = 'WHERE ha.assigned_by = $1::text AND ha.is_active = true';
            
            if (status) {
                paramCount++;
                whereClause += ` AND ha.status = $${paramCount}`;
                queryParams.push(status);
            }
            
            if (classId) {
                paramCount++;
                whereClause += ` AND ha.class_id = $${paramCount}`;
                queryParams.push(classId);
            }

            // Add pagination parameters
            paramCount++;
            queryParams.push((page - 1) * limit); // offset
            paramCount++;
            queryParams.push(parseInt(limit));     // limit
            
            console.log('Query parameters:', queryParams);

            // Main query to fetch assignments
            const query = `
                SELECT 
                    ha._id,
                    ha.class_id,
                    COALESCE(c.title, 'Unknown Class') as class_name,
                    ha.grade_id,
                    COALESCE(g.name, 'Unknown Grade') as grade_name,
                    ha.subject_id,
                    COALESCE(s.name, 'Unknown Subject') as subject_name,
                    ha.topic_id,
                    COALESCE(tp.name, 'Unknown Topic') as topic_name,
                    ha.subtopic_id,
                    COALESCE(st.name, 'Unknown Subtopic') as subtopic_name,
                    ha.homework_id,
                    COALESCE(h."homeworkName", 'Unknown Homework') as homework_name,
                    ha.start_date,
                    ha.due_date,
                    COALESCE(ha.status, 'pending') as status,
                    ha.student_ids,
                    ha.submissions
                FROM homeworkassignments ha
                LEFT JOIN classes c ON c.id = ha.class_id
                LEFT JOIN grades g ON g.id = ha.grade_id
                LEFT JOIN subjects s ON s.id = ha.subject_id
                LEFT JOIN topics tp ON tp.id = ha.topic_id
                LEFT JOIN subtopics st ON st.id = ha.subtopic_id
                LEFT JOIN homeworks h ON h.id = ha.homework_id
                ${whereClause}
                ORDER BY ha.created_at DESC
                OFFSET $${paramCount-1}
                LIMIT $${paramCount}`;

            // Count query for pagination
            const countQuery = `
                SELECT COUNT(*) as count 
                FROM homeworkassignments ha 
                ${whereClause}`;

            console.log('Executing queries:', { query, countQuery });

            // Execute both queries in parallel
            const [assignments, countResult] = await Promise.all([
                client.query(query, queryParams),
                client.query(countQuery, queryParams.slice(0, -2)) // Remove offset and limit params
            ]);

            console.log('Query results:', {
                assignmentCount: assignments.rows.length,
                totalCount: countResult.rows[0].count
            });

            // Process the results
            const count = parseInt(countResult.rows[0].count);
            const processedAssignments = assignments.rows.map(assignment => {
                console.log('Processing raw assignment:', assignment);
                
                // Handle student_ids array
                let studentIds = [];
                if (assignment.student_ids) {
                    if (Array.isArray(assignment.student_ids)) {
                        studentIds = assignment.student_ids;
                    } else if (typeof assignment.student_ids === 'string') {
                        studentIds = assignment.student_ids.replace(/[{"}]/g, '').split(',').filter(Boolean);
                    }
                }

                // Handle submissions
                let submissions = [];
                if (assignment.submissions) {
                    try {
                        submissions = Array.isArray(assignment.submissions) 
                            ? assignment.submissions 
                            : JSON.parse(assignment.submissions);
                    } catch (e) {
                        console.warn('Failed to parse submissions:', e);
                    }
                }

                const processedAssignment = {
                    _id: assignment._id,
                    class: assignment.class_name,
                    grade: {
                        _id: assignment.grade_id,
                        name: assignment.grade_name
                    },
                    subject: {
                        _id: assignment.subject_id,
                        name: assignment.subject_name
                    },
                    topic: {
                        _id: assignment.topic_id,
                        name: assignment.topic_name
                    },
                    subtopic: {
                        _id: assignment.subtopic_id,
                        name: assignment.subtopic_name
                    },
                    homework: {
                        _id: assignment.homework_id,
                        name: assignment.homework_name
                    },
                    startDate: assignment.start_date,
                    dueDate: assignment.due_date,
                    status: assignment.status,
                    student_ids: studentIds,
                    submissions: submissions
                };
                
                console.log('Processed assignment:', processedAssignment);
                return processedAssignment;
            });

            // Send the response
            res.json({
                success: true,
                assignments: processedAssignments,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(count / limit),
                    total: count
                }
            });

        } finally {
            // Release the client back to the pool
            client.release();
        }

    } catch (error) {
        console.error('Error fetching tutor assignments:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch assignments',
            message: error.message 
        });
    }
});

// POST /api/homework-assignments/assign - Create new homework assignment
router.post('/assign', auth(['tutor']), async (req, res) => {
    try {
        console.log('📝 Assignment creation request body:', req.body);
        const {
            gradeId,
            subjectId,
            topicId,
            subtopicId,
            classId,
            studentIds,
            startDate,
            dueDate,
            instructions,
            homeworkId
        } = req.body;

        if (!gradeId || !subjectId || !topicId || !subtopicId || !classId || !startDate || !req.body.homeworkId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields. Please make sure to select a homework.'
            });
        }

        // Generate MongoDB-style 24-character hex ID
        const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
        const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
        const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
        const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
        const newId = timestamp + machineId + processId + counter;

        // Log the values we're trying to save
        console.log('Creating assignment with:', {
            id: newId,
            homeworkId: homeworkId,
            gradeId,
            subjectId,
            classId,
            studentIds
        });

        const assignment = await HomeworkAssignment.create({
            _id: newId,
            grade_id: gradeId,
            subject_id: subjectId,
            topic_id: topicId,
            subtopic_id: subtopicId,
            assigned_by: req.user.id,
            homework_id: homeworkId,  // Use the destructured value
            assignment_type: 'class',
            class_id: classId,
            student_ids: studentIds || [],
            start_date: startDate,
            due_date: dueDate || null,
            instructions: instructions || '',
            status: 'assigned',
            is_active: true,
            submissions: studentIds.map(studentId => ({
                id: timestamp + Math.floor(Math.random() * 16777216).toString(16).padStart(16, '0'),
                studentId,
                status: 'pending'
            }))
        });

        res.json({
            success: true,
            assignment: assignment
        });

    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create assignment',
            message: error.message
        });
    }
});

// GET /api/homework-assignments/tutor/enrolled-students - Get enrolled students for tutor
router.get('/tutor/enrolled-students', auth(['tutor']), async (req, res) => {
    try {
        const tutorId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const client = await pool.connect();
        try {
            const queryParams = [tutorId];
            let paramCount = 1;

            let baseQuery = `
                WITH enrolled_students AS (
                    SELECT DISTINCT
                        c.title as class_name,
                        s.id as student_id,
                        TRIM(CONCAT(s.first_name, ' ', s.last_name)) as student_name,
                        s.email as student_email,
                        TRIM(CONCAT(p.first_name, ' ', p.last_name)) as parent_name,
                        COALESCE(s.created_at::text, 
                                to_char(s.created_at, 'YYYY-MM-DD')) as join_date,
                        'active' as status
                    FROM "Classes" c
                    CROSS JOIN UNNEST(c.students) as student_id
                    JOIN users s ON s.id::varchar = student_id
                    LEFT JOIN users p ON (s.student_profile->>'parentId')::varchar = p.id::varchar
                    WHERE c."tutorId" = $1 AND s.role = 'student'
                    AND s.is_active = true
                )
                SELECT * FROM enrolled_students
            `;

            // Add ordering and pagination
            const finalQuery = baseQuery + ` 
                ORDER BY class_name, student_name
                LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
            
            queryParams.push(limit, (page - 1) * limit);

            // Count query
            const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as sub`;
            const countParams = [tutorId];

            const [students, countResult] = await Promise.all([
                client.query(finalQuery, queryParams),
                client.query(countQuery, countParams)
            ]);

            res.json({
                success: true,
                students: students.rows,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(countResult.rows[0].count / limit),
                    total: parseInt(countResult.rows[0].count)
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching enrolled students:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch enrolled students' });
    }
});

module.exports = router;
