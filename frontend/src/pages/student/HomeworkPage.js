import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { homeworkAPI } from '../../utils/api';
import { getStoredUser } from '../../utils/helpers';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import styles from './HomeworkPage.module.css';

const HomeworkPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeSpent, setTimeSpent] = useState(0);
  const [startTime] = useState(new Date());
  const [user, setUser] = useState(null);

  // Current page state
  const [currentPage, setCurrentPage] = useState(0);

  const [lockedPages, setLockedPages] = useState([]); // [true/false] per page
  const [submitted, setSubmitted] = useState(false);
  
  // Track validation data from API
  const [hasValidation, setHasValidation] = useState(false);
  const [validationData, setValidationData] = useState({}); // Store validation results per question
  
  const [isLastPage, setIsLastPage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Add state for page-level correctness indicators
  const [pageCorrectness, setPageCorrectness] = useState({});

  // Simple helper function to get page-level correctness status from API validationData
  const getPageCorrectness = (pageIndex) => {
    if (!pagesData || !pagesData[pageIndex] || !hasValidation || Object.keys(validationData || {}).length === 0) {
      return null; // No indicator when no validation data
    }

    const page = pagesData[pageIndex];
    let hasAnyValidation = false;
    let allCorrect = true;

    for (const question of page.questions) {
      const questionKey = `page_${pageIndex}_question_${question.id}`;
      const validation = validationData[questionKey];
      
      if (validation) {
        hasAnyValidation = true;
        if (!validation.isCorrect) {
          allCorrect = false;
        }
      }
    }

    // Only return a status if we have validation data for this page
    if (!hasAnyValidation) {
      return null;
    }

    return allCorrect ? 'correct' : 'incorrect';
  };

  // Helper function to get individual question validation status
  const getQuestionValidationStatus = (questionId) => {
    const questionKey = `page_${currentPage}_question_${questionId}`;
    const validation = validationData[questionKey];
    
    if (!hasValidation || !validation) {
      return null; // No validation data
    }
    
    return validation.isCorrect ? 'correct' : 'incorrect';
  };

  // Helper function to determine if question-level indicators should be shown
  const shouldShowQuestionIndicators = () => {
    if (!hasValidation || Object.keys(validationData || {}).length === 0) {
      return false;
    }
    
    // Only show question indicators if there are wrong answers on the current page
    const page = pagesData[currentPage];
    if (!page) return false;
    
    for (const question of page.questions) {
      const questionKey = `page_${currentPage}_question_${question.id}`;
      const validation = validationData[questionKey];
      
      if (validation && !validation.isCorrect) {
        return true; // Found at least one wrong answer
      }
    }
    
    return false; // All answers are correct or no validation data
  };

  // Save progress when navigating
  const saveProgress = async (currentAnswers) => {
    try {
      console.log('💾 Saving progress...');
      setIsSaving(true);
      
      // Create an array to hold all pages' data
      const allPagesData = pagesData.map((pageData, pageIndex) => {
        console.log(`Processing page ${pageIndex}...`);
        // Get answers for this page
        const pageAnswers = {};
        pageData.questions.forEach(question => {
          const key = `page_${pageIndex}_question_${question.id}`;
          const answer = currentAnswers[key];
          console.log(`Question ${question.id} answer:`, answer);
          pageAnswers[key] = answer !== undefined ? answer : null;
        });

        // Format page data
        return {
          pageId: pageIndex + 1,
          templateType: pageData.type === 'reading' ? 'story_with_questions' : 'fill_in_blank',
          components: pageData.questions.map(question => {
            const key = `page_${pageIndex}_question_${question.id}`;
            const answer = pageAnswers[key];
            const questionType = pageData.type === 'reading' ? 'multiple_choice_checkbox' : 'fill_blank_question';
            
            let selected;
            if (questionType === 'multiple_choice_checkbox') {
              // For multiple choice, ensure selected is always an array
              selected = answer ? (Array.isArray(answer) ? answer : [answer]) : [];
            } else {
              // For fill in blank, store the actual input value or empty array if not answered
              selected = answer || [];
            }

            // Get correct options based on question type
            let correctOptions = [];
            if (questionType === 'multiple_choice_checkbox') {
              correctOptions = question.correctOptions || question.options
                ?.filter((_, idx) => question.correctAnswers?.includes(idx))
                ?.map(optText => ({
                  id: `option_${optText}`,
                  text: optText,
                  _id: Math.random().toString(36).substr(2, 9)
                })) || [];
            } else {
              correctOptions = question.correctOptions || (
                question.correctAnswer ? [{
                  id: 'text_answer',
                  text: question.correctAnswer,
                  _id: Math.random().toString(36).substr(2, 9)
                }] : []
              );
            }

            console.log('Saving question:', {
              questionType,
              questionId: question.id,
              correctOptions,
              selected
            });

            // Validate the answer against correct options
            let isCorrect = false;
            if (questionType === 'multiple_choice_checkbox') {
              // For multiple choice, check if selected answers match correct options
              const correctAnswerTexts = correctOptions.map(opt => opt.text);
              isCorrect = selected.length === correctAnswerTexts.length &&
                         selected.every(ans => correctAnswerTexts.includes(ans));
            } else {
              // For fill in blank, check if the answer matches any correct option
              const correctAnswerTexts = correctOptions.map(opt => opt.text);
              isCorrect = correctAnswerTexts.includes(selected);
            }

            return {
              type: questionType,
              questionNumber: question.id,
              studentAnswer: {
                selected: selected,
                isCorrect: isCorrect,
                isValidated: true
              },
              correctAnswer: {
                selected: [],
                correctOptions: correctOptions
              }
            };
          })
        };
      });

      // Call the API to save progress with all pages data
      await homeworkAPI.saveProgress({
        assignmentId,
        exerciseId: pagesData[0]?.exerciseId || 'default_exercise',
        title: pagesData[0]?.title || 'Homework Exercise',
        total_pages: pagesData.length,
        pages: allPagesData
      });

      setIsSaving(false);
      console.log('✅ Progress saved successfully');
    } catch (error) {
      console.error('❌ Error saving progress:', error);
      setError('Failed to save progress');
      setIsSaving(false);
    }
  };

  // Handle answer updates
  const validateAnswer = (answer, type, correctOptions) => {
    if (type === 'multiple_choice_checkbox') {
      const correctAnswerTexts = correctOptions.map(opt => opt.text);
      return answer.length === correctAnswerTexts.length &&
             answer.every(ans => correctAnswerTexts.includes(ans));
    } else {
      const correctAnswerTexts = correctOptions.map(opt => opt.text);
      return correctAnswerTexts.includes(answer);
    }
  };

  const handleAnswerUpdate = (questionId, answer, type) => {
    const key = `page_${currentPage}_question_${questionId}`;
    const currentQuestion = currentPageData?.questions?.find(q => q.id === questionId);
    
    let processedAnswer;
    if (type === 'multiple_choice_checkbox') {
      // For multiple choice, ensure it's always an array
      processedAnswer = Array.isArray(answer) ? answer : [answer].filter(a => a !== null && a !== undefined);
    } else if (type === 'fill_blank_question') {
      // For fill in blank, store the actual value or empty array if not answered
      processedAnswer = answer || [];
    }

    // Validate the answer
    const isCorrect = validateAnswer(processedAnswer, type, currentQuestion?.correctOptions || []);

    // Update answers state with validation result
    setAnswers(prev => ({
      ...prev,
      [key]: processedAnswer
    }));

    // Save progress immediately with validation result
    saveProgress({
      ...answers,
      [key]: processedAnswer,
      [`${key}_validation`]: {
        isCorrect,
        isValidated: true
      }
    });
  };

  // Handle navigation
  const handleNavigate = async (direction) => {
    if (direction === 'next' && !isLastPage) {
      // Save current page answers before navigating
      await saveProgress(answers);
      setCurrentPage(prev => Math.min(prev + 1, pagesData.length - 1));
    } else if (direction === 'prev' && currentPage > 0) {
      setCurrentPage(prev => Math.max(prev - 1, 0));
    }
  };

  // Detect restart mode: assignment is incomplete AND has previous validation data
  const isRestartMode = assignment?.status === 'incomplete' && hasValidation;

  // Debug function - can be called from browser console
  window.debugHomework = () => {
    console.log('\n🐞 ===== HOMEWORK DEBUG INFO =====');
    console.log('📋 Assignment ID:', assignmentId);
    console.log('👤 User State:', user);
    console.log('📄 Pages Data:', pagesData);
    console.log('✅ Validation Data:', validationData);
    console.log('📝 Answers Data:', answers);
    console.log('🎯 Has Validation:', hasValidation);
    console.log('📍 Current Page:', currentPage);
    
    console.log('\n🔍 DETAILED ANALYSIS:');
    console.log('📊 Validation Keys:', Object.keys(validationData || {}));
    console.log('📊 Answer Keys:', Object.keys(answers || {}));
    
    if (pagesData) {
      console.log('\n📋 PAGES STRUCTURE:');
      pagesData.forEach((page, pageIndex) => {
        console.log(`📄 Page ${pageIndex}: ${page.questions?.length || 0} questions`);
        page.questions?.forEach(q => {
          const key = `page_${pageIndex}_question_${q.id}`;
          const validation = validationData[key];
          const answer = answers[key];
          console.log(`  🔍 Q${q.id} (${q.type}):`, {
            key,
            hasAnswer: !!answer,
            hasValidation: !!validation,
            isCorrect: validation?.isCorrect,
            answer: answer
          });
        });
      });
    }
    
    console.log('\n===== END DEBUG INFO =====\n');
  };

  // Determine mode: 'answer' (default) or 'review' (read-only)
  // Accept ?mode=review or /student/review/:assignmentId route
  const urlParams = new URLSearchParams(location.search);
  const mode = urlParams.get('mode') || (location.pathname.includes('/review/') ? 'review' : 'answer');

  // Dynamic pages data parsed from API exerciseData
  const [pagesData, setPagesData] = useState([]);

  // Helper function to determine if a question should be disabled
  const isQuestionDisabled = (questionId) => {
    const questionKey = `page_${currentPage}_question_${questionId}`;
    const validation = validationData[questionKey];
    
    // Disable if question is correct, keep editable if incorrect or no validation
    return hasValidation && validation && validation.isCorrect === true;
  };

  // Function to format saved answers
  const formatSavedAnswers = (savedAnswers) => {
    const formatted = {};
    if (savedAnswers && savedAnswers.pages) {
      savedAnswers.pages.forEach(page => {
        if (page.components) {
          page.components.forEach(component => {
            if (component.questionNumber) {
              const key = `page_${page.pageId - 1}_question_${component.questionNumber}`;
              if (component.studentAnswer && component.studentAnswer.selected !== undefined) {
                formatted[key] = component.studentAnswer.selected;
              }
            }
          });
        }
      });
    }
    return formatted;
  };

  // Get current page data
  const currentPageData = pagesData[currentPage] || pagesData[0];

  // Is this review mode?
  const isReviewMode = mode === 'review';

  // Use ref to track API call status (persists through React StrictMode double execution)
  const hasLoadedData = useRef(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Function to parse exerciseData from API and convert to UI format
  const parseExerciseData = (exerciseDataString, savedAnswers = null) => {
    try {
      console.log('🔄 Parsing exercise data...');
      // Clean the exerciseData string by removing backticks if present
      const cleanedString = exerciseDataString.replace(/^`|`$/g, '');
      console.log('📝 Cleaned exercise data string:', cleanedString.substring(0, 100) + '...');
      console.log('💾 Saved answers available:', !!savedAnswers);
      const exercises = JSON.parse(cleanedString);
      const parsedPages = [];
      exercises.forEach((exercise, exerciseIndex) => {
        exercise.pages.forEach((page, pageIndex) => {
          const uiPage = {
            title: exercise.title,
            instruction: `Exercise ${exerciseIndex + 1}, Page ${pageIndex + 1}`,
            type: page.template_type === 'story_with_questions' ? 'reading' : 
                  page.template_type === 'fill_in_blank' ? 'math' : 'reading',
            story: '',
            timeOptions: [],
            questions: [],
            exerciseId: exercise.exercise_id,
            originalPageId: page.page_id
          };
      // Allow user to correct wrong pages without navigating away
          page.components.forEach(component => {
            if (component.type === 'story_block') {
              // Extract story text from segments with proper formatting
              if (component.content && component.content.text_segments) {
                const storySegments = component.content.text_segments.map(segment => {
                  if (typeof segment === 'string') {
                    return segment;
                  } else if (segment.text) {
                    // Handle styled text
                    if (segment.style === 'bold') {
                      return `**${segment.text}**`;
                    } else if (segment.style === 'italic') {
                      return `*${segment.text}*`;
                    }
                    return segment.text;
                  } else if (segment.image) {
                    // Handle inline images/emojis
                    return segment.image.src || '';
                  }
                  return '';
                }).filter(text => text.length > 0);
                
                uiPage.story = storySegments.join(' ');
                
                // Also store raw segments for more complex rendering if needed
                uiPage.storySegments = component.content.text_segments;
              }
            } else if (component.type === 'timer_selector') {
              uiPage.timeOptions = component.options || [];
            } else if (component.type === 'multiple_choice_checkbox') {
              // Extract correct options and their texts
              const correctOptions = component.options
                .filter(opt => opt.is_correct || opt.correct) // Check both is_correct and correct flags
                .map(opt => ({
                  id: `option_${opt.id || opt.text}`,
                  text: opt.text.replace(/"/g, ''),
                  _id: opt._id || Math.random().toString(36).substr(2, 9)
                }));

              console.log('Found correct options:', correctOptions);

              const question = {
                id: component.question_number,
                type: component.allow_multiple ? 'multiple_choice_checkbox' : 'multiple_choice',
                question: component.question.replace(/"/g, ''),
                options: component.options.map(opt => opt.text.replace(/"/g, '')),
                correctAnswers: component.options
                  .map((opt, idx) => (opt.is_correct || opt.correct) ? idx : -1)
                  .filter(idx => idx !== -1),
                allowMultiple: component.allow_multiple,
                correctOptions: correctOptions
              };

              console.log('Parsed question:', question);
              uiPage.questions.push(question);
            } else if (component.type === 'fill_blank_question') {
              // Extract correct answers for fill in blank
              const correctAnswer = component.blanks?.[0]?.correct_answers?.[0]?.replace(/"/g, '').replace(/^=\s*/, '') || '';
              
              uiPage.questions.push({
                id: component.question_number,
                type: 'fill_blank',
                question: `Problem ${component.question_number}`,
                problem: component.question.replace(/"/g, ''),
                correctOptions: [{
                  id: 'text_answer',
                  text: correctAnswer,
                  _id: Math.random().toString(36).substr(2, 9)
                }]
              });
            }
          });
          parsedPages.push(uiPage);
        });
      });

      console.log(`✅ Parsed ${parsedPages.length} pages from ${exercises.length} exercises`);
      return parsedPages;
    } catch (error) {
      console.error('❌ Error parsing exercise data:', error);
      return [];
    }
  };

  useEffect(() => {
    // Load user data first
    const storedUser = getStoredUser();
    console.log('� Stored user data:', storedUser);
    
    // Reset loading flags when assignment ID changes
    if (assignmentId) {
      hasLoadedData.current = false;
      setIsLoadingData(false);
    }
    
    // Load assignment and saved answers together
    const loadData = async () => {
      try {
        setIsLoadingData(true);
        // First load assignment data with saved answers
        await loadAssignmentWithAnswers();
        // Then explicitly load saved answers to ensure they're properly displayed
        await loadSavedAnswers();
        hasLoadedData.current = true;
      } catch (error) {
        console.error('Error loading assignment data:', error);
        setError('Failed to load assignment data');
      } finally {
        setIsLoadingData(false);
      }
    };
    
    // Only load if we have an assignment ID and haven't loaded yet
    if (assignmentId && !hasLoadedData.current && !isLoadingData) {
      loadData();
    }
    
    // Cleanup function to reset state when component unmounts
    return () => {
      hasLoadedData.current = false;
      setAnswers({});
      setValidationData({});
      setHasValidation(false);
    };
    
    if (!storedUser) {
      console.error('❌ No user data found in localStorage');
      // Try alternative token storage
      const authToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
      console.log('🔑 Available auth token:', authToken ? 'Found' : 'Not found');
      
      // If no user but we have a token, try to get user from API
      if (authToken) {
        console.log('🔄 Attempting to fetch user data from API...');
        fetchUserFromAPI();
      } else {
        navigate('/login');
        return;
      }
    } else {
      // Make sure user has both id and _id for compatibility
      const normalizedUser = {
        ...storedUser,
        _id: storedUser._id || storedUser.id,
        id: storedUser.id || storedUser._id
      };
      setUser(normalizedUser);
      console.log('✅ User state set with normalized data:', normalizedUser);
    }
    
    // Single consolidated API call for both assignment and saved answers
    loadAssignmentWithAnswers();
    
    // Timer for tracking time spent
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [assignmentId]);

  // Function to fetch user data from API if not in localStorage
  const fetchUserFromAPI = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Fetched user data from API:', userData);
        
        // Normalize user data to have both id and _id
        const normalizedUser = {
          ...userData,
          _id: userData._id || userData.id,
          id: userData.id || userData._id
        };
        
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      } else {
        console.error('❌ Failed to fetch user data from API');
        navigate('/login');
      }
    } catch (error) {
      console.error('❌ Error fetching user data:', error);
      navigate('/login');
    }
  };

  // Removed duplicate useEffect - answers are now loaded once in main useEffect

  // Handle last page detection
  useEffect(() => {
    const isOnLastPage = currentPage === pagesData.length - 1;
    setIsLastPage(isOnLastPage);
  }, [currentPage, pagesData.length]);

  // Auto-save functionality removed - only save on navigation



  // Consolidated function to load both assignment data and saved answers in single API call
  // Removed time tracking functions as they're not needed

  const loadAssignmentWithAnswers = async () => {
    try {
      // Mark as loading to prevent concurrent calls
      hasLoadedData.current = true;
      setIsLoadingData(true);
      setLoading(true);
      console.log('🚀 Loading assignment and saved answers in single API call...');
      console.log('🎯 Assignment ID from URL params:', assignmentId);

      // First, try to get saved answers from studentanswers table
      try {
        const savedAnswersResponse = await fetch(`/api/student-answers/${assignmentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`
          }
        });
        if (savedAnswersResponse.ok) {
          const savedAnswers = await savedAnswersResponse.json();
          console.log('📥 Found saved answers:', savedAnswers);
          if (savedAnswers) {
            setAnswers(savedAnswers);
            setHasValidation(true);
          }
        }
      } catch (error) {
        console.error('Error loading saved answers:', error);
      }
      
      const response = await homeworkAPI.getStudentAssignments();
      console.log('📡 API Response received:', {
        success: response?.data?.success,
        assignmentsCount: response?.data?.assignments?.length,
        hasData: !!response?.data
      });
      
      if (response.data && response.data.success) {
        console.log('📋 All assignments from API:', response.data.assignments.map(a => ({
          id: a._id,
          name: a.homework?.homeworkName,
          hasExerciseData: !!a.homework?.exerciseData
        })));
        
        // Find the specific assignment
        const foundAssignment = response.data.assignments.find(a => a._id === assignmentId);
        console.log('🔍 Looking for assignment ID:', assignmentId);
        console.log('🎯 Found assignment:', foundAssignment ? {
          id: foundAssignment._id,
          name: foundAssignment.homework?.homeworkName,
          hasHomework: !!foundAssignment.homework,
          hasExerciseData: !!foundAssignment.homework?.exerciseData,
          exerciseDataLength: foundAssignment.homework?.exerciseData?.length
        } : 'NOT FOUND');
        
        if (foundAssignment) {
          setAssignment(foundAssignment);
          console.log('✅ Assignment loaded:', foundAssignment.homework?.homeworkName);
          
          // Parse exercise data and build dynamic pages
          if (foundAssignment.exerciseData) {
            console.log('📚 Exercise data found, parsing...');
            console.log('Raw exercise data:', typeof foundAssignment.exerciseData, foundAssignment.exerciseData?.substring(0, 100) + '...');
            const dynamicPages = parseExerciseData(foundAssignment.exerciseData);
            setPagesData(dynamicPages);
            console.log('✅ Dynamic pages created:', dynamicPages.length);
          } else {
            console.warn('⚠️ No exercise data found in assignment');
            console.warn('Assignment homework object:', foundAssignment.homework);
            setError('No exercise data available for this assignment');
            return;
          }
        } else {
          console.error('❌ Assignment not found with ID:', assignmentId);
          console.error('Available assignment IDs:', response.data.assignments.map(a => a._id));
          setError('Assignment not found');
          return;
        }
        
        // Load saved answers from the consolidated response
        if (response.data.savedAnswers && response.data.savedAnswers[assignmentId]) {
          const assignmentAnswers = response.data.savedAnswers[assignmentId];
          console.log('📥 Raw saved answers from API:', assignmentAnswers);
          
          // Convert saved answers back to the format used by the component
          const formattedAnswers = {};
          const validationResults = {};
          let hasAnyValidation = false;
          
          // Parse exercise data to get option texts for index-to-text conversion
          let exerciseStructure = [];
          try {
            if (foundAssignment.homework?.exerciseData) {
              const exerciseDataStr = foundAssignment.homework.exerciseData;
              exerciseStructure = JSON.parse(exerciseDataStr);
              console.log('📚 Exercise structure for answer conversion loaded');
            }
          } catch (error) {
            console.error('❌ Error parsing exercise data for answer conversion:', error);
          }
          
          if (assignmentAnswers.pages && assignmentAnswers.pages.length > 0) {
            assignmentAnswers.pages.forEach((page) => {
              // Map API pageId to sequential UI page index (pageId 1 = page 0, pageId 2 = page 1, etc.)
              const uiPageIndex = page.pageId - 1;
              
              // Load reading time if exists (for timer_selector components)
              const timerComponent = page.components.find(c => c.type === 'timer_selector');
              if (timerComponent && timerComponent.studentAnswer?.selected?.length > 0) {
                formattedAnswers[`page_${uiPageIndex}_readingTime`] = timerComponent.studentAnswer.selected[0];
              }
              
              // Load question answers using questionNumber
              if (page.components && page.components.length > 0) {
                page.components.forEach(component => {
                  if (component.questionNumber && component.studentAnswer !== undefined) {
                    const answerKey = `page_${uiPageIndex}_question_${component.questionNumber}`;
                    
                    if (component.type === 'multiple_choice_checkbox') {
                      // For multiple choice, convert indices to text values
                      let answerValues = component.studentAnswer.selected || [];
                      
                      // If answerValues contains indices (numbers), convert them to text
                      // Find the corresponding question in exerciseStructure to get option texts
                      let questionOptions = [];
                      try {
                        for (const exercise of exerciseStructure) {
                          if (exercise.pages) {
                            for (const exercisePage of exercise.pages) {
                              if (exercisePage.page_id === (uiPageIndex + 1)) { // pageId is 1-based
                                if (exercisePage.components) {
                                  const exerciseComponent = exercisePage.components.find(c => 
                                    c.type === 'multiple_choice_checkbox' && c.question_number === component.questionNumber
                                  );
                                  if (exerciseComponent && exerciseComponent.options) {
                                    questionOptions = exerciseComponent.options.map(opt => opt.text || opt);
                                    break;
                                  }
                                }
                              }
                            }
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error finding question options:', error);
                      }
                      
                      if (questionOptions.length > 0) {
                        answerValues = answerValues.map(value => {
                          if (typeof value === 'number' && value >= 0 && value < questionOptions.length) {
                            // Convert index to text
                            console.log(`🔄 Converting index ${value} to text "${questionOptions[value]}" for question ${component.questionNumber}`);
                            return questionOptions[value];
                          } else if (typeof value === 'string') {
                            // Already text, keep as is
                            return value;
                          }
                          return value;
                        }).filter(value => value !== undefined && value !== null && value !== '');
                      }
                      
                      formattedAnswers[answerKey] = answerValues;
                      
                      console.log(`📝 Loaded MCQ answer for ${answerKey}:`, {
                        original: component.studentAnswer.selected,
                        converted: answerValues,
                        questionOptions: questionOptions
                      });
                      
                      // Check for validation data
                      if (component.studentAnswer.isCorrect !== undefined) {
                        hasAnyValidation = true;
                        validationResults[answerKey] = {
                          isCorrect: component.studentAnswer.isCorrect,
                          validationStatus: component.studentAnswer.isCorrect ? 'correct' : 'incorrect'
                        };
                      }
                    } else if (component.type === 'fill_blank_question') {
                      // For fill in the blank, use the first blank's student answer
                      formattedAnswers[answerKey] = component.blanks?.[0]?.studentAnswer || '';
                      
                      // Check for validation data
                      if (component.blanks?.[0]?.isCorrect !== undefined) {
                        hasAnyValidation = true;
                        validationResults[answerKey] = {
                          isCorrect: component.blanks[0].isCorrect,
                          validationStatus: component.blanks[0].isCorrect ? 'correct' : 'incorrect'
                        };
                      }
                    }
                  }
                });
              }
            });
            
            setAnswers(formattedAnswers);
            console.log('✅ Saved answers loaded and formatted:', formattedAnswers);
            
            // UPDATED: Use the new validationData field from backend response
            if (assignmentAnswers.validationData && Object.keys(assignmentAnswers.validationData).length > 0) {
              setHasValidation(true);
              setValidationData(assignmentAnswers.validationData);
              console.log('✅ NEW VALIDATION SYSTEM: Using validationData from backend:', assignmentAnswers.validationData);
              console.log('🔑 Validation keys from backend:', Object.keys(assignmentAnswers.validationData || {}));
              console.log('🎯 HasValidation state set to:', true);
              
              // Debug: Show which pages have questions
              console.log('📋 Pages structure:');
              pagesData.forEach((page, pageIndex) => {
                console.log(`  Page ${pageIndex}: ${page.questions.length} questions`);
                page.questions.forEach(q => {
                  console.log(`    - Question ${q.id} (${q.type})`);
                });
              });
            }
            // FALLBACK: Use legacy validation extraction if new system not available
            else if (hasAnyValidation) {
              setHasValidation(true);
              setValidationData(validationResults);
              console.log('✅ FALLBACK VALIDATION: Using legacy component validation:', validationResults);
              console.log('🔑 Legacy validation keys:', Object.keys(validationResults || {}));
              console.log('🎯 HasValidation state set to:', true);
            } else {
              console.log('ℹ️ No validation data found in saved answers (neither new nor legacy)');
            }
          }
        } else {
          console.log('ℹ️ No saved answers found for this assignment');
        }
        
      } else {
        console.error('❌ Invalid response format from API');
        console.error('Response received:', response);
        setError('Failed to load assignment data - Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error loading assignment with answers:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      setError(`Failed to load homework data: ${error.message}`);
    } finally {
      setLoading(false);
      setIsLoadingData(false);
    }
  };



  const handleTimeSelection = (timeIndex) => {
    setAnswers(prev => ({
      ...prev,
      [`page_${currentPage}_readingTime`]: timeIndex
    }));
  };

  const handleAnswerChange = (questionId, optionIndex, isChecked) => {
    // Get the question data to convert index to text
    const currentQuestion = currentPageData?.questions?.find(q => q.id === questionId);
    const optionText = currentQuestion?.options?.[optionIndex];
    
    if (!optionText) {
      console.warn(`⚠️ Could not find option text for question ${questionId}, index ${optionIndex}`);
      return;
    }
    
    const questionKey = `page_${currentPage}_question_${questionId}`;
    const currentAnswers = answers[questionKey] || [];
    
    let newAnswers;
    if (isChecked) {
      // Add text value
      newAnswers = [...currentAnswers, optionText];
    } else {
      // Remove text value
      newAnswers = currentAnswers.filter(text => text !== optionText);
    }
    
    // Use handleAnswerUpdate to process and save the answer
    handleAnswerUpdate(questionId, newAnswers, 'multiple_choice_checkbox');
  };

  const handleTextAnswerChange = (questionId, value) => {
    // Use handleAnswerUpdate to process and save the answer
    handleAnswerUpdate(questionId, value, 'fill_blank_question');
  };

  const handleRadioAnswerChange = (questionId, optionIndex) => {
    const questionKey = `page_${currentPage}_question_${questionId}`;
    
    console.log(`🔄 [RADIO-CHANGE] Question ${questionId}:`, {
      optionIndex,
      questionKey,
      currentAnswer: answers[questionKey]
    });
    
    // Get the question data to convert index to text
    const currentQuestion = currentPageData?.questions?.find(q => q.id === questionId);
    const optionText = currentQuestion?.options?.[optionIndex];
    
    if (!optionText) {
      console.warn(`⚠️ Could not find option text for question ${questionId}, index ${optionIndex}`);
      console.warn(`Available options:`, currentQuestion?.options);
      return;
    }
    
    console.log(`📝 Converting radio index ${optionIndex} to text "${optionText}"`);
    
    // Only update answers without triggering validation
    setAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionKey]: optionText // Send text value instead of index
      };
      
      console.log(`✅ Radio answer updated:`, {
        questionKey,
        oldAnswer: prev[questionKey],
        newAnswer: optionText
      });
      
      return newAnswers;
    });
  };

  const saveAllAnswersToDatabase = async () => {
    try {
      console.log('🔄 Saving ALL answers from ALL pages to database...');
      
      // Loop through all pages and save their answers
      for (let pageIndex = 0; pageIndex < pagesData.length; pageIndex++) {
        const pageData = pagesData[pageIndex];
        
        // Collect answers for this specific page
        const pageAnswers = {};
        
        // Collect reading time selection if exists
        if (answers[`page_${pageIndex}_readingTime`] !== undefined) {
          pageAnswers.readingTime = answers[`page_${pageIndex}_readingTime`];
        }
        
        // Collect question answers for this page
        pageData.questions.forEach(question => {
          const answerKey = `page_${pageIndex}_question_${question.id}`;
          if (answers[answerKey] !== undefined) {
            let rawAnswer = answers[answerKey];
            
            // Clean up mixed data: ensure only text values for MCQ
            if (question.type === 'multiple_choice_checkbox' && Array.isArray(rawAnswer)) {
              // Filter out any numeric indices, keep only strings
              rawAnswer = rawAnswer.filter(item => typeof item === 'string');
              console.log(`🧹 [CLEANUP] Cleaned MCQ answer for Q${question.id}:`, {
                original: answers[answerKey],
                cleaned: rawAnswer
              });
            } else if (question.type === 'multiple_choice' && typeof rawAnswer === 'number') {
              // Convert single index to text for radio buttons
              const optionText = question.options?.[rawAnswer];
              if (optionText) {
                rawAnswer = optionText;
                console.log(`🧹 [CLEANUP] Converted radio index ${answers[answerKey]} to text "${rawAnswer}"`);
              }
            }
            
            console.log(`🔍 [SAVE-DEBUG] Question ${question.id} answer:`, {
              answerKey,
              originalAnswer: answers[answerKey],
              cleanedAnswer: rawAnswer,
              answerType: typeof rawAnswer,
              isArray: Array.isArray(rawAnswer),
              arrayTypes: Array.isArray(rawAnswer) ? rawAnswer.map(a => typeof a + ':' + a) : 'N/A'
            });
            
            pageAnswers[`question_${question.id}`] = rawAnswer;
          }
        });

        console.log(`📝 Saving page ${pageIndex} answers:`, pageAnswers);

        // Skip if no answers for this page
        if (Object.keys(pageAnswers || {}).length === 0) {
          console.log(`⏭️ Skipping page ${pageIndex} - no answers`);
          continue;
        }

        // Prepare data for this page
        const saveData = {
          assignmentId: assignmentId,
          pageIndex: pageIndex,
          pageType: pageData.type,
          answers: pageAnswers,
          timestamp: new Date().toISOString()
        };

        console.log(`🚀 Saving page ${pageIndex} data:`, saveData);

        // Save this page's answers
        const response = await fetch('/api/homework/save-answers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`
          },
          body: JSON.stringify(saveData)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Page ${pageIndex} saved successfully:`, result);
        } else {
          console.error(`❌ Failed to save page ${pageIndex}:`, await response.text());
        }
      }
      
      console.log('✅ All pages saved successfully!');
      return true;
      
    } catch (error) {
      console.error('❌ Error saving all answers:', error);
      return false;
    }
  };

  const saveAnswersToDatabase = async () => {
    try {
      setIsSaving(true);
      console.log('Starting to save answers for page:', currentPage);
      
      // Get fresh user data if current user is null
      let currentUser = user;
      if (!currentUser) {
        currentUser = getStoredUser();
        console.log('🔄 Refreshed user data:', currentUser);
        setUser(currentUser);
      }
      
      // Check authentication token
      const authToken = localStorage.getItem('accessToken') || localStorage.getItem('token');
      console.log('🔑 Auth token available:', !!authToken);
      
      // Check if we have required data before attempting to save
      if (!assignmentId) {
        console.warn('❌ Missing assignment ID for saving');
        return false; // Return early but allow navigation
      }

      // Check for both _id and id fields for compatibility
      const userId = currentUser?._id || currentUser?.id;
      
      if (!currentUser || !userId) {
        console.warn('❌ Missing user data for saving:', { 
          user: currentUser,
          userId: userId,
          authToken: !!authToken
        });
        
        // Try to get user ID from token
        if (authToken && !currentUser) {
          console.log('🔍 Trying to decode token for user info...');
          try {
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            console.log('🎯 Token payload:', payload);
            if (payload.id) {
              currentUser = { _id: payload.id, id: payload.id };
              console.log('✅ Using user ID from token:', currentUser);
              setUser(currentUser); // Update state for future calls
            }
          } catch (tokenError) {
            console.error('❌ Failed to decode token:', tokenError);
          }
        }
        
        // If still no user, try fetching from API
        if (!currentUser && authToken) {
          try {
            console.log('🔄 Fetching user data from API...');
            const userResponse = await fetch('/api/auth/me', {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (userResponse.ok) {
              const userData = await userResponse.json();
              console.log('✅ Got user data from API:', userData);
              currentUser = userData;
              setUser(userData);
              localStorage.setItem('user', JSON.stringify(userData));
            }
          } catch (apiError) {
            console.error('❌ Failed to fetch user from API:', apiError);
          }
        }
        
        const finalUserId = currentUser?._id || currentUser?.id;
        if (!currentUser || !finalUserId) {
          console.warn('⏭️ Skipping save - unable to determine user ID');
          return false; // Skip saving but don't prevent navigation
        }
      }
      
      // Prepare current page answers for database storage
      const currentPageAnswers = {};
      
      // Collect reading time selection if exists
      if (answers[`page_${currentPage}_readingTime`] !== undefined) {
        currentPageAnswers.readingTime = answers[`page_${currentPage}_readingTime`];
      }
      
      // Collect question answers
      currentPageData.questions.forEach(question => {
        const answerKey = `page_${currentPage}_question_${question.id}`;
        if (answers[answerKey] !== undefined) {
          currentPageAnswers[`question_${question.id}`] = answers[answerKey];
        }
      });

      console.log('Collected answers for saving:', currentPageAnswers);

      // Prepare data in the format expected by backend
      const saveData = {
        assignmentId: assignmentId,
        pageIndex: currentPage,
        pageType: currentPageData.type,
        answers: currentPageAnswers,
        timestamp: new Date().toISOString()
      };

      console.log('📤 Sending save data:', saveData);
      console.log('🌐 Making request to:', '/api/homework/save-answers');

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⏰ Save request timeout after 8 seconds');
        controller.abort();
      }, 8000);

      console.log('🚀 Starting fetch request...');
      const response = await fetch('/api/homework/save-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`
        },
        body: JSON.stringify(saveData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('📡 Save response received - Status:', response.status, 'OK:', response.ok, 'Headers:', response.headers);

      if (!response.ok) {
        console.log('❌ Response not OK, getting error text...');
        const errorText = await response.text();
        console.error('Save failed with response:', errorText);
        throw new Error(`Failed to save answers: ${response.status} - ${errorText}`);
      }

      console.log('✅ Response OK, parsing JSON...');
      const responseData = await response.json();
      console.log('✅ Answers saved successfully:', responseData);
      console.log('🏁 Save function completing successfully');
      return true; // Return success
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⏰ Save request was aborted due to timeout');
      } else {
        console.error('❌ Error saving answers:', error);
      }
      // Don't prevent navigation even if saving fails
      return false; // Return failure but don't throw
    } finally {
      setIsSaving(false);
    }
  };

  const handlePageNavigation = async (direction) => {
    console.log('🚀 Navigation clicked:', direction, 'Current page:', currentPage, 'Total pages:', pagesData.length);
    
    // If on last page and trying to go next, submit assignment
    if (direction === 'next' && isLastPage) {
      handleSubmit();
      return;
    }
    
    // Handle regular navigation
    handleNavigate(direction);
    console.log('✅ Navigation handled');
  };

  const handleStoryBlockClick = (blockIndex) => {
    if (blockIndex < pagesData.length) {
      setCurrentPage(blockIndex);
    }
  };



  const loadSavedAnswers = async () => {
    try {
      console.log('🔄 Loading saved answers for assignment:', assignmentId);
      const response = await homeworkAPI.getAnswers(assignmentId);
      console.log('📥 API Response:', response.data);
      
      if (response.data && response.data.success) {
        const savedAnswers = response.data.data;
        console.log('📥 Found saved answers:', savedAnswers);
        
        // Format answers and set state
        const formattedAnswers = {};
        const validationResults = {};
        
        if (savedAnswers && savedAnswers.pages) {
          console.log('Processing saved pages:', savedAnswers.pages.length);
          
          // Sort pages by pageId to ensure correct order
          const sortedPages = [...savedAnswers.pages].sort((a, b) => a.pageId - b.pageId);
          
          sortedPages.forEach((page, idx) => {
            console.log(`Processing page ${idx + 1}`);
            // Use the index as the pageIndex to ensure continuous numbering
            const pageIndex = idx;
            
            if (page.components) {
              page.components.forEach(component => {
                if (component.questionNumber) {
                  const key = `page_${pageIndex}_question_${component.questionNumber}`;
                  console.log(`Processing question ${component.questionNumber}, type: ${component.type}`);
                  
                  // Handle different question types
                  if (component.type === 'multiple_choice_checkbox') {
                    let selectedAnswers = component.studentAnswer?.selected;
                    if (selectedAnswers) {
                      // Ensure it's an array and has content
                      selectedAnswers = Array.isArray(selectedAnswers) ? selectedAnswers : [selectedAnswers];
                      selectedAnswers = selectedAnswers.filter(Boolean);
                      console.log(`MCQ answers for ${key}:`, selectedAnswers);
                      // Store the selected answers
                      formattedAnswers[key] = selectedAnswers;
                      
                      // Find the indices of selected answers in options for UI
                      const question = pagesData[pageIndex]?.questions?.find(q => q.id === component.questionNumber);
                      if (question) {
                        selectedAnswers.forEach(selected => {
                          const index = question.options.findIndex(opt => opt === selected);
                          if (index !== -1) {
                            formattedAnswers[`${key}_index`] = index;
                          }
                        });
                      }
                    }
                  } else if (component.type === 'fill_blank_question') {
                    const answer = component.studentAnswer?.selected;
                    if (answer) {
                      console.log(`Fill in blank answer for ${key}:`, answer);
                      formattedAnswers[key] = answer;
                    }
                  } else {
                    const answer = component.studentAnswer?.selected;
                    if (answer) {
                      console.log(`Other type answer for ${key}:`, answer);
                      formattedAnswers[key] = answer;
                    }
                  }
                  
                  // Store validation status if available
                  validationResults[key] = {
                    isCorrect: component.studentAnswer?.isCorrect || false,
                    isValidated: component.studentAnswer?.isValidated || false,
                    isEditable: component.isEditable || false,
                    feedback: component.studentAnswer?.feedback || ''
                  };
                  console.log(`Validation for ${key}:`, validationResults[key]);
                }
              });
            }
          });
          
          // Set answers state
          setAnswers(formattedAnswers);
          
          // Set validation data
          setValidationData(validationResults);
          setHasValidation(true);
          
          // Always start from first page when loading homework
          setCurrentPage(0);
          
          // If homework was submitted, mark it as submitted
          if (savedAnswers.grading?.isSubmitted) {
            setSubmitted(true);
          }
          
          console.log('✅ Restored saved answers:', formattedAnswers);
          console.log('✅ Restored validation data:', validationResults);
        } else {
          console.log('❌ No saved answers found for assignment:', assignmentId);
        }
      }
    } catch (error) {
      console.error('❌ Error loading saved answers:', error);
    }
  };

  const handleSubmit = async () => {
    console.log('🎯 Starting assignment submission...');
    
    try {
      // Save current page answers first
      await saveProgress(answers);
      
      // Submit for validation without awaiting the response
      const validationPromise = homeworkAPI.submit({
        assignmentId,
        exerciseId: pagesData[0]?.exerciseId,
        attempt: ((assignment && assignment.attempts) ? assignment.attempts + 1 : 1)
      });
      
      // Start validation
      const response = await validationPromise;

      if (response.data.success) {
        const validatedPages = response.data.pages;
        const allCorrect = validatedPages.every(page => 
          page.components.every(comp => comp.studentAnswer.isCorrect)
        );

        if (allCorrect) {
          console.log('✅ All answers correct, updating status...');
          setSubmitted(true);
          
          // Update status using the new endpoint
          const updateResponse = await homeworkAPI.updateCompletionStatus(assignmentId);

          if (updateResponse.data.success) {
            // Update local assignment state
            setAssignment(prev => ({
              ...prev,
              status: 'completed'
            }));

            // Force immediate update in localStorage for dashboard
            try {
              const currentAssignments = JSON.parse(localStorage.getItem('assignments') || '[]');
              const updatedAssignments = currentAssignments.map(a => 
                a._id === assignmentId ? { ...a, status: 'completed' } : a
              );
              localStorage.setItem('assignments', JSON.stringify(updatedAssignments));
            } catch (e) {
              console.warn('Failed to update localStorage:', e);
            }
          }

          // Set flag for dashboard refresh and navigate
          localStorage.setItem('refreshDashboard', 'true');
          navigate('/student/dashboard', { replace: true });
          
          return; // Exit early to prevent error display
        }

        console.log('🔍 All answers correct?', allCorrect);

        if (allCorrect) {
          console.log('✅ All answers are correct!');
          
          try {
            // First update the assignment status
            const statusResponse = await fetch(`/api/homework-assignments/${assignmentId}/status`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`
              },
              body: JSON.stringify({ 
                status: 'completed',
                submissionData: {
                  completedAt: new Date().toISOString(),
                  score: calculateResults().score,
                  totalQuestions: calculateResults().total,
                  allCorrect: true
                }
              })
            });

            if (statusResponse.ok) {
              console.log('✅ Assignment status updated to completed');
              setSubmitted(true);
              
              // Update assignment in state
              if (assignment) {
                setAssignment({
                  ...assignment,
                  status: 'completed'
                });
              }
            } else {
              const errorText = await statusResponse.text();
              console.warn('⚠️ Failed to update assignment status:', errorText);
              throw new Error(`Failed to update status: ${errorText}`);
            }
          } catch (error) {
            console.error('❌ Error updating assignment status:', error);
            setError('Failed to update assignment status. Please try again.');
          }

          // Navigate to dashboard regardless of status update
          console.log('⏱️ Waiting 3 seconds before navigation...');
          setTimeout(() => {
            console.log('🚀 Navigating to dashboard...');
            navigate('/student/dashboard');
          }, 3000);
        } else {
          console.log('⚠️ Some answers are incorrect. Assignment remains incomplete.');
          // Also navigate to dashboard even if some answers are incorrect
          console.log('⏱️ Waiting 3 seconds before navigation...');
          setTimeout(() => {
            console.log('🚀 Navigating to dashboard...');
            navigate('/student/dashboard');
          }, 3000);
        }
      } else {
        console.error('❌ Failed to validate answers');
        setError('Failed to validate answers. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error during submission:', err);
      setError('Failed to submit homework. Please try again.');
    }
  };

  const handleAssignmentCompletion = async () => {
    try {
      console.log('🎯 Starting assignment completion...');
      setSubmitted(true);
      
      // Update assignment status
      const response = await homeworkAPI.updateCompletionStatus(assignmentId);
      console.log('🎉 Assignment status updated:', response.data);

      // Wait for 5 seconds then navigate
      setTimeout(() => {
        console.log('⏱️ 5 seconds passed, navigating to dashboard...');
        navigate('/student/dashboard');
      }, 5000);

    } catch (error) {
      console.error('❌ Error completing assignment:', error);
      setError('Failed to update assignment status. Please try again.');
    }
  };

  const calculateResults = () => {
    let correct = 0;
    let total = 0;

    pagesData.forEach((pageData, pageIndex) => {
      pageData.questions.forEach(question => {
        total++;
        if (question.type === 'multiple_choice') {
          const userAnswer = answers[`page_${pageIndex}_question_${question.id}`];
          // Now userAnswer is text, so we need to check if it matches correct options
          const correctOptions = question.options?.filter((option, idx) => 
            question.correctAnswers?.includes(idx)
          ) || [];
          
          // Check if user answer text is in the correct answers array
          if (correctOptions.includes(userAnswer)) {
            correct++;
          }
        } else if (question.type === 'multiple_choice_checkbox') {
          const userAnswers = answers[`page_${pageIndex}_question_${question.id}`] || [];
          // Now userAnswers contains text values, compare with correct option texts
          const correctOptions = question.options?.filter((option, idx) => 
            question.correctAnswers?.includes(idx)
          ) || [];
          
          // Check if user selected the exact same options as correct ones
          if (Array.isArray(userAnswers) && 
              userAnswers.length === correctOptions.length &&
              userAnswers.every(answer => correctOptions.includes(answer)) &&
              correctOptions.every(option => userAnswers.includes(option))) {
            correct++;
          }
        } else if (question.type === 'fill_blank') {
          const userAnswer = answers[`page_${pageIndex}_question_${question.id}`];
          if (userAnswer && userAnswer.toString() === question.correctAnswer) {
            correct++;
          }
        }
      });
    });

    return { score: correct, total };
  };

  const handleBackToDashboard = () => {
    // Navigate back without confirmation popup
    navigate('/student/dashboard');
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading assignment..." fullScreen={true} />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={handleBackToDashboard} className={styles.backBtn}>
          ←
        </button>
      </div>
    );
  }

  return (
    <div className={styles.homeworkContainer}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={handleBackToDashboard} className={styles.backBtn}>
          ←
        </button>
        {isSaving && (
          <div className={styles.saveIndicator}>
            💾 Saving...
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Story Block Navigation */}
        <div className={styles.storyNavigation}>
          {(() => {
            if (!pagesData || !Array.isArray(pagesData)) {
              return <div>Loading...</div>;
            }
            
            return pagesData.map((_, index) => {
              const status = getPageCorrectness(index);
              let mark = '';
              
              if (status === 'correct') {
                mark = '✅';
              } else if (status === 'incorrect') {
                mark = '❌';
              }
              
              return (
                <div
                  key={index}
                  className={`${styles.storyBlock} ${index === currentPage ? styles.active : ''}`}
                  onClick={() => handleStoryBlockClick(index)}
                >
                  📄 {mark}
                </div>
              );
            });
          })()}
        </div>

        {/* Content Area with Navigation Arrows */}
        <div className={styles.contentWrapper}>
          {!currentPageData ? (
            <div>Loading...</div>
          ) : (
            <>
              {/* Story Content */}
              <div className={styles.storySection}>
              <div className={styles.storyHeader}>
                {/* Page-level correctness indicator */}
                {(() => {
                  const pageStatus = getPageCorrectness(currentPage);
                  if (pageStatus === 'correct') {
                    return <div className={styles.pageIndicator}><span className={styles.correctIndicator}>✅</span></div>;
                  } else if (pageStatus === 'incorrect') {
                    return <div className={styles.pageIndicator}><span className={styles.incorrectIndicator}>❌</span></div>;
                  }
                  return null;
                })()}
                <h2>{currentPageData.title}</h2>
                <p className={styles.instruction}>🟢 {currentPageData.instruction}</p>
              </div>

          <div className={styles.storyContentBox}>
            <div className={styles.storyText}>
              {/* Render story content dynamically from API data */}
              {currentPageData.story && (
                <div className={styles.storyContent}>
                  {currentPageData.storySegments ? (
                    // Render with proper formatting
                    <div>
                      {currentPageData.storySegments.map((segment, index) => {
                        if (typeof segment === 'string') {
                          return <span key={index}>{segment} </span>;
                        } else if (segment.text) {
                          const style = segment.style;
                          if (style === 'bold') {
                            return <strong key={index}>{segment.text} </strong>;
                          } else if (style === 'italic') {
                            return <em key={index}>{segment.text} </em>;
                          }
                          return <span key={index}>{segment.text} </span>;
                        } else if (segment.image) {
                          return (
                            <span key={index} className={segment.image.alt?.includes('heron') ? styles.heronIcon : styles.monkeyIcon}>
                              {segment.image.src}
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ) : (
                    // Fallback to simple text rendering  
                    <p className={styles.storyParagraph}>
                      <strong>{currentPageData.story}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Time Selection - only show for reading pages */}
          {currentPageData.timeOptions && (
            <div className={styles.timeSelection}>
              {currentPageData.timeOptions.map((option, index) => (
                <button
                  key={index}
                  className={`${styles.timeBtn} ${answers[`page_${currentPage}_readingTime`] === index ? styles.selected : ''}`}
                  onClick={() => handleTimeSelection(index)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Questions */}
          <div className={styles.questionsSection}>
            {currentPageData.questions.map((question, qIndex) => {
              // Lock if this page is in lockedPages
              const pageIsLocked = lockedPages[currentPage];
              
              // Get question validation status
              const questionValidationStatus = getQuestionValidationStatus(question.id);
              const showQuestionIndicators = shouldShowQuestionIndicators();
              const questionIsDisabled = isQuestionDisabled(question.id);
              
              // Helper function to determine if a question should be read-only (keep existing logic)
              const isQuestionCorrectReliable = (question) => {
                const questionKey = `page_${currentPage}_question_${question.id}`;
                const validation = validationData ? validationData[questionKey] : null;
                const userAnswer = answers[questionKey];
                
                // In incomplete homework: Check if answer is correct based on validation data
                if (isRestartMode && validation && userAnswer !== undefined) {
                  // If validation says it's correct, make it read-only
                  // If validation says it's wrong, keep it editable
                  return validation.isCorrect === true;
                }
                
                // For non-restart modes
                return false;
              };
              
              return (
                <div key={question.id} className={`${styles.questionBlock} ${questionIsDisabled ? styles.disabledQuestion : ''}`}>
                  {/* Question-level indicator (above question title) - only show when there are wrong answers */}
                  {showQuestionIndicators && questionValidationStatus && (
                    <div className={styles.questionIndicator}>
                      <span className={`${styles.questionStatus} ${questionValidationStatus === 'correct' ? styles.questionCorrect : styles.questionIncorrect}`}>
                        {questionValidationStatus === 'correct' ? '✅' : '❌'}
                      </span>
                    </div>
                  )}
                  
                  <h4 className={`${styles.questionTitle} ${questionIsDisabled ? styles.disabledText : ''}`}>
                    {question.id}) {question.question}
                  </h4>
                  <div className={styles.options}>
                    {/* Decide rendering without IIFE to keep JSX simpler */}
                    {(() => {
                      const questionKey = `page_${currentPage}_question_${question.id}`;
                      const correctOpts = question.correctOptions || question.correctAnswers || [];
                      const isMultipleAnswer = Array.isArray(correctOpts) && correctOpts.length > 1;
                      const questionValidation = validationData ? validationData[questionKey] : null;
                      const hasQuestionValidation = hasValidation && questionValidation;

                      if (question.type === 'fill_blank' || question.type === 'fill_blank_question') {
                        const savedAnswer = answers[questionKey];
                        const validation = questionValidation;
                        return (
                          <div className={styles.mathProblemContainer}>
                            <div className={styles.mathEquation}>
                              <span className={`${styles.mathText} ${questionIsDisabled ? styles.disabledText : ''}`}>{question.problem.replace(' =', '')}</span>
                              <span className={`${styles.equalsSign} ${questionIsDisabled ? styles.disabledText : ''}`}>=</span>
                              <input
                                type="text"
                                className={`${styles.mathAnswerInput} ${validation ? (validation.isCorrect ? styles.correctAnswer : styles.incorrectAnswer) : ''} ${questionIsDisabled ? styles.disabledInput : ''}`}
                                value={answers[questionKey] || savedAnswer || ''}
                                onChange={(e) => !(isReviewMode || pageIsLocked || questionIsDisabled || isQuestionCorrectReliable(question)) && handleTextAnswerChange(question.id, e.target.value)}
                                placeholder=""
                                disabled={isReviewMode || pageIsLocked || questionIsDisabled || isQuestionCorrectReliable(question)}
                              />
                            </div>
                          </div>
                        );
                      }

                      if (Array.isArray(question.options) && question.options.length > 0) {
                        return (
                          <>
                            {isMultipleAnswer ? (
                              question.options.map((option, oIndex) => {
                                const currentAnswers = answers[questionKey] || [];
                                const isChecked = Array.isArray(currentAnswers) ? currentAnswers.includes(option) : currentAnswers === option;
                                return (
                                  <label key={oIndex} className={`${styles.optionLabel} ${hasQuestionValidation ? (questionValidation?.isCorrect ? styles.correctAnswer : styles.incorrectAnswer) : ''} ${questionIsDisabled ? styles.disabledOption : ''}`}>
                                    <input
                                      type="checkbox"
                                      className={styles.optionCheckbox}
                                      checked={isChecked}
                                      onChange={(e) => !(isReviewMode || pageIsLocked || questionIsDisabled || isQuestionCorrectReliable(question)) && handleAnswerChange(question.id, oIndex, e.target.checked)}
                                      disabled={isReviewMode || pageIsLocked || questionIsDisabled || isQuestionCorrectReliable(question)}
                                    />
                                    <span className={questionIsDisabled ? styles.disabledText : ''}>{option}</span>
                                  </label>
                                );
                              })
                            ) : (
                              question.options.map((option, oIndex) => {
                                const currentAnswers = answers[questionKey];
                                const isSelected = Array.isArray(currentAnswers) ? currentAnswers.includes(option) : currentAnswers === option;
                                return (
                                  <label key={oIndex} className={`${styles.optionLabel} ${hasQuestionValidation ? (questionValidation?.isCorrect ? styles.correctAnswer : styles.incorrectAnswer) : ''} ${questionIsDisabled ? styles.disabledOption : ''}`}>
                                    <input
                                      type="radio"
                                      name={`page_${currentPage}_question_${question.id}`}
                                      checked={isSelected}
                                      onChange={() => !(isReviewMode || pageIsLocked || questionIsDisabled || isQuestionCorrectReliable(question)) && handleRadioAnswerChange(question.id, oIndex)}
                                      className={styles.optionRadio}
                                      disabled={isReviewMode || pageIsLocked || questionIsDisabled || isQuestionCorrectReliable(question)}
                                    />
                                    <span className={questionIsDisabled ? styles.disabledText : ''}>{option}</span>
                                  </label>
                                );
                              })
                            )}
                          </>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Remove the separate submit button - functionality moved to right arrow */}
          </div>

          {/* Navigation Arrows */}
          <div className={styles.navigationArrows}>
            <button 
              className={styles.navArrow} 
              disabled={currentPage === 0}
              onClick={() => handlePageNavigation('prev')}
            >
              &lt;
            </button>
            {isLastPage ? (
                <button 
                  className={`${styles.navArrow} ${styles.submitArrow}`}
                  onClick={() => handlePageNavigation('next')}
                  title="Click to Submit Assignment"
                >
                  <div className={styles.submitText}>
                    {'SUBMIT'.split('').map((letter, index) => (
                      <span key={index} className={styles.submitLetter}>
                        {letter}
                      </span>
                    ))}
                  </div>
                </button>
            ) : (
              <button 
                className={styles.navArrow}
                onClick={() => handlePageNavigation('next')}
                title="Next Page"
              >
                {'>'}
              </button>
            )}
          </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default HomeworkPage;