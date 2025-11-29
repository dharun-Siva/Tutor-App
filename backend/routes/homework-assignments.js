const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const HomeworkAssignment = require('../models/HomeworkAssignment');
const Homework = require('../models/Homework');
const User = require('../models/User');
const Class = require('../models/Class');
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
// GET /api/homework-assignments/parent - Get all assignments for parent's children
router.get('/parent', auth(['parent']), async (req, res) => {
  try {
    const parentId = req.user.id;
    // Find parent and get children from assignments.children
    const parent = await User.findById(parentId)
      .populate('assignments.children', '_id firstName lastName fullName email')
      .select('assignments.children');

    if (!parent || !parent.assignments || !parent.assignments.children || parent.assignments.children.length === 0) {
      return res.json({ assignments: [] });
    }

    const childrenIds = parent.assignments.children.map(child => child._id);

    // Get assignments for all children
    const assignments = await HomeworkAssignment.find({
      studentId: { $in: childrenIds },
      isActive: true
    })
      .populate({
        path: 'homeworkId',
        select: 'homeworkName description gradeId subjectId topicId subtopicId dueDate filePath',
        populate: [
          { path: 'gradeId', select: 'name' },
          { path: 'subjectId', select: 'name' },
          { path: 'topicId', select: 'name' },
          { path: 'subtopicId', select: 'name' }
        ]
      })
      .populate('studentId', 'firstName lastName fullName email')
      .populate('tutorId', 'firstName lastName fullName email')
      .populate({
        path: 'classId',
        select: 'title subject grade',
        populate: {
          path: 'center',
          select: 'name'
        }
      })
      .sort({ assignedDate: -1 });

    // Format response for frontend
    function formatDate(date) {
      if (!date) return '-';
      const d = new Date(date);
      // Only show valid dates, otherwise '-'
      return (d instanceof Date && !isNaN(d.getTime())) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
    }

    // Format response for frontend - return populated objects instead of flattened strings
    const formattedAssignments = assignments.map(assignment => ({
      _id: assignment._id,
      homework: assignment.homeworkId, // Keep populated homework object
      student: assignment.studentId, // Keep populated student object
      tutor: assignment.tutorId, // Keep populated tutor object
      class: assignment.classId, // Keep populated class object
      assignedDate: assignment.assignedDate,
      startDate: assignment.startDate,
      dueDate: assignment.dueDate || assignment.homeworkId?.dueDate,
      status: assignment.status,
      notes: assignment.notes,
      isActive: assignment.isActive
    }));

    res.json({ assignments: formattedAssignments });
  } catch (error) {
    console.error('Error fetching parent assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET /api/homework-assignments/admin - Get all assignments for admin dashboard
router.get('/admin', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, centerId, classId, tutorId, studentId } = req.query;

    // Build filter
    const filter = { isActive: true };
    if (status) filter.status = status;
    if (centerId) filter.centerId = centerId;
    if (classId) filter.classId = classId;
    if (tutorId) filter.tutorId = tutorId;
    if (studentId) filter.studentId = studentId;

    // Add center filter for admin users (only show assignments from their center)
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter) {
        filter.centerId = adminCenter;
      } else {
        return res.json({
          assignments: [],
          pagination: {
            current: parseInt(page),
            pages: 0,
            total: 0
          }
        });
      }
    }

    const skip = (page - 1) * limit;

    // Get assignments with all necessary population
    const assignments = await HomeworkAssignment.find(filter)
      .populate({
        path: 'homeworkId',
        select: 'homeworkName description gradeId subjectId topicId subtopicId dueDate filePath',
        populate: [
          { path: 'gradeId', select: 'name' },
          { path: 'subjectId', select: 'name' },
          { path: 'topicId', select: 'name' },
          { path: 'subtopicId', select: 'name' }
        ]
      })
      .populate('studentId', 'firstName lastName fullName email')
      .populate('tutorId', 'firstName lastName fullName email')
      .populate('centerId', 'name')
      .populate('classId', 'title subject grade')
      .sort({ assignedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalAssignments = await HomeworkAssignment.countDocuments(filter);

    // Format response for admin dashboard
    const formattedAssignments = assignments.map(assignment => ({
      _id: assignment._id,
      centerName: assignment.centerId?.name || '-',
      className: assignment.classId?.title || '-',
      subjectName: assignment.homeworkId?.subjectId?.name || assignment.classId?.subject || '-',
      studentName: assignment.studentId?.fullName || assignment.studentId?.firstName || '-',
      tutorName: assignment.tutorId?.fullName || assignment.tutorId?.firstName || '-',
      scheduleAssignment: assignment.homeworkId?.homeworkName || 'Assignment',
      assignedDate: assignment.assignedDate,
      startDate: assignment.startDate,
      dueDate: assignment.dueDate || assignment.homeworkId?.dueDate,
      completedDate: assignment.completedDate,
      status: assignment.status === 'completed' ? 'complete' : 
             assignment.status === 'inprogress' ? 'progress' : 
             assignment.status === 'assigned' ? 'incomplete' : assignment.status,
      notes: assignment.notes,
      isActive: assignment.isActive
    }));

    res.json({
      assignments: formattedAssignments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalAssignments / limit),
        total: totalAssignments
      }
    });
  } catch (error) {
    console.error('Error fetching admin assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

const Topic = require('../models/Topic');
const Subtopic = require('../models/Subtopic');

// GET /api/homework-assignments/tutor - Get all assignments created by tutor
router.get('/tutor', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    console.log('🎯 GET /tutor endpoint called by tutor:', tutorId);
    console.log('🎯 Request query params:', req.query);
    
    const { status, classId, page = 1, limit = 10 } = req.query;
    
    const filter = { tutorId }; // Remove isActive: true to show all assignments
    if (status) filter.status = status;
    if (classId) filter.classId = classId;
    
    console.log('🎯 Assignment filter (showing all assignments):', filter);
    
    const skip = (page - 1) * limit;
    
    const assignments = await HomeworkAssignment.find(filter)
      .select('homeworkId studentId tutorId classId status assignedDate startDate dueDate notes submissionData grade feedback isActive createdAt updatedAt')
      .populate({
        path: 'homework',
        select: 'homeworkName description gradeId subjectId topicId subtopicId dueDate filePath',
        populate: [
          { path: 'gradeId', select: 'name' },
          { path: 'subjectId', select: 'name' },
          { path: 'topicId', select: 'name' },
          { path: 'subtopicId', select: 'name' }
        ]
      })
      .populate('student', 'firstName lastName email fullName studentProfile')
      .populate('class', 'title subject')
      .sort({ assignedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalAssignments = await HomeworkAssignment.countDocuments(filter);
    
    console.log('🎯 Found assignments:', assignments.length);
    console.log('🎯 Total assignments in DB:', totalAssignments);
    
    // Debug: Log assignment data to check if startDate, dueDate, notes are included
    console.log('🔍 Sample assignment data:', assignments[0] && {
      id: assignments[0]._id,
      homework: assignments[0].homework?.homeworkName,
      student: assignments[0].student?.fullName,
      class: assignments[0].class?.title,
      startDate: assignments[0].startDate,
      dueDate: assignments[0].dueDate,
      notes: assignments[0].notes,
      status: assignments[0].status,
      isActive: assignments[0].isActive
    });
    
    res.json({
      assignments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalAssignments / limit),
        total: totalAssignments
      }
    });
    
  } catch (error) {
    console.error('Error fetching tutor assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// GET /api/homework-assignments/student - Get all assignments for a student with saved answers
router.get('/student', auth(['student']), async (req, res) => {
  try {
    const StudentAnswer = require('../models/StudentAnswer');
    const studentId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    const filter = { studentId, isActive: true };
    if (status) filter.status = status;
    
    const skip = (page - 1) * limit;
    
    const assignments = await HomeworkAssignment.find(filter)
      .select('homeworkId studentId tutorId classId status assignedDate startDate dueDate notes submissionData grade feedback isActive createdAt updatedAt')
      .populate({
        path: 'homework',
        select: 'homeworkName description filePath exerciseData csvContent dueDate',
        populate: [
          { path: 'gradeId', select: 'name' },
          { path: 'subjectId', select: 'name' },
          { path: 'topicId', select: 'name' },
          { path: 'subtopicId', select: 'name' }
        ]
      })
      .populate('tutor', 'firstName lastName fullName')
      .populate('class', 'title subject')
      .sort({ assignedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get saved answers for all assignments
    const assignmentIds = assignments.map(a => a._id);
    const savedAnswers = await StudentAnswer.find({
      assignmentId: { $in: assignmentIds },
      studentId: studentId
    }).select('assignmentId pages currentPage lastUpdated');
    
    // Create a map of saved answers by assignment ID with validation status
    const savedAnswersMap = {};
    savedAnswers.forEach(answer => {
      const validationData = {};
      
      // Extract validation status from each page's components
      answer.pages.forEach((page, pageIndex) => {
        if (page.components) {
          page.components.forEach(component => {
            if (component.questionNumber) {
              const questionKey = `page_${pageIndex}_question_${component.questionNumber}`;
              
              // Extract isCorrect status from different component types
              let isCorrect = undefined;
              let validationStatus = 'unknown';
              
              if (component.type === 'multiple_choice_checkbox' && component.studentAnswer) {
                isCorrect = component.studentAnswer.isCorrect;
                validationStatus = isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : 'unknown';
              } else if (component.type === 'fill_blank_question') {
                // Check blanks for isCorrect status
                if (component.blanks && component.blanks.length > 0 && component.blanks[0].isCorrect !== undefined) {
                  isCorrect = component.blanks[0].isCorrect;
                  validationStatus = isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : 'unknown';
                }
                // Also check studentAnswer for isCorrect (alternative storage)
                else if (component.studentAnswer && component.studentAnswer.isCorrect !== undefined) {
                  isCorrect = component.studentAnswer.isCorrect;
                  validationStatus = isCorrect === true ? 'correct' : isCorrect === false ? 'incorrect' : 'unknown';
                }
              }
              
              // Store validation data if we found it
              if (isCorrect !== undefined) {
                validationData[questionKey] = {
                  isCorrect: isCorrect,
                  validationStatus: validationStatus
                };
                console.log(`✅ Extracted validation for ${questionKey}: isCorrect=${isCorrect}, status=${validationStatus}`);
              } else {
                console.log(`⚠️ No validation data found for ${questionKey} in component:`, {
                  type: component.type,
                  hasStudentAnswer: !!component.studentAnswer,
                  hasBlanks: !!component.blanks,
                  componentKeys: Object.keys(component)
                });
              }
            }
          });
        }
      });
      
      savedAnswersMap[answer.assignmentId.toString()] = {
        pages: answer.pages,
        currentPage: answer.currentPage,
        lastUpdated: answer.lastUpdated,
        validationData: validationData
      };
      
      console.log(`📋 Assignment ${answer.assignmentId}: Found validation data for ${Object.keys(validationData).length} questions`);
    });
    
    const totalAssignments = await HomeworkAssignment.countDocuments(filter);
    
    console.log(`✅ Loaded ${assignments.length} assignments with saved answers for ${Object.keys(savedAnswersMap).length} assignments`);
    
    res.json({
      success: true,
      assignments,
      savedAnswers: savedAnswersMap,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalAssignments / limit),
        total: totalAssignments
      }
    });
    
  } catch (error) {
    console.error('Error fetching student assignments with saved answers:', error);
    res.status(500).json({ error: 'Failed to fetch assignments and saved answers' });
  }
});

// POST /api/homework-assignments/assign - Assign homework to students
router.post('/assign', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { homeworkId, studentIds, classId, startDate, dueDate, notes } = req.body;
    
    // Validation
    if (!homeworkId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: homeworkId, studentIds' });
    }
    
    // Verify homework exists
    const homework = await Homework.findById(homeworkId);
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    // Verify class exists and tutor owns it
    const classObj = await Class.findOne({ _id: classId, tutor: tutorId });
    if (!classObj) {
      return res.status(404).json({ error: 'Class not found or not assigned to you' });
    }
    
    // Verify students are in the class
    const validStudents = await User.find({ 
      _id: { $in: studentIds }, 
      role: 'student',
      isActive: true 
    });
    
    if (validStudents.length !== studentIds.length) {
      return res.status(400).json({ error: 'Some students not found or inactive' });
    }
    
    // Check if students are enrolled in the class
    const classStudentIds = classObj.students.map(id => id.toString());
    const invalidStudents = studentIds.filter(id => !classStudentIds.includes(id.toString()));
    
    if (invalidStudents.length > 0) {
      return res.status(400).json({ error: 'Some students are not enrolled in the selected class' });
    }
    
    // Create assignments (handle duplicate prevention)
    const assignments = [];
    const duplicateStudents = [];
    
    for (const studentId of studentIds) {
      try {
        const assignment = new HomeworkAssignment({
          homeworkId,
          studentId,
          tutorId,
          classId,
          centerId: classObj.center,
          startDate: startDate ? new Date(startDate) : undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          notes: notes || ''
        });
        
        const savedAssignment = await assignment.save();
        assignments.push(savedAssignment);
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate assignment
          const student = validStudents.find(s => s._id.toString() === studentId);
          duplicateStudents.push(student.fullName || `${student.firstName} ${student.lastName}`);
        } else {
          throw err;
        }
      }
    }
    
    // Populate the created assignments
    const populatedAssignments = await HomeworkAssignment.find({
      _id: { $in: assignments.map(a => a._id) }
    })
    .populate('homework', 'homeworkName')
    .populate('student', 'firstName lastName fullName')
    .populate('class', 'title');
    
    let message = `Successfully assigned homework to ${assignments.length} student(s)`;
    if (duplicateStudents.length > 0) {
      message += `. Note: ${duplicateStudents.join(', ')} already had this homework assigned.`;
    }
    
    res.status(201).json({
      message,
      assignments: populatedAssignments,
      duplicateStudents
    });
    
  } catch (error) {
    console.error('Error assigning homework:', error);
    res.status(500).json({ error: 'Failed to assign homework' });
  }
});

// PUT /api/homework-assignments/:id/status - Update assignment status (for students)
router.put('/:id/status', auth(['student', 'tutor']), async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { status, submissionData } = req.body;
    
    if (!['assigned', 'inprogress', 'completed', 'incomplete'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const filter = req.user.role === 'student' 
      ? { _id: assignmentId, studentId: req.user.id }
      : { _id: assignmentId, tutorId: req.user.id };
    
    const assignment = await HomeworkAssignment.findOne(filter);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    assignment.status = status;
    if (submissionData) {
      assignment.submissionData = submissionData;
    }
    
    await assignment.save();
    
    const populatedAssignment = await HomeworkAssignment.findById(assignmentId)
      .populate('homework', 'homeworkName')
      .populate('student', 'firstName lastName fullName')
      .populate('class', 'title');
    
    res.json({
      message: `Assignment status updated to ${status}`,
      assignment: populatedAssignment
    });
    
  } catch (error) {
    console.error('Error updating assignment status:', error);
    res.status(500).json({ error: 'Failed to update assignment status' });
  }
});

// PUT /api/homework-assignments/:id - Update assignment (for tutors)
router.put('/:id', auth(['tutor']), async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const tutorId = req.user.id;
    const { startDate, dueDate, notes, grade, feedback, isActive } = req.body;
    
    console.log('🔄 Updating assignment:', assignmentId, 'with data:', req.body);
    
    const assignment = await HomeworkAssignment.findOne({ 
      _id: assignmentId, 
      tutorId 
    });
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // Update allowed fields
    if (startDate !== undefined) assignment.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) assignment.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) assignment.notes = notes;
    if (grade !== undefined) assignment.grade = grade;
    if (feedback !== undefined) assignment.feedback = feedback;
    if (isActive !== undefined) assignment.isActive = isActive; // Allow reactivation/deactivation
    
    await assignment.save();
    
    console.log('✅ Assignment updated successfully:', {
      id: assignment._id,
      isActive: assignment.isActive,
      updated: assignment.updatedAt
    });
    
    const populatedAssignment = await HomeworkAssignment.findById(assignmentId)
      .populate('homework', 'homeworkName description')
      .populate('student', 'firstName lastName fullName')
      .populate('class', 'title');
    
    res.json({
      message: 'Assignment updated successfully',
      assignment: populatedAssignment
    });
    
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// DELETE /api/homework-assignments/:id - Cancel/delete assignment (for tutors)
router.delete('/:id', auth(['tutor']), async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const tutorId = req.user.id;
    
    const assignment = await HomeworkAssignment.findOne({ 
      _id: assignmentId, 
      tutorId 
    });
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // Hard delete - permanently remove the assignment
    await HomeworkAssignment.findByIdAndDelete(assignmentId);
    
    console.log('🗑️ Assignment permanently deleted:', assignmentId);
    res.json({ message: 'Assignment deleted successfully' });
    
  } catch (error) {
    console.error('Error cancelling assignment:', error);
    res.status(500).json({ error: 'Failed to cancel assignment' });
  }
});

