import React, { useState, useEffect, useRef } from 'react';
import { homeworkAPI } from '../../../utils/homework-api';
import api from '../../../utils/api';
import styles from './HomeworkAssignment.module.css';

const HomeworkAssignment = ({ user }) => {
  console.log('🎯 HomeworkAssignment component loaded with user:', user);
  
  // Form state
  const [formData, setFormData] = useState({
    gradeId: '',
    subjectId: '',
    topicId: '',
    subtopicId: '',
    homeworkId: '',
    classId: '',
    studentIds: [],
    startDate: '',
    dueDate: '',
    notes: ''
  });

  // Data states
  const [formOptions, setFormOptions] = useState({
    grades: [],
    subjects: [],
    topics: [],
    subtopics: [],
    classes: [],
    homeworks: []
  });

  const [filteredOptions, setFilteredOptions] = useState({
    subjects: [],
    topics: [],
    subtopics: [],
    homeworks: [],
    students: []
  });

  // UI states
  const [loading, setLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [assignments, setAssignments] = useState([]);
  const [showAssignments, setShowAssignments] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

  // Refs to prevent duplicate API calls
  const initialLoadRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastClassesRequestRef = useRef(null);
  const lastFormDataRequestRef = useRef(null);
  const lastAssignmentsRequestRef = useRef(null);

  // Load classes for the tutor
  const loadClasses = async () => {
    try {
      // Skip if already loaded
      if (lastClassesRequestRef.current === 'loading' || lastClassesRequestRef.current === 'loaded') {
        console.log('⏭️ Classes already loading or loaded, skipping');
        return;
      }
      
      lastClassesRequestRef.current = 'loading';
      setLoading(true);
      console.log('🔄 Loading classes for tutor');
      const response = await homeworkAPI.getTutorClasses();
      console.log('📊 Raw class response:', response);
      
      if (response?.data?.success && Array.isArray(response.data.data)) {
        const classes = response.data.data;
        console.log('📚 Classes loaded:', classes);
        
        if (classes.length === 0) {
          console.log('ℹ️ No classes found for tutor');
          setMessage({ type: 'info', text: 'No classes found' });
        }

        // Process classes to ensure student count is available
        const processedClasses = classes.map(cls => ({
          ...cls,
          studentCount: (cls.students || []).length,
          title: `${cls.title} (${(cls.students || []).length} students)`
        }));
        
        console.log('📚 Processed classes:', processedClasses);
        
        setFormOptions(prev => ({
          ...prev,
          classes: processedClasses
        }));
        lastClassesRequestRef.current = 'loaded';
      } else {
        console.error('❌ Invalid class data format:', response?.data);
        setMessage({ type: 'error', text: 'Failed to load classes - invalid data format' });
        lastClassesRequestRef.current = null;
      }
    } catch (error) {
      console.error('❌ Failed to load classes:', error);
      setMessage({ type: 'error', text: `Failed to load classes: ${error.message}` });
      lastClassesRequestRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    console.log('🔧 useEffect triggered, user:', user);
    console.log('🔧 user.id exists?', !!user?.id);
    console.log('🔧 user._id exists?', !!user?._id);
    
    // Prevent double calls in Strict Mode
    if (initialLoadRef.current) {
      console.log('🔧 Initial load already completed, skipping');
      return;
    }
    
    if (user?.id || user?._id) {
      console.log('🔧 User ID found, calling loadFormData ONLY (lazy loading enabled)');
      initialLoadRef.current = true;
      loadFormData(); // Only load form data initially
    } else {
      console.log('� No user ID found, skipping data loading');
    }
  }, [user]);

  // Lazy load classes when "Assign Homework" tab is clicked
  useEffect(() => {
    console.log('📌 Lazy load effect - showAssignments:', showAssignments);
    if (!showAssignments && user?.id && initialLoadRef.current) {
      console.log('🔄 User clicked "Assign Homework" tab, loading classes lazily');
      loadClasses();
    }
  }, [showAssignments, user?.id]);

  // Lazy load assignments when "View Assignments" tab is clicked
  useEffect(() => {
    console.log('📌 Lazy load effect - showAssignments:', showAssignments);
    if (showAssignments && user?.id && initialLoadRef.current) {
      console.log('🔄 User clicked "View Assignments" tab, loading assignments lazily');
      loadAssignments();
    }
  }, [showAssignments, user?.id]);

  const loadFormData = async (params = {}) => {
    try {
      setLoading(true);
      console.log('🔄 Loading homework form data with params:', params);
      const response = await homeworkAPI.getAssignmentFormData(params);
      
      // Log the response for debugging
      console.log('Server response:', response.data);
      console.log('📊 Form data response:', response.data);
      
      if (response.data) {
        console.log('📝 Raw form data received:', response.data);
        
        // For initial load, update formOptions
        if (!params.gradeId) {
          const newFormOptions = {
            grades: response.data.data?.grades || [],
            subjects: [],  // These will be populated when grade is selected
            topics: [],
            subtopics: [],
            homeworks: [],
            classes: formOptions.classes // preserve existing classes
          };
          console.log('🔧 Setting form options:', newFormOptions);
          setFormOptions(newFormOptions);
        }
        
        // Update the options based on what data we received
        console.log('📚 Data received:', {
          subjects: response.data?.data?.subjects?.length || 0,
          topics: response.data?.data?.topics?.length || 0
        });
        
        setFilteredOptions(prev => ({
          ...prev,
          subjects: response.data?.data?.subjects || prev.subjects,
          topics: response.data?.data?.topics || prev.topics
        }));
      } else {
        console.error('❌ Invalid response format:', response.data);
        setMessage({ type: 'error', text: 'Invalid response format from server' });
      }
      
      console.log('✅ Form options set:', {
        grades: response.data.grades?.length || 0,
        subjects: response.data.subjects?.length || 0,
        topics: response.data.topics?.length || 0,
        subtopics: response.data.subtopics?.length || 0,
        classes: response.data.classes?.length || 0
      });
      
    } catch (error) {
      console.error('❌ Failed to load form data:', error);
      setMessage({ type: 'error', text: 'Failed to load form data: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    const userId = user?.id || user?._id;
    if (!userId) {
      console.log('❌ No user ID available for loading assignments');
      return;
    }
    
    try {
      // Skip if already loaded
      if (lastAssignmentsRequestRef.current === 'loading' || lastAssignmentsRequestRef.current === 'loaded') {
        console.log('⏭️ Assignments already loading or loaded, skipping');
        return;
      }
      
      lastAssignmentsRequestRef.current = 'loading';
      console.log('🔄 Loading assignments for user ID:', userId);
      console.log('🔄 User object:', user);
      console.log('🔄 AccessToken available:', !!localStorage.getItem('accessToken'));
      console.log('🔄 Legacy token available:', !!localStorage.getItem('token'));
      
      // The API uses the user ID from the auth token, not as a parameter
      const response = await homeworkAPI.getTutorAssignments();
      console.log('📚 Raw assignments response:', response.data);
      console.log('📚 Response status:', response.status);
      console.log('📚 Assignments loaded:', response.data.assignments?.length || 0);
      
      const assignments = response.data.assignments || [];
      console.log('📚 Setting assignments:', assignments);
      setAssignments(assignments);
      lastAssignmentsRequestRef.current = 'loaded';
      
      if (assignments.length > 0) {
        console.log('📚 First assignment example:', assignments[0]);
      } else {
        console.log('⚠️ No assignments found for tutor');
      }
    } catch (error) {
      console.error('❌ Failed to load assignments:', error);
      console.error('❌ Error response status:', error.response?.status);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error message:', error.message);
      setMessage({ type: 'error', text: 'Failed to load assignments: ' + (error.response?.data?.error || error.message) });
      lastAssignmentsRequestRef.current = null;
    }
  };

  // Filter options based on selections
  // Load subjects when grade changes
  useEffect(() => {
    if (formData.gradeId) {
      console.log('🔄 Grade changed, loading subjects for gradeId:', formData.gradeId);
      loadFormData({ gradeId: formData.gradeId });
    }
  }, [formData.gradeId]);

  // Load topics when subject changes
  useEffect(() => {
    if (formData.subjectId && formData.gradeId) {
      console.log('🔄 Subject changed, loading topics');
      loadFormData({ 
        gradeId: formData.gradeId, 
        subjectId: formData.subjectId 
      });
    }
  }, [formData.subjectId, formData.gradeId]);

  useEffect(() => {
    filterTopics();
  }, [formData.subjectId, formOptions.topics]);

  useEffect(() => {
    filterSubtopics();
  }, [formData.topicId, formOptions.subtopics]);

  useEffect(() => {
    loadHomeworks();
  }, [formData.gradeId, formData.subjectId, formData.topicId, formData.subtopicId]);

  useEffect(() => {
    filterStudents();
  }, [formData.classId, formOptions.classes]);

  const filterSubjects = () => {
    if (!formData.gradeId) {
      setFilteredOptions(prev => ({ ...prev, subjects: formOptions.subjects }));
      return;
    }
    // Note: If subjects are grade-specific, add filtering logic here
    setFilteredOptions(prev => ({ ...prev, subjects: formOptions.subjects }));
  };

  const filterTopics = () => {
    if (!formData.subjectId) {
      setFilteredOptions(prev => ({ ...prev, topics: formOptions.topics }));
      return;
    }
    const filtered = formOptions.topics.filter(topic => topic.subjectId === formData.subjectId);
    setFilteredOptions(prev => ({ ...prev, topics: filtered }));
  };

  const filterSubtopics = async () => {
    if (!formData.topicId) {
      setFilteredOptions(prev => ({ ...prev, subtopics: [] }));
      return;
    }
    
    try {
      console.log('🔄 Loading subtopics for topicId:', formData.topicId);
      const response = await homeworkAPI.getAssignmentFormData({
        gradeId: formData.gradeId,
        subjectId: formData.subjectId,
        topicId: formData.topicId
      });
      
      if (response.data?.data?.subtopics) {
        console.log('📚 Subtopics loaded:', response.data.data.subtopics);
        setFilteredOptions(prev => ({ 
          ...prev, 
          subtopics: response.data.data.subtopics 
        }));
      }
    } catch (error) {
      console.error('❌ Failed to load subtopics:', error);
      setMessage({ type: 'error', text: 'Failed to load subtopics' });
      setFilteredOptions(prev => ({ ...prev, subtopics: [] }));
    }
  };

  const loadHomeworks = async () => {
    if (!formData.subtopicId) {
      setFilteredOptions(prev => ({ ...prev, homeworks: [] }));
      return;
    }

    try {
      console.log('🔄 Loading homeworks for subtopicId:', formData.subtopicId);
      const response = await homeworkAPI.getAssignmentFormData({
        gradeId: formData.gradeId,
        subjectId: formData.subjectId,
        topicId: formData.topicId,
        subtopicId: formData.subtopicId
      });

      if (response.data?.data?.homeworks) {
        console.log('📚 Homeworks loaded:', response.data.data.homeworks);
        setFilteredOptions(prev => ({ 
          ...prev, 
          homeworks: response.data.data.homeworks 
        }));
      } else {
        console.log('❌ No homeworks found in response');
        setFilteredOptions(prev => ({ ...prev, homeworks: [] }));
      }
    } catch (error) {
      console.error('❌ Failed to load homeworks:', error);
      setMessage({ type: 'error', text: 'Failed to load homework options' });
      setFilteredOptions(prev => ({ ...prev, homeworks: [] }));
    }
  };

  const filterStudents = () => {
    console.log('🔍 filterStudents called');
    console.log('🔍 formData.classId:', formData.classId);
    console.log('🔍 Available classes:', formOptions.classes);
    
    if (!formData.classId) {
      console.log('🔍 No classId selected, clearing students');
      setFilteredOptions(prev => ({ ...prev, students: [] }));
      return;
    }
    
    const selectedClass = formOptions.classes.find(cls => cls.id === formData.classId);
    console.log('🔍 Selected class:', selectedClass);
    
    if (selectedClass && Array.isArray(selectedClass.students)) {
      const validStudents = selectedClass.students
        .filter(student => student && student.id)
        .map(student => ({
          id: student.id,
          username: student.username || student.fullName,
          email: student.email || '',
          displayName: student.fullName || `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.username || 'Unknown'
        }));
      
      console.log('🔍 Processed students:', validStudents);
      setFilteredOptions(prev => ({ ...prev, students: validStudents }));
    } else {
      console.log('🔍 No valid students found in class');
      setFilteredOptions(prev => ({ ...prev, students: [] }));
    }
  };

  const handleInputChange = async (field, value) => {
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      
      // Reset dependent fields based on what changed
      if (field === 'gradeId') {
        console.log('Grade selected:', value);
        // Don't call loadFormData here - let useEffect handle it
        return {
          ...newFormData,
          subjectId: '',
          topicId: '',
          subtopicId: '',
          homeworkId: ''
        };
      } else if (field === 'subjectId') {
        console.log('Subject selected:', value);
        // Don't call loadFormData here - filtering is handled by useEffect
        return {
          ...newFormData,
          topicId: '',
          subtopicId: '',
          homeworkId: ''
        };
      } else if (field === 'topicId') {
        return {
          ...newFormData,
          subtopicId: '',
          homeworkId: ''
        };
      } else if (field === 'subtopicId') {
        return {
          ...newFormData,
          homeworkId: ''
        };
      } else if (field === 'classId') {
        return {
          ...newFormData,
          studentIds: []
        };
      }
      
      return newFormData;
    });
  };

  const handleViewAssignment = (assignment) => {
    console.log('👁️ Viewing assignment:', assignment);
    // You can implement a modal or navigate to a detailed view
    alert(`Viewing assignment: ${assignment.homework?.homeworkName}\nStudent: ${assignment.student?.fullName}\nStatus: ${assignment.status}`);
  };

  const handleEditAssignment = (assignment) => {
    console.log('✏️ Editing assignment:', assignment);
    console.log('✏️ Assignment homework:', assignment.homework);
    console.log('✏️ Assignment class:', assignment.class);
    console.log('✏️ Assignment student:', assignment.student);
    console.log('✏️ Assignment dates and notes:', {
      startDate: assignment.startDate,
      dueDate: assignment.dueDate,
      notes: assignment.notes
    });
    
    // Extract IDs from the populated data
    const gradeId = assignment.homework?.gradeId?._id || assignment.homework?.gradeId || '';
    const subjectId = assignment.homework?.subjectId?._id || assignment.homework?.subjectId || '';
    const topicId = assignment.homework?.topicId?._id || assignment.homework?.topicId || '';
    const subtopicId = assignment.homework?.subtopicId?._id || assignment.homework?.subtopicId || '';
    const homeworkId = assignment.homework?._id || assignment.homeworkId || '';
    const classId = assignment.class?._id || assignment.class?.id || assignment.classId || '';
    const studentId = assignment.student?._id || assignment.student?.id || assignment.studentId || '';
    
    console.log('✏️ Extracted IDs:', {
      gradeId, subjectId, topicId, subtopicId, homeworkId, classId, studentId
    });
    
    const newFormData = {
      gradeId,
      subjectId,
      topicId,
      subtopicId,
      homeworkId,
      classId,
      studentIds: studentId ? [studentId] : [],
      startDate: assignment.startDate ? new Date(assignment.startDate).toISOString().split('T')[0] : '',
      dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : '',
      notes: assignment.notes || ''
    };
    
    console.log('✏️ Setting form data:', newFormData);
    setFormData(newFormData);
    
    // Manually trigger filtering for all dependent dropdowns after form data is set
    setTimeout(() => {
      console.log('✏️ Triggering filters after form data set');
      // Filter subjects based on grade
      if (gradeId) {
        const filteredSubjects = formOptions.subjects.filter(subject => 
          subject.gradeId === gradeId || subject.gradeId?._id === gradeId
        );
        console.log('✏️ Filtered subjects:', filteredSubjects);
        
        // Filter topics based on subject
        if (subjectId) {
          const filteredTopics = formOptions.topics.filter(topic => 
            topic.subjectId === subjectId || topic.subjectId?._id === subjectId
          );
          console.log('✏️ Filtered topics:', filteredTopics);
          
          // Filter subtopics based on topic
          if (topicId) {
            const filteredSubtopics = formOptions.subtopics.filter(subtopic => 
              subtopic.topicId === topicId || subtopic.topicId?._id === topicId
            );
            console.log('✏️ Filtered subtopics:', filteredSubtopics);
            
            setFilteredOptions(prev => ({
              ...prev,
              subjects: filteredSubjects,
              topics: filteredTopics,
              subtopics: filteredSubtopics
            }));
            
            // Load homeworks after all filtering is complete
            if (subtopicId) {
              console.log('✏️ Loading homeworks with params:', { gradeId, subjectId, topicId, subtopicId });
              // Load homeworks with a slight delay to ensure form data is fully set
              setTimeout(async () => {
                try {
                  const response = await homeworkAPI.getHomeworkList({
                    gradeId: gradeId,
                    subjectId: subjectId,
                    topicId: topicId,
                    subtopicId: subtopicId
                  });
                  console.log('✏️ Homework options loaded:', response.data.homeworks);
                  setFilteredOptions(prev => ({
                    ...prev,
                    homeworks: response.data.homeworks || []
                  }));
                } catch (error) {
                  console.error('❌ Failed to load homework options for edit:', error);
                }
              }, 100);
            }
          } else {
            setFilteredOptions(prev => ({
              ...prev,
              subjects: filteredSubjects,
              topics: filteredTopics,
              subtopics: []
            }));
          }
        } else {
          setFilteredOptions(prev => ({
            ...prev,
            subjects: filteredSubjects,
            topics: [],
            subtopics: []
          }));
        }
      }
      
      // Filter students based on class
      if (classId) {
        const selectedClass = formOptions.classes.find(cls => 
          cls._id === classId || cls.id === classId
        );
        if (selectedClass) {
          setFilteredOptions(prev => ({
            ...prev,
            students: selectedClass.students || []
          }));
        }
      }
    }, 200);
    
    // Switch to the assignment form
    setShowAssignments(false);
    setIsEditMode(true); // Enable edit mode
    setEditingAssignmentId(assignment._id || assignment.id); // Store assignment ID for updating
    setMessage({ type: 'info', text: `Assignment loaded for editing: ${assignment.homework?.homeworkName}` });
  };

  const handleCancelAssignment = async (assignment, studentId) => {
    console.log('❌ Cancelling assignment:', assignment, 'for student:', studentId);
    
    const confirmMessage = `Are you sure you want to cancel the assignment "${assignment.homework_name}" for this student?`;
    
    if (!window.confirm(confirmMessage)) {
        return;
    }
    
    try {
        // Cancel for specific student
        await api.put(`/homework-assignments/${assignment.assignment_id}/cancel-for-student/${studentId}`);
        setMessage({ type: 'success', text: 'Assignment cancelled for student successfully' });
        lastAssignmentsRequestRef.current = null; // Reset cache
        loadAssignments(); // Refresh the list with fresh data
    } catch (error) {
      console.error('❌ Failed to cancel assignment:', error);
      setMessage({ type: 'error', text: 'Failed to cancel assignment: ' + (error.response?.data?.error || error.message) });
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    console.log('�️ Deleting assignment:', assignment);
    
    if (!window.confirm(`Are you sure you want to permanently delete the assignment "${assignment.homework?.homeworkName}" for ${assignment.student?.fullName}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Use the cancel/delete assignment API
      await homeworkAPI.cancelAssignment(assignment._id);
      setMessage({ type: 'success', text: 'Assignment deleted successfully' });
      lastAssignmentsRequestRef.current = null; // Reset cache
      loadAssignments(); // Refresh the list with fresh data
    } catch (error) {
      console.error('❌ Failed to delete assignment:', error);
      setMessage({ type: 'error', text: 'Failed to delete assignment: ' + (error.response?.data?.error || error.message) });
    }
  };

  const handleStatusUpdate = async (assignmentId, newStatus) => {
    try {
      await homeworkAPI.updateAssignmentStatus(assignmentId, { status: newStatus });
      setMessage({ type: 'success', text: 'Assignment status updated successfully' });
      lastAssignmentsRequestRef.current = null; // Reset cache
      loadAssignments(); // Refresh the list with fresh data
    } catch (error) {
      console.error('❌ Failed to update assignment status:', error);
      setMessage({ type: 'error', text: 'Failed to update status: ' + (error.response?.data?.error || error.message) });
    }
  };

  const handleStudentSelection = (studentId) => {
    setFormData(prev => {
      const newStudentIds = prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId];
      
      return { ...prev, studentIds: newStudentIds };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all required fields
    if (!formData.gradeId || !formData.subjectId || !formData.topicId || 
        !formData.subtopicId || !formData.homeworkId || !formData.classId || 
        formData.studentIds.length === 0) {
      setMessage({ 
        type: 'error', 
        text: 'Please fill all required fields (Grade, Subject, Topic, Subtopic, Homework, Class) and select at least one student' 
      });
      return;
    }

    try {
      setAssignmentLoading(true);
      
      let response;
      if (isEditMode && editingAssignmentId) {
        // Update existing assignment - only send startDate, dueDate, and notes
        const updateData = {
          startDate: formData.startDate || null,
          dueDate: formData.dueDate || null,
          notes: formData.notes || ''
        };
        response = await homeworkAPI.updateAssignment(editingAssignmentId, updateData);
        setMessage({ 
          type: 'success', 
          text: response.data.message || 'Assignment updated successfully!' 
        });
      } else {
        // Create new assignment
        const assignmentData = {
          gradeId: formData.gradeId,
          subjectId: formData.subjectId,
          topicId: formData.topicId,
          subtopicId: formData.subtopicId,
          homeworkId: formData.homeworkId,
          classId: formData.classId,
          studentIds: formData.studentIds,
          assignmentType: 'homework',
          status: 'assigned',
          isActive: true,
          assignedBy: user.id,
          startDate: formData.startDate || new Date().toISOString(),
          dueDate: formData.dueDate || null,
          notes: formData.notes || '',
          submissionData: {},
          instructions: ''
        };
        
        response = await homeworkAPI.assignHomework(assignmentData);
        setMessage({ 
          type: 'success', 
          text: response.data.message || 'Homework assigned successfully!' 
        });
      }
      
      // Reset form and edit state
      setFormData({
        gradeId: '',
        subjectId: '',
        topicId: '',
        subtopicId: '',
        homeworkId: '',
        classId: '',
        studentIds: [],
        startDate: '',
        dueDate: '',
        notes: ''
      });
      setIsEditMode(false);
      setEditingAssignmentId(null);
      
      // Reset cache and reload assignments to show updated list
      lastAssignmentsRequestRef.current = null;
      await loadAssignments();
      setShowAssignments(true);
      
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || (isEditMode ? 'Failed to update assignment' : 'Failed to assign homework')
      });
    } finally {
      setAssignmentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading homework assignment form...</p>
      </div>
    );
  }

  return (
    <div className={styles.homeworkAssignment}>
      {message.text && (
        <div className={`${styles.message} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      <div className={styles.tabs}>
        <button 
          className={`${styles.tabButton} ${!showAssignments ? styles.active : ''}`}
          onClick={() => {
            setShowAssignments(false);
            setIsEditMode(false); // Reset edit mode when going to assign tab
            setEditingAssignmentId(null); // Clear editing assignment ID
            // Always clear form data when clicking "Assign Homework"
            console.log('🧹 Clearing form data for new assignment');
            setFormData({
              gradeId: '',
              subjectId: '',
              topicId: '',
              subtopicId: '',
              homeworkId: '',
              classId: '',
              studentIds: [],
              startDate: '',
              dueDate: '',
              notes: ''
            });
            // Reset filtered options to initial state
            setFilteredOptions({
              subjects: [],
              topics: [],
              subtopics: [],
              homeworks: [],
              students: []
            });
            setMessage({ type: '', text: '' });
          }}
        >
          {isEditMode ? 'Edit Assignment' : 'Assign Homework'}
        </button>
        <button 
          className={`${styles.tabButton} ${showAssignments ? styles.active : ''}`}
          onClick={() => {
            console.log('🔄 Switching to View Assignments tab');
            setShowAssignments(true);
            setIsEditMode(false); // Reset edit mode when viewing assignments
            // The useEffect will automatically load assignments when showAssignments becomes true
          }}
        >
          View Assignments ({assignments.length})
        </button>
      </div>

      {!showAssignments ? (
        <div className={styles.assignmentForm}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              {/* Grade Selection */}
              <div className={styles.formGroup}>
                <label>Grade *</label>
                <select 
                  value={formData.gradeId} 
                  onChange={(e) => handleInputChange('gradeId', e.target.value)}
                  required
                >
                  <option value="">Select Grade</option>
                  {formOptions.grades.map(grade => (
                    <option key={grade.id} value={grade.id}>{grade.grade_name}</option>
                  ))}
                </select>
              </div>

              {/* Subject Selection */}
              <div className={styles.formGroup}>
                <label>Subject *</label>
                <select 
                  value={formData.subjectId} 
                  onChange={(e) => handleInputChange('subjectId', e.target.value)}
                  required
                  disabled={!formData.gradeId}
                >
                  <option value="">Select Subject</option>
                  {filteredOptions.subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.subjectName}</option>
                  ))}
                </select>
              </div>

              {/* Topic Selection */}
              <div className={styles.formGroup}>
                <label>Topic *</label>
                <select 
                  value={formData.topicId} 
                  onChange={(e) => handleInputChange('topicId', e.target.value)}
                  required
                  disabled={!formData.subjectId}
                >
                  <option value="">Select Topic</option>
                  {filteredOptions.topics.map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.topicName}</option>
                  ))}
                </select>
              </div>

              {/* Subtopic Selection */}
              <div className={styles.formGroup}>
                <label>Subtopic *</label>
                <select 
                  value={formData.subtopicId} 
                  onChange={(e) => handleInputChange('subtopicId', e.target.value)}
                  required
                  disabled={!formData.topicId}
                >
                  <option value="">Select Subtopic</option>
                  {filteredOptions.subtopics.map(subtopic => (
                    <option key={subtopic.id} value={subtopic.id}>{subtopic.subtopicName}</option>
                  ))}
                </select>
              </div>

              {/* Homework Selection */}
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label>Homework *</label>
                <select 
                  value={formData.homeworkId} 
                  onChange={(e) => handleInputChange('homeworkId', e.target.value)}
                  required
                  disabled={!formData.subtopicId}
                >
                  <option value="">Select Homework</option>
                  {filteredOptions.homeworks.map(homework => (
                    <option key={homework.id} value={homework.id}>
                      {homework.homeworkName || homework.homework_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Selection */}
              <div className={styles.formGroup}>
                <label>Class *</label>
                <select 
                  value={formData.classId} 
                  onChange={(e) => {
                    console.log('🎯 Class selected:', e.target.value);
                    console.log('🎯 Available classes for debugging:', formOptions.classes);
                    handleInputChange('classId', e.target.value);
                  }}
                  required
                >
                  <option value="">Select Class</option>
                  {Array.isArray(formOptions.classes) && formOptions.classes.length > 0 ? (
                    formOptions.classes.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {`${cls.title} (${cls.studentCount || 0})`}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>{loading ? 'Loading classes...' : 'No classes available'}</option>
                  )}
                </select>
                {message.text && message.type === 'error' && (
                  <div className={styles.errorMessage}>{message.text}</div>
                )}
              </div>

              {/* Start Date */}
              <div className={styles.formGroup}>
                <label>Start Date (Optional)</label>
                <input 
                  type="date" 
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                />
              </div>

              {/* Due Date */}
              <div className={styles.formGroup}>
                <label>Due Date (Optional)</label>
                <input 
                  type="date" 
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                />
              </div>
            </div>

            {/* Student Selection */}
            {formData.classId && (
              <div className={styles.studentSelection}>
                <label>
                  Select Students * 
                  {isEditMode && (
                    <span className={styles.editModeNote}>(Cannot change students when editing)</span>
                  )}
                </label>
                <div className={styles.studentCount}>
                  {filteredOptions.students.length} students available
                </div>
                <div className={styles.studentList}>
                  {filteredOptions.students.length === 0 ? (
                    <p>No students found in this class</p>
                  ) : (
                    filteredOptions.students.map(student => {
                      const studentId = student.id;
                      console.log('🎯 Student details for display:', student);
                      return (
                        <div key={studentId} className={`${styles.studentItem} ${isEditMode ? styles.disabled : ''}`}>
                          <input
                            type="checkbox"
                            id={`student-${studentId}`}
                            checked={formData.studentIds.includes(studentId)}
                            onChange={() => !isEditMode && handleStudentSelection(studentId)}
                            disabled={isEditMode}
                          />
                          <label htmlFor={`student-${studentId}`} className={styles.studentLabel}>
                            {student.displayName}
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className={styles.formGroup}>
              <label>Notes (Optional)</label>
              <textarea 
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Add any additional notes for students..."
                rows="3"
              />
            </div>

            <div className={styles.formActions}>
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={assignmentLoading}
              >
                {assignmentLoading 
                  ? (isEditMode ? 'Updating...' : 'Assigning...') 
                  : (isEditMode ? 'Update Assignment' : 'Assign Homework')
                }
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className={styles.assignmentsList}>
          <h3>Your Homework Assignments</h3>
          
          {assignments.length === 0 ? (
            <div className={styles.noAssignments}>
              <p>No homework assignments created yet.</p>
              <p>Create some assignments using the form above to see them here.</p>
            </div>
          ) : (
            <div className={styles.assignmentsTable}>
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Student</th>
                    <th>Grade</th>
                    <th>Subject</th>
                    <th>Topic</th>
                    <th>Subtopic</th>
                    <th>Homework</th>
                    <th>Status</th>
                    <th>Start Date</th>
                    <th>Due Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(assignment => (
                    <tr key={`${assignment.assignment_id}-${assignment.student_id}`}>
                      <td>{assignment.class_name || '-'}</td>
                      <td>{assignment.student_name || '-'}</td>
                      <td>{assignment.grade_name || '-'}</td>
                      <td>{assignment.subject_name || '-'}</td>
                      <td>{assignment.topic_name || '-'}</td>
                      <td>{assignment.subtopic_name || '-'}</td>
                      <td>{assignment.homework_name || '-'}</td>
                      <td>
                        <div className={styles.statusContainer}>
                          <span className={`${styles.status} ${styles[assignment.submission_status || 'pending']}`}>
                            {(assignment.submission_status || 'Pending').charAt(0).toUpperCase() + 
                             (assignment.submission_status || 'Pending').slice(1)}
                          </span>
                          {!assignment.is_active && (
                            <span className={`${styles.status} ${styles.cancelled}`}>
                              (Cancelled)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {assignment.start_date 
                          ? new Date(assignment.start_date).toLocaleDateString('en-US', {
                              day: '2-digit', 
                              month: 'short',
                              year: 'numeric'
                            })
                          : '-'}
                      </td>
                      <td>
                        {assignment.due_date 
                          ? new Date(assignment.due_date).toLocaleDateString('en-US', {
                              day: '2-digit',
                              month: 'short', 
                              year: 'numeric'
                            })
                          : '-'}
                      </td>
                      <td className={styles.actionsCell}>
                        <button 
                          className={styles.actionButton}
                          onClick={() => handleViewAssignment(assignment)}
                          title="View assignment details"
                        >
                          View
                        </button>
                        <button 
                          className={styles.actionButton}
                          onClick={() => handleEditAssignment(assignment)}
                          title="Edit assignment"
                        >
                          Edit
                        </button>
                        {assignment.is_active && (
                          <button 
                            className={styles.actionButtonDanger}
                            onClick={() => handleCancelAssignment(assignment, assignment.student_id)}
                            title="Cancel assignment for this student"
                          >
                            Cancel
                          </button>
                        )}
                        {!assignment.is_active && (
                          <button 
                            className={styles.actionButtonDanger}
                            onClick={() => handleDeleteAssignment(assignment)}
                            title="Delete assignment permanently"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomeworkAssignment;