const express = require('express');
const router = express.Router();
const StudentAnswer = require('../models/StudentAnswer.postgres');
const Homework = require('../models/Homework.postgres');
const HomeworkAssignment = require('../models/HomeworkAssignment.postgres');
const auth = require('../middleware/auth-postgres');

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

    // Process each data row with proper CSV parsing (handle commas in quotes)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, '')); // Add last value
      
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
        
        if (correctAnswerText && correctAnswerText.trim() !== '' && correctAnswerText.trim().toLowerCase() !== 'null' && !questionData.correctAnswerText.includes(correctAnswerText)) {
          questionData.correctAnswerText.push(correctAnswerText);
        }

        // For multiple choice questions, also store as correct options
        if (rowData.question_type === 'multiple_choice_checkbox' && isCorrect && rowData.answer_text && rowData.answer_text.trim() !== '' && rowData.answer_text.trim().toLowerCase() !== 'null') {
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

// Helper function to extract correct answers from homework exercise data
async function getCorrectAnswers(assignmentId, pageId, questionNumber, questionType) {
  try {
    console.log(`🔍 DEBUG: getCorrectAnswers called with:`, {
      assignmentId,
      pageId,
      questionNumber,
      questionType
    });

    // Get homework assignment to find the homework content
    const assignment = await HomeworkAssignment.findById(assignmentId).populate('homeworkId');
    console.log(`📋 Assignment found:`, !!assignment);
    console.log(`📋 HomeworkId populated:`, !!assignment?.homeworkId);
    console.log(`📋 ExerciseData exists:`, !!assignment?.homeworkId?.exerciseData);

    if (!assignment) {
      console.log(`❌ No assignment found with ID: ${assignmentId}`);
      return null;
    }
    
    if (!assignment.homeworkId) {
      console.log(`❌ Assignment has no homeworkId populated`);
      return null;
    }
    
    if (!assignment.homeworkId.exerciseData) {
      console.log(`❌ Homework has no exerciseData field`);
      return null;
    }

    // Parse exercise data (it's stored as JSON string)
    let exerciseData;
    try {
      exerciseData = JSON.parse(assignment.homeworkId.exerciseData);
      console.log(`📊 Exercise data parsed successfully. Type:`, Array.isArray(exerciseData) ? 'Array' : 'Object');
      console.log(`📊 Exercise data length/keys:`, Array.isArray(exerciseData) ? exerciseData.length : Object.keys(exerciseData));
      
      // Log structure for debugging
      if (exerciseData.length > 0) {
        console.log(`📝 First exercise structure:`, JSON.stringify(exerciseData[0], null, 2));
      }
    } catch (parseError) {
      console.log(`❌ Failed to parse exerciseData:`, parseError.message);
      console.log(`🔍 Raw exerciseData:`, assignment.homeworkId.exerciseData.substring(0, 200));
      return null;
    }
    
    console.log(`🔍 Searching for correct answers in nested structure...`);
    console.log(`📊 Total exercises: ${exerciseData.length}`);
    
    // Count total pages across all exercises
    let totalPagesCount = 0;
    for (const exercise of exerciseData) {
      if (exercise.pages) {
        totalPagesCount += exercise.pages.length;
        console.log(`📄 Exercise "${exercise.exercise_id || exercise.title}" has ${exercise.pages.length} pages`);
      }
    }
    console.log(`📊 Total pages across all exercises: ${totalPagesCount}`);
    
    // The exerciseData is an array of exercises, each with pages containing components
    // We need to find the right page by cumulative page index across all exercises
    let correctAnswerData = null;
    let cumulativePageIndex = 0; // 0-based cumulative page index across all exercises
    
    for (const exercise of exerciseData) {
      if (!exercise.pages) {
        console.log(`⚠️ Exercise "${exercise.exercise_id || exercise.title}" has no pages`);
        continue;
      }
      
      console.log(`🔍 Checking exercise "${exercise.exercise_id || exercise.title}" with ${exercise.pages.length} pages`);
      
      for (const page of exercise.pages) {
        console.log(`📋 Page ${cumulativePageIndex + 1} (cumulative): page_id=${page.page_id}, template_type=${page.template_type}, components=${page.components ? page.components.length : 0}`);
        
        // Check if this is the page we're looking for by cumulative index
        if (cumulativePageIndex !== pageId - 1) { // pageId is 1-based, cumulativePageIndex is 0-based
          cumulativePageIndex++;
          continue;
        }
        
        console.log(`✅ Found target page at cumulative index ${cumulativePageIndex}, page_id: ${page.page_id}`);
        
        if (!page.components) {
          cumulativePageIndex++;
          continue;
        }
        
        for (const component of page.components) {
          console.log(`🔍 Checking component: type=${component.type}, question_number=${component.question_number}, looking for type=${questionType}, questionNumber=${questionNumber}`);
          
          // Skip non-question components
          if (component.type !== questionType) {
            console.log(`⚠️ Skipping component type mismatch: ${component.type} !== ${questionType}`);
            continue;
          }
          
          // Check question number - be lenient if not set
          const componentQuestionNum = component.question_number || component.questionNumber;
          if (componentQuestionNum && componentQuestionNum !== questionNumber) {
            console.log(`⚠️ Skipping question number mismatch: ${componentQuestionNum} !== ${questionNumber}`);
            continue;
          }
          
          console.log(`✅ Found matching component:`, component);
          
          if (questionType === 'multiple_choice_checkbox' && component.options) {
            const correctOptions = component.options.filter(option => option.correct === true || option.is_correct === true || option.correct === 'true');
            console.log(`📝 Correct options found:`, correctOptions);
            
            if (correctOptions.length > 0) {
              correctAnswerData = {
                correctOptions: correctOptions.map((option, index) => ({
                  id: option.id || index.toString(),
                  text: option.text || option.answer_text || option
                })),
                correctTexts: correctOptions.map(option => option.text || option.answer_text || option) // Store just the texts for comparison
              };
            } else {
              // If no options marked as correct, check if there's a correct_answer field at component level
              console.log(`⚠️ No options marked as correct, checking component level correct_answer`);
              if (component.correct_answer || component.correctAnswer) {
                const correctAnswerText = component.correct_answer || component.correctAnswer;
                correctAnswerData = {
                  correctOptions: [{
                    id: 'text_answer',
                    text: correctAnswerText
                  }],
                  correctTexts: [correctAnswerText]
                };
              }
            }
            break;
          } else if (questionType === 'fill_blank_question' && component.blanks) {
            const correctAnswers = component.blanks.flatMap(blank => blank.correct_answers || blank.correctAnswers || []);
            console.log(`📝 Correct fill-blank answers found:`, correctAnswers);
            
            if (correctAnswers.length > 0) {
              correctAnswerData = {
                correctAnswers: correctAnswers
              };
            } else {
              // Check if correct answer is at component level
              if (component.correct_answer || component.correctAnswer) {
                correctAnswerData = {
                  correctAnswers: [component.correct_answer || component.correctAnswer]
                };
              }
            }
            break;
          }
        }
        
        // Move to next page in cumulative count
        cumulativePageIndex++;
        
        if (correctAnswerData) break;
      }
      
      if (correctAnswerData) break;
    }
    
    console.log(`📊 Finished searching. Total cumulative pages processed: ${cumulativePageIndex}`);
    console.log(`🎯 Looking for pageId=${pageId} (cumulative index ${pageId - 1})`);
    
    if (correctAnswerData) {
      console.log(`📤 Returning structured result:`, correctAnswerData);
      return correctAnswerData;
    } else {
      console.log(`❌ No correct answers found for pageId=${pageId}, questionNumber=${questionNumber}, questionType=${questionType}`);
      return null;
    }

  } catch (error) {
    console.error('❌ Error extracting correct answers:', error);
    return null;
  }
}

// Add logging middleware to debug requests
router.use((req, res, next) => {
  console.log(`🔍 Student-answers route: ${req.method} ${req.originalUrl}`);
  next();
});

// Test endpoint without auth - TEMPORARY
router.post('/test-save', async (req, res) => {
  console.log('🧪 TEST ENDPOINT HIT! Request body:', req.body);
  res.json({ success: true, message: 'Test endpoint working!' });
});

// DEBUG: Check homework exercise data structure
router.get('/debug-homework/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    console.log(`🔍 Debugging homework data for assignment: ${assignmentId}`);

    const assignment = await HomeworkAssignment.findById(assignmentId).populate('homeworkId');
    
    if (!assignment) {
      return res.json({
        success: false,
        message: 'Assignment not found',
        debug: { assignmentId, found: false }
      });
    }

    if (!assignment.homeworkId) {
      return res.json({
        success: false,
        message: 'Homework not populated',
        debug: { 
          assignmentId, 
          assignmentFound: true, 
          homeworkPopulated: false,
          assignmentData: assignment
        }
      });
    }

    const homework = assignment.homeworkId;
    let exerciseData = null;
    let parseError = null;

    if (homework.exerciseData) {
      try {
        exerciseData = JSON.parse(homework.exerciseData);
      } catch (error) {
        parseError = error.message;
      }
    }

    const debugInfo = {
      assignment: {
        id: assignment._id,
        studentId: assignment.studentId,
        tutorId: assignment.tutorId,
        status: assignment.status
      },
      homework: {
        id: homework._id,
        name: homework.homeworkName,
        hasExerciseData: !!homework.exerciseData,
        exerciseDataLength: homework.exerciseData ? homework.exerciseData.length : 0,
        exerciseDataSample: homework.exerciseData ? homework.exerciseData.substring(0, 500) : null,
        hasCsvContent: !!homework.csvContent,
        csvContentLength: homework.csvContent ? homework.csvContent.length : 0,
        csvContentSample: homework.csvContent ? homework.csvContent.substring(0, 500) : null
      },
      exerciseDataParsed: {
        success: !parseError,
        error: parseError,
        itemCount: exerciseData ? exerciseData.length : 0,
        sampleItems: exerciseData ? exerciseData.slice(0, 5) : null,
        uniquePageIds: exerciseData ? [...new Set(exerciseData.map(item => item.page_id))] : null,
        uniqueQuestionTypes: exerciseData ? [...new Set(exerciseData.map(item => item.question_type))] : null,
        correctAnswersCount: exerciseData ? exerciseData.filter(item => item.is_correct === true).length : 0
      }
    };

    res.json({
      success: true,
      message: 'Debug data retrieved',
      debug: debugInfo
    });

  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    });
  }
});

// POST /api/homework/save-answers - Save current page answers (temporarily without auth)
router.post('/save-answers', async (req, res) => {
  console.log('🚀 POST /save-answers route hit!');
  console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Accept both formats for compatibility
    const { assignmentId, currentPage, pageIndex, pageAnswers, answers, pageType } = req.body;
    // TEMPORARY: Use hardcoded student ID since we bypassed auth
    const studentId = '68b7b468e0aedbc1a8c4e203';

    // Use the correct field names based on what's provided
    const actualCurrentPage = currentPage !== undefined ? currentPage : pageIndex;
    const actualPageAnswers = pageAnswers || answers;

    console.log('🔄 Saving answers for assignment:', assignmentId, 'page:', actualCurrentPage);
    console.log('📝 Page answers:', actualPageAnswers);
    console.log('📋 Page type:', pageType);

    // Find existing student answer record or create new one
    let studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      // Create new student answer record
      studentAnswer = new StudentAnswer({
        assignmentId,
        studentId,
        currentPage: actualCurrentPage,
        pages: []
      });
    }

    // Update current page
    studentAnswer.currentPage = actualCurrentPage;
    studentAnswer.lastUpdated = new Date();

    // Find or create the page entry
    let currentPageIndex = studentAnswer.pages.findIndex(page => page.pageId === actualCurrentPage + 1);
    
    if (currentPageIndex === -1) {
      // Create new page entry
      const newPage = {
        pageId: actualCurrentPage + 1,
        templateType: pageType === 'reading' ? 'story_with_questions' : 
                      pageType === 'math' ? 'math_addition' : 'fill_in_blank',
        components: []
      };
      studentAnswer.pages.push(newPage);
      currentPageIndex = studentAnswer.pages.length - 1;
    }

    // Clear existing components for this page
    studentAnswer.pages[currentPageIndex].components = [];

    // Process page answers based on type
    if (pageType === 'reading') {
      // Add timer selector component if exists
      if (actualPageAnswers.readingTime !== undefined) {
        studentAnswer.pages[currentPageIndex].components.push({
          type: 'timer_selector',
          studentAnswer: {
            selected: [actualPageAnswers.readingTime],
            isCorrect: false
          }
        });
      }

      // Add multiple choice questions
      for (const key of Object.keys(actualPageAnswers)) {
        if (key.startsWith('question_')) {
          const questionId = key.replace('question_', '');
          const answer = actualPageAnswers[key];
          
          const component = {
            type: 'multiple_choice_checkbox',
            questionNumber: parseInt(questionId),
            studentAnswer: {
              selected: Array.isArray(answer) ? answer : [answer],
              isCorrect: false // Will be determined by validation service later
            }
          };

          console.log(`💾 [SAVE-ANSWERS] Processing MCQ for question ${questionId}:`, {
            rawAnswer: answer,
            isArray: Array.isArray(answer),
            answerType: typeof answer,
            processedSelected: component.studentAnswer.selected,
            selectedTypes: Array.isArray(answer) ? answer.map(a => typeof a) : [typeof answer]
          });

          // Try to get correct answers from stored CSV data if available
          if (studentAnswer.exerciseId && studentAnswer.correctAnswers) {
            const questionKey = `${studentAnswer.exerciseId}_${actualCurrentPage + 1}_multiple_choice_checkbox_${questionId}`;
            const correctAnswerData = studentAnswer.correctAnswers.get(questionKey);
            
            if (correctAnswerData) {
              // Store correct answer texts instead of indices
              component.correctAnswer = {
                correctOptions: correctAnswerData.correctOptions,
                correctTexts: correctAnswerData.correctAnswerText || []
              };
              
              // Check if student answer is correct using text comparison
              const studentSelected = Array.isArray(answer) ? answer : [answer];
              const correctTexts = correctAnswerData.correctAnswerText || [];
              
              console.log(`🔍 Checking MCQ answer in save-answers:`, {
                studentSelected,
                correctTexts,
                correctOptions: correctAnswerData.correctOptions
              });
              
              // Convert student selections to text if they're indices (legacy support)
              const studentTexts = studentSelected.map(selection => {
                if (typeof selection === 'string') {
                  return selection.trim();
                } else if (typeof selection === 'number') {
                  // Legacy index-based answer - try to convert to text
                  const optionText = correctAnswerData.correctOptions[selection]?.text;
                  return optionText ? optionText.trim() : '';
                }
                return String(selection).trim();
              }).filter(text => text.length > 0);
              
              console.log(`👤 Student texts after conversion:`, studentTexts);
              
              // Check if student text selections match correct answer texts
              const studentTextSet = new Set(studentTexts);
              const correctTextSet = new Set(correctTexts);
              
              component.studentAnswer.isCorrect = studentTextSet.size === correctTextSet.size &&
                                                  [...studentTextSet].every(text => correctTextSet.has(text)) &&
                                                  [...correctTextSet].every(text => studentTextSet.has(text));
                                                  
              console.log(`✅ Save-answers MCQ validation result: ${component.studentAnswer.isCorrect ? 'CORRECT' : 'INCORRECT'}`);
            }
          }

          // If no correct answers from CSV, try to get from exercise data
          if (!component.correctAnswer) {
            console.log(`📊 No CSV correct answers found, trying exercise data for MCQ question ${questionId}`);
            const correctAnswerData = await getCorrectAnswers(assignmentId, actualCurrentPage + 1, parseInt(questionId), 'multiple_choice_checkbox');
            
            if (correctAnswerData && correctAnswerData.correctOptions) {
              component.correctAnswer = {
                correctOptions: correctAnswerData.correctOptions.map(option => ({
                  id: option.id,
                  text: option.text
                })),
                correctTexts: correctAnswerData.correctTexts || []
              };
              console.log(`✅ Found correct answers from exercise data:`, component.correctAnswer);
            } else {
              console.log(`❌ No correct answers found in exercise data either for MCQ question ${questionId}`);
            }
          }

          studentAnswer.pages[currentPageIndex].components.push(component);
        }
      }
    } else if (pageType === 'math') {
      // Add fill blank questions for math problems
      for (const key of Object.keys(actualPageAnswers)) {
        if (key.startsWith('question_')) {
          const questionId = key.replace('question_', '');
          const answer = actualPageAnswers[key];
          
          console.log(`💾 [SAVE-ANSWERS] Processing math question ${questionId}:`, {
            rawAnswer: answer,
            answerType: typeof answer
          });
          
          const component = {
            type: 'fill_blank_question',
            questionNumber: parseInt(questionId),
            blanks: [{
              id: 'blank1',
              studentAnswer: answer || '',
              isCorrect: false // Will be determined by validation service later
            }]
          };

          // Try to get correct answers from stored CSV data if available
          if (studentAnswer.exerciseId && studentAnswer.correctAnswers) {
            const questionKey = `${studentAnswer.exerciseId}_${actualCurrentPage + 1}_fill_blank_question_${questionId}`;
            const correctAnswerData = studentAnswer.correctAnswers.get(questionKey);
            
            if (correctAnswerData) {
              component.correctBlanks = [{
                id: 'blank1',
                correctAnswers: correctAnswerData.correctAnswerText,
                position: 0
              }];
              
              // Check if student answer is correct
              const studentAnswerText = (answer || '').toLowerCase().trim();
              const isCorrect = correctAnswerData.correctAnswerText.some(correctAns => {
                // Remove leading '=' if present and compare
                const cleanCorrectAns = correctAns.replace(/^=\s*/, '').toLowerCase().trim();
                return cleanCorrectAns === studentAnswerText;
              });
              component.blanks[0].isCorrect = isCorrect;
              
              console.log(`✅ Math question ${questionId} validation: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
            }
          }

          // If no correct answers from CSV, try to get from exercise data
          if (!component.correctBlanks) {
            console.log(`📊 No CSV correct answers found, trying exercise data for fill_blank question ${questionId}`);
            const correctAnswerData = await getCorrectAnswers(assignmentId, actualCurrentPage + 1, parseInt(questionId), 'fill_blank_question');
            
            if (correctAnswerData && correctAnswerData.correctAnswers) {
              component.correctBlanks = [{
                id: 'blank1',
                correctAnswers: correctAnswerData.correctAnswers,
                position: 0
              }];
              console.log(`✅ Found correct answers from exercise data:`, component.correctBlanks);
            } else {
              console.log(`❌ No correct answers found in exercise data either for fill_blank question ${questionId}`);
            }
          }

          studentAnswer.pages[currentPageIndex].components.push(component);
          console.log(`📝 Added math component for question ${questionId}:`, component);
        }
      }
    }

    // Update summary
    if (studentAnswer.summary.status === 'not_started') {
      studentAnswer.summary.status = 'in_progress';
    }

    await studentAnswer.save();

    console.log('✅ Successfully saved answers for page:', actualCurrentPage);

    res.json({
      success: true,
      message: 'Answers saved successfully',
      data: {
        assignmentId,
        currentPage: actualCurrentPage,
        savedAt: new Date(),
        totalPages: studentAnswer.pages.length
      }
    });

  } catch (error) {
    console.error('❌ Error saving answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answers',
      error: error.message
    });
  }
});

// GET /api/homework/debug-answers/:assignmentId - Debug saved answers (includes raw data)
router.get('/debug-answers/:assignmentId', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    const studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    console.log('🐞 Debug - Student Answer Record:', JSON.stringify(studentAnswer, null, 2));

    res.json({
      success: true,
      message: 'Debug data retrieved',
      data: studentAnswer,
      debugInfo: {
        assignmentId,
        studentId,
        recordExists: !!studentAnswer,
        pagesCount: studentAnswer?.pages?.length || 0,
        currentPage: studentAnswer?.currentPage,
        status: studentAnswer?.summary?.status
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving debug data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve debug data',
      error: error.message
    });
  }
});

// GET /api/homework/get-answers-with-correct/:assignmentId - Get saved answers including correct answers
router.get('/get-answers-with-correct/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = '68b7b468e0aedbc1a8c4e203'; // Hardcoded for testing

    const studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.json({
        success: true,
        message: 'No saved answers found',
        data: null
      });
    }

    // Format response to show both student answers and correct answers clearly
    const formattedData = {
      ...studentAnswer.toObject(),
      pages: studentAnswer.pages.map(page => ({
        ...page,
        components: page.components.map(component => ({
          ...component,
          hasCorrectAnswers: !!(component.correctAnswer || component.correctBlanks)
        }))
      }))
    };

    res.json({
      success: true,
      message: 'Answers with correct answers retrieved successfully',
      data: formattedData
    });

  } catch (error) {
    console.error('❌ Error retrieving answers with correct answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve answers with correct answers',
      error: error.message
    });
  }
});

// GET /api/homework/get-answers/:assignmentId - Get saved answers
// GET /api/student-answers/get-answers/:assignmentId - Get student answers and initialize correct answers if needed
router.get('/get-answers/:assignmentId', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    let studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    // Ensure pages are properly ordered and reindexed if student answer exists
    if (studentAnswer && studentAnswer.pages) {
      // Sort pages by pageId
      studentAnswer.pages.sort((a, b) => a.pageId - b.pageId);
      
      // Reindex pageIds to ensure continuous numbering
      studentAnswer.pages = studentAnswer.pages.map((page, index) => ({
        ...page,
        pageId: index + 1
      }));
      
      // Save the reindexed pages
      await studentAnswer.save();
    }

    // If no student answer exists, create one and initialize correct answers from CSV
    if (!studentAnswer) {
      console.log('🆕 Creating new student answer record with correct answers from CSV');
      
      // Get homework assignment to access CSV content
      const assignment = await HomeworkAssignment.findById(assignmentId).populate('homeworkId');
      
      if (!assignment || !assignment.homeworkId) {
        return res.status(404).json({
          success: false,
          message: 'Assignment or homework not found'
        });
      }

      // Initialize correct answers from CSV if available
      let correctAnswersMap = new Map();
      if (assignment.homeworkId.csvContent) {
        console.log('📊 Extracting correct answers from CSV content');
        correctAnswersMap = parseCorrectAnswersFromCSV(assignment.homeworkId.csvContent);
      }

      // Create new student answer record with correct answers
      studentAnswer = new StudentAnswer({
        assignmentId,
        studentId,
        correctAnswers: correctAnswersMap,
        currentPage: 0,
        pages: [],
        summary: {
          status: 'not_started'
        }
      });

      await studentAnswer.save();
      console.log('✅ Created student answer record with correct answers initialized');
    }

    res.json({
      success: true,
      message: 'Answers retrieved successfully',
      data: studentAnswer
    });

  } catch (error) {
    console.error('❌ Error retrieving answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve answers',
      error: error.message
    });
  }
});

// POST /api/student-answers/start-homework/:assignmentId - Initialize homework with correct answers from CSV
router.post('/start-homework/:assignmentId', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    console.log('🚀 Starting homework for student:', studentId, 'assignment:', assignmentId);

    // Check if student answer already exists
    let studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (studentAnswer) {
      // If already exists, just return it
      return res.json({
        success: true,
        message: 'Homework already started',
        data: studentAnswer
      });
    }

    // Get homework assignment to access CSV content
    const assignment = await HomeworkAssignment.findById(assignmentId).populate('homeworkId');
    
    if (!assignment || !assignment.homeworkId) {
      return res.status(404).json({
        success: false,
        message: 'Assignment or homework not found'
      });
    }

    console.log('📋 Assignment found:', assignment.homeworkId.homeworkName);
    console.log('📊 CSV content available:', !!assignment.homeworkId.csvContent);

    // Extract correct answers from CSV
    let correctAnswersMap = new Map();
    if (assignment.homeworkId.csvContent) {
      console.log('📊 Extracting correct answers from CSV content...');
      correctAnswersMap = parseCorrectAnswersFromCSV(assignment.homeworkId.csvContent);
      console.log('✅ Extracted correct answers for', correctAnswersMap.size, 'questions');
    } else {
      console.log('⚠️ No CSV content found in homework');
    }

    // Create new student answer record with correct answers
    studentAnswer = new StudentAnswer({
      assignmentId,
      studentId,
      exerciseId: assignment.homeworkId.homeworkName || 'homework_exercise',
      title: assignment.homeworkId.description || 'Homework Exercise',
      correctAnswers: correctAnswersMap,
      currentPage: 0,
      totalPages: 2, // Default, can be updated based on CSV content
      pages: [],
      summary: {
        status: 'in_progress',
        totalQuestions: correctAnswersMap.size,
        correct: 0,
        percentage: 0
      }
    });

    await studentAnswer.save();

    console.log('✅ Successfully started homework with correct answers initialized');

    res.json({
      success: true,
      message: 'Homework started successfully with correct answers loaded',
      data: {
        assignmentId,
        studentId,
        totalCorrectAnswers: correctAnswersMap.size,
        status: 'started',
        studentAnswer
      }
    });

  } catch (error) {
    console.error('❌ Error starting homework:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start homework',
      error: error.message
    });
  }
});

// GET /api/student-answers/get-correct-answers/:assignmentId - Get correct answers for an assignment
router.get('/get-correct-answers/:assignmentId', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    console.log('🔍 Getting correct answers for assignment:', assignmentId);

    // Find student answer record
    const studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Student answer record not found. Please start the homework first.'
      });
    }

    // Convert Map to object for JSON response
    const correctAnswersObject = {};
    if (studentAnswer.correctAnswers) {
      studentAnswer.correctAnswers.forEach((value, key) => {
        correctAnswersObject[key] = value;
      });
    }

    res.json({
      success: true,
      message: 'Correct answers retrieved successfully',
      data: {
        assignmentId,
        totalCorrectAnswers: studentAnswer.correctAnswers?.size || 0,
        correctAnswers: correctAnswersObject
      }
    });

  } catch (error) {
    console.error('❌ Error getting correct answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get correct answers',
      error: error.message
    });
  }
});

// GET /api/homework/verify-correct-answers/:assignmentId - Verify correct answers are stored
router.get('/verify-correct-answers/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = '68b7b468e0aedbc1a8c4e203'; // Hardcoded for testing

    const studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.json({
        success: false,
        message: 'No student answer record found'
      });
    }

    // Check each component to see if correct answers are stored
    const verification = {
      assignmentId,
      studentId,
      totalPages: studentAnswer.pages.length,
      pagesWithCorrectAnswers: 0,
      componentsAnalysis: []
    };

    studentAnswer.pages.forEach((page, pageIndex) => {
      let pageHasCorrectAnswers = false;
      
      page.components.forEach((component, componentIndex) => {
        const analysis = {
          pageId: page.pageId,
          componentIndex,
          type: component.type,
          questionNumber: component.questionNumber,
          hasStudentAnswer: !!(component.studentAnswer || component.blanks),
          hasCorrectAnswer: !!(component.correctAnswer || component.correctBlanks),
          studentAnswerData: component.studentAnswer || component.blanks,
          correctAnswerData: component.correctAnswer || component.correctBlanks
        };

        if (analysis.hasCorrectAnswer) {
          pageHasCorrectAnswers = true;
        }

        verification.componentsAnalysis.push(analysis);
      });

      if (pageHasCorrectAnswers) {
        verification.pagesWithCorrectAnswers++;
      }
    });

    res.json({
      success: true,
      message: 'Verification completed',
      data: verification
    });

  } catch (error) {
    console.error('❌ Error verifying correct answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify correct answers',
      error: error.message
    });
  }
});

// POST /api/student-answers/validate - Validate answers and return correctness
router.post('/validate', async (req, res) => {
  try {
    const { assignmentId, answers, homeworkData } = req.body;
    
    console.log('🎯 Validating answers for assignment:', assignmentId);
    console.log('📝 Answers received:', Object.keys(answers).length, 'answers');
    
    if (!assignmentId || !answers || !homeworkData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required data: assignmentId, answers, or homeworkData'
      });
    }

    // Parse exercise data to get correct answers
    const exerciseData = homeworkData.exerciseData;
    if (!exerciseData) {
      return res.status(400).json({
        success: false,
        message: 'No exercise data found in homeworkData'
      });
    }

    let exerciseStructure;
    try {
      exerciseStructure = JSON.parse(exerciseData);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exercise data format'
      });
    }

    const validationResults = {};

    // Validate each answer
    for (const [key, userAnswer] of Object.entries(answers)) {
      // Skip reading time answers
      if (key.includes('readingTime')) {
        continue;
      }

      // Extract page, question info from key (format: page_X_question_Y)
      const keyMatch = key.match(/page_(\d+)_question_(\d+)/);
      if (!keyMatch) {
        console.log(`⚠️ Skipping invalid key format: ${key}`);
        continue;
      }

      const pageIndex = parseInt(keyMatch[1]); // 0-based page index
      const questionNumber = parseInt(keyMatch[2]); // question number

      console.log(`🔍 Validating ${key}: pageIndex=${pageIndex}, questionNumber=${questionNumber}, userAnswer=`, userAnswer);

      // Find the correct answers in exercise data
      let isCorrect = false;
      let correctAnswer = null;
      let correctAnswerFound = false;

      // Traverse through all exercises and pages to find the matching question by cumulative page index
      let cumulativePageIndex = 0; // 0-based cumulative page index across all exercises
      for (const exercise of exerciseStructure) {
        if (!exercise.pages) continue;

        for (const page of exercise.pages) {
          // Check if this is the page we're looking for by cumulative index
          if (cumulativePageIndex === pageIndex) {
            // Found the right page, now find the question
            if (page.components) {
              for (const component of page.components) {
                if (component.question_number === questionNumber) {
                  correctAnswerFound = true;
                  console.log(`📍 Found question component:`, component);

                  if (component.type === 'multiple_choice_checkbox' && component.options) {
                    console.log(`✅ Processing MCQ with text-based comparison`);
                    console.log(`👤 User answer:`, userAnswer, `(type: ${typeof userAnswer})`);

                    // Extract correct option texts from component
                    let correctTexts = [];
                    component.options.forEach((option, index) => {
                      if (option.correct === true) {
                        let optionText = (option.text || option.answer_text || option).toString().trim();
                        
                        // Apply enhanced quote cleaning to option text
                        console.log(`🔍 MCQ Option before cleaning: "${optionText}"`);
                        let originalText = optionText;
                        let iterations = 0;
                        const maxIterations = 10;
                        
                        while (iterations < maxIterations) {
                          let cleaned = false;
                          
                          // Remove any trailing quotes (all patterns)
                          if (optionText.endsWith('"')) {
                            optionText = optionText.slice(0, -1);
                            console.log(`🔧 MCQ Removed trailing quote: "${optionText}"`);
                            cleaned = true;
                          }
                          // Remove any leading quotes
                          else if (optionText.startsWith('"')) {
                            optionText = optionText.slice(1);
                            console.log(`🔧 MCQ Removed leading quote: "${optionText}"`);
                            cleaned = true;
                          }
                          // Remove trailing escaped quotes  
                          else if (optionText.endsWith('\\"')) {
                            optionText = optionText.slice(0, -2);
                            console.log(`🔧 MCQ Removed escaped trailing quote: "${optionText}"`);
                            cleaned = true;
                          }
                          // Remove leading escaped quotes
                          else if (optionText.startsWith('\\"')) {
                            optionText = optionText.slice(2);
                            console.log(`🔧 MCQ Removed escaped leading quote: "${optionText}"`);
                            cleaned = true;
                          }
                          // Remove trailing backslashes (cleanup)
                          else if (optionText.endsWith('\\')) {
                            optionText = optionText.slice(0, -1);
                            console.log(`🔧 MCQ Removed trailing backslash: "${optionText}"`);
                            cleaned = true;
                          }
                          
                          if (!cleaned) break;
                          iterations++;
                        }
                        
                        // Final trim
                        optionText = optionText.trim();
                        console.log(`✅ MCQ Option after cleaning: "${optionText}" (${iterations} iterations)`);
                        
                        correctTexts.push(optionText);
                      }
                    });

                    console.log(`✅ Correct answer texts:`, correctTexts);

                    // Filter out invalid correct answers
                    correctTexts = correctTexts.filter(text => text && text.trim() !== '' && text.trim().toLowerCase() !== 'null');

                    if (correctTexts.length === 0) {
                      console.log(`⚠️ No valid correct answers found for MCQ, skipping validation`);
                      correctAnswerFound = false;
                      continue;
                    }

                    // If no correct options found in options array, check component level
                    if (correctTexts.length === 0) {
                      console.log(`⚠️ No correct options found in options array, checking component level`);
                      if (component.correct_answer || component.correctAnswer) {
                        let correctAnswerText = (component.correct_answer || component.correctAnswer).toString().trim();
                        // Apply same cleaning
                        let iterations = 0;
                        const maxIterations = 10;
                        while (iterations < maxIterations) {
                          let cleaned = false;
                          if (correctAnswerText.endsWith('"')) {
                            correctAnswerText = correctAnswerText.slice(0, -1);
                            cleaned = true;
                          } else if (correctAnswerText.startsWith('"')) {
                            correctAnswerText = correctAnswerText.slice(1);
                            cleaned = true;
                          } else if (correctAnswerText.endsWith('\\"')) {
                            correctAnswerText = correctAnswerText.slice(0, -2);
                            cleaned = true;
                          } else if (correctAnswerText.startsWith('\\"')) {
                            correctAnswerText = correctAnswerText.slice(2);
                            cleaned = true;
                          } else if (correctAnswerText.endsWith('\\')) {
                            correctAnswerText = correctAnswerText.slice(0, -1);
                            cleaned = true;
                          }
                          if (!cleaned) break;
                          iterations++;
                        }
                        correctAnswerText = correctAnswerText.trim();
                        correctTexts.push(correctAnswerText);
                        console.log(`✅ Found correct answer at component level: "${correctAnswerText}"`);
                      }
                    }

                    // Handle different user answer formats (could be string, array of strings, or mixed)
                    let userAnswerTexts = [];
                    if (Array.isArray(userAnswer)) {
                      // User submitted array - could be texts or indices
                      userAnswerTexts = userAnswer.map(ans => {
                        if (typeof ans === 'string') {
                          return ans.trim();
                        } else if (typeof ans === 'number') {
                          // Handle legacy index-based answers by converting to text
                          const optionText = component.options[ans]?.text || component.options[ans]?.answer_text || component.options[ans];
                          return optionText ? optionText.toString().trim() : '';
                        }
                        return String(ans).trim();
                      }).filter(text => text.length > 0);
                    } else if (typeof userAnswer === 'string') {
                      userAnswerTexts = [userAnswer.trim()];
                    } else if (typeof userAnswer === 'number') {
                      // Handle legacy single index answer
                      const optionText = component.options[userAnswer]?.text || component.options[userAnswer]?.answer_text || component.options[userAnswer];
                      if (optionText) {
                        userAnswerTexts = [optionText.toString().trim()];
                      }
                    }

                    // Clean user answers with the same enhanced cleaning
                    const cleanUserAnswers = userAnswerTexts.map(answerText => {
                      let cleanedAnswer = answerText;
                      let iterations = 0;
                      const maxIterations = 10;
                      
                      console.log(`� User answer before cleaning: "${cleanedAnswer}"`);
                      
                      while (iterations < maxIterations) {
                        let cleaned = false;
                        
                        // Remove trailing quotes
                        if (cleanedAnswer.endsWith('"')) {
                          cleanedAnswer = cleanedAnswer.slice(0, -1);
                          console.log(`🔧 User answer - removed trailing quote: "${cleanedAnswer}"`);
                          cleaned = true;
                        }
                        // Remove leading quotes
                        else if (cleanedAnswer.startsWith('"')) {
                          cleanedAnswer = cleanedAnswer.slice(1);
                          console.log(`🔧 User answer - removed leading quote: "${cleanedAnswer}"`);
                          cleaned = true;
                        }
                        // Remove trailing escaped quotes  
                        else if (cleanedAnswer.endsWith('\\"')) {
                          cleanedAnswer = cleanedAnswer.slice(0, -2);
                          console.log(`🔧 User answer - removed escaped trailing quote: "${cleanedAnswer}"`);
                          cleaned = true;
                        }
                        // Remove leading escaped quotes
                        else if (cleanedAnswer.startsWith('\\"')) {
                          cleanedAnswer = cleanedAnswer.slice(2);
                          console.log(`🔧 User answer - removed escaped leading quote: "${cleanedAnswer}"`);
                          cleaned = true;
                        }
                        // Remove trailing backslashes
                        else if (cleanedAnswer.endsWith('\\')) {
                          cleanedAnswer = cleanedAnswer.slice(0, -1);
                          console.log(`🔧 User answer - removed trailing backslash: "${cleanedAnswer}"`);
                          cleaned = true;
                        }
                        
                        if (!cleaned) break;
                        iterations++;
                      }
                      
                      cleanedAnswer = cleanedAnswer.trim();
                      console.log(`✅ User answer after cleaning: "${cleanedAnswer}" (${iterations} iterations)`);
                      
                      return cleanedAnswer;
                    });

                    console.log(`👤 Processed user answer texts:`, cleanUserAnswers);

                    // Compare text arrays (case-insensitive)
                    const userSet = new Set(cleanUserAnswers.map(text => text.toLowerCase()));
                    const correctSet = new Set(correctTexts.map(text => text.toLowerCase()));
                    
                    isCorrect = userSet.size === correctSet.size && 
                               [...userSet].every(text => correctSet.has(text)) &&
                               [...correctSet].every(text => userSet.has(text));

                    console.log(`🔍 Text comparison result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);

                    // Store correct answer texts for database update
                    correctAnswer = correctTexts;

                  } else if (component.type === 'fill_blank_question') {
                    // For fill in the blank, compare with correct answer text
                    let userText = String(userAnswer).trim();
                    
                    // Clean user answer with enhanced cleaning
                    console.log(`🔍 User fill-in answer before cleaning: "${userText}"`);
                    let userIterations = 0;
                    const maxUserIterations = 10;
                    
                    while (userIterations < maxUserIterations) {
                      let userCleaned = false;
                      
                      // Remove trailing quotes
                      if (userText.endsWith('"')) {
                        userText = userText.slice(0, -1);
                        console.log(`🔧 User fill-in - removed trailing quote: "${userText}"`);
                        userCleaned = true;
                      }
                      // Remove leading quotes
                      else if (userText.startsWith('"')) {
                        userText = userText.slice(1);
                        console.log(`🔧 User fill-in - removed leading quote: "${userText}"`);
                        userCleaned = true;
                      }
                      // Remove trailing escaped quotes  
                      else if (userText.endsWith('\\"')) {
                        userText = userText.slice(0, -2);
                        console.log(`🔧 User fill-in - removed escaped trailing quote: "${userText}"`);
                        userCleaned = true;
                      }
                      // Remove leading escaped quotes
                      else if (userText.startsWith('\\"')) {
                        userText = userText.slice(2);
                        console.log(`🔧 User fill-in - removed escaped leading quote: "${userText}"`);
                        userCleaned = true;
                      }
                      // Remove trailing backslashes
                      else if (userText.endsWith('\\')) {
                        userText = userText.slice(0, -1);
                        console.log(`🔧 User fill-in - removed trailing backslash: "${userText}"`);
                        userCleaned = true;
                      }
                      
                      if (!userCleaned) break;
                      userIterations++;
                    }
                    
                    userText = userText.trim();
                    console.log(`✅ User fill-in answer after cleaning: "${userText}" (${userIterations} iterations)`);
                    
                    // Get correct answer from different possible locations
                    let correctAnswerText = '';
                    
                    if (component.blanks && component.blanks.length > 0 && component.blanks[0].correct_answers) {
                      // From CSV conversion format: component.blanks[0].correct_answers[0]
                      const rawCorrectAnswer = component.blanks[0].correct_answers[0] || '';
                      console.log(`🔍 Raw correct answer from blanks:`, rawCorrectAnswer, `(type: ${typeof rawCorrectAnswer})`);
                      correctAnswerText = rawCorrectAnswer;
                    } else if (component.correct_answer) {
                      // From direct format: component.correct_answer
                      correctAnswerText = component.correct_answer;
                    } else if (component.answer) {
                      // From alternative format: component.answer
                      correctAnswerText = component.answer;
                    }
                    
                    // Convert to string and trim
                    correctAnswerText = String(correctAnswerText).trim();
                    
                    console.log(`🔍 Before quote cleaning: "${correctAnswerText}"`);
                    
                    // Enhanced quote cleaning logic to handle all edge cases
                    console.log(`🚀 ENHANCED QUOTE CLEANING ACTIVE!`);
                    let originalText = correctAnswerText;
                    let iterations = 0;
                    const maxIterations = 10; // Prevent infinite loops
                    
                    while (iterations < maxIterations) {
                      let cleaned = false;
                      
                      // Remove any trailing quotes (all patterns)
                      if (correctAnswerText.endsWith('"')) {
                        correctAnswerText = correctAnswerText.slice(0, -1);
                        console.log(`🔧 Removed trailing quote: "${correctAnswerText}"`);
                        cleaned = true;
                      }
                      // Remove any leading quotes
                      else if (correctAnswerText.startsWith('"')) {
                        correctAnswerText = correctAnswerText.slice(1);
                        console.log(`🔧 Removed leading quote: "${correctAnswerText}"`);
                        cleaned = true;
                      }
                      // Remove trailing escaped quotes  
                      else if (correctAnswerText.endsWith('\\"')) {
                        correctAnswerText = correctAnswerText.slice(0, -2);
                        console.log(`🔧 Removed escaped trailing quote: "${correctAnswerText}"`);
                        cleaned = true;
                      }
                      // Remove leading escaped quotes
                      else if (correctAnswerText.startsWith('\\"')) {
                        correctAnswerText = correctAnswerText.slice(2);
                        console.log(`🔧 Removed escaped leading quote: "${correctAnswerText}"`);
                        cleaned = true;
                      }
                      // Remove trailing backslashes (cleanup)
                      else if (correctAnswerText.endsWith('\\')) {
                        correctAnswerText = correctAnswerText.slice(0, -1);
                        console.log(`🔧 Removed trailing backslash: "${correctAnswerText}"`);
                        cleaned = true;
                      }
                      
                      if (!cleaned) break;
                      iterations++;
                    }
                    
                    // Final trim to clean up any remaining whitespace
                    correctAnswerText = correctAnswerText.trim();
                    
                    console.log(`✅ Final correct answer: "${correctAnswerText}" (cleaned in ${iterations} iterations)`);
                    
                    if (!correctAnswerText || correctAnswerText.trim() === '' || correctAnswerText.trim().toLowerCase() === 'null') {
                      console.log(`⚠️ Invalid correct answer for fill_blank: "${correctAnswerText}", skipping validation`);
                      correctAnswerFound = false;
                      continue;
                    }

                    console.log(`📝 Fill-in-blank validation:`);
                    console.log(`   User answer: "${userText}"`);
                    console.log(`   Correct answer: "${correctAnswerText}"`);
                    console.log(`   Component structure:`, JSON.stringify(component, null, 2));
                    
                    // Case-insensitive comparison for fill-in-the-blank
                    isCorrect = userText.toLowerCase() === correctAnswerText.toLowerCase();

                    // Store correct answer for database update
                    correctAnswer = correctAnswerText;
                  }

                  console.log(`🎯 Question ${questionNumber} validation result: ${isCorrect ? 'CORRECT ✅' : 'INCORRECT ❌'}`);
                  break;
                }
              }
            }
            break;
          }
          // Move to next page in cumulative count
          cumulativePageIndex++;
        }
        if (correctAnswerFound) break;
      }

      if (!correctAnswerFound) {
        console.log(`⚠️ No correct answer found in JSON data for ${key}, trying CSV fallback...`);
        
        // Try to get the correct answer from CSV data stored in the database
        try {
          const assignment = await HomeworkAssignment.findById(assignmentId).populate('homeworkId');
          if (assignment && assignment.homeworkId && assignment.homeworkId.csvContent) {
            console.log('📊 Found CSV content, parsing for correct answers...');
            const correctAnswersMap = parseCorrectAnswersFromCSV(assignment.homeworkId.csvContent);
            
            // Generate CSV key format: exercise_page_questionType_questionNumber
            // Try multiple possible exercise IDs and question types based on page
            const possibleKeys = [];
            
            // Determine likely exercise and question type based on page
            if (pageIndex >= 0 && pageIndex <= 2) {
              // Pages 0-2: likely reading comprehension
              possibleKeys.push(`reading_comprehension_1_${pageIndex + 1}_fill_blank_question_${questionNumber}`);
              possibleKeys.push(`reading_comprehension_1_${pageIndex + 1}_multiple_choice_checkbox_${questionNumber}`);
            }
            
            if (pageIndex >= 2) {
              // Pages 2+: likely math word problems  
              possibleKeys.push(`math_word_problems_1_${pageIndex - 1}_fill_blank_question_${questionNumber}`);
              possibleKeys.push(`math_word_problems_1_${pageIndex - 1}_multiple_choice_checkbox_${questionNumber}`);
              possibleKeys.push(`math_word_problems_1_${pageIndex}_fill_blank_question_${questionNumber}`);
              possibleKeys.push(`math_word_problems_1_${pageIndex}_multiple_choice_checkbox_${questionNumber}`);
            }
            
            // Also try direct mapping
            possibleKeys.push(`reading_comprehension_1_${pageIndex + 1}_fill_blank_question_${questionNumber}`);
            possibleKeys.push(`math_word_problems_1_${pageIndex + 1}_fill_blank_question_${questionNumber}`);
            
            console.log(`🔍 Trying CSV keys for page_${pageIndex}_question_${questionNumber}:`, possibleKeys);
            
            // Try each possible key
            for (const csvKey of possibleKeys) {
              if (correctAnswersMap.has(csvKey)) {
                const csvData = correctAnswersMap.get(csvKey);
                console.log(`📝 Found CSV data with key "${csvKey}":`, csvData);
                
                if (csvData.correctAnswerText && csvData.correctAnswerText.length > 0) {
                  let csvCorrectAnswer = csvData.correctAnswerText[0];
                  
                  if (csvCorrectAnswer && csvCorrectAnswer.trim() !== '' && csvCorrectAnswer.trim().toLowerCase() !== 'null') {
                    // Remove the "= " prefix if present (fill-in-the-blank format)
                    if (csvCorrectAnswer.startsWith('= ')) {
                      csvCorrectAnswer = csvCorrectAnswer.substring(2);
                    }
                    
                    console.log(`✅ Using CSV correct answer: "${csvCorrectAnswer}"`);
                    
                    // Validate against CSV answer
                    const userText = String(Array.isArray(userAnswer) ? userAnswer[0] : userAnswer).trim();
                    isCorrect = userText.toLowerCase() === csvCorrectAnswer.toLowerCase();
                    correctAnswer = csvCorrectAnswer;
                    correctAnswerFound = true;
                    
                    console.log(`🎯 CSV validation result: ${isCorrect ? 'CORRECT ✅' : 'INCORRECT ❌'}`);
                    break; // Found a match, exit the loop
                  }
                }
              }
            }
            
            if (!correctAnswerFound) {
              console.log(`⚠️ No CSV data found for any of the tried keys:`, possibleKeys);
            }
          }
        } catch (error) {
          console.error('❌ Error during CSV fallback:', error);
        }
        
        if (!correctAnswerFound) {
          console.log(`❌ No correct answer found in either JSON or CSV data for ${key}`);
          isCorrect = false;
        }
      }

      validationResults[key] = {
        isCorrect,
        userAnswer,
        correctAnswer,
        questionKey: key
      };
    }

    const totalQuestions = Object.keys(validationResults).length;
    const correctCount = Object.values(validationResults).filter(r => r.isCorrect).length;

    console.log(`📊 Validation completed: ${correctCount}/${totalQuestions} correct answers`);

    // 🔄 UPDATE DATABASE: Find existing StudentAnswer document and update with validation results
    const studentId = '68b7b468e0aedbc1a8c4e203'; // Hardcoded for now
    
    try {
      // Find existing StudentAnswer document
      let studentAnswer = await StudentAnswer.findOne({
        assignmentId,
        studentId
      });

      if (!studentAnswer) {
        // Return error if document doesn't exist - user should save answers first
        return res.status(400).json({
          success: false,
          message: "Student answers not found. Please save answers first before validating."
        });
      }

      console.log('💾 Updating existing StudentAnswer document with validation results...');

      // Update pages/components with validation results - work with actual model structure
      for (const [questionKey, validationResult] of Object.entries(validationResults)) {
        // Extract page and question info from key (format: page_X_question_Y)
        const keyMatch = questionKey.match(/page_(\d+)_question_(\d+)/);
        if (!keyMatch) {
          console.log(`⚠️ Skipping invalid key format: ${questionKey}`);
          continue;
        }

        const pageIndex = parseInt(keyMatch[1]); // 0-based page index
        const questionNumber = parseInt(keyMatch[2]); // question number

        console.log(`🔄 Updating ${questionKey}: pageIndex=${pageIndex}, questionNumber=${questionNumber}`);

        // Find the page in the student answer
        let targetPage = studentAnswer.pages.find(page => page.pageId === pageIndex + 1);
        
        if (!targetPage) {
          console.log(`⚠️ Page ${pageIndex + 1} not found in student answers, creating it...`);
          // Create the page if it doesn't exist
          targetPage = {
            pageId: pageIndex + 1,
            templateType: 'story_with_questions', // Default template
            components: []
          };
          studentAnswer.pages.push(targetPage);
        }

        // Find the component for this question
        let targetComponent = targetPage.components.find(comp => comp.questionNumber === questionNumber);
        
        if (!targetComponent) {
          console.log(`⚠️ Component for question ${questionNumber} not found, creating it...`);
          // Create the component if it doesn't exist
          targetComponent = {
            type: 'multiple_choice_checkbox', // Default type
            questionNumber: questionNumber,
            studentAnswer: {
              selected: Array.isArray(validationResult.userAnswer) ? validationResult.userAnswer : [validationResult.userAnswer],
              isCorrect: false
            }
          };
          targetPage.components.push(targetComponent);
        }

        // Update the component with validation results
        if (targetComponent.studentAnswer) {
          console.log(`🔄 Before update - ${questionKey} isCorrect:`, targetComponent.studentAnswer.isCorrect);
          targetComponent.studentAnswer.isCorrect = validationResult.isCorrect;
          console.log(`🔄 After update - ${questionKey} isCorrect:`, targetComponent.studentAnswer.isCorrect);
          
          // Store correct answer for reference - ensure proper format
          if (Array.isArray(validationResult.correctAnswer)) {
            // For multiple choice - correctAnswer contains indices
            targetComponent.correctAnswer.correctOptions = validationResult.correctAnswer.map((index, i) => ({
              id: `option_${index}`,
              text: `Option ${index}`
            }));
          } else {
            // For text answers - correctAnswer contains text
            targetComponent.correctAnswer.correctOptions = [{
              id: 'text_answer',
              text: String(validationResult.correctAnswer)
            }];
          }
        } else {
          // Create studentAnswer if it doesn't exist
          console.log(`🆕 Creating new studentAnswer for ${questionKey} with isCorrect:`, validationResult.isCorrect);
          targetComponent.studentAnswer = {
            selected: Array.isArray(validationResult.userAnswer) ? validationResult.userAnswer : [validationResult.userAnswer],
            isCorrect: validationResult.isCorrect
          };
          
          // Store correct answer for reference - ensure proper format
          if (Array.isArray(validationResult.correctAnswer)) {
            // For multiple choice - correctAnswer contains indices
            targetComponent.correctAnswer = {
              correctOptions: validationResult.correctAnswer.map((index, i) => ({
                id: `option_${index}`,
                text: `Option ${index}`
              }))
            };
          } else {
            // For text answers - correctAnswer contains text
            targetComponent.correctAnswer = {
              correctOptions: [{
                id: 'text_answer',
                text: String(validationResult.correctAnswer)
              }]
            };
          }
        }

        console.log(`✅ Updated ${questionKey} with isCorrect: ${validationResult.isCorrect}`);
      }

      // Save the updated document
      console.log('💾 Saving updated StudentAnswer document...');
      const savedDocument = await studentAnswer.save();
      console.log('✅ Document saved successfully. Verifying update...');
      
      // Verify the update worked
      const verifyUpdate = await StudentAnswer.findById(studentAnswer._id);
      if (verifyUpdate) {
        console.log('🔍 Verification - Updated document pages:', verifyUpdate.pages.length);
        verifyUpdate.pages.forEach((page, pageIndex) => {
          console.log(`📄 Page ${page.pageId}:`, page.components.length, 'components');
          page.components.forEach((comp, compIndex) => {
            if (comp.studentAnswer) {
              console.log(`  📝 Component ${comp.questionNumber}: isCorrect = ${comp.studentAnswer.isCorrect}`);
            }
          });
        });
      }

      console.log('✅ Successfully updated StudentAnswer document with validation results');

    } catch (dbError) {
      console.error('❌ Error updating StudentAnswer document:', dbError);
      // Continue with response even if DB update fails
    }

    res.json({
      success: true,
      validationResults,
      totalQuestions,
      correctAnswers: correctCount
    });

  } catch (error) {
    console.error('❌ Error validating answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate answers',
      error: error.message
    });
  }
});

// POST /api/homework/submit-assignment - Submit complete assignment
router.post('/submit-assignment', async (req, res) => {
  try {
    const { assignmentId, results, timeSpent } = req.body;
    const studentId = '68b7b468e0aedbc1a8c4e203'; // Hardcoded for now

    console.log('🎯 Submitting complete assignment:', assignmentId);

    // Find existing student answer record
    let studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Student answer record not found'
      });
    }

    // Update summary with final results
    studentAnswer.summary.status = 'completed';
    studentAnswer.summary.totalQuestions = results?.total || 0;
    studentAnswer.summary.correct = results?.score || 0;
    studentAnswer.summary.percentage = results?.total > 0 ? 
      Math.round((results.score / results.total) * 100) : 0;
    
    // Add completion timestamp
    studentAnswer.lastUpdated = new Date();

    await studentAnswer.save();

    console.log('✅ Assignment submitted successfully');

    res.json({
      success: true,
      message: 'Assignment submitted successfully',
      data: {
        assignmentId,
        results: studentAnswer.summary,
        submittedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Error submitting assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assignment',
      error: error.message
    });
  }
});

// GET /api/student-answers/review/:assignmentId - Get completed assignment for review with page indicators
router.get('/review/:assignmentId', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    // Get student answer record
    const studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found. Please complete the homework first.'
      });
    }

    // Check if assignment is completed
    if (studentAnswer.summary.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Assignment is not completed yet. Please submit the assignment first.'
      });
    }

    // Get homework assignment details
    const assignment = await HomeworkAssignment.findById(assignmentId).populate('homeworkId');
    
    // Calculate page indicators (✅ or ❌) based on student answers vs correct answers
    const pageIndicators = [];
    
    for (const page of studentAnswer.pages) {
      let correctCount = 0;
      let totalQuestions = 0;
      
      for (const component of page.components) {
        if (component.type === 'multiple_choice_checkbox' || component.type === 'fill_blank_question') {
          totalQuestions++;
          if (component.studentAnswer?.isCorrect || component.blanks?.[0]?.isCorrect) {
            correctCount++;
          }
        }
      }
      
      pageIndicators.push({
        pageId: page.pageId,
        status: correctCount === totalQuestions ? 'correct' : 'incorrect',
        correctCount,
        totalQuestions,
        needsEdit: correctCount < totalQuestions
      });
    }

    res.json({
      success: true,
      message: 'Assignment review data retrieved successfully',
      data: {
        assignmentId,
        studentAnswer,
        assignment: {
          _id: assignment._id,
          homeworkName: assignment.homeworkId?.homeworkName,
          description: assignment.homeworkId?.description
        },
        pageIndicators,
        summary: {
          totalPages: pageIndicators.length,
          completedPages: pageIndicators.filter(p => p.status === 'correct').length,
          pagesNeedingEdit: pageIndicators.filter(p => p.needsEdit).length,
          overallStatus: pageIndicators.every(p => p.status === 'correct') ? 'all_correct' : 'has_errors'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting assignment review:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assignment review',
      error: error.message
    });
  }
});

// PUT /api/student-answers/edit/:assignmentId/:pageId - Enable edit mode for a specific page
router.put('/edit/:assignmentId/:pageId', auth, async (req, res) => {
  try {
    const { assignmentId, pageId } = req.params;
    const studentId = req.user.id;

    console.log('✏️ Enabling edit mode for page:', pageId, 'assignment:', assignmentId);

    // Get student answer record
    const studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Find the specific page
    const page = studentAnswer.pages.find(p => p.pageId === parseInt(pageId));
    
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    // Return page data with edit capabilities for wrong answers only
    const editableComponents = page.components.map(component => {
      const isCorrect = component.studentAnswer?.isCorrect || component.blanks?.[0]?.isCorrect;
      
      return {
        ...component,
        isCorrect,
        editable: !isCorrect, // Only wrong answers are editable
        editMode: true
      };
    });

    res.json({
      success: true,
      message: 'Edit mode enabled for page',
      data: {
        pageId: parseInt(pageId),
        components: editableComponents,
        editMode: true
      }
    });

  } catch (error) {
    console.error('❌ Error enabling edit mode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enable edit mode',
      error: error.message
    });
  }
});

// POST /api/student-answers/final-submit/:assignmentId - Final submit after editing corrections
router.post('/final-submit/:assignmentId', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    console.log('🎯 Final submit for assignment:', assignmentId);

    // Get student answer record
    let studentAnswer = await StudentAnswer.findOne({
      assignmentId,
      studentId
    });

    if (!studentAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Re-validate all answers against correct answers from CSV
    let totalCorrect = 0;
    let totalQuestions = 0;

    for (const page of studentAnswer.pages) {
      for (const component of page.components) {
        if (component.type === 'multiple_choice_checkbox' || component.type === 'fill_blank_question') {
          totalQuestions++;
          
          // Re-check answer correctness
          const questionKey = `${studentAnswer.exerciseId}_${page.pageId}_${component.type}_${component.questionNumber}`;
          const correctAnswerData = studentAnswer.correctAnswers?.get(questionKey);
          
          let isCorrect = false;
          
          if (component.type === 'multiple_choice_checkbox' && correctAnswerData) {
            const studentSelected = component.studentAnswer?.selected || [];
            const correctTexts = correctAnswerData.correctAnswerText;
            isCorrect = studentSelected.some(selectedIndex => 
              correctTexts.includes(selectedIndex.toString()) || 
              correctAnswerData.correctOptions.some(opt => opt.text === selectedIndex)
            );
          } else if (component.type === 'fill_blank_question' && correctAnswerData) {
            const studentAnswerText = (component.blanks?.[0]?.studentAnswer || '').toLowerCase().trim();
            isCorrect = correctAnswerData.correctAnswerText.some(correctAns => {
              const cleanCorrectAns = correctAns.replace(/^=\s*/, '').toLowerCase().trim();
              return cleanCorrectAns === studentAnswerText;
            });
          }
          
          // Update component with new correctness
          if (component.studentAnswer) {
            component.studentAnswer.isCorrect = isCorrect;
          }
          if (component.blanks && component.blanks[0]) {
            component.blanks[0].isCorrect = isCorrect;
          }
          
          if (isCorrect) totalCorrect++;
        }
      }
    }

    // Update summary
    studentAnswer.summary.correct = totalCorrect;
    studentAnswer.summary.totalQuestions = totalQuestions;
    studentAnswer.summary.percentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    studentAnswer.lastUpdated = new Date();

    await studentAnswer.save();
    
    console.log('✅ Final submit completed - Score:', totalCorrect, '/', totalQuestions);

    // Calculate updated page indicators
    const pageIndicators = [];
    for (const page of studentAnswer.pages) {
      let correctCount = 0;
      let totalPageQuestions = 0;
      
      for (const component of page.components) {
        if (component.type === 'multiple_choice_checkbox' || component.type === 'fill_blank_question') {
          totalPageQuestions++;
          if (component.studentAnswer?.isCorrect || component.blanks?.[0]?.isCorrect) {
            correctCount++;
          }
        }
      }
      
      pageIndicators.push({
        pageId: page.pageId,
        status: correctCount === totalPageQuestions ? 'correct' : 'incorrect',
        correctCount,
        totalQuestions: totalPageQuestions,
        needsEdit: correctCount < totalPageQuestions
      });
    }

    res.json({
      success: true,
      message: 'Assignment corrections submitted successfully',
      data: {
        assignmentId,
        updatedScore: {
          correct: totalCorrect,
          total: totalQuestions,
          percentage: studentAnswer.summary.percentage
        },
        pageIndicators,
        summary: {
          totalPages: pageIndicators.length,
          completedPages: pageIndicators.filter(p => p.status === 'correct').length,
          pagesNeedingEdit: pageIndicators.filter(p => p.needsEdit).length,
          overallStatus: pageIndicators.every(p => p.status === 'correct') ? 'all_correct' : 'has_errors'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in final submit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit corrections',
      error: error.message
    });
  }
});

// POST /api/student-answers/test-csv-parsing - Test CSV parsing functionality
router.post('/test-csv-parsing', async (req, res) => {
  try {
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({
        success: false,
        message: 'CSV content is required'
      });
    }

    console.log('🧪 Testing CSV parsing...');
    const correctAnswersMap = parseCorrectAnswersFromCSV(csvContent);
    
    // Convert Map to object for response
    const correctAnswersObject = {};
    correctAnswersMap.forEach((value, key) => {
      correctAnswersObject[key] = value;
    });

    res.json({
      success: true,
      message: 'CSV parsed successfully',
      data: {
        totalQuestions: correctAnswersMap.size,
        correctAnswers: correctAnswersObject
      }
    });

  } catch (error) {
    console.error('❌ Error testing CSV parsing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to parse CSV',
      error: error.message
    });
  }
});

