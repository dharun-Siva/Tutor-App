const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Homework = require('../models/Homework');
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const Subtopic = require('../models/Subtopic');

// Helper function to parse CSV content and extract correct answers
function parseCorrectAnswersFromCSV(csvContent) {
  try {
    if (!csvContent || typeof csvContent !== 'string') {
      console.log('❌ No CSV content provided or invalid format');
      return new Map();
    }

    console.log('📊 Parsing CSV content for correct answers...');
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      console.log('❌ CSV content has no data rows');
      return new Map();
    }

    // Parse header to find column indices
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    console.log('📋 CSV Headers:', headers);

    const correctAnswersMap = new Map();

    // Process each data row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      
      if (values.length !== headers.length) {
        console.log(`⚠️ Skipping malformed row ${i}: ${lines[i]}`);
        continue;
      }

      const rowData = {};
      headers.forEach((header, index) => {
        rowData[header] = values[index];
      });

      // Check if this row contains correct answer (either is_correct=true or has correct_answer_text)
      const isCorrect = rowData.is_correct === 'true' || rowData.is_correct === true;
      const hasCorrectAnswerText = rowData.correct_answer_text && rowData.correct_answer_text.trim() !== '';

      if (isCorrect || hasCorrectAnswerText) {
        const key = `${rowData.exercise_id}_${rowData.page_id}_${rowData.question_type}_${rowData.question_number}`;
        
        if (!correctAnswersMap.has(key)) {
          correctAnswersMap.set(key, {
            exerciseId: rowData.exercise_id,
            pageId: parseInt(rowData.page_id),
            questionType: rowData.question_type,
            questionNumber: parseInt(rowData.question_number),
            question: rowData.question,
            correctAnswerText: [],
            correctOptions: []
          });
        }

        const questionData = correctAnswersMap.get(key);

        // Store correct answer text (prioritize correct_answer_text column if available)
        const correctAnswerText = hasCorrectAnswerText ? rowData.correct_answer_text : rowData.answer_text;
        
        if (correctAnswerText && !questionData.correctAnswerText.includes(correctAnswerText)) {
          questionData.correctAnswerText.push(correctAnswerText);
        }

        // For multiple choice questions, also store as correct options
        if (rowData.question_type === 'multiple_choice_checkbox' && isCorrect) {
          questionData.correctOptions.push({
            id: rowData.option_id || questionData.correctOptions.length.toString(),
            text: rowData.answer_text,
            isCorrect: true
          });
        }
      }
    }

    console.log(`✅ Extracted correct answers for ${correctAnswersMap.size} questions`);
    return correctAnswersMap;

  } catch (error) {
    console.error('❌ Error parsing CSV for correct answers:', error);
    return new Map();
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/homework');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'homework-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow specific file types including CSV and Excel files
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype === 'text/csv' || 
                     file.mimetype === 'application/vnd.ms-excel' ||
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, PDF, DOC, DOCX, TXT, CSV, and Excel files are allowed.'));
    }
  }
});

