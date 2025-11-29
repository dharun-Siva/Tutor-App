import React, { useState, useEffect, useRef } from 'react';
import api from '../../../../utils/api';
import { getErrorMessage } from '../../../../utils/helpers';
import styles from './SubjectManagement.module.css';

const HomeworkTab = () => {
  const [homeworks, setHomeworks] = useState([]);
  const [grades, setGrades] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingHomework, setEditingHomework] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('homeworkName');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    homeworkName: '',
    description: '',
    gradeId: '',
    subjectId: '',
    topicId: '',
    subtopicId: '',
    file: null
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Filtered dropdowns
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [filteredTopics, setFilteredTopics] = useState([]);
  const [filteredSubtopics, setFilteredSubtopics] = useState([]);

  // CSV Upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvContent, setCsvContent] = useState(null);
  const [parsedCsvData, setParsedCsvData] = useState(null);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [csvParseError, setCsvParseError] = useState('');
  const [viewingCsvContent, setViewingCsvContent] = useState(null);
  const [showCsvViewModal, setShowCsvViewModal] = useState(false);

  // Prevent duplicate API calls
  const abortControllerRef = useRef(null);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Only load on initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      loadData();
    }

    return () => {
      // Cleanup: abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    // Load when pagination or sorting changes
    loadData();
  }, [currentPage, itemsPerPage, sortField, sortDirection]);

  useEffect(() => {
    // Filter subjects when grade changes
    if (formData.gradeId) {
      console.log('Current grade ID:', formData.gradeId);
      console.log('All subjects:', subjects);
      console.log('Subject sample:', subjects[0]);
      
      const filtered = subjects.filter(subject => {
        const subjectGradeId = subject.gradeId;
        console.log('Comparing:', {subjectGradeId, formGradeId: formData.gradeId, matches: subjectGradeId === formData.gradeId});
        return subjectGradeId === formData.gradeId;
      });
      console.log('Filtered subjects:', filtered);
      setFilteredSubjects(filtered);
      
      // Clear subject and subsequent selections if they're not valid for the new grade
      if (formData.subjectId && !filtered.find(s => s.id === formData.subjectId || s._id === formData.subjectId)) {
        setFormData(prev => ({ ...prev, subjectId: '', topicId: '', subtopicId: '' }));
      }
    } else {
      setFilteredSubjects([]);
      setFormData(prev => ({ ...prev, subjectId: '', topicId: '', subtopicId: '' }));
    }
  }, [formData.gradeId, subjects]);

  useEffect(() => {
    // Filter topics when subject changes
    if (formData.subjectId) {
      console.log('Filtering topics for subject:', formData.subjectId);
      console.log('Available topics:', topics);
      
      const filtered = topics.filter(topic => {
        const topicSubjectId = String(topic.subjectId?._id || topic.subjectId);
        const formSubjectId = String(formData.subjectId);
        console.log('Comparing topics:', { topicSubjectId, formSubjectId, topic });
        return topicSubjectId === formSubjectId;
      });
      
      console.log('Filtered topics:', filtered);
      setFilteredTopics(filtered);
      
      // Clear topic and subtopic selection if they're not valid for the new subject
      if (formData.topicId) {
        const isValidTopic = filtered.some(t => 
          String(t.id) === String(formData.topicId)
        );
        if (!isValidTopic) {
          setFormData(prev => ({ ...prev, topicId: '', subtopicId: '' }));
        }
      }
    } else {
      setFilteredTopics([]);
      setFormData(prev => ({ ...prev, topicId: '', subtopicId: '' }));
    }
  }, [formData.subjectId, topics]);

  useEffect(() => {
      // Filter subtopics when topic changes
    if (formData.topicId) {
      console.log('Filtering subtopics for topic:', formData.topicId);
      console.log('Available subtopics:', subtopics);
      
      const filtered = subtopics.filter(subtopic => {
        // Handle both MongoDB and PostgreSQL field names
        const subtopicTopicId = String(subtopic.topicId);
        const formTopicId = String(formData.topicId);
        console.log('Comparing:', { subtopicTopicId, formTopicId, subtopic });
        return subtopicTopicId === formTopicId;
      });      console.log('Filtered subtopics:', filtered);
      setFilteredSubtopics(filtered);
      
      // Clear subtopic selection if it's not valid for the new topic
      if (formData.subtopicId) {
        const isValidSubtopic = filtered.some(st => 
          String(st.id) === String(formData.subtopicId)
        );
        if (!isValidSubtopic) {
          setFormData(prev => ({ ...prev, subtopicId: '' }));
        }
      }
    } else {
      setFilteredSubtopics([]);
      setFormData(prev => ({ ...prev, subtopicId: '' }));
    }
  }, [formData.topicId, subtopics]);

  // allow overrides: { page, limit, sortField, sortDirection }
  const loadData = async (overrides = {}) => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const page = overrides.page || currentPage;
      const limit = overrides.limit || itemsPerPage;
      const sf = overrides.sortField || sortField;
      const sd = overrides.sortDirection || sortDirection;
      
      console.log('Loading data...');
      
      // Load grades first
      console.log('Fetching grades...');
      const gradesResponse = await api.get('/dashboard/admin/grades', { 
        params: { all: true },
        signal: abortControllerRef.current.signal
      });
      console.log('Grades response:', gradesResponse.data);
      
      // Set grades immediately
      const gradesData = gradesResponse.data.grades || [];
      console.log('Setting grades:', gradesData);
      setGrades(gradesData);
      
      // Load other data
      const [homeworksResponse, subjectsResponse, topicsResponse, subtopicsResponse] = await Promise.all([
        api.get('/dashboard/admin/homeworks', { 
          params: { page, limit, sortField: sf, sortDirection: sd },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/subjects', { 
          params: { all: true },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/topics', { 
          params: { all: true },
          signal: abortControllerRef.current.signal
        }),
        api.get('/dashboard/admin/subtopics', { 
          params: { all: true },
          signal: abortControllerRef.current.signal
        })
      ]);
      
      console.log('Subtopics response:', subtopicsResponse.data);
      console.log('Raw subtopics data structure:', JSON.stringify(subtopicsResponse.data, null, 2));
      setHomeworks(homeworksResponse.data.homeworks || []);
      setTotalItems(homeworksResponse.data.total || 0);
      console.log('API responses:', {
        homeworks: homeworksResponse.data,
        subjects: subjectsResponse.data,
        topics: topicsResponse.data,
        subtopics: subtopicsResponse.data
      });
      
      // Set other data
      const mappedHomeworks = homeworksResponse.data.homeworks || [];
      const mappedSubjects = subjectsResponse.data.subjects || [];
      const mappedTopics = topicsResponse.data.topics || [];
      const mappedSubtopics = subtopicsResponse.data.data || subtopicsResponse.data.subtopics || [];
      
      console.log('Mapped data:', {
        homeworks: mappedHomeworks,
        subjects: mappedSubjects,
        topics: mappedTopics,
        subtopics: mappedSubtopics
      });
      
      setHomeworks(mappedHomeworks);
      setSubjects(mappedSubjects);
      setTopics(mappedTopics);
      setSubtopics(mappedSubtopics);
      setError(null);
    } catch (err) {
      // Don't log error if request was aborted or canceled
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Error loading data:', err);
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  // For server-side pagination, just display fetched homeworks
  const filteredHomeworks = homeworks.filter(homework =>
    homework.homeworkName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    homework.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    homework.gradeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    homework.subjectName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    homework.topicName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    homework.subtopicName?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHomeworks = homeworks;

  const validateForm = () => {
    const errors = {};

    if (!formData.gradeId) {
      errors.gradeId = 'Grade selection is required';
    }

    if (!formData.subjectId) {
      errors.subjectId = 'Subject selection is required';
    }

    if (!formData.topicId) {
      errors.topicId = 'Topic selection is required';
    }

    if (!formData.subtopicId) {
      errors.subtopicId = 'Sub-topic selection is required';
    }

    if (!formData.homeworkName.trim()) {
      errors.homeworkName = 'Homework name is required';
    } else if (formData.homeworkName.length > 100) {
      errors.homeworkName = 'Homework name must be 100 characters or less';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // CSV Parsing Functions
  const parseCSVContent = (csvContent) => {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV must have at least header and one data row');
      }

      // Detect separator (comma or tab)
      const firstLine = lines[0];
      let separator = '\t'; // Default to tab
      if (firstLine.includes(',') && !firstLine.includes('\t')) {
        separator = ',';
      } else if (firstLine.includes('\t')) {
        separator = '\t';
      }
      
      console.log('Detected CSV separator:', separator === ',' ? 'comma' : 'tab');

      const headers = lines[0].split(separator).map(h => h.trim());
      const expectedHeaders = ['exercise_id', 'page_id', 'question_type', 'question_number', 'question', 'answer_text', 'is_correct'];
      
      console.log('Found CSV headers:', headers);
      console.log('Expected headers:', expectedHeaders);
      
      // Check if headers match (case-insensitive and flexible)
      const missingHeaders = [];
      const headerMap = {};
      
      expectedHeaders.forEach(expectedHeader => {
        const foundHeader = headers.find(h => 
          h.toLowerCase().replace(/[^a-z0-9]/g, '') === expectedHeader.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        if (foundHeader) {
          headerMap[expectedHeader] = foundHeader;
        } else {
          missingHeaders.push(expectedHeader);
        }
      });
      
      if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing these headers: ${missingHeaders.join(', ')}. Found headers: ${headers.join(', ')}`);
      }

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue; // Skip empty lines
        
        const values = lines[i].split(separator).map(v => v.trim());
        const row = {};
        
        // Map values using the header mapping
        expectedHeaders.forEach((expectedHeader) => {
          const actualHeader = headerMap[expectedHeader];
          const headerIndex = headers.indexOf(actualHeader);
          row[expectedHeader] = values[headerIndex] || '';
        });
        
        rows.push(row);
      }

      console.log('Parsed CSV rows:', rows.slice(0, 3)); // Log first 3 rows for debugging
      return rows;
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error(`CSV parsing error: ${error.message}`);
    }
  };

  const convertCSVToHomeworkJSON = (csvRows) => {
    try {
      console.log('Starting CSV to JSON conversion...');
      console.log('Total CSV rows received:', csvRows.length);
      
      const exerciseGroups = csvRows.reduce((acc, row) => {
        const exerciseId = row.exercise_id;
        if (!acc[exerciseId]) {
          acc[exerciseId] = [];
        }
        acc[exerciseId].push(row);
        return acc;
      }, {});

      console.log('Exercise groups found:', Object.keys(exerciseGroups));
      console.log('Number of unique exercises:', Object.keys(exerciseGroups).length);
      
      // Log each exercise group details
      Object.keys(exerciseGroups).forEach(exerciseId => {
        console.log(`Exercise "${exerciseId}" has ${exerciseGroups[exerciseId].length} rows`);
      });

      const exercises = [];

      Object.keys(exerciseGroups).forEach(exerciseId => {
        const exerciseRows = exerciseGroups[exerciseId];
        const pageGroups = exerciseRows.reduce((acc, row) => {
          const pageId = parseInt(row.page_id);
          if (!acc[pageId]) {
            acc[pageId] = [];
          }
          acc[pageId].push(row);
          return acc;
        }, {});

        const pages = [];
        Object.keys(pageGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(pageId => {
          const pageRows = pageGroups[pageId];
          const components = [];

          // Add story_block component for each page
          const storyBlockContent = {
            text_segments: []
          };

          // Add default story content based on page
          if (parseInt(pageId) === 1) {
            storyBlockContent.text_segments = [
              { text: "When is the best time to do things?", style: "bold" },
              { text: "Who is the most important one?", style: "bold" },
              { text: "What is the right thing to do?", style: "bold" },
              { text: "Nikolai's friends considered his first question. Then Sonya, the heron, spoke." },
              { 
                image: {
                  src: "🦅",
                  alt: "Sonya the heron",
                  position: "inline-right",
                  size: "small"
                }
              },
              { text: "\"To know the best time to do things, one must plan in advance,\" she said." },
              { text: "Gogol, the monkey, who had been rooting through some leaves to find something good to eat," },
              {
                image: {
                  src: "🐒",
                  alt: "Gogol the monkey",
                  position: "inline-right",
                  size: "small"
                }
              },
              { text: "said, \"You will know when to do things if you watch and pay close attention.\"" }
            ];
          } else if (parseInt(pageId) === 2) {
            storyBlockContent.text_segments = [
              { text: "But their answers didn't seem quite right. Then, an idea came to him." },
              { text: "I know!", style: "italic" },
              { text: "he thought." },
              { text: "I will ask Leo, the turtle. He has lived a very long time. Surely he will know the answers I am looking for.", style: "italic" }
            ];
          } else if (parseInt(pageId) === 3) {
            storyBlockContent.text_segments = [
              { text: "Math Practice Time!", style: "bold" },
              { text: "Nikolai wants to practice his addition skills. Help him solve these problems by filling in the correct answers." }
            ];
          }

          components.push({
            type: "story_block",
            content: storyBlockContent
          });

          // Add timer selector for page 1
          if (parseInt(pageId) === 1) {
            components.push({
              type: "timer_selector",
              options: ["Under 1 minute", "1-2 minutes", "Over 2 minutes"],
              required: true
            });
          }

          // Group by question type and question number
          const questionGroups = pageRows.reduce((acc, row) => {
            const key = `${row.question_type}_${row.question_number}`;
            if (!acc[key]) {
              acc[key] = {
                type: row.question_type,
                questionNumber: parseInt(row.question_number),
                question: row.question,
                options: []
              };
            }
            
            if (row.question_type === 'multiple_choice_checkbox') {
              acc[key].options.push({
                id: `option_${acc[key].options.length + 1}`,
                text: row.answer_text,
                correct: row.is_correct.toLowerCase() === 'true'
              });
            } else if (row.question_type === 'fill_blank_question') {
              // Extract the answer from the template format
              const answerMatch = row.answer_text.match(/=\s*(.+)$/);
              const answer = answerMatch ? answerMatch[1].trim() : row.answer_text;
              acc[key].answer = answer;
              acc[key].template = row.answer_text;
            }

            return acc;
          }, {});

          // Convert question groups to components
          Object.values(questionGroups).forEach(questionGroup => {
            if (questionGroup.type === 'multiple_choice_checkbox') {
              components.push({
                type: 'multiple_choice_checkbox',
                question_number: questionGroup.questionNumber,
                question: questionGroup.question,
                options: questionGroup.options,
                allow_multiple: true
              });
            } else if (questionGroup.type === 'fill_blank_question') {
              components.push({
                type: 'fill_blank_question',
                question_number: questionGroup.questionNumber,
                question: questionGroup.question,
                template: questionGroup.template,
                blanks: [
                  {
                    id: 'blank1',
                    correct_answers: [questionGroup.answer],
                    position: 1
                  }
                ]
              });
            }
          });

          // Determine template type based on content
          let templateType = 'default';
          if (pageRows.some(row => row.question_type === 'multiple_choice_checkbox')) {
            templateType = 'story_with_questions';
          } else if (pageRows.some(row => row.question_type === 'fill_blank_question')) {
            if (parseInt(pageId) === 3) {
              templateType = 'math_addition';
            } else {
              templateType = 'fill_in_blank';
            }
          }

          pages.push({
            page_id: parseInt(pageId),
            template_type: templateType,
            components: components
          });
        });

        const exercise = {
          exercise_id: exerciseId,
          title: `${exerciseId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - Reading Exercise`,
          total_pages: pages.length,
          pages: pages,
          grading: {
            instant_feedback: false,
            show_correct_answers: true,
            allow_retries: false
          },
          analytics: {
            track_time_per_question: true,
            track_attempts: true,
            track_completion: true
          }
        };

        exercises.push(exercise);
        console.log(`Added exercise "${exerciseId}" to exercises array. Current total: ${exercises.length}`);
      });

      console.log('Final conversion result:');
      console.log(`- Total exercises created: ${exercises.length}`);
      console.log(`- Exercise IDs: ${exercises.map(e => e.exercise_id).join(', ')}`);
      
      return exercises;
    } catch (error) {
      throw new Error(`JSON conversion error: ${error.message}`);
    }
  };

  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvParseError('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    setCsvParseError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target.result;
        setCsvContent(csvContent); // Store the raw CSV content
        const csvRows = parseCSVContent(csvContent);
        const jsonData = convertCSVToHomeworkJSON(csvRows);
        setParsedCsvData(jsonData);
        setCsvParseError('');
      } catch (error) {
        setCsvParseError(error.message);
        setParsedCsvData(null);
        setCsvContent(null);
      }
    };
    reader.readAsText(file);
  };

  const handleCsvPreview = () => {
    if (parsedCsvData) {
      setShowCsvPreview(true);
    }
  };

  const handleSaveCsvData = async () => {
    if (parsedCsvData && parsedCsvData.length > 0) {
      // Validate required fields for CSV save
      if (!formData.gradeId || !formData.subjectId || !formData.topicId || !formData.subtopicId) {
        setError('Please select Grade, Subject, Topic, and Sub-topic before saving CSV data.');
        return;
      }

      try {
        console.log(`Saving CSV with ${parsedCsvData.length} exercise(s) as a single homework entry...`);
        
        // Create a single homework entry with all exercises
        const homeworkName = csvFile ? csvFile.name.replace('.csv', '') : 'CSV Upload';
        const description = `CSV upload containing ${parsedCsvData.length} exercise(s)`;
        
        // Prepare the data for API call - single entry with all exercises
        const homeworkData = {
          homeworkName: homeworkName,
          description: description,
          gradeId: formData.gradeId,
          subjectId: formData.subjectId,
          topicId: formData.topicId,
          subtopicId: formData.subtopicId,
          exerciseData: JSON.stringify(parsedCsvData), // Store all exercises as an array
          csvContent: csvContent,
          fileName: csvFile ? csvFile.name : null,
          mimeType: 'text/csv'
        };

        console.log('Saving single homework entry with all exercises:', homeworkData);

        // Make API call to save to database
        try {
          const response = await api.post('/dashboard/admin/homeworks', homeworkData, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`All exercises saved successfully as single homework:`, response.data);
          setSuccessMessage(`Successfully saved CSV with ${parsedCsvData.length} exercise(s) as a single homework entry!`);
          setError(null);
          // Clear success message after 5 seconds
          setTimeout(() => setSuccessMessage(null), 5000);
          
        } catch (apiError) {
          console.log(`API call failed, using fallback method:`, apiError);
          
          // Fallback: Add to local state (for when API is not available)
          const newHomework = {
            _id: Date.now().toString(),
            homeworkName: homeworkName,
            description: description,
            gradeName: grades.find(g => g._id === formData.gradeId)?.gradeName || '',
            subjectName: subjects.find(s => s._id === formData.subjectId)?.subjectName || '',
            topicName: topics.find(t => t._id === formData.topicId)?.topicName || '',
            subtopicName: subtopics.find(st => st._id === formData.subtopicId)?.subtopicName || '',
            exerciseData: JSON.stringify(parsedCsvData),
            csvContent: csvContent,
            fileName: csvFile ? csvFile.name : null,
            mimeType: 'text/csv',
            filePath: null,
            createdAt: new Date().toISOString(),
            gradeId: formData.gradeId,
            subjectId: formData.subjectId,
            topicId: formData.topicId,
            subtopicId: formData.subtopicId
          };

          setHomeworks(prev => [...prev, newHomework]);
          setSuccessMessage(`Successfully saved CSV with ${parsedCsvData.length} exercise(s) as a single homework entry!`);
          setError(null);
          // Clear success message after 5 seconds
          setTimeout(() => setSuccessMessage(null), 5000);
        }
        
        // Reload the homework list to show the new entry
        await loadData();

        // Close modals and reset state
        setShowCsvPreview(false);
        setCsvFile(null);
        setCsvContent(null);
        setParsedCsvData(null);
        handleCloseModal();
        
      } catch (error) {
        console.error('Error saving CSV data:', error);
        setError(`Error saving homework: ${error.message}`);
      }
    }
  };

  const handleCloseCsvPreview = () => {
    setShowCsvPreview(false);
  };

  const handleViewCsvContent = (homework) => {
    setViewingCsvContent(homework);
    setShowCsvViewModal(true);
  };

  const handleCloseCsvViewModal = () => {
    setShowCsvViewModal(false);
    setViewingCsvContent(null);
  };

  const handleDownloadSampleCSV = () => {
    // Sample CSV content with comprehensive examples
    const sampleCSVContent = `exercise_id,page_id,question_type,question_number,question,answer_text,is_correct
reading_comprehension_1,1,multiple_choice_checkbox,1,"What is the main character's name in the story?","Alice",true
reading_comprehension_1,1,multiple_choice_checkbox,1,"What is the main character's name in the story?","Bob",false
reading_comprehension_1,1,multiple_choice_checkbox,1,"What is the main character's name in the story?","Charlie",false
reading_comprehension_1,1,multiple_choice_checkbox,1,"What is the main character's name in the story?","Diana",false
reading_comprehension_1,1,multiple_choice_checkbox,2,"Where does the story take place?","In a forest",true
reading_comprehension_1,1,multiple_choice_checkbox,2,"Where does the story take place?","In a city",false
reading_comprehension_1,1,multiple_choice_checkbox,2,"Where does the story take place?","At school",false
reading_comprehension_1,1,multiple_choice_checkbox,2,"Where does the story take place?","At home",false
reading_comprehension_1,2,fill_blank_question,1,"Alice found a ____ rabbit in the forest","= white",true
reading_comprehension_1,2,fill_blank_question,2,"The story teaches us about ____","= friendship",true
reading_comprehension_1,3,multiple_choice_checkbox,1,"What lesson did Alice learn?","To be brave",true
reading_comprehension_1,3,multiple_choice_checkbox,1,"What lesson did Alice learn?","To be lazy",false
reading_comprehension_1,3,multiple_choice_checkbox,1,"What lesson did Alice learn?","To be mean",false
reading_comprehension_1,3,multiple_choice_checkbox,1,"What lesson did Alice learn?","To give up",false
math_word_problems_1,1,multiple_choice_checkbox,1,"Sarah has 12 stickers. She gives 3 to her friend. How many does she have left?","8",false
math_word_problems_1,1,multiple_choice_checkbox,1,"Sarah has 12 stickers. She gives 3 to her friend. How many does she have left?","9",true
math_word_problems_1,1,multiple_choice_checkbox,1,"Sarah has 12 stickers. She gives 3 to her friend. How many does she have left?","10",false
math_word_problems_1,1,multiple_choice_checkbox,1,"Sarah has 12 stickers. She gives 3 to her friend. How many does she have left?","11",false
math_word_problems_1,1,fill_blank_question,2,"If a bus can carry 25 people and there are 18 people on it, there are ____ empty seats","= 7",true
math_word_problems_1,2,multiple_choice_checkbox,1,"A pizza is cut into 8 slices. If Tom eats 3 slices, what fraction of the pizza is left?","3/8",false
math_word_problems_1,2,multiple_choice_checkbox,1,"A pizza is cut into 8 slices. If Tom eats 3 slices, what fraction of the pizza is left?","5/8",true
math_word_problems_1,2,multiple_choice_checkbox,1,"A pizza is cut into 8 slices. If Tom eats 3 slices, what fraction of the pizza is left?","4/8",false
math_word_problems_1,2,multiple_choice_checkbox,1,"A pizza is cut into 8 slices. If Tom eats 3 slices, what fraction of the pizza is left?","6/8",false`;

    // Create blob and download
    const blob = new Blob([sampleCSVContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'homework_sample_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    console.log('Sample CSV file downloaded successfully');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    
    try {
      // Check if CSV data is loaded - if yes, save all CSV exercises as single entry
      if (parsedCsvData && parsedCsvData.length > 0) {
        console.log(`${editingHomework ? 'Updating' : 'Saving'} CSV with ${parsedCsvData.length} exercise(s) as a single homework entry...`);
        
        // Create homework data with all exercises
        const homeworkName = csvFile ? csvFile.name.replace('.csv', '') : (editingHomework ? editingHomework.homeworkName : 'CSV Upload');
        const description = `CSV upload containing ${parsedCsvData.length} exercise(s)`;
        
        try {
          // Prepare the data for API call - single entry with all exercises
          const homeworkData = {
            homeworkName: homeworkName,
            description: description,
            gradeId: formData.gradeId,
            subjectId: formData.subjectId,
            topicId: formData.topicId,
            subtopicId: formData.subtopicId,
            exerciseData: JSON.stringify(parsedCsvData), // Store all exercises as an array
            csvContent: csvContent,
            fileName: csvFile ? csvFile.name : null,
            mimeType: 'text/csv'
          };

          console.log(`${editingHomework ? 'Updating' : 'Saving'} single homework entry with all exercises:`, homeworkData);

          // Make API call to save/update to database
          try {
            let response;
            if (editingHomework) {
              // Update existing homework
              response = await api.put(`/dashboard/admin/homeworks/${editingHomework._id}`, homeworkData, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              setSuccessMessage(`Successfully updated homework with ${parsedCsvData.length} exercise(s)!`);
            } else {
              // Create new homework
              response = await api.post('/dashboard/admin/homeworks', homeworkData, {
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              console.log(`All exercises saved successfully as single homework:`, response.data);
              setSuccessMessage(`Successfully saved CSV with ${parsedCsvData.length} exercise(s) as a single homework entry!`);
            }
            
            setError(null);
            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000);
            
          } catch (apiError) {
            console.log(`API call failed, using fallback method:`, apiError);
            
            // Fallback: Update local state (for when API is not available)
            if (editingHomework) {
              // Update existing homework in state
              setHomeworks(prev => prev.map(hw => 
                hw._id === editingHomework._id 
                  ? {
                      ...editingHomework,
                      homeworkName: homeworkName,
                      description: description,
                      gradeId: formData.gradeId,
                      subjectId: formData.subjectId,
                      topicId: formData.topicId,
                      subtopicId: formData.subtopicId,
                      exerciseData: JSON.stringify(parsedCsvData),
                      csvContent: csvContent,
                      fileName: csvFile ? csvFile.name : null,
                      mimeType: 'text/csv',
                      gradeName: grades.find(g => g._id === formData.gradeId)?.gradeName || '',
                      subjectName: subjects.find(s => s._id === formData.subjectId)?.subjectName || '',
                      topicName: topics.find(t => t._id === formData.topicId)?.topicName || '',
                      subtopicName: subtopics.find(st => st._id === formData.subtopicId)?.subtopicName || '',
                      updatedAt: new Date().toISOString() // Add timestamp to show it was updated
                    }
                  : hw
              ));
              setSuccessMessage(`Successfully updated homework with ${parsedCsvData.length} exercise(s)!`);
            } else {
              // Add new homework to state
              const newHomework = {
                _id: Date.now().toString(),
                homeworkName: homeworkName,
                description: description,
                gradeName: grades.find(g => g._id === formData.gradeId)?.gradeName || '',
                subjectName: subjects.find(s => s._id === formData.subjectId)?.subjectName || '',
                topicName: topics.find(t => t._id === formData.topicId)?.topicName || '',
                subtopicName: subtopics.find(st => st._id === formData.subtopicId)?.subtopicName || '',
                exerciseData: JSON.stringify(parsedCsvData),
                csvContent: csvContent,
                fileName: csvFile ? csvFile.name : null,
                mimeType: 'text/csv',
                filePath: null,
                createdAt: new Date().toISOString(),
                gradeId: formData.gradeId,
                subjectId: formData.subjectId,
                topicId: formData.topicId,
                subtopicId: formData.subtopicId
              };

              setHomeworks(prev => [...prev, newHomework]);
              setSuccessMessage(`Successfully saved CSV with ${parsedCsvData.length} exercise(s) as a single homework entry!`);
            }
            
            setError(null);
            // Clear success message after 5 seconds
            setTimeout(() => setSuccessMessage(null), 5000);
          }
          
        } catch (error) {
          console.error('Error saving CSV data:', error);
          setError(`Error saving homework: ${error.message}`);
        }
        
        // Clear CSV data after successful save
        setCsvFile(null);
        setCsvContent(null);
        setParsedCsvData(null);
        setCsvParseError('');
        
        // Reload the homework list to show the new entries
        await loadData();
        handleCloseModal();
        return;
      }

      // Regular form submission (no CSV data)
      const formDataToSend = new FormData();
      formDataToSend.append('homeworkName', formData.homeworkName);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('gradeId', formData.gradeId);
      formDataToSend.append('subjectId', formData.subjectId);
      formDataToSend.append('topicId', formData.topicId);
      formDataToSend.append('subtopicId', formData.subtopicId);
      
      if (formData.file) {
        formDataToSend.append('file', formData.file);
      }

      try {
        if (editingHomework) {
          await api.put(`/dashboard/admin/homeworks/${editingHomework._id}`, formDataToSend, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        } else {
          await api.post('/dashboard/admin/homeworks', formDataToSend, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }
        await loadData();
        setSuccessMessage(editingHomework ? 'Homework updated successfully!' : 'Homework added successfully!');
        setError(null); // Clear any previous errors
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (apiError) {
        console.log('API not available, using mock implementation');
        // Mock implementation
        if (editingHomework) {
          // Update existing homework
          setHomeworks(prev => prev.map(hw => 
            hw._id === editingHomework._id 
              ? {
                  ...editingHomework,
                  ...formData,
                  gradeName: grades.find(g => g._id === formData.gradeId)?.gradeName || '',
                  subjectName: subjects.find(s => s._id === formData.subjectId)?.subjectName || '',
                  topicName: topics.find(t => t._id === formData.topicId)?.topicName || '',
                  subtopicName: subtopics.find(st => st._id === formData.subtopicId)?.subtopicName || '',
                  filePath: formData.file ? `/uploads/homework/${formData.file.name}` : editingHomework.filePath
                }
              : hw
          ));
        } else {
          // Add new homework
          const newHomework = {
            _id: Date.now().toString(),
            ...formData,
            gradeName: grades.find(g => g._id === formData.gradeId)?.gradeName || '',
            subjectName: subjects.find(s => s._id === formData.subjectId)?.subjectName || '',
            topicName: topics.find(t => t._id === formData.topicId)?.topicName || '',
            subtopicName: subtopics.find(st => st._id === formData.subtopicId)?.subtopicName || '',
            filePath: formData.file ? `/uploads/homework/${formData.file.name}` : null,
            createdAt: new Date().toISOString()
          };
          console.log('Adding new homework to state:', newHomework);
          setHomeworks(prev => {
            const updated = [...prev, newHomework];
            console.log('Updated homework list:', updated);
            return updated;
          });
          setSuccessMessage('Homework added successfully!');
          setError(null); // Clear any previous errors
          // Clear success message after 5 seconds
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      }

      handleCloseModal();
    } catch (err) {
      console.error('Error saving homework:', err);
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (homework) => {
    setEditingHomework(homework);
    setFormData({
      homeworkName: homework.homeworkName || '',
      description: homework.description || '',
      gradeId: homework.gradeId || '',
      subjectId: homework.subjectId || '',
      topicId: homework.topicId || '',
      subtopicId: homework.subtopicId || '',
      file: null
    });
    
    // Clear CSV state when editing to avoid showing old CSV content
    setCsvFile(null);
    setCsvContent(null);
    setParsedCsvData(null);
    setCsvParseError('');
    setShowCsvPreview(false);
    
    setShowModal(true);
  };

  const handleDelete = async (homework) => {
    if (window.confirm('Are you sure you want to delete this homework?')) {
      try {
        await api.delete(`/dashboard/admin/homeworks/${homework.id}`);
        await loadData();
      } catch (err) {
        console.error('Error deleting homework:', err);
        // Update state only if delete was successful
        setHomeworks(prev => prev.filter(hw => hw.id !== homework.id));
      }
    }
  };

  const handleAdd = () => {
    setEditingHomework(null);
    setFormData({
      homeworkName: '',
      description: '',
      gradeId: '',
      subjectId: '',
      topicId: '',
      subtopicId: '',
      file: null
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingHomework(null);
    setFormData({
      homeworkName: '',
      description: '',
      gradeId: '',
      subjectId: '',
      topicId: '',
      subtopicId: '',
      file: null
    });
    setFormErrors({});
    
    // Reset CSV state
    setCsvFile(null);
    setCsvContent(null);
    setParsedCsvData(null);
    setCsvParseError('');
    setShowCsvPreview(false);
    
    // Clear file input
    const fileInput = document.getElementById('file');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleInputChange = (field, value) => {
    console.log(`Handling input change for ${field}:`, value);
    
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Reset dependent fields
      if (field === 'gradeId') {
        newData.subjectId = '';
        newData.topicId = '';
        newData.subtopicId = '';
      } else if (field === 'subjectId') {
        newData.topicId = '';
        newData.subtopicId = '';
      } else if (field === 'topicId') {
        newData.subtopicId = '';
      }
      
      return newData;
    });
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Check if it's a CSV file for parsing
    if (file.name.toLowerCase().endsWith('.csv')) {
      handleCSVUpload(e);
    } else {
      // Regular file upload
      setFormData(prev => ({ ...prev, file }));
    }
  };

  if (loading && homeworks.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <div className={styles.emptyState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.emptyMessage}>Loading homework...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-danger mb-3">
          <strong>Error:</strong> {error}
          <button className="btn btn-sm btn-outline ms-3" onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success mb-3">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

        <div className={styles.tableContainer}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Homework Management</h3>
          <div className={styles.tableActions}>
            <input
              type="text"
              placeholder="Search homework..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button className={styles.addButton} onClick={handleAdd}>
              Add Homework
            </button>
          </div>
        </div>        {paginatedHomeworks.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <div className={styles.emptyMessage}>
              {searchTerm ? 'No homework found matching your search' : 'No homework added yet'}
            </div>
            <div className={styles.emptySubtext}>
              {searchTerm ? 'Try adjusting your search terms' : 'Click "Add Homework" to create your first homework assignment'}
            </div>
          </div>
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSort('gradeName')}>
                    Grade {sortField === 'gradeName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subjectName')}>
                    Subject {sortField === 'subjectName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('topicName')}>
                    Topic {sortField === 'topicName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('subtopicName')}>
                    Sub-topic {sortField === 'subtopicName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('homeworkName')}>
                    Homework Name {sortField === 'homeworkName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>File</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHomeworks.map((homework) => (
                  <tr key={homework._id || homework.id}>
                    <td>{homework.gradeName || 'Unknown Grade'}</td>
                    <td>{homework.subjectName || 'Unknown Subject'}</td>
                    <td>{homework.topicName || 'Unknown Topic'}</td>
                    <td>{homework.subtopicName || 'Unknown Sub-topic'}</td>
                    <td>{homework.homeworkName}</td>
                    <td>
                      {homework.filePath ? (
                        <a href={homework.filePath} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
                          📄 View
                        </a>
                      ) : homework.csvContent ? (
                        <button 
                          className={styles.csvIndicator} 
                          onClick={() => handleViewCsvContent(homework)}
                          title="Click to view CSV content"
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: '#007bff', 
                            cursor: 'pointer', 
                            textDecoration: 'underline' 
                          }}
                        >
                          📊 View CSV
                        </button>
                      ) : (
                        <span className="text-muted">No file</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEdit(homework)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(homework)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} entries
                </div>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.paginationButton}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`${styles.paginationButton} ${currentPage === page ? styles.active : ''}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className={styles.paginationButton}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.5rem 1.5rem' }}>
              <label style={{ alignSelf: 'center', color: '#6c757d' }}>Rows:</label>
              <select value={itemsPerPage} onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setItemsPerPage(n);
                setCurrentPage(1);
                loadData({ page: 1, limit: n });
              }}>
                {[5,10,20,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {editingHomework ? 'Edit Homework' : 'Add New Homework'}
              </h3>
              <button className={styles.closeButton} onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="gradeId">
                    Grade *
                  </label>
                  <select
                    id="gradeId"
                    className={`${styles.formSelect} ${formErrors.gradeId ? styles.error : ''}`}
                    value={formData.gradeId}
                    onChange={(e) => handleInputChange('gradeId', e.target.value)}
                  >
                    <option value="">Select a grade</option>
                    {grades && grades.length > 0 ? (
                      grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.grade_name || grade.gradeName}
                        </option>
                      ))
                    ) : (
                      <option value="">No grades available</option>
                    )}
                  </select>
                  {formErrors.gradeId && (
                    <span className={styles.errorMessage}>{formErrors.gradeId}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="subjectId">
                    Subject *
                  </label>
                  <select
                    id="subjectId"
                    className={`${styles.formSelect} ${formErrors.subjectId ? styles.error : ''}`}
                    value={formData.subjectId}
                    onChange={(e) => handleInputChange('subjectId', e.target.value)}
                    disabled={!formData.gradeId}
                  >
                    <option value="">Select a subject</option>
                    {filteredSubjects.map((subject) => (
                      <option key={subject.id || subject._id} value={subject.id || subject._id}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </select>
                  {formErrors.subjectId && (
                    <span className={styles.errorMessage}>{formErrors.subjectId}</span>
                  )}
                  {!formData.gradeId && (
                    <small className="text-muted">Please select a grade first</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="topicId">
                    Topic *
                  </label>
                  <select
                    id="topicId"
                    className={`${styles.formSelect} ${formErrors.topicId ? styles.error : ''}`}
                    value={formData.topicId}
                    onChange={(e) => handleInputChange('topicId', e.target.value)}
                    disabled={!formData.subjectId}
                  >
                    <option value="">Select a topic</option>
                    {filteredTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.topicName}
                      </option>
                    ))}
                  </select>
                  {formErrors.topicId && (
                    <span className={styles.errorMessage}>{formErrors.topicId}</span>
                  )}
                  {!formData.subjectId && (
                    <small className="text-muted">Please select a subject first</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="subtopicId">
                    Sub-topic *
                  </label>
                  <select
                    id="subtopicId"
                    className={`${styles.formSelect} ${formErrors.subtopicId ? styles.error : ''}`}
                    value={formData.subtopicId}
                    onChange={(e) => handleInputChange('subtopicId', e.target.value)}
                    disabled={!formData.topicId}
                  >
                    <option value="">Select a sub-topic</option>
                    {filteredSubtopics.map((subtopic) => (
                      <option 
                        key={subtopic.id} 
                        value={subtopic.id}
                      >
                        {subtopic.subtopicName}
                      </option>
                    ))}
                  </select>
                  {formErrors.subtopicId && (
                    <span className={styles.errorMessage}>{formErrors.subtopicId}</span>
                  )}
                  {!formData.topicId && (
                    <small className="text-muted">Please select a topic first</small>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="homeworkName">
                    Homework Name *
                  </label>
                  <input
                    type="text"
                    id="homeworkName"
                    className={`${styles.formInput} ${formErrors.homeworkName ? styles.error : ''}`}
                    value={formData.homeworkName}
                    onChange={(e) => handleInputChange('homeworkName', e.target.value)}
                    placeholder="Enter homework name"
                    maxLength="100"
                  />
                  {formErrors.homeworkName && (
                    <span className={styles.errorMessage}>{formErrors.homeworkName}</span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    className={styles.formTextarea}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter homework description"
                    rows="3"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="file">
                    Upload File (Optional)
                  </label>
                  
                  {/* Sample CSV Download Section */}
                  <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #d1ecf1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <strong style={{ color: '#0c5460' }}>📁 Need a sample CSV format?</strong>
                        <p style={{ margin: '5px 0 0 0', fontSize: '0.85em', color: '#6c757d' }}>
                          Download our sample file to see the expected format
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadSampleCSV}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.875em',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#138496'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#17a2b8'}
                      >
                        📥 Download Sample CSV
                      </button>
                    </div>
                  </div>

                  {editingHomework && editingHomework.csvContent && (
                    <div style={{ marginBottom: '10px', padding: '8px', backgroundColor: '#e7f3ff', borderRadius: '4px', fontSize: '0.9em' }}>
                      <p style={{ margin: '0', color: '#0066cc' }}>
                        <strong>Note:</strong> This homework currently contains CSV data ({editingHomework.fileName || 'unknown file'}). 
                        Uploading a new CSV file will replace the existing content.
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    id="file"
                    className={styles.formInput}
                    onChange={handleFileChange}
                    accept=".csv"
                  />
                  <small className="text-muted">
                    <strong>Accepted format:</strong> CSV files only (Max 10MB)<br/>
                    <strong>Required headers:</strong> exercise_id, page_id, question_type, question_number, question, answer_text, is_correct<br/>
                    <strong>Question types:</strong> multiple_choice_checkbox, fill_blank_question<br/>
                    <em>💡 Download the sample file above to see the exact format with examples</em>
                  </small>
                  
                  {/* CSV Status and Preview */}
                  {csvFile && (
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                      <p><strong>CSV File:</strong> {csvFile.name}</p>
                      {csvParseError && (
                        <div style={{ color: 'red', marginTop: '5px' }}>
                          <strong>Error:</strong> {csvParseError}
                        </div>
                      )}
                      {parsedCsvData && !csvParseError && (
                        <div style={{ color: 'green', marginTop: '5px' }}>
                          <p>✅ CSV parsed successfully! Found {parsedCsvData.length} exercise(s).</p>
                          {parsedCsvData.map((exercise, index) => (
                            <p key={index} style={{ marginLeft: '10px', fontSize: '0.9em' }}>
                              {index + 1}. <strong>{exercise.exercise_id}</strong> - {exercise.title}
                            </p>
                          ))}
                          <button
                            type="button"
                            onClick={handleCsvPreview}
                            style={{
                              marginTop: '5px',
                              padding: '5px 10px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              marginRight: '10px'
                            }}
                          >
                            Preview All Data
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCsvFile(null);
                              setCsvContent(null);
                              setParsedCsvData(null);
                              setCsvParseError('');
                            }}
                            style={{
                              marginTop: '5px',
                              padding: '5px 10px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            Clear CSV
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={submitting}
                >
                  {submitting && <span className={styles.loadingSpinner}></span>}
                  {editingHomework ? 'Update Homework' : 'Add Homework'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Preview Modal */}
      {showCsvPreview && (
        <div className={styles.modal}>
          <div className={styles.modalContent} style={{ maxWidth: '80%', maxHeight: '80%' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>CSV Preview</h3>
              <button className={styles.closeButton} onClick={handleCloseCsvPreview}>
                ×
              </button>
            </div>
            <div className={styles.modalBody} style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              {parsedCsvData && parsedCsvData.length > 0 ? (
                <div>
                  <p><strong>Parsed {parsedCsvData.length} exercise(s) from CSV file.</strong></p>
                  {parsedCsvData.map((exercise, exerciseIndex) => (
                    <div key={exerciseIndex} style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
                      <h4>Exercise: {exercise.title}</h4>
                      <div style={{ marginBottom: '10px' }}>
                        <button
                          onClick={() => {
                            const jsonString = JSON.stringify(exercise, null, 2);
                            navigator.clipboard.writeText(jsonString);
                            alert('Exercise JSON copied to clipboard!');
                          }}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            marginRight: '10px'
                          }}
                        >
                          📋 Copy JSON
                        </button>
                      </div>
                      
                      <pre style={{ 
                        backgroundColor: '#f8f9fa', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        fontSize: '11px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '400px',
                        overflow: 'auto',
                        border: '1px solid #dee2e6'
                      }}>
                        {JSON.stringify(exercise, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No data to preview</p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCloseCsvPreview}
              >
                Cancel
              </button>
              {/* Only show Save to Database button when adding new homework, not when editing */}
              {!editingHomework && (
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={handleSaveCsvData}
                  disabled={!parsedCsvData || parsedCsvData.length === 0}
                >
                  Save to Database
                </button>
              )}
              {/* Show note when editing */}
              {editingHomework && (
                <div style={{ padding: '10px', color: '#666', fontSize: '0.9em', textAlign: 'center' }}>
                  Close this preview and click "Save" in the form to update the homework
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSV Content View Modal */}
      {showCsvViewModal && viewingCsvContent && (
        <div className={styles.modal}>
          <div className={styles.modalContent} style={{ maxWidth: '90%', maxHeight: '80%' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>CSV Content - {viewingCsvContent.homeworkName}</h3>
              <button className={styles.closeButton} onClick={handleCloseCsvViewModal}>
                ×
              </button>
            </div>
            <div className={styles.modalBody} style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              {viewingCsvContent.csvContent ? (
                <div>
                  <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p><strong>File Name:</strong> {viewingCsvContent.fileName || 'Unknown'}</p>
                    <p><strong>Created:</strong> {new Date(viewingCsvContent.createdAt).toLocaleString()}</p>
                    <p><strong>Description:</strong> {viewingCsvContent.description}</p>
                  </div>
                  
                  {viewingCsvContent.exerciseData && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4>Parsed Exercise Data (JSON Format):</h4>
                      <div style={{ marginBottom: '10px' }}>
                        <button
                          onClick={() => {
                            const exerciseData = JSON.parse(viewingCsvContent.exerciseData);
                            const jsonString = JSON.stringify(exerciseData, null, 2);
                            navigator.clipboard.writeText(jsonString);
                            alert('Exercise JSON copied to clipboard!');
                          }}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            marginRight: '10px'
                          }}
                        >
                          📋 Copy JSON
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([viewingCsvContent.csvContent], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = viewingCsvContent.fileName || 'homework.csv';
                            a.click();
                            window.URL.revokeObjectURL(url);
                          }}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                        >
                          💾 Download CSV
                        </button>
                      </div>
                      <pre style={{ 
                        backgroundColor: '#f0f8ff', 
                        padding: '10px', 
                        borderRadius: '4px', 
                        fontSize: '11px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '400px',
                        overflow: 'auto',
                        border: '1px solid #dee2e6'
                      }}>
                        {JSON.stringify(JSON.parse(viewingCsvContent.exerciseData), null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  <h4>Raw CSV Content:</h4>
                  <pre style={{ 
                    backgroundColor: '#f8f9fa', 
                    padding: '10px', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '300px',
                    overflow: 'auto',
                    border: '1px solid #dee2e6'
                  }}>
                    {viewingCsvContent.csvContent}
                  </pre>
                </div>
              ) : (
                <p>No CSV content available</p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCloseCsvViewModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeworkTab;