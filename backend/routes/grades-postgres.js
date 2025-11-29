const express = require('express');
const router = express.Router();
const Grade = require('../models/Grade.postgres');
const authMiddleware = require('../middleware/auth-postgres');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');

// GET all grades with pagination, sorting, and filtering
router.get('/', authMiddleware(['admin', 'teacher', 'student']), async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Sorting parameters
    const sortField = req.query.sortField === 'gradeName' ? 'grade_name' : 'id'; // Default to id if not sorting by gradeName
    const sortDirection = req.query.sortDirection === 'desc' ? 'DESC' : 'ASC';

    // Query parameters for search/filter
    const searchQuery = req.query.search || '';

    // Build where clause for search and center_id filtering
    let whereClause = {};
    
    // Add search conditions if search query exists
    if (searchQuery) {
      whereClause[Op.or] = [
        { grade_code: { [Op.iLike]: `%${searchQuery}%` } },
        { grade_name: { [Op.iLike]: `%${searchQuery}%` } }
      ];
    }

    // Add center_id filter for admin users
    if (req.user && req.user.role === 'admin' && req.user.center_id) {
      whereClause.center_id = req.user.center_id;
    }

    // Get total count for pagination
    const total = await Grade.count({ where: whereClause });

    // Get grades with pagination
    const grades = await Grade.findAll({
      where: whereClause,
      attributes: [
        'id', 
        'grade_code', 
        'grade_name', 
        'center_id',
        ['created_at', 'created_at'],
        ['updated_at', 'updated_at']
      ],
      order: [[sortField, sortDirection]],
      limit,
      offset
    });

    // Map database fields to frontend field names
    const mappedGrades = grades.map(grade => {
      const createdAt = grade.getDataValue('created_at');
      return {
        id: grade.id,
        gradeCode: grade.grade_code,
        gradeName: grade.grade_name,
        centerId: grade.center_id,
        createdAt: createdAt ? createdAt.toISOString() : null
      };
    });

    res.json({
      grades: mappedGrades,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET grade by ID
router.get('/:id', authMiddleware(['admin', 'teacher', 'student']), async (req, res) => {
  try {
    const center_id = req.user.centerId;
    const grade = await Grade.findOne({
      where: {
        id: req.params.id,
        center_id
      },
      attributes: ['id', 'grade_code', 'grade_name', 'center_id', 'created_at', 'updated_at']
    });

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    res.json(grade);
  } catch (error) {
    console.error('Error fetching grade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new grade
router.post('/', authMiddleware(['admin']), async (req, res) => {
  try {
    // Detailed debug logging
    console.log('=== Grade Creation Debug ===');
    console.log('Full request user:', req.user);
    console.log('User ID:', req.user ? req.user.id : 'no user');
    console.log('Center ID:', req.user ? req.user.center_id : 'no center_id');
    console.log('Role:', req.user ? req.user.role : 'no role');
    
    const { gradeCode, gradeName } = req.body;

    // Validate required fields
    if (!gradeCode || !gradeName) {
      return res.status(400).json({ error: 'gradeCode and gradeName are required' });
    }

    // Get center_id from authenticated user
    const center_id = req.user.center_id;
    
    // Check if grade code already exists in the same center (case-insensitive)
    const existingGrade = await Grade.findOne({
      where: {
        grade_code: { [Op.iLike]: gradeCode },
        center_id: center_id
      }
    });

    if (existingGrade) {
      return res.status(400).json({ error: 'Grade code already exists in this center' });
    }
    console.log('Creating grade with center_id:', center_id);

    // Create new grade (the ID will be auto-generated in MongoDB style by the model)
    const grade = await Grade.create({
      grade_code: gradeCode,
      grade_name: gradeName,
      center_id: center_id
    });

    res.status(201).json({
      id: grade.id,
      gradeCode: grade.grade_code,
      gradeName: grade.grade_name,
      createdAt: grade.created_at
    });
  } catch (error) {
    console.error('Error creating grade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update grade
router.put('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const { gradeCode, gradeName } = req.body;

    // Validate required fields
    if (!gradeCode || !gradeName) {
      return res.status(400).json({ error: 'gradeCode and gradeName are required' });
    }

    // Find the grade
    const grade = await Grade.findOne({
      where: {
        id: req.params.id
      }
    });

    if (!grade) {
      return res.status(404).json({ error: 'Grade not found' });
    }

    // Check if updated gradeCode conflicts with existing grade
    if (gradeCode !== grade.grade_code) {
      const existingGrade = await Grade.findOne({
        where: {
          grade_code: { [Op.iLike]: gradeCode },
          id: { [Op.ne]: req.params.id } // Exclude current grade
        }
      });

      if (existingGrade) {
        return res.status(400).json({ error: 'Grade code already exists' });
      }
    }

    // Update grade
    await grade.update({
      grade_code: gradeCode,
      grade_name: gradeName
    });

    res.json(grade);
  } catch (error) {
    console.error('Error updating grade:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE grade with cascading deletes
router.delete('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const gradeId = req.params.id;
    
    // Start a transaction for atomic operations
    const transaction = await sequelize.transaction();

    try {
      // Step 1: Find all subjects for this grade
      const subjects = await sequelize.query(
        `SELECT id FROM subjects WHERE "gradeId" = :gradeId`,
        {
          replacements: { gradeId },
          type: Sequelize.QueryTypes.SELECT,
          transaction
        }
      );

      const subjectIds = subjects.map(s => s.id);

      if (subjectIds.length > 0) {
        // Step 2: Find all topics for these subjects
        const topics = await sequelize.query(
          `SELECT id FROM topics WHERE subject_id IN (:subjectIds)`,
          {
            replacements: { subjectIds },
            type: Sequelize.QueryTypes.SELECT,
            transaction
          }
        );

        const topicIds = topics.map(t => t.id);

        if (topicIds.length > 0) {
          // Step 3: Find all subtopics for these topics
          const subtopics = await sequelize.query(
            `SELECT id FROM subtopics WHERE topic_id IN (:topicIds)`,
            {
              replacements: { topicIds },
              type: Sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          const subtopicIds = subtopics.map(st => st.id);

          if (subtopicIds.length > 0) {
            // Step 4: Delete all homeworks for these subtopics
            await sequelize.query(
              `DELETE FROM homeworks WHERE "subtopicId" IN (:subtopicIds)`,
              {
                replacements: { subtopicIds },
                type: Sequelize.QueryTypes.DELETE,
                transaction
              }
            );
          }

          // Step 5: Delete all subtopics
          await sequelize.query(
            `DELETE FROM subtopics WHERE topic_id IN (:topicIds)`,
            {
              replacements: { topicIds },
              type: Sequelize.QueryTypes.DELETE,
              transaction
            }
          );
        }

        // Step 6: Delete all topics
        await sequelize.query(
          `DELETE FROM topics WHERE subject_id IN (:subjectIds)`,
          {
            replacements: { subjectIds },
            type: Sequelize.QueryTypes.DELETE,
            transaction
          }
        );
      }

      // Step 7: Delete all subjects
      await sequelize.query(
        `DELETE FROM subjects WHERE "gradeId" = :gradeId`,
        {
          replacements: { gradeId },
          type: Sequelize.QueryTypes.DELETE,
          transaction
        }
      );

      // Step 8: Delete the grade
      await Grade.destroy({
        where: { id: gradeId },
        transaction
      });

      await transaction.commit();
      res.json({ 
        success: true,
        message: 'Grade and all related subjects, topics, subtopics, and homeworks deleted successfully' 
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting grade:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;