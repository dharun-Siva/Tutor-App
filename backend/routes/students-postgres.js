
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const User = require('../models/User.postgres');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');

// Get list of students by IDs
router.get('/list', auth(['tutor']), async (req, res) => {
  try {
    const { ids } = req.query;
    // Handle comma-separated string of IDs
    const studentIds = ids ? ids.split(',') : [];
    
    if (!studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'No student IDs provided'
      });
    }

    const students = await User.findAll({
      where: {
        id: {
          [Op.in]: studentIds
        },
        role: 'student'
      },
      attributes: ['id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'student_profile', 'created_at', 'updated_at', 'is_active', 'center_id']
    });

    res.json({
      success: true,
      students: students.map(student => ({
        id: student.id,
        username: student.username,
        email: student.email,
        first_name: student.first_name,
        last_name: student.last_name,
        phone_number: student.phone_number,
        role: student.role,
        is_active: student.is_active,
        center_id: student.center_id,
        created_at: student.created_at,
        updated_at: student.updated_at,
        student_profile: student.student_profile,
        dateOfBirth: student.student_profile?.dateOfBirth || 'Not provided'
      }))
    });

  } catch (error) {
    console.error('Error fetching students list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students list'
    });
  }
});

// Delete a student
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const studentId = req.params.id;
    
    // Get the student to verify role and center access
    const student = await User.findByPk(studentId, { transaction: t });
    
    if (!student || student.role !== 'student') {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id;
      if (!adminCenter || String(student.center_id) !== String(adminCenter)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          error: 'Access denied: Student does not belong to your center'
        });
      }
    }

    // Find all parents that have this student in their children array
    const parents = await User.findAll({
      where: {
        role: 'parent',
        assignments: {
          [Sequelize.Op.not]: null
        }
      },
      transaction: t
    });

    // Update each parent's children array
    for (const parent of parents) {
      if (parent.assignments && Array.isArray(parent.assignments.children)) {
        const updatedChildren = parent.assignments.children.filter(
          childId => childId.toString() !== studentId.toString()
        );
        
        await parent.update({
          assignments: {
            ...parent.assignments,
            children: updatedChildren
          }
        }, { transaction: t });
      }
    }

    // Delete the student
    await student.destroy({ transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });

  } catch (error) {
    await t.rollback();
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete student',
      message: error.message
    });
  }
});

// Get filter options for students selection modal
router.get('/filter-options', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    // Example: You may want to fetch these from DB in future
    const subjects = [
      'Math', 'Science', 'English', 'Social Studies', 'Computer Science', 'Art', 'Music', 'Physical Education'
    ];
    const preferredSubjects = subjects;
    const strugglingSubjects = subjects;
    const grades = [
      'Kindergarten', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
    ];
    res.json({
      success: true,
      data: {
        subjects,
        preferredSubjects,
        strugglingSubjects,
        grades
      }
    });
  } catch (error) {
    console.error('Error loading student filter options:', error);
    res.status(500).json({ success: false, message: 'Failed to load filter options', error: error.message });
  }
});

