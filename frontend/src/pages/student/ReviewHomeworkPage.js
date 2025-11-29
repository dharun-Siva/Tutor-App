// This file is now obsolete. All review logic is handled in HomeworkPage.js.
// You can safely delete this file.
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import styles from './ReviewHomeworkPage.module.css';

const ReviewHomeworkPage = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editableData, setEditableData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [dynamicPages, setDynamicPages] = useState([]);

  // Parse exerciseData from API - same logic as HomeworkPage
  const parseExerciseData = (exerciseDataString) => {
    try {
      if (!exerciseDataString) return [];
      
      const exercises = JSON.parse(exerciseDataString);
      const allPages = [];
      
      exercises.forEach((exercise, exerciseIndex) => {
        exercise.pages.forEach((page, pageIndex) => {
          const uiPage = {
            id: `${exercise.exercise_id}_${page.page_id}`,
            title: exercise.title || `Exercise ${exerciseIndex + 1}`,
            instruction: "Review your answers and see the correct responses.",
            type: page.template_type === 'story_with_questions' ? 'reading' : 
                  page.template_type === 'fill_in_blank' ? 'math' : 'reading',
            story: "", // We'll extract this from components
            timeOptions: page.template_type === 'story_with_questions' ? 
                        ["Under 1 minute", "1-2 minutes", "Over 2 minutes"] : null,
            questions: []
          };
          
          // Process components to extract story and questions
          page.components.forEach(component => {
            if (component.type === 'story_block' && component.content) {
              // Extract story text from text_segments
              if (component.content.text_segments) {
                uiPage.story = component.content.text_segments
                  .filter(segment => segment.text)
                  .map(segment => segment.text)
                  .join(' ');
              }
            } else if (component.type === 'multiple_choice_checkbox') {
              uiPage.questions.push({
                id: component.question_number || uiPage.questions.length + 1,
                type: 'multiple_choice_checkbox',
                question: component.question || `Question ${component.question_number}`,
                options: component.options ? component.options.map(opt => opt.text || opt) : [],
                correctAnswers: component.options ? 
                  component.options.map((opt, idx) => opt.correct ? idx : -1).filter(idx => idx >= 0) : [],
                allowMultiple: true
              });
            } else if (component.type === 'fill_blank_question') {
              uiPage.questions.push({
                id: component.question_number || uiPage.questions.length + 1,
                type: 'fill_blank',
                question: `Question ${component.question_number}`,
                problem: component.question || component.template || "",
                correctAnswer: component.blanks && component.blanks[0] ? 
                  component.blanks[0].correct_answers?.[0] || "" : ""
              });
            }
          });
          
          allPages.push(uiPage);
        });
      });
      
      console.log('📚 Parsed exercise data for review:', allPages);
      return allPages;
      
    } catch (error) {
      console.error('❌ Error parsing exercise data for review:', error);
      return [];
    }
  };

  // Load review data
  useEffect(() => {
    loadReviewData();
  }, [assignmentId]);

  const loadReviewData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        return;
      }

      // Load assignment data which contains both exercise structure and saved answers
      const response = await fetch('/api/homework-assignments/student', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        // Find the specific assignment
        const assignment = result.assignments.find(a => a._id === assignmentId);
        
        if (!assignment) {
          setError('Assignment not found');
          return;
        }
        
        // Check if assignment is completed
        if (assignment.status !== 'completed') {
          setError('Assignment is not completed yet. Please submit the assignment first.');
          return;
        }
        
        if (assignment.homework?.exerciseData) {
          // Parse exercise data to get dynamic page structure
          const parsedPages = parseExerciseData(assignment.homework.exerciseData);
          setDynamicPages(parsedPages);
          console.log('📋 Loaded dynamic pages for review:', parsedPages);
        }
        
        // Get saved answers for this assignment
        const savedAnswers = result.savedAnswers?.[assignmentId];
        
        if (savedAnswers) {
          // Transform saved answers to match expected review structure
          const pageIndicators = savedAnswers.pages?.map((page, index) => {
            let correctCount = 0;
            let totalQuestions = 0;
            page.components?.forEach(component => {
              if (component.type === 'multiple_choice_checkbox' || component.type === 'fill_blank_question') {
                totalQuestions++;
                if (component.studentAnswer?.isCorrect) {
                  correctCount++;
                }
              }
            });
            return {
              pageId: page.pageId || (index + 1),
              status: correctCount === totalQuestions ? 'correct' : 'incorrect',
              correctCount,
              totalQuestions,
              needsEdit: correctCount < totalQuestions
            };
          }) || [];

          const summary = {
            totalPages: pageIndicators.length,
            completedPages: pageIndicators.filter(p => p.status === 'correct').length,
            pagesNeedingEdit: pageIndicators.filter(p => p.needsEdit).length,
            overallStatus: pageIndicators.every(p => p.status === 'correct') ? 'all_correct' : 'has_errors'
          };

          const reviewData = {
            assignmentId,
            assignment: {
              _id: assignment._id,
              homeworkName: assignment.homework?.homeworkName,
              description: assignment.homework?.description
            },
            savedAnswers,
            pageIndicators,
            summary
          };

          setReviewData(reviewData);
          console.log('✅ Review data loaded successfully:', reviewData);
          console.log('📊 Page indicators:', reviewData.pageIndicators);
          console.log('💾 Saved answers structure:', savedAnswers);
        } else {
          setError('No saved answers found for this assignment');
        }
      } else {
        setError(result.message || 'Failed to load review data');
      }
    } catch (err) {
      console.error('Error loading review data:', err);
      setError('Failed to load assignment review');
    } finally {
      setLoading(false);
    }
  };

  const enableEditMode = (pageId) => {
    // Find the current page data from savedAnswers
    const pageIndex = reviewData.savedAnswers.pages.findIndex(p => p.pageId === pageId);
    if (pageIndex === -1) {
      setError('Page not found for editing');
      return;
    }
    // Deep clone the page data and set all components as editable
    const editablePage = JSON.parse(JSON.stringify(reviewData.savedAnswers.pages[pageIndex]));
    editablePage.components.forEach(component => {
      component.editable = true;
    });
    setEditableData(editablePage);
    setEditMode(true);
    console.log('✏️ Edit mode enabled for page:', pageId);
  };

  const savePageAnswers = async () => {
    if (!editableData) return;

    try {
      setSaving(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

      // Prepare answers data for all components
      const pageAnswers = {};
      editableData.components.forEach((component) => {
        if (component.type === 'multiple_choice_checkbox') {
          pageAnswers[`question_${component.questionNumber}`] = component.studentAnswer?.selected || [];
        } else if (component.type === 'fill_blank_question') {
          pageAnswers[`question_${component.questionNumber}`] = component.blanks?.[0]?.studentAnswer || '';
        }
      });

      const response = await fetch('/api/student-answers/save-answers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assignmentId,
          currentPage: editableData.pageId - 1,
          pageAnswers,
          pageType: editableData.components[0]?.type === 'multiple_choice_checkbox' ? 'reading' : 'math'
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('💾 Page answers saved successfully');
        // Reload review data to get updated status
        await loadReviewData();
        setEditMode(false);
        setEditableData(null);
      } else {
        setError(result.message || 'Failed to save answers');
      }
    } catch (err) {
      console.error('❌ Error saving answers:', err);
      setError('Failed to save answers');
    } finally {
      setSaving(false);
    }
  };

  const finalSubmit = async () => {
    try {
      setFinalSubmitting(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      const response = await fetch(`/api/student-answers/final-submit/${assignmentId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('🎯 Final submit successful:', result.data);
        // Reload review data to show updated indicators
        await loadReviewData();
        alert('Your corrections have been submitted successfully!');
      } else {
        setError(result.message || 'Failed to submit corrections');
      }
    } catch (err) {
      console.error('❌ Error in final submit:', err);
      setError('Failed to submit corrections');
    } finally {
      setFinalSubmitting(false);
    }
  };

  const handleAnswerChange = (componentIndex, newValue) => {
    if (!editableData) return;

    const updatedData = { ...editableData };
    const component = updatedData.components[componentIndex];

    if (component.type === 'multiple_choice_checkbox') {
      if (!component.studentAnswer) component.studentAnswer = { selected: [] };
      component.studentAnswer.selected = newValue;
    } else if (component.type === 'fill_blank_question') {
      if (!component.blanks) component.blanks = [{}];
      component.blanks[0].studentAnswer = newValue;
    }

    setEditableData(updatedData);
  };

  const getPageStatus = (pageIndicator) => {
    if (pageIndicator.status === 'correct') return '✅';
    return '❌';
  };

  const getCurrentPageData = () => {
    if (!reviewData || !dynamicPages.length) return null;
    
    if (editMode && editableData) {
      return editableData;
    }
    
    // Return the current page from savedAnswers but enhanced with dynamic page info
    const savedAnswerPage = reviewData.savedAnswers.pages?.[currentPage];
    const dynamicPageInfo = dynamicPages[currentPage];
    
    if (!savedAnswerPage || !dynamicPageInfo) return null;
    
    // Merge saved answers with dynamic page structure
    const enhancedComponents = savedAnswerPage.components.map(savedComponent => {
      // Find matching question from dynamic page data
      const dynamicQuestion = dynamicPageInfo.questions.find(q => 
        q.id === savedComponent.questionNumber
      );
      
      // Enhance the saved component with dynamic question info
      return {
        ...savedComponent,
        question: dynamicQuestion?.question || savedComponent.question || `Question ${savedComponent.questionNumber}`,
        options: dynamicQuestion?.options || savedComponent.options || [],
        correctAnswers: dynamicQuestion?.correctAnswers || []
      };
    });
    
    return {
      ...savedAnswerPage,
      components: enhancedComponents,
      dynamicPageInfo,
      title: dynamicPageInfo.title,
      story: dynamicPageInfo.story
    };
  };

  const getCurrentPageIndicator = () => {
    if (!reviewData) return null;
    return reviewData.pageIndicators[currentPage];
  };

  const renderQuestion = (component, index) => {
    const isEditable = editMode && component.editable;
    const isCorrect = component.isCorrect;

    if (component.type === 'multiple_choice_checkbox') {
      return (
        <div key={index} className={styles.questionContainer}>
          <div className={styles.questionHeader}>
            <h3 className={styles.questionTitle}>
              Question {component.questionNumber}: {component.question}
              <span className={`${styles.statusIcon} ${isCorrect ? styles.correct : styles.incorrect}`}>
                {isCorrect ? '✅' : '❌'}
              </span>
            </h3>
          </div>
          
          <div className={styles.optionsContainer}>
            {component.options?.map((option, optIndex) => {
              const isSelected = component.studentAnswer?.selected?.includes(optIndex);
              
              return (
                <label key={optIndex} className={`${styles.option} ${isSelected ? styles.selected : ''} ${!isEditable ? styles.readonly : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isEditable}
                    onChange={(e) => {
                      if (isEditable) {
                        const currentSelected = component.studentAnswer?.selected || [];
                        let newSelected;
                        if (e.target.checked) {
                          newSelected = [...currentSelected, optIndex];
                        } else {
                          newSelected = currentSelected.filter(i => i !== optIndex);
                        }
                        handleAnswerChange(index, newSelected);
                      }
                    }}
                  />
                  <span className={styles.optionText}>{option.text}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    } else if (component.type === 'fill_blank_question') {
      const studentAnswer = component.blanks?.[0]?.studentAnswer || '';
      
      return (
        <div key={index} className={styles.questionContainer}>
          <div className={styles.questionHeader}>
            <h3 className={styles.questionTitle}>
              Question {component.questionNumber}: {component.question}
              <span className={`${styles.statusIcon} ${isCorrect ? styles.correct : styles.incorrect}`}>
                {isCorrect ? '✅' : '❌'}
              </span>
            </h3>
          </div>
          
          <div className={styles.fillBlankContainer}>
            <input
              type="text"
              value={studentAnswer}
              disabled={!isEditable}
              className={`${styles.fillBlankInput} ${isCorrect ? styles.correctAnswer : styles.incorrectAnswer} ${!isEditable ? styles.readonly : ''}`}
              onChange={(e) => {
                if (isEditable) {
                  handleAnswerChange(index, e.target.value);
                }
              }}
              placeholder={isEditable ? "Enter your answer" : "No answer"}
            />
          </div>
        </div>
      );
    }

    return null;
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className={styles.error}>Error: {error}</div>;
  if (!reviewData) return <div className={styles.error}>No review data available</div>;
  if (!dynamicPages.length) return <LoadingSpinner message="Loading exercise data..." />;

  const currentPageData = getCurrentPageData();
  const currentPageIndicator = getCurrentPageIndicator();

  return (
    <div className={styles.reviewContainer}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={styles.title}>
          Review: {reviewData.assignment.homeworkName}
        </h1>
      </div>

      {/* Page Navigation */}
      <div className={styles.pageNavigation}>
        <h2>Pages Overview:</h2>
        <div className={styles.pageIndicators}>
          {reviewData.pageIndicators.map((indicator, index) => (
            <button
              key={indicator.pageId}
              className={`${styles.pageButton} ${currentPage === index ? styles.active : ''}`}
              onClick={() => {
                setCurrentPage(index);
                setEditMode(false);
                setEditableData(null);
              }}
            >
              📄 Page {indicator.pageId} {getPageStatus(indicator)}
            </button>
          ))}
        </div>
      </div>

      {/* Current Page Content */}
      {currentPageData && (
        <div className={styles.pageContent}>
          <div className={styles.pageHeader}>
            <h2>
              Page {currentPageData.pageId}
              <span className={styles.pageStatus}>
                {currentPageIndicator && (
                  <>
                    {getPageStatus(currentPageIndicator)} 
                    ({currentPageIndicator.correctCount}/{currentPageIndicator.totalQuestions} correct)
                  </>
                )}
              </span>
            </h2>
            
            {/* Edit Button - Only show for pages with wrong answers */}
            {!editMode && currentPageIndicator?.needsEdit && (
              <button
                className={styles.editButton}
                onClick={() => enableEditMode(currentPageData.pageId)}
              >
                ✏️ Edit Answers
              </button>
            )}
          </div>

          {/* Questions */}
          <div className={styles.questionsContainer}>
            {currentPageData.components
              ?.filter(comp => comp.type === 'multiple_choice_checkbox' || comp.type === 'fill_blank_question')
              .map((component, index) => renderQuestion(component, index))}
          </div>

          {/* Edit Mode Controls */}
          {editMode && (
            <div className={styles.editControls}>
              <button
                className={styles.saveButton}
                onClick={savePageAnswers}
                disabled={saving}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setEditMode(false);
                  setEditableData(null);
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Page Navigation Controls */}
      <div className={styles.navigationControls}>
        <button
          onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className={styles.navButton}
        >
          ← Previous Page
        </button>
        
        <span className={styles.pageInfo}>
          Page {currentPage + 1} of {reviewData.pageIndicators.length}
        </span>
        
        <button
          onClick={() => setCurrentPage(Math.min(reviewData.pageIndicators.length - 1, currentPage + 1))}
          disabled={currentPage === reviewData.pageIndicators.length - 1}
          className={styles.navButton}
        >
          Next Page →
        </button>
      </div>

      {/* Final Submit Button */}
      {reviewData.summary.pagesNeedingEdit > 0 && (
        <div className={styles.finalSubmitContainer}>
          <h3>Ready to submit your corrections?</h3>
          <p>
            You have {reviewData.summary.pagesNeedingEdit} page(s) with incorrect answers. 
            Make sure to edit all wrong answers before final submission.
          </p>
          <button
            className={styles.finalSubmitButton}
            onClick={finalSubmit}
            disabled={finalSubmitting}
          >
            {finalSubmitting ? 'Submitting...' : '🎯 Final Submit All Corrections'}
          </button>
        </div>
      )}

      {/* Success Message */}
      {reviewData.summary.overallStatus === 'all_correct' && (
        <div className={styles.successMessage}>
          <h3>🎉 Congratulations!</h3>
          <p>All your answers are correct! Great job!</p>
        </div>
      )}
    </div>
  );
};

export default ReviewHomeworkPage;