// GET /api/homework-assignments/tutor/data - Get data for assignment form
router.get('/tutor/data', auth(['tutor']), async (req, res) => {
  try {
    const tutorId = req.user.id;
    console.log('🔄 Loading assignment form data for tutor:', tutorId);
    
    // Connect to tutor1 database for grades, subjects, topics, subtopics
    const tutor1DB = mongoose.connection.useDb('tutor1');
    
    // Get tutor's classes (from current database)
    const classes = await Class.find({ 
      tutor: tutorId, 
      status: { $in: ['active', 'scheduled'] } 
    })
    .populate('students', 'firstName lastName fullName email studentProfile')
    .select('title subject students');
    
    console.log('📚 Found classes:', classes.length);
    
    // Fetch data from tutor1 database collections
    const [grades, subjects, topics, subtopics] = await Promise.all([
      tutor1DB.collection('grades').find({}).sort({ gradeName: 1 }).toArray(),
      tutor1DB.collection('subjects').find({}).sort({ subjectName: 1 }).toArray(),
      tutor1DB.collection('topics').find({}).sort({ topicName: 1 }).toArray(),
      tutor1DB.collection('subtopics').find({}).sort({ subtopicName: 1 }).toArray()
    ]);
    
    // Format the data to match the expected structure in the frontend
    const formattedGrades = grades.map(grade => ({
      _id: grade._id,
      id: grade._id,
      name: grade.gradeName,
      gradeName: grade.gradeName,
      gradeCode: grade.gradeCode,
      centerId: grade.centerId
    }));
    
    const formattedSubjects = subjects.map(subject => ({
      _id: subject._id,
      id: subject._id,
      name: subject.subjectName,
      subjectName: subject.subjectName,
      subjectCode: subject.subjectCode,
      gradeId: subject.gradeId,
      centerId: subject.centerId
    }));
    
    const formattedTopics = topics.map(topic => ({
      _id: topic._id,
      id: topic._id,
      name: topic.topicName,
      topicName: topic.topicName,
      subjectId: topic.subjectId,
      centerId: topic.centerId
    }));
    
    const formattedSubtopics = subtopics.map(subtopic => ({
      _id: subtopic._id,
      id: subtopic._id,
      name: subtopic.subtopicName,
      subtopicName: subtopic.subtopicName,
      topicId: subtopic.topicId,
      centerId: subtopic.centerId
    }));
    
    console.log('📊 Form data counts:', {
      classes: classes.length,
      grades: formattedGrades.length,
      subjects: formattedSubjects.length,
      topics: formattedTopics.length,
      subtopics: formattedSubtopics.length
    });
    
    console.log('📋 Sample data:', {
      grades: formattedGrades.slice(0, 2).map(g => g.name),
      subjects: formattedSubjects.slice(0, 2).map(s => s.name),
      topics: formattedTopics.slice(0, 2).map(t => t.name),
      subtopics: formattedSubtopics.slice(0, 2).map(st => st.name)
    });
    
    res.json({
      classes,
      grades: formattedGrades,
      subjects: formattedSubjects,
      topics: formattedTopics,
      subtopics: formattedSubtopics
    });
    
  } catch (error) {
    console.error('Error fetching assignment form data:', error);
    res.status(500).json({ error: 'Failed to fetch form data' });
  }
});

// GET /api/homework-assignments/homework-list - Get homework by filters
router.get('/homework-list', auth(['tutor']), async (req, res) => {
  try {
    const { gradeId, subjectId, topicId, subtopicId } = req.query;
    
    const filter = { isActive: true };
    if (gradeId) filter.gradeId = gradeId;
    if (subjectId) filter.subjectId = subjectId;
    if (topicId) filter.topicId = topicId;
    if (subtopicId) filter.subtopicId = subtopicId;
    
    const homeworks = await Homework.find(filter)
      .populate('gradeId', 'name')
      .populate('subjectId', 'name')
      .populate('topicId', 'name')
      .populate('subtopicId', 'name')
      .select('homeworkName description dueDate filePath')
      .sort({ homeworkName: 1 });
    
    res.json({ homeworks });
    
  } catch (error) {
    console.error('Error fetching homework list:', error);
    res.status(500).json({ error: 'Failed to fetch homework list' });
  }
});

// GET /api/homework-assignments/:id - Get single assignment details
router.get('/:id', auth(['tutor', 'student']), async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const filter = { _id: assignmentId, isActive: true };
    if (userRole === 'student') {
      filter.studentId = userId;
    } else if (userRole === 'tutor') {
      filter.tutorId = userId;
    }
    
    const assignment = await HomeworkAssignment.findOne(filter)
      .populate({
        path: 'homework',
        select: 'homeworkName description filePath exerciseData csvContent dueDate',
        populate: [
          { path: 'gradeId', select: 'name' },
          { path: 'subjectId', select: 'name' },
          { path: 'topicId', select: 'name' },
          { path: 'subtopicId', select: 'name' }
        ]
      })
      .populate('student', 'firstName lastName fullName email')
      .populate('tutor', 'firstName lastName fullName')
      .populate('class', 'title subject');
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    res.json({ assignment });
    
  } catch (error) {
    console.error('Error fetching assignment details:', error);
    res.status(500).json({ error: 'Failed to fetch assignment details' });
  }
});

module.exports = router;