// POST /api/student-answers/:assignmentId/start-session - Start time tracking session
router.post('/:assignmentId/start-session', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;
    
    console.log('⏱️ Starting study session for assignment:', assignmentId, 'student:', studentId);
    
    let studentAnswer = await StudentAnswer.findOne({ 
      assignmentId, 
      studentId 
    });
    
    if (!studentAnswer) {
      // Create new student answer record if it doesn't exist
      studentAnswer = new StudentAnswer({
        assignmentId,
        studentId,
        studyTracking: {
          totalTimeSpent: 0,
          dailyTime: [],
          startTime: new Date(),
          lastActiveTime: new Date(),
          isActive: true
        }
      });
    } else {
      // Update existing record to start session
      if (!studentAnswer.studyTracking) {
        studentAnswer.studyTracking = {
          totalTimeSpent: 0,
          dailyTime: [],
          isActive: true
        };
      }
      
      studentAnswer.studyTracking.startTime = new Date();
      studentAnswer.studyTracking.lastActiveTime = new Date();
      studentAnswer.studyTracking.isActive = true;
    }
    
    await studentAnswer.save();
    
    res.json({
      success: true,
      message: 'Study session started',
      data: {
        sessionStartTime: studentAnswer.studyTracking.startTime,
        isActive: studentAnswer.studyTracking.isActive
      }
    });

  } catch (error) {
    console.error('❌ Error starting study session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start study session',
      error: error.message
    });
  }
});

// POST /api/student-answers/:assignmentId/end-session - End time tracking session
router.post('/:assignmentId/end-session', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;
    
    console.log('⏹️ Ending study session for assignment:', assignmentId, 'student:', studentId);
    
    const studentAnswer = await StudentAnswer.findOne({ 
      assignmentId, 
      studentId 
    });
    
    if (!studentAnswer || !studentAnswer.studyTracking || !studentAnswer.studyTracking.isActive) {
      return res.status(400).json({
        success: false,
        message: 'No active study session found'
      });
    }
    
    const now = new Date();
    const startTime = studentAnswer.studyTracking.startTime;
    const sessionDuration = Math.round((now - startTime) / (1000 * 60)); // in minutes
    
    // Update total time spent
    studentAnswer.studyTracking.totalTimeSpent += sessionDuration;
    studentAnswer.studyTracking.isActive = false;
    studentAnswer.studyTracking.lastActiveTime = now;
    
    // Add to daily time tracking
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dailyRecord = studentAnswer.studyTracking.dailyTime.find(
      d => new Date(d.date).toDateString() === today.toDateString()
    );
    
    if (!dailyRecord) {
      dailyRecord = {
        date: today,
        timeSpent: 0,
        sessions: []
      };
      studentAnswer.studyTracking.dailyTime.push(dailyRecord);
    }
    
    dailyRecord.timeSpent += sessionDuration;
    dailyRecord.sessions.push({
      startTime,
      endTime: now,
      duration: sessionDuration
    });
    
    await studentAnswer.save();
    
    res.json({
      success: true,
      message: 'Study session ended',
      data: {
        sessionDuration,
        totalTimeSpent: studentAnswer.studyTracking.totalTimeSpent,
        dailyTimeSpent: dailyRecord.timeSpent
      }
    });

  } catch (error) {
    console.error('❌ Error ending study session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end study session',
      error: error.message
    });
  }
});