// GET /api/dashboard/admin/homeworks - Get all homework
router.get('/', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { gradeId, subjectId, topicId, subtopicId, page = 1, limit = 10 } = req.query;
    
    // Build filter query
    const filter = { isActive: true };
    if (gradeId) filter.gradeId = gradeId;
    if (subjectId) filter.subjectId = subjectId;
    if (topicId) filter.topicId = topicId;
    if (subtopicId) filter.subtopicId = subtopicId;

    // Add center filter for admin users
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter) {
        filter.center = adminCenter;
      } else {
        return res.json({
          success: true,
          homeworks: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get homework with populated references
    const homeworks = await Homework.find(filter)
      .populate('gradeId', 'gradeName')
      .populate('subjectId', 'subjectName')
      .populate('topicId', 'topicName')
      .populate('subtopicId', 'subtopicName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Transform data to match frontend expectations
    const transformedHomeworks = homeworks.map(homework => ({
      _id: homework._id,
      homeworkName: homework.homeworkName,
      description: homework.description,
      gradeId: homework.gradeId._id,
      gradeName: homework.gradeId.gradeName,
      subjectId: homework.subjectId._id,
      subjectName: homework.subjectId.subjectName,
      topicId: homework.topicId._id,
      topicName: homework.topicId.topicName,
      subtopicId: homework.subtopicId._id,
      subtopicName: homework.subtopicId.subtopicName,
      dueDate: homework.dueDate,
      fileName: homework.fileName,
      filePath: homework.filePath,
      fileSize: homework.fileSize,
      mimeType: homework.mimeType,
      exerciseData: homework.exerciseData,
      csvContent: homework.csvContent,
      createdBy: homework.createdBy,
      createdAt: homework.createdAt,
      updatedAt: homework.updatedAt
    }));

    // Get total count for pagination
    const total = await Homework.countDocuments(filter);

    res.json({
      success: true,
      homeworks: transformedHomeworks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching homework',
      error: error.message
    });
  }
});

// POST /api/dashboard/admin/homeworks - Create new homework
router.post('/', auth(['admin', 'superadmin']), upload.single('file'), async (req, res) => {
  try {
    // Check if admin has center assigned
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (!adminCenter) {
        return res.status(400).json({
          success: false,
          message: 'Admin must be assigned to a center before creating homework'
        });
      }
    }

    const {
      homeworkName,
      description,
      gradeId,
      subjectId,
      topicId,
      subtopicId,
      exerciseData,
      csvContent,
      fileName,
      mimeType
    } = req.body;

    // Validation
    if (!homeworkName || !gradeId || !subjectId || !topicId || !subtopicId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify that all referenced documents exist
    const [grade, subject, topic, subtopic] = await Promise.all([
      Grade.findById(gradeId),
      Subject.findById(subjectId),
      Topic.findById(topicId),
      Subtopic.findById(subtopicId)
    ]);

    if (!grade || !subject || !topic || !subtopic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade, subject, topic, or subtopic ID'
      });
    }

    // Prepare homework data
    const homeworkData = {
      homeworkName,
      description,
      gradeId,
      subjectId,
      topicId,
      subtopicId,
      center: req.user.center || req.user.assignments?.center || req.user.id, // Map to admin's center
      createdBy: req.user.id
    };

    // Add exercise data if provided (for CSV-generated homework)
    if (exerciseData) {
      homeworkData.exerciseData = exerciseData;
    }

    // Handle CSV content and extract correct answers
    let processedCSVContent = csvContent;
    let correctAnswersMap = new Map();
    
    // If file was uploaded and it's a CSV, read and process it
    if (req.file && (req.file.mimetype === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv'))) {
      try {
        const csvFilePath = req.file.path;
        processedCSVContent = fs.readFileSync(csvFilePath, 'utf8');
        console.log('📂 CSV file uploaded and read successfully');
        
        // Extract correct answers from CSV
        correctAnswersMap = parseCorrectAnswersFromCSV(processedCSVContent);
        console.log(`✅ Extracted correct answers for ${correctAnswersMap.size} questions from uploaded CSV`);
        
      } catch (fileError) {
        console.error('❌ Error reading uploaded CSV file:', fileError);
      }
    } else if (csvContent) {
      // Process CSV content sent directly
      correctAnswersMap = parseCorrectAnswersFromCSV(csvContent);
      console.log(`✅ Extracted correct answers for ${correctAnswersMap.size} questions from CSV content`);
    }

    // Add CSV content if available
    if (processedCSVContent) {
      homeworkData.csvContent = processedCSVContent;
      
      // Store correct answers summary in homework for quick reference
      homeworkData.correctAnswersSummary = {
        totalQuestions: correctAnswersMap.size,
        questionTypes: [...new Set(Array.from(correctAnswersMap.values()).map(q => q.questionType))],
        exerciseIds: [...new Set(Array.from(correctAnswersMap.values()).map(q => q.exerciseId))]
      };
    }

    // Add file data if file was uploaded via multipart
    if (req.file) {
      homeworkData.fileName = req.file.originalname;
      homeworkData.filePath = `/uploads/homework/${req.file.filename}`;
      homeworkData.fileSize = req.file.size;
      homeworkData.mimeType = req.file.mimetype;
    } else if (fileName && mimeType) {
      // For CSV data sent as JSON (not multipart)
      homeworkData.fileName = fileName;
      homeworkData.mimeType = mimeType;
    }

    // Create homework
    const homework = new Homework(homeworkData);
    await homework.save();

    // Populate the created homework
    await homework.populate([
      { path: 'gradeId', select: 'gradeName' },
      { path: 'subjectId', select: 'subjectName' },
      { path: 'topicId', select: 'topicName' },
      { path: 'subtopicId', select: 'subtopicName' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: correctAnswersMap.size > 0 ? 
        `Homework created successfully with ${correctAnswersMap.size} correct answers extracted from CSV` :
        'Homework created successfully',
      homework: {
        _id: homework._id,
        homeworkName: homework.homeworkName,
        description: homework.description,
        gradeId: homework.gradeId._id,
        gradeName: homework.gradeId.gradeName,
        subjectId: homework.subjectId._id,
        subjectName: homework.subjectId.subjectName,
        topicId: homework.topicId._id,
        topicName: homework.topicId.topicName,
        subtopicId: homework.subtopicId._id,
        subtopicName: homework.subtopicId.subtopicName,
        dueDate: homework.dueDate,
        fileName: homework.fileName,
        filePath: homework.filePath,
        fileSize: homework.fileSize,
        mimeType: homework.mimeType,
        exerciseData: homework.exerciseData,
        csvContent: homework.csvContent,
        correctAnswersSummary: homework.correctAnswersSummary,
        createdAt: homework.createdAt,
        updatedAt: homework.updatedAt
      },
      correctAnswersInfo: {
        totalQuestions: correctAnswersMap.size,
        questionsFound: correctAnswersMap.size > 0,
        csvProcessed: !!processedCSVContent
      }
    });
  } catch (error) {
    console.error('Error creating homework:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating homework',
      error: error.message
    });
  }
});

// PUT /api/dashboard/admin/homeworks/:id - Update homework
router.put('/:id', (req, res, next) => {
  // Check content type and apply appropriate middleware
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    // Handle file uploads
    upload.single('file')(req, res, next);
  } else {
    // Handle JSON requests
    next();
  }
}, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      homeworkName,
      description,
      gradeId,
      subjectId,
      topicId,
      subtopicId,
      dueDate,
      csvContent,
      exerciseData,
      fileName,
      mimeType
    } = req.body;

    // Find existing homework
    const homework = await Homework.findById(id);
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: 'Homework not found'
      });
    }

    // Validation - dueDate is now optional
    if (!homeworkName || !gradeId || !subjectId || !topicId || !subtopicId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: homeworkName, gradeId, subjectId, topicId, subtopicId'
      });
    }

    // Verify that all referenced documents exist
    const [grade, subject, topic, subtopic] = await Promise.all([
      Grade.findById(gradeId),
      Subject.findById(subjectId),
      Topic.findById(topicId),
      Subtopic.findById(subtopicId)
    ]);

    if (!grade || !subject || !topic || !subtopic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid grade, subject, topic, or subtopic ID'
      });
    }

    // Update homework data
    homework.homeworkName = homeworkName;
    homework.description = description;
    homework.gradeId = gradeId;
    homework.subjectId = subjectId;
    homework.topicId = topicId;
    homework.subtopicId = subtopicId;
    
    // Only update dueDate if provided
    if (dueDate) {
      homework.dueDate = new Date(dueDate);
    }
    
    // Handle CSV data
    if (csvContent) {
      homework.csvContent = csvContent;
    }
    if (exerciseData) {
      homework.exerciseData = exerciseData;
    }
    if (fileName) {
      homework.fileName = fileName;
    }
    if (mimeType) {
      homework.mimeType = mimeType;
    }

    // Handle file update
    if (req.file) {
      // Delete old file if it exists
      if (homework.filePath) {
        const oldFilePath = path.join(__dirname, '../uploads/homework', path.basename(homework.filePath));
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update with new file
      homework.fileName = req.file.originalname;
      homework.filePath = `/uploads/homework/${req.file.filename}`;
      homework.fileSize = req.file.size;
      homework.mimeType = req.file.mimetype;
    }

    await homework.save();

    // Populate the updated homework
    await homework.populate([
      { path: 'gradeId', select: 'gradeName' },
      { path: 'subjectId', select: 'subjectName' },
      { path: 'topicId', select: 'topicName' },
      { path: 'subtopicId', select: 'subtopicName' },
      { path: 'createdBy', select: 'firstName lastName' }
    ]);

    res.json({
      success: true,
      message: 'Homework updated successfully',
      homework: {
        _id: homework._id,
        homeworkName: homework.homeworkName,
        description: homework.description,
        gradeId: homework.gradeId._id,
        gradeName: homework.gradeId.gradeName,
        subjectId: homework.subjectId._id,
        subjectName: homework.subjectId.subjectName,
        topicId: homework.topicId._id,
        topicName: homework.topicId.topicName,
        subtopicId: homework.subtopicId._id,
        subtopicName: homework.subtopicId.subtopicName,
        dueDate: homework.dueDate,
        fileName: homework.fileName,
        filePath: homework.filePath,
        fileSize: homework.fileSize,
        mimeType: homework.mimeType,
        csvContent: homework.csvContent,
        exerciseData: homework.exerciseData,
        createdAt: homework.createdAt,
        updatedAt: homework.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating homework:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating homework',
      error: error.message
    });
  }
});