// Get all students with pagination
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 1000,
      search,
      name,
      status,
      grade,
      availableDay,
      availableTimeStart,
      availableTimeEnd,
      ageFrom,
      ageTo
    } = req.query;
    
    // Check if any complex filters are applied (grade, age, availability)
    const hasComplexFilters = grade || ageFrom || ageTo || availableDay || availableTimeStart || availableTimeEnd;
    
    const whereClause = {
      role: 'student'
    };
    
    // Filter by center_id for admin users
    if (req.user.role === 'admin' && req.user.center_id) {
      whereClause.center_id = req.user.center_id;
      console.log('Filtering students by center_id:', req.user.center_id);
    }

    // Add search functionality (name or search param)
    const searchTerm = name || search;
    if (searchTerm) {
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${searchTerm}%` } },
        { last_name: { [Op.iLike]: `%${searchTerm}%` } },
        { email: { [Op.iLike]: `%${searchTerm}%` } },
        { username: { [Op.iLike]: `%${searchTerm}%` } }
      ];
    }

    // Add status filter
    if (status === 'active') {
      whereClause.is_active = true;
    } else if (status === 'inactive') {
      whereClause.is_active = false;
    }

    console.log('Fetching students with where clause:', whereClause);
    console.log('Has complex filters:', hasComplexFilters);

    // If complex filters are applied, fetch ALL students first, then filter client-side
    // This ensures grade/age/availability filters work correctly across all students
    const fetchLimit = hasComplexFilters ? null : parseInt(limit);
    const fetchOffset = hasComplexFilters ? 0 : (parseInt(page) - 1) * parseInt(limit);

    const result = await User.findAndCountAll({
      where: whereClause,
      attributes: [
        'id',
        'username',
        'email',
        'first_name',
        'last_name',
        'role',
        'is_active',
        'account_status',
        'center_id',
        'phone_number',
        'student_profile',
        'created_at',
        'updated_at'
      ],
      order: [['created_at', 'DESC']],
      ...(fetchLimit && { limit: fetchLimit }),
      ...(fetchOffset && { offset: fetchOffset }),
      raw: true
    });

    const students = result.rows || [];
    const total = result.count || 0;

    console.log(`Found ${students.length} students out of ${total} total`);

    // Helper function to normalize grade format (10, 10th, 5th, 5 => comparable format)
    const normalizeGrade = (gradeStr) => {
      if (!gradeStr || typeof gradeStr !== 'string') return '';
      // Remove ordinal suffixes (th, st, nd, rd) and convert to number
      const normalized = gradeStr.trim().toLowerCase().replace(/(?:st|nd|rd|th)$/i, '').trim();
      return normalized;
    };

    // Process students to include profile information
    let processedStudents = students.map(student => {
      const profile = student.student_profile || {};
      return {
        ...student,
        phone_number: student.phone_number,
        grade: profile.grade || 'Not set',
        school: profile.school || 'Not provided',
        availability: profile.availability || 'Not set',
        dateOfBirth: profile.dateOfBirth || null,
        enrollment_date: student.created_at
      };
    });

    // PRE-PAGINATION FILTERS (Applied before pagination)
    // These need to be applied client-side since they involve JSON fields and complex logic
    
    // Apply grade filter - supports both "10" and "10th" formats
    if (grade && grade !== '') {
      const filterGradeNormalized = normalizeGrade(grade);
      processedStudents = processedStudents.filter(student => {
        const profile = student.student_profile || {};
        const studentGrade = profile.grade || 'Not set';
        const normalizedStudentGrade = normalizeGrade(studentGrade);
        
        console.log(`Grade filter: student="${studentGrade}" (normalized="${normalizedStudentGrade}") vs filter="${grade}" (normalized="${filterGradeNormalized}") => ${normalizedStudentGrade === filterGradeNormalized}`);
        
        return normalizedStudentGrade === filterGradeNormalized;
      });
    }

    // Apply age filters
    if (ageFrom || ageTo) {
      const today = new Date();
      processedStudents = processedStudents.filter(student => {
        const profile = student.student_profile || {};
        if (!profile.dateOfBirth) return true; // Include students without DOB
        
        const birthDate = new Date(profile.dateOfBirth);
        const age = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24 * 365));
        
        const isOldEnough = !ageFrom || age >= parseInt(ageFrom);
        const isYoungEnough = !ageTo || age <= parseInt(ageTo);
        
        return isOldEnough && isYoungEnough;
      });
    }

    // Apply availability filters (day and time range)
    if (availableDay || availableTimeStart || availableTimeEnd) {
      processedStudents = processedStudents.filter(student => {
        const profile = student.student_profile || {};
        const availability = profile.availability || {};
        
        // If no day is specified, skip availability filtering
        if (!availableDay || availableDay === '') return true;
        
        const dayLower = availableDay.toLowerCase();
        const dayAvailability = availability[dayLower];
        
        // Check if student is available on the selected day
        if (!dayAvailability || !dayAvailability.available) return false;
        
        // If no time range is specified, just check the day
        if (!availableTimeStart && !availableTimeEnd) return true;
        
        // Check time overlap
        const filterStart = availableTimeStart ? availableTimeStart : '00:00';
        const filterEnd = availableTimeEnd ? availableTimeEnd : '23:59';
        
        // Handle new format with start/end times
        if (dayAvailability.start && dayAvailability.end) {
          const studentStart = dayAvailability.start;
          const studentEnd = dayAvailability.end;
          
          // Check if there's an overlap between filter time and student availability
          return studentStart <= filterEnd && studentEnd >= filterStart;
        }
        
        // Handle old format with timeSlots array
        if (dayAvailability.timeSlots && Array.isArray(dayAvailability.timeSlots)) {
          return dayAvailability.timeSlots.some(slot => {
            if (typeof slot === 'string' && slot.includes('-')) {
              const [slotStart, slotEnd] = slot.split('-');
              // Check if there's an overlap
              return slotStart <= filterEnd && slotEnd >= filterStart;
            }
            return false;
          });
        }
        
        return true;
      });
    }

    // Re-calculate pagination based on filtered results
    const filteredTotal = processedStudents.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const currentOffset = (pageNum - 1) * limitNum;
    const paginatedStudents = processedStudents.slice(currentOffset, currentOffset + limitNum);

    console.log(`After filtering: ${filteredTotal} total students, returning page ${pageNum} with ${paginatedStudents.length} students`);

    res.json({
      success: true,
      data: {
        students: paginatedStudents,
        currentPage: pageNum,
        totalPages: Math.ceil(filteredTotal / limitNum),
        totalStudents: filteredTotal,
        pagination: {
          current: pageNum,
          total: Math.ceil(filteredTotal / limitNum),
          count: paginatedStudents.length,
          totalRecords: filteredTotal
        }
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'});
  }
});

// Update a student
router.put('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const studentId = req.params.id;
    const {
      first_name,
      firstName,
      last_name,
      lastName,
      email,
      username,
      password,
      phone_number,
      phoneNumber,
      address,
      grade,
      parent_id,
      preferred_subjects,
      struggling_subjects,
      is_active,
      isActive
    } = req.body;

    console.log('📝 UPDATE STUDENT REQUEST:');
    console.log('  Student ID:', studentId);
    console.log('  Request body keys:', Object.keys(req.body));
    console.log('  is_active:', is_active);
    console.log('  isActive:', isActive);
    console.log('  Full req.body:', JSON.stringify(req.body, null, 2));

    // Convert camelCase to snake_case for database fields
    const activeStatus = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true);
    console.log('  Converted activeStatus:', activeStatus);

    // Get the student to verify role and center access
    const student = await User.findByPk(studentId, { transaction: t });

    if (!student || student.role !== 'student') {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id;
      if (!adminCenter || String(student.center_id) !== String(adminCenter)) {
        await t.rollback();
        return res.status(403).json({
          success: false,
          error: 'Access denied: Student does not belong to your center'
        });
      }
    }

    // Check if email or username is being changed and if they're already taken
    if ((email && email !== student.email) || (username && username !== student.username)) {
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: email?.toLowerCase() },
            { username: username?.toLowerCase() }
          ],
          id: { [Op.ne]: studentId }
        },
        transaction: t
      });

      if (existingUser) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Email or username already exists'
        });
      }
    }

    // Prepare update data
    const updateData = {
      first_name: firstName || first_name || student.first_name,
      last_name: lastName || last_name || student.last_name,
      email: email?.toLowerCase() || student.email,
      username: username?.toLowerCase() || student.username,
      phone_number: phoneNumber || phone_number || student.phone_number,
      address: address || student.address,
      is_active: activeStatus,  // Use snake_case to match database column
      account_status: activeStatus ? 'active' : 'inactive',  // Update account_status based on is_active
      data: {
        ...student.data,
        grade: grade || student.data?.grade,
        preferred_subjects: preferred_subjects || student.data?.preferred_subjects,
        struggling_subjects: struggling_subjects || student.data?.struggling_subjects
      }
    };

    // Hash password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Update student data
    console.log('  Updating student with data:', JSON.stringify(updateData, null, 2));
    await student.update(updateData, { transaction: t });
    console.log('  ✅ Student updated in DB');

    // If parent_id is provided, update parent's children array
    if (parent_id) {
      const parent = await User.findOne({
        where: { id: parent_id, role: 'parent' },
        transaction: t
      });

      if (parent) {
        const currentAssignments = parent.assignments || {};
        const currentChildren = currentAssignments.children || [];
        
        if (!currentChildren.includes(studentId)) {
          await parent.update({
            assignments: {
              ...currentAssignments,
              children: [...currentChildren, studentId]
            }
          }, { transaction: t });
        }
      }
    }

    await t.commit();

    // Refresh student data from database to get updated isActive value
    const updatedStudent = await User.findByPk(studentId);
    console.log('  ✅ After commit - updatedStudent.isActive:', updatedStudent.isActive);
    console.log('  ✅ After commit - updatedStudent.is_active (via field):', updatedStudent.dataValues?.is_active);
    console.log('  ✅ Full updatedStudent:', JSON.stringify(updatedStudent.dataValues, null, 2));

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: {
        id: updatedStudent.id,
        username: updatedStudent.username,
        email: updatedStudent.email,
        first_name: updatedStudent.first_name,
        last_name: updatedStudent.last_name,
        role: updatedStudent.role,
        is_active: updatedStudent.isActive,
        phone_number: updatedStudent.phoneNumber,
        address: updatedStudent.address,
        data: updatedStudent.data
      }
    });
    console.log('  ✅ Response sent with is_active:', updatedStudent.isActive);

  } catch (error) {
    await t.rollback();
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update student',
      message: error.message
    });
  }
});

// Get a specific student by ID
router.get('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // Get student with all details
    const student = await User.findOne({
      where: {
        id: studentId,
        role: 'student'
      },
      attributes: [
        'id',
        'username',
        'email',
        'first_name',
        'last_name',
        'phone_number',
        'address',
        'is_active',
        'center_id',
        'data',
        'created_at',
        'updated_at'
      ]
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id;
      if (!adminCenter || String(student.center_id) !== String(adminCenter)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Student does not belong to your center'
        });
      }
    }

    res.json({
      success: true,
      data: student
    });

  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student',
      message: error.message
    });
  }
});

// Create new student
router.post('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    if (!req.body.email || !req.body.username || !req.body.password || 
        !req.body.firstName || !req.body.lastName || !req.body.parentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        error: 'Email, username, password, firstName, lastName and parent selection are required'
      });
    }

    if (req.body.username.length < 3 || req.body.username.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Invalid username length',
        error: 'Username must be between 3 and 50 characters long'
      });
    }

    // Check if email already exists
    const existingUserWithEmail = await User.findOne({
      where: { email: req.body.email }
    });
    if (existingUserWithEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
        error: 'A user with this email already exists'
      });
    }

    // Check if username already exists
    const existingUserWithUsername = await User.findOne({
      where: { username: req.body.username }
    });
    if (existingUserWithUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists',
        error: 'A user with this username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Find parent and get center_id
    let center_id = null;
    let parent_id = null;
    
    if (req.body.parentId) {
      // First try to find parent by ID
      let parent = await User.findOne({
        where: {
          id: req.body.parentId,
          role: 'parent'
        }
      });
      
      // If not found by ID, check if it's an email
      if (!parent && req.body.parentId.includes('@')) {
        parent = await User.findOne({
          where: { 
            email: req.body.parentId,
            role: 'parent'
          }
        });
      }
      
      // If still not found, try extracting email from parentheses
      if (!parent) {
        const emailMatch = req.body.parentId.match(/\((.*?)\)/);
        if (emailMatch) {
          parent = await User.findOne({
            where: { 
              email: emailMatch[1],
              role: 'parent'
            }
          });
        }
      }
      
      if (parent) {
        center_id = parent.center_id;
        parent_id = parent.id;
        console.log('Found parent:', { id: parent.id, email: parent.email });
      } else {
        console.log('Parent not found with identifier:', req.body.parentId);
      }
    }

    const now = new Date().toISOString();

    // Create new student
    const newStudent = await User.create({
      email: req.body.email.toLowerCase(),
      username: req.body.username,
      password: hashedPassword,
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      phone_number: req.body.phone || req.body.parentContact?.phone || null,
      role: 'student',
      center_id: center_id,
      is_active: true,
      assignments: {
        center: center_id,
        classes: [],
        children: []
      },
      studentProfile: {
        goals: req.body.goals || '',
        grade: req.body.grade,
        notes: req.body.notes || '',
        school: req.body.school,
        parentContact: {
          name: req.body.parentContact?.name || req.body.parentName || '',
          email: req.body.parentContact?.email || req.body.parentEmail || '',
          phone: req.body.parentContact?.phone || req.body.parentPhone || ''
        },
        status: req.body.status || 'enrolled',
        address: req.body.address || {
          city: '',
          state: '',
          street: '',
          country: '',
          zipCode: ''
        },
        currency: req.body.currency || 'USD',
        subjects: req.body.subjects || [],
        documents: req.body.documents || [],
        education: req.body.education || [],
        hourlyRate: req.body.hourlyRate || 85,
        availability: req.body.availability || {
          friday: { available: false, timeSlots: [], timeSlotsZones: [] },
          monday: { available: false, timeSlots: [], timeSlotsZones: [] },
          sunday: { available: false, timeSlots: [], timeSlotsZones: [] },
          tuesday: { available: false, timeSlots: [], timeSlotsZones: [] },
          saturday: { available: false, timeSlots: [], timeSlotsZones: [] },
          thursday: { available: false, timeSlots: [], timeSlotsZones: [] },
          wednesday: { available: false, timeSlots: [], timeSlotsZones: [] }
        },
        learningStyle: req.body.learningStyle || '',
        enrollmentDate: req.body.enrollmentDate || now,
        preferredSubjects: req.body.preferredSubjects || [],
        strugglingSubjects: req.body.strugglingSubjects || [],
        verificationStatus: req.body.verificationStatus || '',
        dateOfBirth: req.body.dateOfBirth,
        medicalInfo: {
          allergies: req.body.medicalInfo?.allergies || '',
          conditions: req.body.medicalInfo?.conditions || '',
          medications: req.body.medicalInfo?.medications || '',
          doctorContact: req.body.medicalInfo?.doctorContact || '',
          emergencyInfo: req.body.medicalInfo?.emergencyInfo || ''
        },
        parent_id: parent_id
      }
    });

    // After creating the student, add their ID to the parent's assignments.children array
    if (parent_id) {
      console.log('Adding student', newStudent.id, 'to parent', parent_id);
      
      // First get the current parent data
      const parent = await User.findByPk(parent_id);
      if (parent) {
        // Initialize assignments if it doesn't exist
        if (!parent.assignments) {
          parent.assignments = {
            center: parent.center_id,
            classes: [],
            children: []
          };
        }
        
        // Initialize children array if it doesn't exist
        if (!parent.assignments.children) {
          parent.assignments.children = [];
        }
        
        // Add student ID if not already present
        if (!parent.assignments.children.includes(newStudent.id)) {
          parent.assignments.children.push(newStudent.id);
          
          // Update the parent
          await User.update(
            { assignments: parent.assignments },
            { where: { id: parent_id } }
          );
          
          console.log('Updated parent assignments:', parent.assignments);
        } else {
          console.log('Student already in parent\'s children array');
        }
      } else {
        console.log('Parent not found when trying to update children array');
      }
    }

    const responseData = newStudent.toJSON();
    delete responseData.password;

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create student',
      message: error.message
    });
  }
});

module.exports = router;