// GET /api/student-answers/:assignmentId/study-data - Get study tracking data
router.get('/:assignmentId/study-data', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;
    const { month, year } = req.query;
    
    console.log('📊 Getting study data for assignment:', assignmentId, 'student:', studentId);
    
    const studentAnswer = await StudentAnswer.findOne({ 
      assignmentId, 
      studentId 
    }).populate('assignmentId', 'title subject grade assignedDate dueDate status');
    
    if (!studentAnswer) {
      return res.status(404).json({
        success: false,
        message: 'Student answer record not found'
      });
    }
    
    let dailyData = studentAnswer.studyTracking?.dailyTime || [];
    
    // Filter by month and year if provided
    if (month && year) {
      dailyData = dailyData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === parseInt(month) - 1 && 
               recordDate.getFullYear() === parseInt(year);
      });
    }
    
    res.json({
      success: true,
      data: {
        assignment: studentAnswer.assignmentId,
        studyTracking: {
          totalTimeSpent: studentAnswer.studyTracking?.totalTimeSpent || 0,
          isActive: studentAnswer.studyTracking?.isActive || false,
          dailyTime: dailyData
        },
        taskProgress: studentAnswer.taskProgress || [],
        summary: studentAnswer.summary
      }
    });

  } catch (error) {
    console.error('❌ Error getting study data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get study data',
      error: error.message
    });
  }
});