// DELETE /api/dashboard/admin/homeworks/:id - Delete homework
router.delete('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Find homework
    const homework = await Homework.findById(id);
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: 'Homework not found'
      });
    }

    // Check center access for admin users
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter && homework.center.toString() !== adminCenter.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Delete associated file if it exists
    if (homework.filePath) {
      const filePath = path.join(__dirname, '../uploads/homework', path.basename(homework.filePath));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Soft delete (set isActive to false) or hard delete
    // Using soft delete to maintain data integrity
    homework.isActive = false;
    await homework.save();

    // Or for hard delete, uncomment the line below:
    // await Homework.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Homework deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting homework:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting homework',
      error: error.message
    });
  }
});

// GET /api/dashboard/admin/homeworks/:id - Get single homework
router.get('/:id', auth(['admin', 'superadmin']), async (req, res) => {
  try {
    const { id } = req.params;

    const homework = await Homework.findById(id)
      .populate('gradeId', 'gradeName')
      .populate('subjectId', 'subjectName')
      .populate('topicId', 'topicName')
      .populate('subtopicId', 'subtopicName')
      .populate('createdBy', 'firstName lastName');

    if (!homework || !homework.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Homework not found'
      });
    }

    // Check center access for admin users
    if (req.user.role === 'admin') {
      const adminCenter = req.user.center || req.user.assignments?.center;
      if (adminCenter && homework.center.toString() !== adminCenter.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      homework: {
        _id: homework._id,
        homeworkName: homework.homeworkName,
        description: homework.description,
        gradeId: homework.gradeId._id,
        gradeName: homework.gradeId.gradeName,
        subjectId: homework.subjectId._id,
        subjectName: homework.subjectId.subjectName,
        topicId: homework.topicId._id,
        topicName: homework.topicId.topicName,
        subtopicId: homework.subtopicId._id,
        subtopicName: homework.subtopicId.subtopicName,
        dueDate: homework.dueDate,
        fileName: homework.fileName,
        filePath: homework.filePath,
        fileSize: homework.fileSize,
        mimeType: homework.mimeType,
        createdAt: homework.createdAt,
        updatedAt: homework.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching homework',
      error: error.message
    });
  }
});

// POST /api/homework/test-csv-creation - Test homework creation with CSV content
router.post('/test-csv-creation', async (req, res) => {
  try {
    const { csvContent, homeworkName = 'Test CSV Homework' } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({
        success: false,
        message: 'CSV content is required for testing'
      });
    }

    console.log('🧪 Testing homework creation with CSV content...');
    
    // Parse correct answers from CSV
    const correctAnswersMap = parseCorrectAnswersFromCSV(csvContent);
    
    // Convert Map to object for response
    const correctAnswersObject = {};
    correctAnswersMap.forEach((value, key) => {
      correctAnswersObject[key] = value;
    });

    res.json({
      success: true,
      message: `CSV processing completed successfully`,
      testResults: {
        homeworkName,
        csvProcessed: true,
        totalQuestions: correctAnswersMap.size,
        correctAnswers: correctAnswersObject,
        correctAnswersSummary: {
          totalQuestions: correctAnswersMap.size,
          questionTypes: [...new Set(Array.from(correctAnswersMap.values()).map(q => q.questionType))],
          exerciseIds: [...new Set(Array.from(correctAnswersMap.values()).map(q => q.exerciseId))]
        },
        sampleQuestionKey: correctAnswersMap.size > 0 ? Array.from(correctAnswersMap.keys())[0] : null
      }
    });

  } catch (error) {
    console.error('❌ Error testing CSV creation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test CSV creation',
      error: error.message
    });
  }
});

module.exports = router;