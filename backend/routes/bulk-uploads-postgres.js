const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-postgres');
const User = require('../models/User.postgres.js');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const sequelize = require('../config/database/config');
const multer = require('multer');
const csv = require('csv-parse');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Helper function to validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Helper function to validate phone number format
const isValidPhoneNumber = (phone) => {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phone ? phoneRegex.test(phone) : true; // Optional field
};

// Helper function to validate date format
const isValidDate = (date) => {
    if (!date) return false;
    const [day, month, year] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return dateObj instanceof Date && !isNaN(dateObj) &&
        dateObj.getDate() === day &&
        dateObj.getMonth() === month - 1 &&
        dateObj.getFullYear() === year;
};

// Helper function to parse date from DD-MM-YYYY to YYYY-MM-DD
const parseDate = (date) => {
    const [day, month, year] = date.split('-');
    return `${year}-${month}-${day}`;
};

// Helper function to create student profile data

const validateTutorFields = (data) => {
    const { user } = data;
    if (!user) return 'Missing user data';

    const requiredFields = [
        'firstName', 'lastName', 'email', 'username', 'password',
        'timeZone'
    ];
    
    const missingFields = requiredFields.filter(field => !user[field]);
    if (missingFields.length > 0) {
        return `Missing required fields: ${missingFields.join(', ')}`;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
        return 'Invalid email format';
    }

    // Validate password requirements
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(user.password)) {
        return 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }

    return null;
};

// Helper function to validate required fields for student/parent
const validateStudentParentFields = (row) => {
    const requiredFields = [
        'Parent First Name', 'Parent Last Name', 'Parent Email', 'Parent Password',
        'Student First Name', 'Student Last Name', 'Student Email', 'Student Username',
        'Student Password', 'Student Date of Birth (DD-MM-YYYY)', 'Student Time Zone',
        'Student Currency', 'Student Grade', 'Student School', 'Student Subjects of Interest'
    ];
    
    const missingFields = requiredFields.filter(field => !row[field]);
    if (missingFields.length > 0) {
        return `Missing required fields: ${missingFields.join(', ')}`;
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row['Parent Email'])) {
        return 'Invalid parent email format';
    }
    if (!emailRegex.test(row['Student Email'])) {
        return 'Invalid student email format';
    }

    // Validate passwords
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(row['Parent Password'])) {
        return 'Parent password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }
    if (!passwordRegex.test(row['Student Password'])) {
        return 'Student password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }

    // Validate date format
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-\d{4}$/;
    if (!dateRegex.test(row['Student Date of Birth (DD-MM-YYYY)'])) {
        return 'Invalid date format for Student Date of Birth. Use DD-MM-YYYY format';
    }

    return null;
};

// Helper function to structure tutor profile data
const createTutorProfileData = (row) => {
    const availability = {
        monday: { available: row['Monday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] },
        tuesday: { available: row['Tuesday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] },
        wednesday: { available: row['Wednesday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] },
        thursday: { available: row['Thursday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] },
        friday: { available: row['Friday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] },
        saturday: { available: row['Saturday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] },
        sunday: { available: row['Sunday Available'] === 'Yes', timeSlots: [], timeSlotsZones: [] }
    };

    const education = [];
    for (let i = 1; i <= 3; i++) {
        if (row[`Education${i}_Degree`]) {
            education.push({
                degree: row[`Education${i}_Degree`],
                institution: row[`Education${i}_Institution`],
                year: row[`Education${i}_Year`],
                fieldOfStudy: row[`Education${i}_Field of Study`]
            });
        }
    }

    const certifications = [];
    for (let i = 1; i <= 3; i++) {
        if (row[`Certification${i}_Name`]) {
            certifications.push({
                name: row[`Certification${i}_Name`],
                issuedBy: row[`Certification${i}_Issued By`],
                issueDate: row[`Certification${i}_Issue Date (DD-MM-YYYY)`],
                expiryDate: row[`Certification${i}_Expiry Date (DD-MM-YYYY)`],
                credentialId: row[`Certification${i}_Credential ID`]
            });
        }
    }

    return {
        address: {
            street: row['Street Address'] || '',
            city: row['City'] || '',
            state: row['State'] || '',
            zipCode: row['ZIP Code'] || '',
            country: 'US'
        },
        availability,
        rating: { average: 0, count: 0, experience: parseInt(row['Years of Experience']) || 0 },
        subjects: row['Subjects to Teach'].split(',').map(s => s.trim()),
        hourlyRate: parseFloat(row['Hourly Rate']) || 0,
        currency: row['Currency'] || 'USD',
        specializations: [],
        languagesSpoken: row['Languages Spoken'] ? row['Languages Spoken'].split(',').map(l => l.trim()) : [],
        verificationStatus: 'pending',
        education,
        certifications,
        documents: []
    };
};

// Helper function to create student profile data from CSV
const createStudentProfileFromCSV = (row, parentId) => {
    // Parse date of birth
    const dob = row['Student Date of Birth (DD-MM-YYYY) *'];
    const formattedDob = dob ? parseDate(dob) : null;
    
    const availability = {
        monday: { 
            available: row['Student Monday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        },
        tuesday: { 
            available: row['Student Tuesday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        },
        wednesday: { 
            available: row['Student Wednesday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        },
        thursday: { 
            available: row['Student Thursday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        },
        friday: { 
            available: row['Student Friday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        },
        saturday: { 
            available: row['Student Saturday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        },
        sunday: { 
            available: row['Student Sunday Available'] === 'true', 
            timeSlots: [],
            timeSlotsZones: []
        }
    };

    return {
        goals: row['Student Learning Goals'] || '',
        grade: row['Student Grade *'] || '',
        notes: row['Student Additional Notes'] || '',
        school: row['Student School *'] || '',
        status: 'enrolled',
        address: {
            city: row['Student City'] || '',
            state: row['Student State'] || '',
            street: row['Student Street'] || '',
            country: row['Student Country'] || '',
            zipCode: row['Student ZIP Code'] || ''
        },
        currency: row['Student Currency *'] || 'USD',
        subjects: row['Student Subjects of Interest *'] ? 
            row['Student Subjects of Interest *'].split(',').map(s => s.trim()) : [],
        documents: [],
        education: [],
        parent_id: parentId,
        hourlyRate: parseFloat(row['Student Hourly Rate']) || 0,
        dateOfBirth: row['Student Date of Birth (DD-MM-YYYY) *'] ? 
            parseDate(row['Student Date of Birth (DD-MM-YYYY) *']) : null,
        medicalInfo: {
            allergies: row['Student Allergies'] || '',
            conditions: row['Medical Conditions'] || '',
            medications: row['Student Medical Conditions'] || '',
            doctorContact: row['Doctor Contact'] || '',
            emergencyInfo: row['Emergency Contact'] || ''
        },
        availability: availability,
        learningStyle: row['Student Learning Style'] || '',
        parentContact: {
            name: `${row['Parent First Name *'] || ''} ${row['Parent Last Name *'] || ''}`.trim(),
            email: row['Parent Email *'] || '',
            phone: row['Parent Phone'] || ''
        },
        dateOfBirth: row['Student Date of Birth (DD-MM-YYYY) *'] ? parseDate(row['Student Date of Birth (DD-MM-YYYY) *']) : null,
        enrollmentDate: new Date().toISOString(),
        preferredSubjects: row['Student Subjects of Interest *'] ? 
            row['Student Subjects of Interest *'].split(',').map(s => s.trim()) : [],
        strugglingSubjects: row['Student Struggling Subjects'] ? 
            row['Student Struggling Subjects'].split(',').map(s => s.trim()) : [],
        verificationStatus: 'pending'
    };
};

// Helper function to validate parent and student fields
const validateParentStudentFields = (row, requiredFields) => {
    const errors = [];
    
    // Check required fields
    for (const field of requiredFields) {
        if (!row[field]) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    // Validate email formats if they exist
    if (row['Parent Email *'] && !isValidEmail(row['Parent Email *'])) {
        errors.push('Invalid parent email format');
    }
    if (row['Student Email *'] && !isValidEmail(row['Student Email *'])) {
        errors.push('Invalid student email format');
    }

    // Validate phone numbers if they exist
    if (row['Parent Phone'] && !isValidPhoneNumber(row['Parent Phone'])) {
        errors.push('Invalid parent phone number format');
    }
    if (row['Student Phone Number'] && !isValidPhoneNumber(row['Student Phone Number'])) {
        errors.push('Invalid student phone number format');
    }

    // Validate date format if exists
    if (row['Student Date of Birth (DD-MM-YYYY) *'] && !isValidDate(row['Student Date of Birth (DD-MM-YYYY) *'])) {
        errors.push('Invalid student date of birth format (DD-MM-YYYY)');
    }

    return errors;
};



// Bulk upload route for tutors
router.post('/tutors', auth(['admin', 'superadmin']), async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { data } = req.body;
        const results = {
            success: [],
            errors: []
        };

        for (const tutorData of data) {
            try {
                console.log('Processing tutor data:', JSON.stringify(tutorData, null, 2));
                
                // Validate required fields
                const validationError = validateTutorFields(tutorData);
                if (validationError) {
                    results.errors.push({ data: tutorData, error: validationError });
                    continue;
                }

                const { user, profile } = tutorData;

                // Check for existing user
                const existingUser = await User.findOne({
                    where: {
                        [Sequelize.Op.or]: [
                            { email: user.email.toLowerCase() },
                            { username: user.username }
                        ]
                    },
                    transaction: t
                });

                if (existingUser) {
                    results.errors.push({ data: tutorData, error: 'Email or username already exists' });
                    continue;
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(user.password, 10);

                // Create tutor data
                const createData = {
                    email: user.email.toLowerCase(),
                    username: user.username,
                    password: hashedPassword,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    phone_number: user.phoneNumber,
                    date_of_birth: user.dateOfBirth,
                    time_zone: user.timeZone,
                    role: 'tutor',
                    center_id: req.user.center_id,
                    is_active: user.isActive ?? true,
                    account_status: 'active',
                    tutorProfile: {
                        rating: {
                            count: 0,
                            average: 0,
                            experience: profile.experience?.years || 0
                        },
                        address: user.address || {},
                        currency: profile.teaching?.preferences?.currency || '',
                        subjects: profile.teaching?.subjects || [],
                        documents: [],
                        education: Array.isArray(profile.education) ? profile.education.map(edu => ({
                            degree: edu.degree || '',
                            institution: edu.institution || '',
                            year: edu.year || null,
                            fieldOfStudy: edu.fieldOfStudy || ''
                        })) : [],
                        hourlyRate: profile.teaching?.preferences?.hourlyRate || 0,
                        availability: {
                            friday: {
                                available: profile.availability?.friday?.available || false,
                                timeSlots: profile.availability?.friday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.friday?.timeSlotsZones || []
                            },
                            monday: {
                                available: profile.availability?.monday?.available || false,
                                timeSlots: profile.availability?.monday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.monday?.timeSlotsZones || []
                            },
                            sunday: {
                                available: profile.availability?.sunday?.available || false,
                                timeSlots: profile.availability?.sunday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.sunday?.timeSlotsZones || []
                            },
                            tuesday: {
                                available: profile.availability?.tuesday?.available || false,
                                timeSlots: profile.availability?.tuesday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.tuesday?.timeSlotsZones || []
                            },
                            saturday: {
                                available: profile.availability?.saturday?.available || false,
                                timeSlots: profile.availability?.saturday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.saturday?.timeSlotsZones || []
                            },
                            thursday: {
                                available: profile.availability?.thursday?.available || false,
                                timeSlots: profile.availability?.thursday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.thursday?.timeSlotsZones || []
                            },
                            wednesday: {
                                available: profile.availability?.wednesday?.available || false,
                                timeSlots: profile.availability?.wednesday?.timeSlots || [],
                                timeSlotsZones: profile.availability?.wednesday?.timeSlotsZones || []
                            }
                        },
                        certifications: Array.isArray(profile.certifications) ? profile.certifications : [],
                        languagesSpoken: profile.teaching?.languagesSpoken || [],
                        specializations: profile.teaching?.specializations || [],
                        verificationStatus: 'pending',
                        bio: profile.bio || ''
                    }
                };

                console.log('Creating tutor with data:', JSON.stringify(createData, null, 2));

                const newTutor = await User.create(createData, { 
                    transaction: t,
                });

                results.success.push(newTutor);

            } catch (error) {
                console.error('Error creating tutor:', error);
                results.errors.push({ data: tutorData, error: error.message });
            }
        }

        await t.commit();

        // Create error report CSV if there are errors
        let errorReportUrl = null;
        if (results.errors.length > 0) {
            // Format error rows for CSV
            const headers = ['Email', 'Username', 'First Name', 'Last Name', 'Error'];
            const csvRows = results.errors.map(err => {
                const userData = err.data?.user || {};
                return [
                    userData.email || '',
                    userData.username || '',
                    userData.firstName || '',
                    userData.lastName || '',
                    err.error || 'Unknown error'
                ].map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`)
                .join(',');
            });
            
            // Create CSV content
            const errorCsv = [
                headers.join(','),
                ...csvRows
            ].join('\\n');

            // Save CSV file
            const fs = require('fs');
            const filePath = 'uploads/error-reports/bulk-upload-errors.csv';
            fs.mkdirSync('uploads/error-reports', { recursive: true });
            fs.writeFileSync(filePath, errorCsv);
            errorReportUrl = '/error-reports/bulk-upload-errors.csv';
        }

        res.json({
            success: true,
            message: `Successfully created ${results.success.length} tutors with ${results.errors.length} errors`,
            data: {
                ...results,
                errorReportUrl
            }
        });

    } catch (error) {
        console.error('Transaction error:', error);
        await t.rollback();
        res.status(500).json({
            success: false,
            message: 'Error processing bulk upload',
            error: error.message
        });
    }
});

// Bulk upload route for students and parents
// Helper function to clean up deleted children from parent assignments
const cleanupDeletedChildrenFromParents = async (transaction) => {
    try {
        // Get all parent users
        const parents = await User.findAll({
            where: {
                role: 'parent',
                assignments: {
                    [Sequelize.Op.not]: null
                }
            },
            transaction
        });

        // For each parent, update their assignments.children array to only include existing student IDs
        for (const parent of parents) {
            if (parent.assignments && Array.isArray(parent.assignments.children)) {
                const existingChildren = await User.findAll({
                    where: {
                        id: parent.assignments.children,
                        role: 'student'
                    },
                    attributes: ['id'],
                    transaction
                });

                const validChildrenIds = existingChildren.map(child => child.id);
                
                // Update parent's assignments only if there are changes
                if (validChildrenIds.length !== parent.assignments.children.length) {
                    await User.update(
                        {
                            assignments: {
                                ...parent.assignments,
                                children: validChildrenIds
                            }
                        },
                        {
                            where: { id: parent.id },
                            transaction
                        }
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error cleaning up deleted children:', error);
        throw error;
    }
};

router.post('/students', auth(['admin', 'superadmin']), express.json(), async (req, res) => {
    const t = await sequelize.transaction();
    try {
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        // Clean up deleted children references first
        await cleanupDeletedChildrenFromParents(t);
        
        // Ensure we have an array of entries
        const entries = Array.isArray(req.body) ? req.body : (req.body.entries || []);
        
        if (!Array.isArray(entries)) {
            throw new Error('Invalid data format: expected an array of entries');
        }

        console.log('Processing entries:', JSON.stringify(entries, null, 2));

        const results = {
            success: [],
            errors: [],
            parentsCreated: 0,
            studentsCreated: 0
        };

        for (const entry of entries) {
            let parentId = null;
            try {
                console.log('Processing entry:', JSON.stringify(entry, null, 2));

                // 1. First create parent
                if (!entry.parent || !entry.parent.firstName || !entry.parent.lastName || !entry.parent.email) {
                    throw new Error('Missing required parent fields');
                }

                // Create parent account
                const hashedParentPassword = await bcrypt.hash(entry.parent.password.toString(), 10);
                const parentData = {
                    email: entry.parent.email.toLowerCase(),
                    username: entry.parent.username || entry.parent.email.split('@')[0],
                    password: hashedParentPassword,
                    first_name: entry.parent.firstName,
                    last_name: entry.parent.lastName,
                    phone_number: entry.parent.phoneNumber || null,
                    role: 'parent',
                    center_id: req.user.center_id,
                    is_active: true,
                    account_status: 'active',
                    parentProfile: {
                        address: entry.parent.address || {},
                        emergency_contacts: [],
                        children: [],
                        assignments: {
                            center: req.user.center_id,
                            classes: []
                        },
                        preferences: {
                            currency: 'USD',
                            notification_settings: {
                                email: true,
                                sms: entry.parent.phoneNumber ? true : false
                            }
                        },
                        verificationStatus: 'pending'
                    }
                };

                // Validate required parent fields
                const missingParentFields = [];
                if (!entry.parent.firstName) missingParentFields.push('First Name');
                if (!entry.parent.lastName) missingParentFields.push('Last Name');
                if (!entry.parent.email) missingParentFields.push('Email');
                if (!entry.parent.password) missingParentFields.push('Password');

                if (missingParentFields.length > 0) {
                    throw new Error(`Missing required parent fields: ${missingParentFields.join(', ')}`);
                }

                // Validate required student fields
                const missingStudentFields = [];
                if (!entry.student.firstName) missingStudentFields.push('First Name');
                if (!entry.student.lastName) missingStudentFields.push('Last Name');
                if (!entry.student.email) missingStudentFields.push('Email');
                if (!entry.student.username) missingStudentFields.push('Username');
                if (!entry.student.password) missingStudentFields.push('Password');
                if (!entry.student.studentProfile) missingStudentFields.push('Student Profile');
                if (!entry.student.studentProfile?.grade) missingStudentFields.push('Grade');
                if (!entry.student.studentProfile?.school) missingStudentFields.push('School');

                if (missingStudentFields.length > 0) {
                    throw new Error(`Missing required student fields: ${missingStudentFields.join(', ')}`);
                }

                console.log('Validation passed for both parent and student');

                // Initialize parentId variable
                let parentId = null;
                const existingParent = await User.findOne({
                    where: { 
                        email: entry.parent.email.toLowerCase(),
                        role: 'parent'
                    },
                    transaction: t
                });

                if (existingParent) {
                    console.log(`Found existing parent with email ${entry.parent.email}`);
                    parentId = existingParent.id;
                    // Update parent's children array if needed
                    const currentChildren = existingParent.parentProfile?.children || [];
                    if (!currentChildren.includes(parentId)) {
                        await User.update(
                            { 
                                parentProfile: {
                                    ...existingParent.parentProfile,
                                    children: [...currentChildren, parentId]
                                }
                            },
                            { 
                                where: { id: existingParent.id },
                                transaction: t
                            }
                        );
                    }
                } else {
                    // Create new parent
                    // Validate parent data
                    if (!entry.parent || !entry.parent.firstName || !entry.parent.lastName || 
                        !entry.parent.email || !entry.parent.password) {
                        throw new Error('Missing required parent fields');
                    }

                    const { parent } = entry;

                    // Validate parent data
                    if (!parent || !parent.firstName || !parent.lastName || !parent.email) {
                        throw new Error(`Missing required parent fields: ${[
                            !parent?.firstName && 'first name',
                            !parent?.lastName && 'last name',
                            !parent?.email && 'email'
                        ].filter(Boolean).join(', ')}`);
                    }

                    const hashedPassword = await bcrypt.hash(parent.password.toString(), 10);
                    const createParentData = {
                        email: parent.email.toLowerCase(),
                        username: parent.username || parent.email.split('@')[0],
                        password: hashedPassword,
                        first_name: parent.firstName,
                        last_name: parent.lastName,
                        phone_number: entry.parent.phoneNumber || null,
                        date_of_birth: entry.parent.dateOfBirth || null,
                        time_zone: entry.parent.timeZone || 'UTC',
                        role: 'parent',
                        center_id: req.user.center_id,
                        is_active: true,
                        account_status: 'active',
                        assignments: {
                            center: req.user.center_id,
                            classes: [],
                            children: []
                        },
                        parentProfile: {
                            address: entry.parent.address || {},
                            emergency_contacts: entry.parent.emergencyContacts || [],
                            children: [],
                            assignments: {
                                center: req.user.center_id,
                                classes: []
                            },
                            preferences: {
                                currency: entry.parent.currency || 'USD',
                                language: entry.parent.language || 'en',
                                notification_settings: {
                                    email: true,
                                    sms: entry.parent.phoneNumber ? true : false
                                }
                            },
                            verificationStatus: 'pending'
                        }
                    };

                    console.log('Creating parent with data:', JSON.stringify(createParentData, null, 2));
                    const newParent = await User.create(createParentData, { transaction: t });
                    parentId = newParent.id;
                    results.parentsCreated++;
                }

                // Log availability data for debugging
                console.log('Student availability data:', {
                    monday: entry.student.studentProfile?.monday?.available,
                    wednesday: entry.student.studentProfile?.wednesday?.available
                });

                // Validate student data
                if (!entry.student || !entry.student.firstName || !entry.student.lastName || !entry.student.email) {
                    throw new Error(`Missing required student fields: ${[
                        !entry.student?.firstName && 'first name',
                        !entry.student?.lastName && 'last name',
                        !entry.student?.email && 'email'
                    ].filter(Boolean).join(', ')}`);
                }

                // 2. Now create student using parentId
                if (!parentId) {
                    throw new Error('Parent must be created before student');
                }

                if (!entry.student || !entry.student.firstName || !entry.student.lastName || !entry.student.email) {
                    throw new Error('Missing required student fields');
                }

                console.log('Creating student with parentId:', parentId);
                const hashedStudentPassword = await bcrypt.hash(entry.student.password.toString(), 10);
                
                const studentData = {
                    email: entry.student.email.toLowerCase(),
                    username: entry.student.username || entry.student.email.split('@')[0],
                    password: hashedStudentPassword,
                    first_name: entry.student.firstName,
                    last_name: entry.student.lastName,
                    phone_number: entry.student.phoneNumber || null,
                    date_of_birth: entry.student.dateOfBirth || null,
                    time_zone: entry.student.timeZone || 'UTC',
                    role: 'student',
                    center_id: req.user.center_id,
                    is_active: true,
                    account_status: 'active',
                    studentProfile: {
                        parent_id: parentId, // Using standard field name
                        grade: entry.student.studentProfile?.grade || null,
                        school: entry.student.studentProfile?.school || null,
                        subjects: entry.student.studentProfile?.subjects || [],
                        documents: [],
                        education: [],
                        medicalInfo: {
                            allergies: entry.student.studentProfile?.medicalInformation?.allergies || '',
                            conditions: entry.student.studentProfile?.medicalInformation?.medicalConditions || '',
                            medications: entry.student.studentProfile?.medicalInformation?.currentMedications || '',
                            doctorContact: entry.student.studentProfile?.medicalInformation?.doctorContact || '',
                            emergencyInfo: entry.student.studentProfile?.emergencyContact?.name || ''
                        },
                        parentContact: {
                            name: entry.student.studentProfile?.emergencyContact?.name || '',
                            phone: entry.student.studentProfile?.emergencyContact?.phone || '',
                            email: entry.student.studentProfile?.emergencyContact?.email || ''
                        },
                        dateOfBirth: entry.student.dateOfBirth || null,
                        availability: {
                            monday: { 
                                available: entry.student.studentProfile?.availability?.monday?.available === true || entry.student.studentProfile?.monday?.available === 'Yes', 
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            },
                            tuesday: { 
                                available: entry.student.studentProfile?.availability?.tuesday?.available === true || entry.student.studentProfile?.tuesday?.available === 'Yes',
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            },
                            wednesday: { 
                                available: entry.student.studentProfile?.availability?.wednesday?.available === true || entry.student.studentProfile?.wednesday?.available === 'Yes',
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            },
                            thursday: { 
                                available: entry.student.studentProfile?.availability?.thursday?.available === true || entry.student.studentProfile?.thursday?.available === 'Yes',
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            },
                            friday: { 
                                available: entry.student.studentProfile?.availability?.friday?.available === true || entry.student.studentProfile?.friday?.available === 'Yes',
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            },
                            saturday: { 
                                available: entry.student.studentProfile?.availability?.saturday?.available === true || entry.student.studentProfile?.saturday?.available === 'Yes',
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            },
                            sunday: { 
                                available: entry.student.studentProfile?.availability?.sunday?.available === true || entry.student.studentProfile?.sunday?.available === 'Yes',
                                timeSlots: [], 
                                timeSlotsZones: [] 
                            }
                        },
                        preferences: {
                            currency: entry.student.studentProfile?.currency || 'USD',
                            learningStyle: entry.student.studentProfile?.learningStyle || '',
                            preferredSubjects: entry.student.studentProfile?.preferredSubjects || [],
                            strugglingSubjects: entry.student.studentProfile?.strugglingSubjects || []
                        },
                        verificationStatus: 'pending',
                        address: entry.student.address || {},
                        hourlyRate: entry.student.studentProfile?.hourlyRate || 0,
                        learningGoals: entry.student.studentProfile?.learningGoals || '',
                        additionalNotes: entry.student.studentProfile?.additionalNotes || ''
                    },
                    assignments: {
                        center: req.user.center_id,
                        classes: []
                    }
                };
                
                // Validate required fields before creating student
                if (!studentData.first_name || !studentData.last_name || !studentData.email || !studentData.username) {
                    throw new Error('Missing required student fields: first name, last name, email, or username');
                }

                try {
                    console.log('Creating student with data:', JSON.stringify(studentData, null, 2));
                    const newStudent = await User.create(studentData, { transaction: t });

                    // Get current parent data
                    const parent = await User.findByPk(parentId, { transaction: t });
                    if (parent) {
                        // Get current assignments
                        const assignments = parent.assignments || {};
                        let children = assignments.children || [];
                        
                        // First validate that all existing children exist in database
                        const existingChildren = await User.findAll({
                            where: {
                                id: children,
                                role: 'student'
                            },
                            attributes: ['id'],
                            transaction: t
                        });
                        
                        // Filter out any invalid children IDs and convert to string format
                        children = existingChildren.map(child => child.id.toString());
                        
                        // Add new student to children array if not already present
                        if (!children.includes(newStudent.id)) {
                            children.push(newStudent.id);
                            console.log(`Added student ${newStudent.id} to parent ${parentId} children array`);
                        }
                        
                        // Validate child exists
                        const studentExists = await User.findByPk(newStudent.id, { transaction: t });
                        if (!studentExists) {
                            console.error(`Warning: Student ${newStudent.id} not found in database`);
                            throw new Error(`Failed to create student record properly`);
                        }

                        // Update parent's assignments
                        await User.update(
                            {
                                assignments: {
                                    ...assignments,
                                    children: children
                                }
                            },
                            {
                                where: { id: parentId },
                                transaction: t
                            }
                        );
                    }

                    console.log('Successfully created student:', newStudent.id);
                    results.success.push(newStudent);
                    results.studentsCreated++;
                } catch (error) {
                    console.error('Error creating student:', error);
                    throw error;
                }

            } catch (error) {
                console.error('Error processing entry:', error);
                let errorMessage = error.message;
                
                // Check for duplicate email errors
                if (error.name === 'SequelizeUniqueConstraintError') {
                    if (error.fields.email) {
                        // Check if this is a parent or student email
                        const existingUser = await User.findOne({
                            where: { email: error.fields.email },
                            attributes: ['role'],
                            transaction: t
                        });
                        
                        errorMessage = existingUser 
                            ? `${existingUser.role.charAt(0).toUpperCase() + existingUser.role.slice(1)} email ${error.fields.email} already exists`
                            : `Email ${error.fields.email} already exists`;
                    }
                }
                
                results.errors.push({ 
                    entry, 
                    error: errorMessage
                });
            }
        }

        await t.commit();

        res.json({
            success: true,
            message: `Successfully created ${results.parentsCreated} parents and ${results.studentsCreated} students with ${results.errors.length} errors`,
            data: results
        });

    } catch (error) {
        console.error('Transaction error:', error);
        await t.rollback();
        res.status(500).json({
            success: false,
            message: 'Error processing bulk upload',
            error: error.message
        });
    }
});

// Error report download route
router.get('/error-reports/:filename', auth(['admin', 'superadmin']), (req, res) => {
    const filename = req.params.filename;
    res.download(`uploads/error-reports/${filename}`);
});

// Bulk upload endpoint for parents and students
router.post('/parents-students', auth(['admin', 'superadmin']), upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }

    const results = {
        parentsCreated: 0,
        studentsCreated: 0,
        success: [],
        errors: []
    };

    const t = await sequelize.transaction();

    try {
        const csvData = req.file.buffer.toString();
        const records = await new Promise((resolve, reject) => {
            csv.parse(csvData, {
                columns: true,
                trim: true,
                skip_empty_lines: true
            }, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });

        for (let row of records) {
            try {
                // Define required fields
                const requiredFields = [
                    'Parent First Name *',
                    'Parent Last Name *',
                    'Parent Email *',
                    'Student First Name *',
                    'Student Last Name *',
                    'Student Email *',
                    'Student Username *',
                    'Student Password *',
                    'Student Date of Birth (DD-MM-YYYY) *',
                    'Student Time Zone *',
                    'Student Grade *',
                    'Student School *',
                    'Student Subjects of Interest *'
                ];

                // Validate required fields
                const validationErrors = validateParentStudentFields(row, requiredFields);
                if (validationErrors.length > 0) {
                    throw new Error(validationErrors.join(', '));
                }

                // Check if parent already exists
                let parentId;
                const existingParent = await User.findOne({
                    where: { 
                        email: row['Parent Email *'].toLowerCase(),
                        role: 'parent'
                    },
                    transaction: t
                });

                if (!existingParent) {
                    // Create new parent
                    const hashedPassword = await bcrypt.hash(row['Parent Password *'], 10);
                    const parentData = {
                        email: row['Parent Email *'].toLowerCase(),
                        username: row['Parent Username'],
                        password: hashedPassword,
                        first_name: row['Parent First Name *'],
                        last_name: row['Parent Last Name *'],
                        phone_number: row['Parent Phone'],
                        role: 'parent',
                        center_id: req.user.center_id,
                        is_active: true,
                        account_status: 'active',
                        assignments: {
                            center: req.user.center_id,
                            classes: [],
                            children: []
                        },
                        assignments: {
                            center: req.user.center_id,
                            classes: [],
                            children: [],
                            center_assignments: [req.user.center_id]
                        }
                    };

                    const newParent = await User.create(parentData, { transaction: t });
                    parentId = newParent.id;
                    results.parentsCreated++;
                } else {
                    parentId = existingParent.id;
                }

                // Create student
                const hashedStudentPassword = await bcrypt.hash(row['Student Password *'], 10);
                const studentData = {
                    email: row['Student Email *'].toLowerCase(),
                    username: row['Student Username *'],
                    password: hashedStudentPassword,
                    first_name: row['Student First Name *'],
                    last_name: row['Student Last Name *'],
                    phone_number: row['Student Phone Number'],
                    role: 'student',
                    center_id: req.user.center_id,
                    is_active: true,
                    account_status: 'active',
                    studentProfile: createStudentProfileFromCSV(row, parentId),
                    assignments: {
                        center: req.user.center_id,
                        classes: [],
                        children: []
                    }
                };

                // Set parent_id in studentProfile
                studentData.studentProfile.parent_id = parentId;

                const newStudent = await User.create(studentData, { transaction: t });

                // Update parent's children array
                await User.update(
                    {
                        assignments: sequelize.literal(`jsonb_set(
                            assignments::jsonb,
                            '{children}',
                            (assignments->>'children')::jsonb || '["${newStudent.id}"]'::jsonb
                        )`)
                    },
                    {
                        where: { id: parentId },
                        transaction: t
                    }
                );

                results.success.push(newStudent);
                results.studentsCreated++;

            } catch (error) {
                results.errors.push({ row, error: error.message });
            }
        }

        await t.commit();

        res.json({
            success: true,
            message: `Successfully created ${results.parentsCreated} parents and ${results.studentsCreated} students with ${results.errors.length} errors`,
            data: results
        });

    } catch (error) {
        await t.rollback();
        const statusCode = error.name === 'SequelizeValidationError' ? 400 : 500;
        const message = error.name === 'SequelizeValidationError' 
            ? 'Validation error in bulk upload'
            : 'Error processing CSV file';
            
        res.status(statusCode).json({
            success: false,
            message: message,
            error: error.message,
            details: error.name === 'SequelizeValidationError' ? error.errors : undefined
        });
    }
});

module.exports = router;
