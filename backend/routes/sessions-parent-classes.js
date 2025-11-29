const express = require('express');
const router = express.Router();
const User = require('../models/User.postgres');
const auth = require('../middleware/auth');
const { pgClient } = require('../db');

// @route   GET /api/sessions/parent-classes
// @desc    Get all CLASSES (not sessions) for a parent's children - similar to tutor dashboard
// @access  Private (Parent)
router.get('/parent-classes', auth(['parent']), async (req, res) => {
  try {
    console.log('📋 Parent classes endpoint called by user:', req.user.id);
    const parentId = req.user.id;

    // Step 1: Find the parent
    const parent = await User.findByPk(parentId, {
      attributes: ['id', 'first_name', 'last_name', 'email'],
      raw: true
    });
    
    if (!parent) {
      console.log('❌ Parent not found with ID:', parentId);
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Step 2: Find all students and check which ones have this parent as parent_id
    const students = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'first_name', 'last_name', 'email', 'student_profile'],
      raw: true
    });

    const childrenIds = [];
    for (const student of students) {
      let studentProfile = student.student_profile;
      let parentIdInProfile = null;
      
      // Handle both JSON string and object formats
      if (typeof studentProfile === 'string') {
        try {
          const parsed = JSON.parse(studentProfile);
          parentIdInProfile = parsed.parent_id || parsed.parentId;
        } catch (e) {
          parentIdInProfile = null;
        }
      } else if (typeof studentProfile === 'object' && studentProfile) {
        parentIdInProfile = studentProfile.parent_id || studentProfile.parentId;
      }
      
      if (parentIdInProfile && parentIdInProfile.toString() === parentId.toString()) {
        childrenIds.push(student.id);
      }
    }

    console.log('👦 Found', childrenIds.length, 'children for parent');

    if (childrenIds.length === 0) {
      console.log('📝 No children assigned to this parent');
      return res.json({
        success: true,
        data: {
          classes: [],
          totalClasses: 0,
          children: [],
          parentInfo: {
            name: parent.first_name + ' ' + parent.last_name,
            childrenCount: 0
          }
        }
      });
    }

    // Get children details
    const children = students.filter(s => childrenIds.includes(s.id)).map(s => ({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      email: s.email
    }));

    console.log('👦 Children details:', children.map(c => c.firstName + ' ' + c.lastName));

    // Step 3: Query classes where these children are enrolled (using raw SQL to avoid relationship issues)
    let classes = [];
    if (childrenIds.length > 0) {
      try {
        // Convert childrenIds to strings for matching with VARCHAR array
        const childrenIdsStr = childrenIds.map(id => id.toString());
        
        const classQuery = `
          SELECT c.id, c.title, c.subject, c."tutorId", c.students, c.status, c."scheduleType", 
                 c."startTime", c.duration, c."classDate", c."recurringDays", 
                 c."startDate", c."endDate", c."meetingLink", c."meetingId"
          FROM "Classes" c
          WHERE EXISTS (
            SELECT 1 FROM unnest(c.students) AS st
            WHERE st = ANY($1::text[])
          )
        `;
        const classResult = await pgClient.query(classQuery, [childrenIdsStr]);
        console.log('📚 Found', classResult.rows.length, 'classes with these children');
        
        // Fetch tutor info for each class
        classes = await Promise.all(classResult.rows.map(async (cls) => {
          let tutor = null;
          if (cls.tutorId) {
            const tutorQuery = 'SELECT id, first_name, last_name, email FROM "users" WHERE id = $1';
            const tutorResult = await pgClient.query(tutorQuery, [cls.tutorId]);
            tutor = tutorResult.rows[0];
          }
          
          // Try to fetch subject name if subject ID exists
          let subjectName = 'N/A';
          if (cls.subject) {
            try {
              const subjectQuery = 'SELECT "subjectName" FROM subjects WHERE id = $1';
              const subjectResult = await pgClient.query(subjectQuery, [cls.subject]);
              if (subjectResult.rows[0]) {
                subjectName = subjectResult.rows[0].subjectName;
              } else {
                // If no matching subject found, just use a generic label
                subjectName = 'Class Subject';
              }
            } catch (e) {
              subjectName = 'Class Subject';
            }
          }
          
          // Filter to only show parent's children in the class
          const childrenInClass = (cls.students || []).filter(sid => childrenIdsStr.includes(sid.toString()));
          
          return {
            id: cls.id,
            title: cls.title,
            subject: subjectName,
            scheduleType: cls.scheduleType,
            startTime: cls.startTime,
            duration: cls.duration,
            classDate: cls.classDate,
            recurringDays: cls.recurringDays,
            startDate: cls.startDate,
            endDate: cls.endDate,
            status: cls.status,
            tutor: tutor ? {
              id: tutor.id,
              firstName: tutor.first_name,
              lastName: tutor.last_name,
              email: tutor.email
            } : null,
            childrenInClass: childrenInClass,
            totalStudents: cls.students ? cls.students.length : 0,
            meetingLink: cls.meetingLink,
            meetingId: cls.meetingId
          };
        }));
      } catch (classError) {
        console.error('❌ Error fetching classes:', classError);
        // Continue without classes rather than failing
      }
    }

    console.log('📊 Processed classes:', classes.length);

    // Return response with children and classes
    res.json({
      success: true,
      data: {
        classes: classes,
        totalClasses: classes.length,
        children: children,
        parentInfo: {
          name: parent.first_name + ' ' + parent.last_name,
          childrenCount: children.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching parent classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching classes',
      error: error.message
    });
  }
});

module.exports = router;