// POST /api/student-answers/:assignmentId/update-task-progress - Update task progress
router.post('/:assignmentId/update-task-progress', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;
    const { taskId, taskDescription, completed, timeSpent } = req.body;
    
    console.log('📋 Updating task progress for assignment:', assignmentId);
    
    let studentAnswer = await StudentAnswer.findOne({ 
      assignmentId, 
      studentId 
    });
    
    if (!studentAnswer) {
      studentAnswer = new StudentAnswer({
        assignmentId,
        studentId,
        taskProgress: []
      });
    }
    
    if (!studentAnswer.taskProgress) {
      studentAnswer.taskProgress = [];
    }
    
    // Find or create task progress
    let taskProgress = studentAnswer.taskProgress.find(t => t.taskId === taskId);
    
    if (!taskProgress) {
      taskProgress = {
        taskId,
        taskDescription,
        completed: false,
        timeSpent: 0
      };
      studentAnswer.taskProgress.push(taskProgress);
    }
    
    // Update task progress
    if (completed !== undefined) {
      taskProgress.completed = completed;
      if (completed) {
        taskProgress.completedDate = new Date();
      }
    }
    
    if (timeSpent !== undefined) {
      taskProgress.timeSpent += timeSpent;
    }
    
    await studentAnswer.save();
    
    res.json({
      success: true,
      message: 'Task progress updated',
      data: {
        taskProgress: studentAnswer.taskProgress
      }
    });

  } catch (error) {
    console.error('❌ Error updating task progress:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task progress',
      error: error.message
    });
  }
});

module.exports = router;
