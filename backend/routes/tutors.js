const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const User = require('../models/User.postgres.js');
const Center = require('../models/sequelize/Center');
const { AdminCenterAssignment } = require('../models/sequelize/associations');
const { sendTutorWelcomeEmail } = require('../utils/emailService');

// Configure multer for CV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/cvs';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed for CV upload'));
    }
  }
});

// Get filter options for tutor search
router.get('/filter-options', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    // Get all tutors with their profiles
    const tutors = await User.findAll({
      where: {
        role: 'tutor'
      },
      attributes: ['tutor_profile'],
      raw: true
    });

    // Extract unique subjects and specializations from tutor profiles
    const subjects = new Set();
    const specializations = new Set();
    const languages = new Set();

    tutors.forEach(tutor => {
      try {
        const profile = typeof tutor.tutor_profile === 'string' 
          ? JSON.parse(tutor.tutor_profile) 
          : tutor.tutor_profile;

        // Extract subjects
        if (profile && profile.subjects) {
          const subjectList = Array.isArray(profile.subjects) ? profile.subjects : [profile.subjects];
          subjectList.forEach(sub => {
            if (sub) subjects.add(sub);
          });
        }

        // Extract specializations
        if (profile && profile.specializations) {
          const specList = Array.isArray(profile.specializations) ? profile.specializations : [profile.specializations];
          specList.forEach(spec => {
            if (spec) specializations.add(spec);
          });
        }

        // Extract languages
        if (profile && profile.languagesSpoken) {
          const langList = Array.isArray(profile.languagesSpoken) ? profile.languagesSpoken : [profile.languagesSpoken];
          langList.forEach(lang => {
            if (lang) languages.add(lang);
          });
        }
      } catch (e) {
        console.error('Error processing tutor profile:', e);
      }
    });

    res.json({
      success: true,
      data: {
        subjects: Array.from(subjects),
        specializations: Array.from(specializations),
        languages: Array.from(languages)
      }
    });
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error.message
    });
  }
});

// Get all tutors with pagination, search, and filtering
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 1000, 
      sortBy = 'created_at',
      sortOrder = 'desc',
      name,
      minExperience,
      maxExperience,
      minRating,
      minRate,
      maxRate,
      verificationStatus,
      availableDay,
      availableTimeFrom,
      availableTimeTo
    } = req.query;

    // Check if any complex filters are applied
    const hasComplexFilters = minExperience || maxExperience || minRating || minRate || maxRate || verificationStatus || availableDay || availableTimeFrom || availableTimeTo;

    // Basic Sequelize query for tutors
    const { Op } = require('sequelize');
    let where = { role: 'tutor' };
    
    // Filter by center_id for admin users
    if (req.user.role === 'admin' && req.user.center_id) {
      where.center_id = req.user.center_id;
      console.log('Filtering tutors by center_id:', req.user.center_id);
    }

    // Name search filter
    if (name) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${name}%` } },
        { last_name: { [Op.iLike]: `%${name}%` } },
        { email: { [Op.iLike]: `%${name}%` } },
        { username: { [Op.iLike]: `%${name}%` } }
      ];
    }

    // Verification status filter
    if (verificationStatus && verificationStatus !== '') {
      where.account_status = verificationStatus;
    }

    const offset = (page - 1) * limit;
    
    // If complex filters are applied, fetch ALL tutors first, then filter client-side
    const fetchLimit = hasComplexFilters ? null : parseInt(limit);
    const fetchOffset = hasComplexFilters ? 0 : parseInt(offset);

    // Always use 'created_at' for ordering, regardless of query param
    const order = [['created_at', sortOrder.toUpperCase()]];

    console.log('Fetching tutors with where clause:', where);
    console.log('Has complex filters:', hasComplexFilters);

    const { count: total, rows: tutorsRaw } = await User.findAndCountAll({
      where,
      ...(fetchLimit && { offset: fetchOffset, limit: fetchLimit }),
      order,
      attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'role', 'created_at', 'is_active', 'account_status', 'tutor_profile', 'student_profile', 'assignments']
    });

    // Helper function to normalize/compare values for filtering
    const normalizeNumber = (val) => {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    // Map tutors and apply additional client-side filters
    let tutors = tutorsRaw.map(tutor => {
      const plain = tutor.get({ plain: true });
      const profile = plain.tutor_profile || {};
      
      console.log(`🎓 [TUTOR] ${plain.first_name}: tutor_profile =`, JSON.stringify(profile));
      
      return {
        ...plain,
        tutorProfile: profile,
        studentProfile: plain.student_profile || {},
        assignments: plain.assignments || {},
        _id: plain.id,
        firstName: plain.first_name || '',
        lastName: plain.last_name || '',
        fullName: `${plain.first_name || ''} ${plain.last_name || ''}`.trim(),
        createdAt: plain.created_at || '',
        isActive: plain.is_active !== undefined ? plain.is_active : true,
        accountStatus: plain.account_status || 'pending',
        // Extract fields for easier filtering - use correct field names from profile
        yearsOfExperience: profile.experience || profile.yearsOfExperience || 0,
        rating: profile.rating || 0,
        hourlyRate: profile.hourlyRate || profile.hourly_rate || 0,
        availability: profile.availability || {}
      };
    });

    // Apply experience filter (client-side)
    if (minExperience || maxExperience) {
      const beforeCount = tutors.length;
      tutors = tutors.filter(tutor => {
        const experience = normalizeNumber(tutor.yearsOfExperience);
        const min = minExperience ? normalizeNumber(minExperience) : 0;
        const max = maxExperience ? normalizeNumber(maxExperience) : Infinity;
        const matches = experience >= min && experience <= max;
        console.log(`Experience filter: tutor "${tutor.firstName}" has ${experience} years, filter is ${min}-${max}, matches: ${matches}`);
        return matches;
      });
      console.log(`After experience filter (${minExperience}-${maxExperience}): ${tutors.length} tutors (was ${beforeCount})`);
    }

    // Apply rating filter (client-side)
    if (minRating) {
      const minRatingVal = normalizeNumber(minRating);
      const beforeCount = tutors.length;
      tutors = tutors.filter(tutor => {
        const rating = normalizeNumber(tutor.rating);
        const matches = rating >= minRatingVal;
        console.log(`Rating filter: tutor "${tutor.firstName}" has ${rating} stars, filter is ${minRatingVal}+, matches: ${matches}`);
        return matches;
      });
      console.log(`After rating filter (${minRating}+): ${tutors.length} tutors (was ${beforeCount})`);
    }

    // Apply hourly rate filter (client-side)
    if (minRate || maxRate) {
      const beforeCount = tutors.length;
      tutors = tutors.filter(tutor => {
        const rate = normalizeNumber(tutor.hourlyRate);
        const min = minRate ? normalizeNumber(minRate) : 0;
        const max = maxRate ? normalizeNumber(maxRate) : Infinity;
        const matches = rate >= min && rate <= max;
        console.log(`Rate filter: tutor "${tutor.firstName}" charges $${rate}/hr, filter is $${min}-$${max}, matches: ${matches}`);
        return matches;
      });
      console.log(`After rate filter (${minRate}-${maxRate}): ${tutors.length} tutors (was ${beforeCount})`);
    }

    // Apply availability filters (client-side)
    if (availableDay || availableTimeFrom || availableTimeTo) {
      tutors = tutors.filter(tutor => {
        const availability = tutor.availability || {};
        
        // If no day specified, skip availability filtering
        if (!availableDay || availableDay === '') return true;
        
        const dayLower = availableDay.toLowerCase();
        const dayAvailability = availability[dayLower];
        
        // Check if tutor is available on the selected day
        if (!dayAvailability || !dayAvailability.available) return false;
        
        // If no time range specified, just check the day
        if (!availableTimeFrom && !availableTimeTo) return true;
        
        // Check time overlap
        const filterStart = availableTimeFrom ? availableTimeFrom : '00:00';
        const filterEnd = availableTimeTo ? availableTimeTo : '23:59';
        
        // Handle new format with start/end times
        if (dayAvailability.start && dayAvailability.end) {
          const tutorStart = dayAvailability.start;
          const tutorEnd = dayAvailability.end;
          
          // Check if there's an overlap
          return tutorStart <= filterEnd && tutorEnd >= filterStart;
        }
        
        // Handle old format with timeSlots array
        if (dayAvailability.timeSlots && Array.isArray(dayAvailability.timeSlots)) {
          return dayAvailability.timeSlots.some(slot => {
            if (typeof slot === 'string' && slot.includes('-')) {
              const [slotStart, slotEnd] = slot.split('-');
              return slotStart <= filterEnd && slotEnd >= filterStart;
            }
            return false;
          });
        }
        
        return true;
      });
      console.log(`After availability filter: ${tutors.length} tutors`);
    }

    // Re-calculate pagination based on filtered results
    const filteredTotal = tutors.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const currentOffset = (pageNum - 1) * limitNum;
    const paginatedTutors = tutors.slice(currentOffset, currentOffset + limitNum);

    console.log(`After filtering: ${filteredTotal} total tutors, returning page ${pageNum} with ${paginatedTutors.length} tutors`);

    res.json({
      success: true,
      data: {
        tutors: paginatedTutors,
        pagination: {
          current: pageNum,
          total: Math.ceil(filteredTotal / limitNum),
          count: paginatedTutors.length,
          totalRecords: filteredTotal
        },
        totalTutors: filteredTotal,
        currentPage: pageNum,
        totalPages: Math.ceil(filteredTotal / limitNum)
      }
    });
    return;
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tutors',
      message: error.message
    });
  }
});

// Get filter options for tutors (subjects, specializations, languages)
router.get('/filter-options', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const matchStage = { role: 'tutor' };
    
    // Filter by center for admin users
    if (req.user.role === 'admin') {
      if (req.user.center_id) {
        matchStage.center = req.user.center_id;
      }
    }
    
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          subjects: { $addToSet: { $arrayElemAt: ["$tutorProfile.subjects", 0] } },
          allSubjects: { $push: "$tutorProfile.subjects" },
          specializations: { $addToSet: { $arrayElemAt: ["$tutorProfile.specializations", 0] } },
          allSpecializations: { $push: "$tutorProfile.specializations" },
          languages: { $addToSet: { $arrayElemAt: ["$tutorProfile.languagesSpoken", 0] } },
          allLanguages: { $push: "$tutorProfile.languagesSpoken" },
          maxExperience: { $max: "$tutorProfile.experience" },
          minExperience: { $min: "$tutorProfile.experience" },
          maxRate: { $max: "$tutorProfile.hourlyRate" },
          minRate: { $min: "$tutorProfile.hourlyRate" }
        }
      }
    ];

    const result = await User.aggregate(pipeline);
    
    // Flatten arrays and remove empty values
    const flattenAndClean = (arrays) => {
      return [...new Set(
        arrays
          .flat(2)
          .filter(item => item && item.trim() !== '')
          .map(item => item.trim())
      )].sort();
    };

    const filterOptions = {
      subjects: result[0] ? flattenAndClean(result[0].allSubjects) : [],
      specializations: result[0] ? flattenAndClean(result[0].allSpecializations) : [],
      languages: result[0] ? flattenAndClean(result[0].allLanguages) : [],
      experienceRange: {
        min: result[0]?.minExperience || 0,
        max: result[0]?.maxExperience || 10
      },
      rateRange: {
        min: result[0]?.minRate || 0,
        max: result[0]?.maxRate || 100
      },
      verificationStatuses: ['pending', 'verified', 'rejected'],
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    };

    res.json({
      success: true,
      data: filterOptions
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error.message
    });
  }
});

// Get single tutor by ID
router.get('/:id', auth(['admin', 'superadmin', 'tutor']), async (req, res) => {
  try {
    const tutor = await User.findByPk(req.params.id);
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ success: false, error: 'Tutor not found' });
    }
    // Check center access for admin
    if (req.user.role === 'admin') {
      if (!req.user.center_id || tutor.center_id?.toString() !== req.user.center_id.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied: Tutor does not belong to your center' });
      }
    }
    // Allow tutors to view their own profile
    if (req.user.role === 'tutor' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied: You can only view your own profile' });
    }
    const plain = tutor.get({ plain: true });
    res.json({
      success: true,
      data: {
        ...plain,
        tutorProfile: plain.tutor_profile,
        studentProfile: plain.student_profile,
        assignments: plain.assignments
      }
    });
  } catch (error) {
    console.error('Get tutor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tutor',
      message: error.message
    });
  }
});

// Create new tutor
router.post('/', auth(['admin', 'superadmin']), upload.single('cv'), async (req, res) => {
    // Helper to parse JSON fields safely
    function safeParseJSON(val, fallback) {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (e) {
          return fallback;
        }
      }
      return val !== undefined ? val : fallback;
    }

    // Parse all relevant fields
    const parsedSubjects = safeParseJSON(req.body.subjects, []);
    const parsedEducation = safeParseJSON(req.body.education, []);
    const parsedCertifications = safeParseJSON(req.body.certifications, []);
    const parsedAddress = safeParseJSON(req.body.address, {});
    const parsedAvailability = safeParseJSON(req.body.availability, {});
    const parsedLanguagesSpoken = safeParseJSON(req.body.languagesSpoken, []);
    const parsedSpecializations = safeParseJSON(req.body.specializations, []);
    const parsedDocuments = safeParseJSON(req.body.documents, []);
    const parsedRating = safeParseJSON(req.body.rating, { average: 0, count: 0, experience: 0 });
  // Debug: Log incoming request body for tutor creation
  console.log('Tutor creation request body:', req.body);
    // Generate a 24-character hex string for the new tutor id
    function generateObjectId() {
      const timestamp = Math.floor(Date.now() / 1000).toString(16);
      return (
        timestamp +
        'xxxxxxxxxxxxxxxx'.replace(/[x]/g, function () {
          return ((Math.random() * 16) | 0).toString(16);
        })
      ).slice(0, 24);
    }
  try {
    const {
      // Step 1: Personal Information
      email,
      username,
      password, // Add password field
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      address,
      
      // Step 2: Qualifications
      education,
      experience,
      certifications,
      
      // Step 3: Subjects and other details
      subjects,
      bio,
      hourlyRate,
      currency,
      availability,
      languagesSpoken,
      specializations
    } = req.body;

    // Check if user already exists (case-insensitive, trimmed, Sequelize)
    const { Op } = require('sequelize');
    const trimmedEmail = email ? email.trim().toLowerCase() : '';
    const trimmedUsername = username ? username.trim().toLowerCase() : '';
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: trimmedEmail } },
          { username: { [Op.iLike]: trimmedUsername } }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: existingUser.email && existingUser.email.toLowerCase() === trimmedEmail
          ? 'Email already exists'
          : 'Username already exists'
      });
    }

    // Parse subjects if it's a string
    let parsedSubjects = subjects;
    if (typeof subjects === 'string') {
      try {
        parsedSubjects = JSON.parse(subjects);
      } catch (e) {
        parsedSubjects = subjects.split(',').map(s => s.trim());
      }
    }

    // Parse other arrays if they're strings
    let parsedEducation = education;
    if (typeof education === 'string') {
      try {
        parsedEducation = JSON.parse(education);
      } catch (e) {
        parsedEducation = [];
      }
    }

    let parsedCertifications = certifications;
    if (typeof certifications === 'string') {
      try {
        parsedCertifications = JSON.parse(certifications);
      } catch (e) {
        parsedCertifications = [];
      }
    }

    // Parse address if it's a string
    let parsedAddress = address;
    if (typeof address === 'string') {
      try {
        parsedAddress = JSON.parse(address);
      } catch (e) {
        parsedAddress = {};
      }
    }

    // Parse availability if it's a string
    let parsedAvailability = availability;
    if (typeof availability === 'string') {
      try {
        parsedAvailability = JSON.parse(availability);
      } catch (e) {
        parsedAvailability = {};
      }
    }

    // Parse languagesSpoken if it's a string
    let parsedLanguagesSpoken = languagesSpoken;
    if (typeof languagesSpoken === 'string') {
      try {
        parsedLanguagesSpoken = JSON.parse(languagesSpoken);
      } catch (e) {
        parsedLanguagesSpoken = [];
      }
    }

    // Parse specializations if it's a string
    let parsedSpecializations = specializations;
    if (typeof specializations === 'string') {
      try {
        parsedSpecializations = JSON.parse(specializations);
      } catch (e) {
        parsedSpecializations = [];
      }
    }

    // Use provided password or generate temporary password
    let tutorPassword;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (password && password.trim() && passwordRegex.test(password.trim())) {
      // Use the provided password if it meets security requirements
      tutorPassword = password.trim();
      console.log('Using provided password (meets security requirements)');
    } else {
      // Generate temporary password that meets validation requirements
      const generateSecurePassword = () => {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '@$!%*?&'; // Match the exact special chars in regex
        
        // Ensure at least one character from each required category
        let password = '';
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        // Fill the rest with random characters from all categories
        const allChars = uppercase + lowercase + numbers + special;
        for (let i = 4; i < 12; i++) {
          password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Shuffle the password
        return password.split('').sort(() => Math.random() - 0.5).join('');
      };

      tutorPassword = generateSecurePassword();
      console.log('Generated secure password (provided password did not meet requirements)');
    }


    // Accept center_id from request body (required for admin)
    let selectedCenterId = req.body.center_id;
    // Debug log for troubleshooting center assignment
    console.log('DEBUG: req.user.center_id =', req.user.center_id, '| submitted center_id =', selectedCenterId);
    if (req.user.role === 'admin') {
      // For one-to-one: admin must have center_id in their user record
      if (!req.user.center_id) {
        console.warn('DEBUG: Admin user has no center_id in session/JWT');
        return res.status(403).json({
          success: false,
          message: 'Admin is not assigned to any center.'
        });
      }
      // If center_id is provided, it must match admin's center_id (type-safe)
      if (!selectedCenterId || String(selectedCenterId) !== String(req.user.center_id)) {
        console.warn('DEBUG: Submitted center_id does not match admin center_id');
        return res.status(403).json({
          success: false,
          message: 'You can only create tutors for your assigned center.'
        });
      }
    } else {
      // Superadmin: allow any center_id, but validate it exists
      if (selectedCenterId) {
        const centerExists = await Center.findByPk(selectedCenterId);
        if (!centerExists) {
          return res.status(400).json({
            success: false,
            message: 'Provided center_id does not exist.'
          });
        }
      }
    }

    // Create tutor profile using Sequelize
    // Debug: Log experience value before assignment
    console.log('Raw experience value:', experience, '| typeof:', typeof experience);
    let experienceValue = 0;
    if (typeof experience === 'number' && !isNaN(experience)) {
      experienceValue = experience;
    } else if (typeof experience === 'string' && experience.trim() !== '' && !isNaN(Number(experience))) {
      experienceValue = Number(experience);
    }

    const tutorData = {
      id: generateObjectId(),
      email,
      username,
      password: tutorPassword,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNumber,
      role: 'tutor',
      is_active: true,
      account_status: 'active',
      center_id: selectedCenterId || null,
      assignments: {
        center: selectedCenterId || null,
        classes: [],
        children: []
      },
      tutorProfile: {
        rating: {
          count: (parsedRating && typeof parsedRating.count === 'number') ? parsedRating.count : 0,
          average: (parsedRating && typeof parsedRating.average === 'number') ? parsedRating.average : 0,
          experience: experienceValue
        },
        address: parsedAddress,
        currency: currency || '',
        subjects: parsedSubjects,
        documents: parsedDocuments,
        education: parsedEducation,
        hourlyRate: parseFloat(hourlyRate) || 0,
        availability: parsedAvailability,
        certifications: parsedCertifications,
        languagesSpoken: parsedLanguagesSpoken,
        specializations: parsedSpecializations,
        verificationStatus: req.body.verificationStatus || '',
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        experience: experienceValue,
        bio,
        cvPath: req.file ? req.file.path : null,
        cvOriginalName: req.file ? req.file.originalname : null
      }
    };

    // Use Sequelize's create method
  // Hash password before saving
  const { hashPassword } = User;
  let hashedPassword = tutorData.password;
  if (typeof hashPassword === 'function') {
    hashedPassword = await hashPassword(tutorData.password);
  }
  tutorData.password = hashedPassword;
  // Debug: Print final tutorData before saving
  console.log('Final tutorData to be saved:', JSON.stringify(tutorData, null, 2));
  const tutor = await User.create(tutorData);
  // Debug: Print created user object
  console.log('Created user from DB:', JSON.stringify(tutor.toJSON(), null, 2));

    // Send welcome email
    try {
      await sendTutorWelcomeEmail(tutor, tutorPassword);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Tutor created successfully. Welcome email sent.',
      data: {
        id: tutor.id,
        email: tutor.email,
        firstName: tutor.firstName,
        lastName: tutor.lastName
      }
    });
  } catch (error) {
    console.error('Create tutor error:', error);
    if (error && error.errors) {
      error.errors.forEach(e => console.error('Sequelize validation error:', e.message));
    }
    // Delete uploaded file if user creation failed
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create tutor',
      message: error.message,
      details: error.errors ? error.errors.map(e => e.message) : undefined
    });
  }
});

// Update tutor
router.put('/:id', auth(['admin', 'superadmin']), upload.single('cv'), async (req, res) => {
  try {
    const tutorId = req.params.id;
    let updateData = { ...req.body };

    console.log('📝 UPDATE TUTOR REQUEST:');
    console.log('  Tutor ID:', tutorId);
    console.log('  Request body keys:', Object.keys(updateData));

    // Extract isActive status
    const { isActive, is_active } = updateData;
    const activeStatus = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true);
    
    console.log('  isActive:', isActive);
    console.log('  is_active:', is_active);
    console.log('  Converted activeStatus:', activeStatus);
    
    // Handle password update if provided
    if (updateData.password && updateData.password.trim()) {
      const passwordToHash = updateData.password.trim();
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(passwordToHash)) {
        return res.status(400).json({
          success: false,
          error: 'Password validation failed',
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        });
      }
      const bcrypt = require('bcrypt');
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(passwordToHash, saltRounds);
      updateData.passwordChangedAt = new Date();
    } else {
      delete updateData.password;
    }

    // Parse JSON fields
    const parseField = (field) => {
      if (updateData[field] && typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (e) {
          updateData[field] = [];
        }
      }
    };
    ['subjects','education','certifications','address','availability','languagesSpoken','specializations'].forEach(parseField);

    // Get the existing tutor
    const tutor = await User.findByPk(tutorId);
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ success: false, error: 'Tutor not found' });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id || req.user.center || req.user.assignments?.center;
      if (!adminCenter || String(tutor.center_id) !== String(adminCenter)) {
        return res.status(403).json({ success: false, error: 'Access denied: Tutor does not belong to your center' });
      }
    }

    // Prepare updated data for Sequelize JSONB
    let updatedProfile = tutor.tutor_profile || {};
    const profileFields = ['dateOfBirth','address','education','experience','certifications','subjects','bio','hourlyRate','currency','availability','languagesSpoken','specializations'];
    profileFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updatedProfile[field] = field === 'hourlyRate' ? parseFloat(updateData[field]) : updateData[field];
      }
    });

    // Handle CV file update
    if (req.file) {
      if (updatedProfile.cvPath) {
        fs.unlink(updatedProfile.cvPath, (err) => {
          if (err) console.error('Failed to delete old CV:', err);
        });
      }
      updatedProfile.cvPath = req.file.path;
      updatedProfile.cvOriginalName = req.file.originalname;
    }

    // Update the tutor record
    console.log('  Updating tutor with data:');
    console.log('    is_active:', activeStatus);
    console.log('    account_status:', activeStatus ? 'active' : 'inactive');
    console.log('    first_name:', updateData.firstName);
    console.log('    last_name:', updateData.lastName);
    
    const updateResult = await User.update({
      first_name: updateData.firstName,
      last_name: updateData.lastName,
      email: updateData.email,
      username: updateData.username,
      phone_number: updateData.phoneNumber,
      is_active: activeStatus,  // Update is_active status
      account_status: activeStatus ? 'active' : 'inactive',  // Update account_status based on is_active
      tutor_profile: updatedProfile
    }, {
      where: { id: tutorId }
    });
    
    console.log('  ✅ User.update result:', updateResult);

    // Fetch updated tutor
    const updatedTutor = await User.findByPk(tutorId);
    const plain = updatedTutor.get({ plain: true });
    
    console.log('  ✅ After commit - is_active:', plain.is_active);
    console.log('  ✅ After commit - account_status:', plain.account_status);
    console.log('  ✅ Full updated tutor:', JSON.stringify(plain, null, 2));
    
    res.json({
      success: true,
      message: 'Tutor updated successfully',
      data: {
        ...plain,
        tutorProfile: plain.tutor_profile,
        studentProfile: plain.student_profile,
        assignments: plain.assignments
      }
    });
  } catch (error) {
    console.error('Update tutor error:', error);
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
    }
    res.status(500).json({ success: false, error: 'Failed to update tutor', message: error.message });
  }
});

// Delete single tutor
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const tutor = await User.findByPk(req.params.id);

    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({
        success: false,
        error: 'Tutor not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center_id || req.user.center || req.user.assignments?.center;
      if (!adminCenter || String(tutor.center_id) !== String(adminCenter)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Tutor does not belong to your center'
        });
      }
    }

    // Delete CV file if exists (Sequelize JSONB)
    if (tutor.tutor_profile && tutor.tutor_profile.cvPath) {
      fs.unlink(tutor.tutor_profile.cvPath, (err) => {
        if (err) console.error('Failed to delete CV file:', err);
      });
    }

    // First, delete all classes assigned to this tutor
    const ClassModel = require('../models/sequelize/Class');
    const classCount = await ClassModel.count({ where: { tutorId: req.params.id } });
    if (classCount > 0) {
      console.log(`🔍 Deleting ${classCount} classes before deleting tutor ${req.params.id}`);
      await ClassModel.destroy({ where: { tutorId: req.params.id } });
    }

    // Now delete the tutor
    await User.destroy({ where: { id: req.params.id } });

    res.json({
      success: true,
      message: 'Tutor deleted successfully',
      classesDeleted: classCount
    });
  } catch (error) {
    console.error('Delete tutor error:', error);
    
    // Handle foreign key constraint error
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete tutor',
        message: 'This tutor still has active classes. Please delete or reassign their classes first.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete tutor',
      message: error.message
    });
  }
});

// Bulk delete tutors
router.post('/bulk-delete', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { tutorIds } = req.body;

    if (!tutorIds || !Array.isArray(tutorIds) || tutorIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tutor IDs provided'
      });
    }

    // Build query with center filter for admins
    const query = { _id: { $in: tutorIds }, role: 'tutor' };
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter) {
        query.center = adminCenter;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Admin must be assigned to a center'
        });
      }
    }

    // Get tutors to delete their CV files
    const tutors = await User.find(query);

    // Delete CV files
    tutors.forEach(tutor => {
      if (tutor.tutorProfile && tutor.tutorProfile.cvPath) {
        fs.unlink(tutor.tutorProfile.cvPath, (err) => {
          if (err) console.error('Failed to delete CV file:', err);
        });
      }
    });

    // Delete tutors
    const result = await User.deleteMany(query);

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} tutors`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete tutors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tutors',
      message: error.message
    });
  }
});

// Update tutor status (activate/deactivate)
router.patch('/:id/status', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { isActive, accountStatus } = req.body;
    
    // First check if tutor exists and belongs to admin's center
    const tutor = await User.findById(req.params.id);
    
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({
        success: false,
        error: 'Tutor not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (!adminCenter || tutor.center?.toString() !== adminCenter.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Tutor does not belong to your center'
        });
      }
    }
    
    const updatedTutor = await User.findByIdAndUpdate(
      req.params.id,
      { 
        isActive: isActive !== undefined ? isActive : undefined,
        accountStatus: accountStatus || undefined
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Tutor status updated successfully',
      data: updatedTutor
    });
  } catch (error) {
    console.error('Update tutor status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tutor status',
      message: error.message
    });
  }
});

// Download tutor CV
router.get('/:id/cv', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const tutor = await User.findById(req.params.id);

    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({
        success: false,
        error: 'Tutor not found'
      });
    }

    // Check center access for admin
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (!adminCenter || tutor.center?.toString() !== adminCenter.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Tutor does not belong to your center'
        });
      }
    }

    if (!tutor.tutorProfile || !tutor.tutorProfile.cvPath) {
      return res.status(404).json({
        success: false,
        error: 'CV not found for this tutor'
      });
    }

    const filePath = tutor.tutorProfile.cvPath;
    const fileName = tutor.tutorProfile.cvOriginalName || `${tutor.firstName}_${tutor.lastName}_CV.pdf`;

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('CV download error:', err);
        res.status(404).json({
          success: false,
          error: 'CV file not found'
        });
      }
    });
  } catch (error) {
    console.error('Download CV error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download CV',
      message: error.message
    });
  }
});

module.exports = router;
