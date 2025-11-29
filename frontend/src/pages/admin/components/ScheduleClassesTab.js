import React, { useState, useEffect } from 'react';
import { getStoredToken } from '../../../utils/helpers';
import api from '../../../utils/api';
import styles from './ScheduleClassesTab.module.css';
import TutorSelectionModal from '../../../components/TutorSelectionModal';
import StudentSelectionModal from '../../../components/StudentSelectionModal';
import SubjectDropdown from '../../../components/SubjectDropdown';
import { getTimezoneDisplayString } from '../../../utils/timezoneUtils';
import {
  checkTutorTimeConflicts,
  checkStudentTimeConflicts,
  generateConflictMessages
} from '../../../utils/scheduleValidation';
import { parseStartTime } from '../../../utils/timeParser';
import SCHEDULE_CONFIG from '../../../config/schedule';
import { getMinScheduleDate } from '../../../utils/dateUtils';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h4>Error displaying class details</h4>
          <p>{this.state.error?.message}</p>
          <p>Please try again or contact support.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const ScheduleClassesTab = () => {
  // Safe date formatting helper functions
  const formatDateSafely = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date value:', dateValue);
        return '';
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Error formatting date:', dateValue, error);
      return '';
    }
  };

  const formatDateTimeSafely = (dateValue) => {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        console.warn('Invalid datetime value:', dateValue);
        return null;
      }
      return date.toISOString();
    } catch (error) {
      console.warn('Error formatting datetime:', dateValue, error);
      return null;
    }
  };

  const calculateEndTimeSafely = (startTime, duration) => {
    if (!startTime || !duration) return null;
    try {
      // support startTime being a time-only string by using parseStartTime when needed
      const start = (typeof startTime === 'string' && startTime.match(/^\s*\d{1,2}:\d{2}\s*$/))
        ? parseStartTime({ startTime })
        : new Date(startTime);
      if (isNaN(start.getTime())) {
        console.warn('Invalid start time:', startTime);
        return null;
      }
      const endTime = new Date(start.getTime() + duration * 60000);
      return endTime.toISOString();
    } catch (error) {
      console.warn('Error calculating end time:', startTime, duration, error);
      return null;
    }
  };

  // Debug function
  const handleDebug = () => {
    console.clear(); // Clear console
    console.log('%c===== DEBUG INFO =====', 'background: #333; color: #fff; padding: 4px; font-size: 16px;');
    console.log('Current Classes:', classes);
    console.log('Current Filters:', filters);
    console.log('Current Page:', currentPage);
    console.log('Loading State:', loading);
    console.log('%c===================', 'background: #333; color: #fff; padding: 4px; font-size: 16px;');
  };

  console.log('🚀 ScheduleClassesTab component mounted');
  
  const [classes, setClasses] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tutorsLoading, setTutorsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showTutorSelectionModal, setShowTutorSelectionModal] = useState(false);
  const [showStudentSelectionModal, setShowStudentSelectionModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(''); // Track subject ID for dropdown
  
const getCurrentTimeString = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`; // Format: "14:05"
};


  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '', // Will store subject ID
    tutor: '',
    students: [],
    maxCapacity: 10,
    startTime: getCurrentTimeString(),
    duration: 35,
    customDuration: '',
    scheduleType: 'one-time',
    classDate: '',
    recurringDays: [],
    startDate: '',
    endDate: '',
    notes: '',
    paymentStatus: 'unpaid',
    amount: '',
    currency: 'USD'
  });

console.log('Initial formData.startTime', formData.startTime);

  
  // Schedule validation state
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    subject: 'all',
    tutorId: '',
    student: '',
    scheduleType: 'all'
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClasses, setTotalClasses] = useState(0);
  const itemsPerPage = 5;

  // Duration options
  const durationOptions = [
    { value: 30, label: '30 minutes' },
    { value: 35, label: '35 minutes' },
    { value: 45, label: '45 minutes' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' }
  ];

  // Days of week
  const weekDays = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  // Helper function to get subject name by ID
  const getSubjectName = (subjectId) => {
    if (!subjectId || !subjects.length) return 'N/A';
    const subject = subjects.find(s => s._id === subjectId);
    return subject ? subject.subjectName : subjectId;
  };

  // Load initial data - use ref to prevent double calls in Strict Mode
  const initialLoadDone = React.useRef(false);
  
  useEffect(() => {
    // Prevent running twice in Strict Mode
    if (initialLoadDone.current) {
      return;
    }
    initialLoadDone.current = true;

    console.log('🎯 useEffect triggered - loading initial data');
    
    // Check authentication first
    const token = getStoredToken();
    console.log('🔑 Token check:', token ? '✅ Found' : '❌ Missing');
    
    if (!token) {
      console.log('❌ No token found, setting error');
      setError('Please login first. No authentication token found.');
      setLoading(false);
      return;
    }

    console.log('🚀 Starting to load data: classes and subjects');
    
    // Load classes and subjects initially
    loadClasses();
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setSubjectsLoading(true);
      console.log('=== LOADING SUBJECTS ===');
      
      // Get user data for context
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (!userData) {
        setError('Please log in again. User information is missing.');
        console.error('❌ No userData found in localStorage.');
        return;
      }
      console.log('👤 User context:', {
        id: userData?._id,
        role: userData?.role,
        centerId: userData?.centerId,
        assignments: userData?.assignments
      });
      
      // Load subjects directly without duplicate /auth/me call
      const response = await api.get('/dashboard/admin/subjects');
      const subjectsList = response.data.subjects || [];
      
      // Log found subjects
      console.log('📚 Available subjects:', subjectsList.map(s => ({
        id: s._id,
        name: s.subjectName,
        code: s.subjectCode,
        centerId: s.centerId
      })));
      
      // Log detailed subject information
      console.log('📋 Loaded subjects:', subjectsList.map(subject => ({
        id: subject._id,
        name: subject.subjectName,
        code: subject.subjectCode,
        grade: subject.gradeId?.gradeName,
        center: subject.centerId
      })));
      
      setSubjects(subjectsList);
      console.log(`✅ Loaded ${subjectsList.length} subjects`);
    } catch (error) {
      console.error('Load subjects error:', error);
      setError('Failed to load subjects: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubjectsLoading(false);
    }
  };

  // Reload classes when page or filters change
  useEffect(() => {
    if (getStoredToken()) {
      loadClasses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  // Auto-refresh dashboard every 5 minutes to reflect auto-updated class statuses
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      console.log('🔄 AUTO-REFRESH: Refreshing class statuses (every 5 minutes)');
      loadClasses();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadClasses = async () => {
    console.log('🔄 loadClasses called - fetching updated class list');
    console.log('Current filters:', filters);
    console.log('Current page:', currentPage);
    try {
      setLoading(true);
      
      // Build query parameters, excluding empty and 'all' values
      const filteredParams = Object.entries(filters)
        .filter(([_, v]) => v !== '' && v !== 'all')
        .reduce((acc, [k, v]) => {
          acc[k] = v;
          return acc;
        }, {});
      
      const queryParams = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        ...filteredParams
      });

      const response = await api.get(`/classes?${queryParams}`);

      console.log('Classes API response status:', response.status);
      console.log('Classes API response data:', response.data);

      if (response.data.success) {
        // Handle both response formats
        const classes = response.data.data?.classes || [];
        const pagination = response.data.data?.pagination || { pages: 1, total: classes.length };
        
        console.log('📊 Classes received:', classes.length);
        console.log('📊 Classes data:', classes.map(c => ({ 
          id: c.id,
          title: c.title,
          subject: c.subject,
          createdAt: c.createdAt
        })));
        console.log('📊 First class id:', classes[0]?.id);
        
        // Debug: Check all classes for valid IDs
        const classesWithoutId = classes.filter(cls => !cls.id);
        if (classesWithoutId.length > 0) {
          console.error('❌ Classes without valid ID found:', classesWithoutId);
        }
        
        // Debug: Log ID types for all classes
        classes.forEach((cls, index) => {
          console.log(`📋 Class ${index}: id=${cls.id}, title=${cls.title}`);
          console.log(`📋   Students: ${cls.students?.length || 0}`, cls.students);
          console.log(`📋   StudentDetails: ${cls.studentDetails?.length || 0}`, cls.studentDetails);
          if (cls.tutor) {
            console.log(`📋   Tutor: ${cls.tutor.firstName} ${cls.tutor.lastName}`);
            console.log(`📋   Tutor has tutorProfile:`, !!cls.tutor.tutorProfile);
            console.log(`📋   Tutor availability:`, cls.tutor.tutorProfile?.availability);
          }
        });
        
        // Update state with the classes and pagination data
        setClasses(classes);
        setTotalPages(pagination.pages);
        setTotalClasses(pagination.total);
        
        // Log the state updates
        console.log('Updated state:', {
          classes: classes.length,
          pages: pagination.pages,
          total: pagination.total
        });
        setError(''); // Clear any previous errors
      } else {
        const errorMsg = response.data.error || 'Failed to load classes';
        console.error('Classes API error:', errorMsg);
        setError(errorMsg);
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          setError('Authentication failed. Please login again.');
          // Optionally redirect to login
          // window.location.href = '/login';
        }
      }
    } catch (error) {
      console.error('Load classes error:', error);
      setError('Failed to load classes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTutors = async () => {
    try {
      setTutorsLoading(true);
      const token = getStoredToken();
      
      if (!token) {
        console.error('No token found for tutors request');
        setError('Authentication required. Please login again.');
        return;
      }

      console.log('Loading tutors with token:', token.substring(0, 30) + '...');

      const backendUrl = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
      const response = await fetch(`${backendUrl}/api/tutors?page=1&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Tutors API response status:', response.status);
      const data = await response.json();
      console.log('Tutors response:', data);
      
      if (response.ok && data.success) {
        const tutorsList = data.data?.tutors || data.data || [];
        setTutors(tutorsList);
        console.log(`✅ Loaded ${tutorsList.length} tutors`);
      } else {
        const errorMsg = data.error || data.message || 'Failed to load tutors';
        console.error('❌ Failed to load tutors:', errorMsg);
        
        if (response.status === 401) {
          setError('Authentication failed. Please login again.');
        } else {
          setError('Failed to load tutors: ' + errorMsg);
        }
      }
    } catch (error) {
      console.error('Load tutors error:', error);
      setError('Failed to load tutors: ' + error.message);
    } finally {
      setTutorsLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      setStudentsLoading(true);
      const token = getStoredToken();
      
      if (!token) {
        console.error('No token found for students request');
        setError('Authentication required. Please login again.');
        return;
      }

      console.log('Loading students with token:', token.substring(0, 30) + '...');

      const response = await fetch('http://localhost:5000/api/students?page=1&limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Students API response status:', response.status);
      const data = await response.json();
      console.log('Students response:', data);
      
      if (response.ok && data.success) {
        const studentsList = data.data?.students || data.data || [];
        setStudents(studentsList);
        console.log(`✅ Loaded ${studentsList.length} students`);
      } else {
        const errorMsg = data.error || data.message || 'Failed to load students';
        console.error('❌ Failed to load students:', errorMsg);
        
        if (response.status === 401) {
          setError('Authentication failed. Please login again.');
        } else {
          setError('Failed to load students: ' + errorMsg);
        }
      }
    } catch (error) {
      console.error('Load students error:', error);
      setError('Failed to load students: ' + error.message);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let newFormData = { ...formData };
    
    // Special handling for subject selection
    if (name === 'subject') {
      console.log('🎯 Subject selection:', { 
        selectedId: value,
        availableSubjects: subjects.map(s => ({
          id: s._id,
          name: s.subjectName,
          code: s.subjectCode,
          center: s.centerId
        }))
      });
      
      // Handle empty value (when "Select subject" is selected or cleared)
      if (!value || value === '') {
        console.log('✅ Clearing subject selection');
        newFormData.subject = '';
        setSelectedSubjectId('');
        setError(''); // Clear any previous errors
      } else {
        const selectedSubject = subjects.find(s => s._id === value);
        
        if (selectedSubject) {
        console.log('✅ Setting subject:', {
          id: selectedSubject._id,
          name: selectedSubject.subjectName,
          code: selectedSubject.subjectCode,
          center: selectedSubject.centerId
        });
        newFormData.subject = selectedSubject.subjectName; // Use the subject name for form submission
        setSelectedSubjectId(selectedSubject._id); // Track the ObjectId for dropdown
        setError(''); // Clear any previous errors
      } else {
        console.warn('⚠️ Subject not found in list:', value);
        newFormData.subject = '';
        setSelectedSubjectId('');
        setError('Invalid subject selection');
      }
      }
    } else if (type === 'checkbox' && name === 'students') {
      const studentId = value;
      newFormData = {
        ...newFormData,
        students: checked 
          ? [...newFormData.students, studentId]
          : newFormData.students.filter(id => id !== studentId)
      };
    } else if (type === 'checkbox' && name === 'recurringDays') {
      const day = value;
      newFormData = {
        ...newFormData,
        recurringDays: checked
          ? [...newFormData.recurringDays, day]
          : newFormData.recurringDays.filter(d => d !== day)
      };
    } else if (name === 'tutor') {
      // Handle basic tutor selection from dropdown
      newFormData = {
        ...newFormData,
        [name]: value
      };
      
      // Clear advanced selection if basic selection is used
      if (value) {
        const basicSelectedTutor = tutors.find(t => t._id === value);
        if (basicSelectedTutor) {
          setSelectedTutor(basicSelectedTutor);
        }
      } else {
        setSelectedTutor(null);
      }
    } else {
      newFormData = {
        ...newFormData,
        [name]: value
      };
    }
    
    setFormData(newFormData);
    
    // Trigger validation for time-sensitive fields
    if (['startTime', 'duration', 'customDuration', 'classDate', 'scheduleType'].includes(name)) {
      // Use timeout to ensure state is updated before validation
      setTimeout(() => validateScheduleConflicts(newFormData), 100);
    }
  };

  // Handle tutor selection from advanced modal
  const handleTutorSelection = (tutor) => {
    setSelectedTutor(tutor);
    setFormData(prev => ({
      ...prev,
      tutor: tutor._id
    }));
    
    // Trigger validation after tutor selection
    setTimeout(() => validateScheduleConflicts(), 100);
  };

  // Reset tutor selection
  const resetTutorSelection = () => {
    setSelectedTutor(null);
    setFormData(prev => ({
      ...prev,
      tutor: ''
    }));
  };

  // Handle student selection from advanced modal
  const handleStudentSelection = (selectedStudents) => {
    console.log('👥 handleStudentSelection called with:', selectedStudents);
    selectedStudents.forEach((student, index) => {
      console.log(`👥 Student ${index}:`, student);
      console.log(`👥 Student profile:`, student.studentProfile);
      console.log(`👥 Academic info:`, student.studentProfile?.academicInfo);
      console.log(`👥 Subjects:`, student.studentProfile?.academicInfo?.subjects);
      console.log(`👥 Preferred subjects:`, student.studentProfile?.academicInfo?.preferredSubjects);
      console.log(`👥 Struggling subjects:`, student.studentProfile?.academicInfo?.strugglingSubjects);
    });
    
    setFormData(prev => ({
      ...prev,
      students: selectedStudents.map(student => student.id)
    }));
  };

  // Remove individual student
  const handleRemoveStudent = (studentIdToRemove) => {
    setFormData(prev => ({
      ...prev,
      students: prev.students.filter(studentId => studentId !== studentIdToRemove)
    }));
  };

  // Check availability conflicts between tutor and students
  const checkAvailabilityConflicts = () => {
    if (!selectedTutor || !formData.startTime || !formData.scheduleType) {
      return { hasConflicts: false, conflicts: [] };
    }

    const conflicts = [];
    const classStartTime = formData.startTime;
    const classDuration = formData.customDuration || formData.duration;
    
    // Calculate class end time
    const [hours, minutes] = classStartTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + classDuration * 60000);
    const classEndTime = endDate.toTimeString().slice(0, 5);

    // Get the day of the week for the class
    let classDays = [];
    if (formData.scheduleType === 'one-time' && formData.classDate) {
      try {
        const classDate = new Date(formData.classDate);
        if (!isNaN(classDate.getTime())) {
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          classDays = [dayNames[classDate.getDay()]];
        } else {
          console.warn('Invalid class date for validation:', formData.classDate);
        }
      } catch (error) {
        console.warn('Error parsing class date:', formData.classDate, error);
      }
    } else if (formData.scheduleType === 'weekly-recurring' && formData.recurringDays) {
      classDays = formData.recurringDays.map(day => day.toLowerCase());
    }

    // Check tutor availability
    classDays.forEach(day => {
      const tutorAvailability = selectedTutor.tutorProfile?.availability?.[day];
      if (tutorAvailability && tutorAvailability.available) {
        // For tutors, check if class time falls within their availability window
        if (tutorAvailability.start && tutorAvailability.end) {
          if (classStartTime < tutorAvailability.start || classEndTime > tutorAvailability.end) {
            conflicts.push({
              type: 'tutor',
              name: `${selectedTutor.firstName} ${selectedTutor.lastName}`,
              day: day,
              issue: `Not available ${classStartTime}-${classEndTime} (available ${tutorAvailability.start}-${tutorAvailability.end})`
            });
          }
        }
      } else {
        conflicts.push({
          type: 'tutor',
          name: `${selectedTutor.firstName} ${selectedTutor.lastName}`,
          day: day,
          issue: `Not available on ${day}`
        });
      }
    });

    // Check student availability
    const selectedStudentObjects = students.filter(s => formData.students.includes(s._id));
    selectedStudentObjects.forEach(student => {
      classDays.forEach(day => {
        const studentAvailability = student.studentProfile?.availability?.[day];
        if (studentAvailability && studentAvailability.available) {
          let hasOverlap = false;

          // Check new format with start/end times (like tutors)
          if (studentAvailability.start && studentAvailability.end) {
            if (classStartTime >= studentAvailability.start && classEndTime <= studentAvailability.end) {
              hasOverlap = true;
            }
          }
          // Check old format with timeSlots array
          else if (studentAvailability.timeSlots && studentAvailability.timeSlots.length > 0) {
            hasOverlap = studentAvailability.timeSlots.some(slot => {
              if (typeof slot === 'string' && slot.includes('-')) {
                const [slotStart, slotEnd] = slot.split('-');
                if (slotStart && slotEnd) {
                  return !(classEndTime <= slotStart || classStartTime >= slotEnd);
                }
              }
              return false;
            });
          }

          if (!hasOverlap) {
            const availabilityInfo = studentAvailability.start && studentAvailability.end
              ? `available ${studentAvailability.start}-${studentAvailability.end}`
              : studentAvailability.timeSlots
                ? `available slots: ${studentAvailability.timeSlots.join(', ')}`
                : 'no specific time slots defined';
                
            conflicts.push({
              type: 'student',
              name: `${student.firstName} ${student.lastName}`,
              day: day,
              issue: `No availability overlap with ${classStartTime}-${classEndTime} (${availabilityInfo})`
            });
          }
        } else {
          conflicts.push({
            type: 'student',
            name: `${student.firstName} ${student.lastName}`,
            day: day,
            issue: `Not available on ${day}`
          });
        }
      });
    });

    return { hasConflicts: conflicts.length > 0, conflicts };
  };

  // Reset student selection
  const resetStudentSelection = () => {
    setFormData(prev => ({
      ...prev,
      students: []
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    // Ensure proper handling for all filter fields
    let safeValue = value;
    if ((name === 'tutor' || name === 'subject') && (!value || typeof value !== 'string')) {
      safeValue = '';
    }
    setFilters(prev => ({
      ...prev,
      [name]: safeValue
    }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      subject: '',
      tutor: '',
      students: [],
      maxCapacity: 10,
      startTime: '',
      duration: 35,
      customDuration: '',
      scheduleType: 'one-time',
      classDate: '',
      recurringDays: [],
      startDate: '',
      endDate: '',
      notes: '',
      paymentStatus: 'unpaid',
      amount: '',
      currency: 'USD'
    });
    setSelectedSubjectId(''); // Reset subject ID selection
    setError('');
  };

  const openAddModal = () => {
    console.log('🎯 openAddModal called');
    console.log('📋 Current tutors:', tutors.length);
    console.log('📋 Current students:', students.length);
    console.log('📋 Current subjects:', subjects.length);
    console.log('📋 Current error state:', error);
    
    // Load tutors, students, and subjects when opening the add modal
    console.log('🚀 Loading tutors, students, and subjects for new class form');
    loadTutors();
    loadStudents();
    loadSubjects();
    
    resetForm();
    setShowAddModal(true);
    
    console.log('✅ Add modal opened, showAddModal set to true');
    console.log('📋 Form data after reset:', formData);
  };

  const openEditModal = (classItem) => {
    console.log('🔧 openEditModal called with:', classItem);
    console.log('🔧 classItem._id:', classItem._id);
    console.log('🔧 classItem.id:', classItem.id);
    
    // Validate that the class has a valid ID
    if (!classItem || (!classItem._id && !classItem.id)) {
      console.error('❌ Class item has no valid ID:', classItem);
      setError('Cannot edit class: Invalid class data. Please refresh the page and try again.');
      return;
    }

    // Ensure we use _id (MongoDB standard) or fallback to id
    const classId = classItem._id || classItem.id;
    const normalizedClassItem = {
      ...classItem,
      _id: classId
    };

    console.log('class id normalized', classId);
    console.log('🔧 Normalized class item:', normalizedClassItem);
    
    setSelectedClass(normalizedClassItem);
    
    // Find the subject ObjectId from the subject name for dropdown compatibility
    let subjectValue = '';
    if (normalizedClassItem.subject) {
      const subjectFromName = subjects.find(s => s.subjectName === normalizedClassItem.subject);
      subjectValue = subjectFromName?._id || '';
      setSelectedSubjectId(subjectValue); // Set the subject ID for dropdown
      console.log('🔧 Converting subject name to ObjectId for dropdown:', {
        subjectName: normalizedClassItem.subject,
        foundSubject: subjectFromName,
        subjectId: subjectValue
      });
    } else {
      setSelectedSubjectId('');
    }
    
    setFormData({
      title: normalizedClassItem.title || '',
      description: normalizedClassItem.description || '',
      subject: normalizedClassItem.subject || '', // Keep original subject name
      tutor: normalizedClassItem.tutor?._id || '',
      students: normalizedClassItem.students?.map(s => s._id) || [],
      maxCapacity: normalizedClassItem.maxCapacity || 10,
      startTime: normalizedClassItem.startTime || '',
      duration: normalizedClassItem.duration || 35,
      customDuration: normalizedClassItem.customDuration || '',
      scheduleType: normalizedClassItem.scheduleType || 'one-time',
      classDate: formatDateSafely(normalizedClassItem.classDate),
      recurringDays: normalizedClassItem.recurringDays || [],
      startDate: formatDateSafely(normalizedClassItem.startDate),
      endDate: formatDateSafely(normalizedClassItem.endDate),
      notes: normalizedClassItem.notes || '',
      paymentStatus: normalizedClassItem.paymentStatus || 'unpaid',
      amount: normalizedClassItem.amount || '',
      currency: normalizedClassItem.currency || 'USD'
    });

    // Set the selected tutor object for proper validation and display
    if (normalizedClassItem.tutor) {
      console.log('🔧 Setting selectedTutor from edit:', normalizedClassItem.tutor);
      console.log('🔧 Tutor tutorProfile:', normalizedClassItem.tutor.tutorProfile);
      console.log('🔧 Tutor availability:', normalizedClassItem.tutor.tutorProfile?.availability);
      setSelectedTutor(normalizedClassItem.tutor);
    } else {
      console.log('🔧 No tutor found in classItem, setting selectedTutor to null');
      setSelectedTutor(null);
    }

    console.log('🔧 About to set showEditModal to true');
    setShowEditModal(true);
  };

  const openViewModal = (classItem) => {
    setSelectedClass(classItem);
    setShowViewModal(true);
  };

  // Schedule validation function
  const validateScheduleConflicts = (currentFormData = formData, currentSelectedClass = selectedClass) => {
    console.log('validate conflicts', currentSelectedClass);
    console.log('validate conflicts', currentFormData);
    console.log('validate conflicts', selectedTutor);
    console.log('validate conflicts', classes);

    // Clear previous validation errors
    setValidationErrors([]);
    setValidationWarnings([]);

    // Only validate if we have the minimum required data and classes have been loaded
    if (!currentFormData.startTime || !selectedTutor || !classes || classes.length === 0) {
      console.log('validate conflicts due to missing data.');
      return { hasErrors: false, hasWarnings: false };
    }

    try {
      const classData = {
        ...currentFormData,
        scheduleType: currentFormData.scheduleType,
        startTime: currentFormData.startTime,
        duration: currentFormData.customDuration || currentFormData.duration || 35,
        classDate: currentFormData.classDate,
        recurringDays: currentFormData.recurringDays
      };

      const normalizedClasses = classes.map(c => ({
      ...c,
      _id: c._id || c.id
    }));

      // Check tutor conflicts
      const tutorConflicts = checkTutorTimeConflicts(
        classData,
        normalizedClasses,
        selectedTutor._id,
        currentSelectedClass?._id // Exclude current class if editing
      );

      // Check student conflicts
      const selectedStudentObjects = students.filter(student => 
        currentFormData.students.includes(student._id)
      );
      
      const studentConflicts = checkStudentTimeConflicts(
        classData,
        normalizedClasses,
        currentFormData.students,
        currentSelectedClass?._id // Exclude current class if editing
      );

      // Generate error messages
      const errorMessages = generateConflictMessages(
        tutorConflicts,
        studentConflicts,
        selectedTutor,
        selectedStudentObjects
      );

      if (errorMessages.length > 0) {
        setValidationErrors(errorMessages);
        return { hasErrors: true, hasWarnings: false };
      }

      return { hasErrors: false, hasWarnings: false };
    } catch (error) {
      console.error('Validation error:', error);
      return { hasErrors: false, hasWarnings: false };
    }
  };

  const refreshClassList = async () => {
    console.log('🔄 Refreshing class list...');
    console.log('Current filters:', filters);
    console.log('Current page:', currentPage);
    
    // Don't reset filters or page, just reload with current settings
    await loadClasses();
    
    console.log('✅ Class list refresh complete');
  };

  const closeModals = () => {
    console.log('🔄 closeModals called - clearing selectedClass');
    setShowAddModal(false);
    setShowEditModal(false);
    setShowViewModal(false);
    setSelectedClass(null);
    resetForm();
  };

  // Debug function to check state
  const handleDebugClick = () => {
    console.log('==== DEBUG INFO ====');
    console.log('Current Classes:', classes);
    console.log('Current Filters:', filters);
    console.log('Current Page:', currentPage);
    console.log('Loading:', loading);
    console.log('==================');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    console.log('=====================================');
    console.log('📝 CREATING NEW CLASS');
    console.log('=====================================');
      console.log('🚀 showEditModal:', showEditModal);
      console.log('🚀 selectedClass at start:', selectedClass);
      console.log('🚀 selectedClass._id at start:', selectedClass?._id);
      
      // Log form data and subject information
      console.log('📝 Form Data:', {
        ...formData,
        subject: formData.subject,
        subjectDetails: subjects.find(s => s._id === formData.subject)
      });
      
      // Get user data for context
      const userData = JSON.parse(localStorage.getItem('userData'));
      console.log('👤 User context:', {
        id: userData?._id,
        role: userData?.role,
        centerId: userData?.centerId,
        assignments: userData?.assignments
      });    try {
      // Validate required fields with specific messages
      const missingFields = [];
      if (!formData.title) missingFields.push('Title');
      if (!formData.subject) missingFields.push('Subject');
      if (!formData.startTime) missingFields.push('Start Time');
      if (!formData.scheduleType) missingFields.push('Schedule Type');
      if (formData.amount === '' || formData.amount === undefined || formData.amount === null) missingFields.push('Amount');
      
      // Check schedule-specific required fields
      if (formData.scheduleType === 'one-time' && !formData.classDate) {
        missingFields.push('Class Date');
      } else if (formData.scheduleType === 'weekly-recurring') {
        if (!formData.startDate) missingFields.push('Start Date');
        if (!formData.endDate) missingFields.push('End Date');
        if (!formData.recurringDays || formData.recurringDays.length === 0) missingFields.push('Recurring Days');
      }
      
      if (missingFields.length > 0) {
        setError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
        console.error('Missing required fields:', missingFields);
        return;
      }

      // Validate amount is a positive number
      const amountValue = parseFloat(formData.amount);
      if (isNaN(amountValue) || amountValue < 0) {
        setError('Amount must be a valid non-negative number');
        return;
      }
      
      console.log('Validating selectedTutor:', selectedTutor);

      // Validate tutor selection
      if (!selectedTutor || !selectedTutor._id) {
        setError('Please select a tutor for this class');
        return;
      }

      // Run schedule conflict validation before submission
      const validation = validateScheduleConflicts();
      if (validation.hasErrors) {
        setError('Scheduling conflicts detected. Please resolve all conflicts before creating the class.');
        return;
      }


      // Validate students array - require at least one student selected
      let validStudents;
      try {
        validStudents = (formData.students || [])
          .filter(studentId => studentId && studentId !== 'undefined')
          .map(studentId => typeof studentId === 'string' ? studentId : studentId._id || studentId);

        console.log('valid students', validStudents);
        console.log('Raw students in formData:', formData.students);
      } catch (err) {
        console.error('🔥 Error while processing students:', err);
        console.error('🔥 formData:', formData);
        setError('An error occurred while validating students');
        return;
      }

      if (!validStudents || validStudents.length === 0) {
        setError('Please select at least one student for this class.');
        return;
      }


 


      const token = getStoredToken();
      if (!token) {
        setError('Authentication token not found. Please login again.');
        return;
      }
      console.log('validate token', token);

      // Validate selectedClass for edit mode
      console.log('edit model', showEditModal);
      if (showEditModal) {
        console.log('🔍 Validating selectedClass for edit mode...');
        console.log('🔍 selectedClass:', selectedClass);
        
        if (!selectedClass) {
          console.error('❌ selectedClass is null/undefined for edit mode');
          setError('No class selected for editing. Please close and reopen the edit dialog.');
          return;
        }
        
        // Check both _id and id fields
        const classId = selectedClass._id || selectedClass.id || formData.id || formData._id;
        if (!classId) {
          console.error('❌ selectedClass exists but has no _id or id field:', selectedClass);
          console.error('❌ Available fields:', Object.keys(selectedClass));
          setError('Selected class has no valid ID. Please refresh the page and try again.');
          return;
        }
        
        console.log('✅ selectedClass validation passed with ID:', classId);
      }

      console.log('Form submission - showEditModal:', showEditModal);
      console.log('Form submission - selectedClass:', selectedClass);
      console.log('Form submission - selectedClass._id sucss  :', selectedClass?._id);

      const classId = selectedClass?._id || selectedClass?.id;
      console.log('Form submission - selectedClass demo:', selectedClass);
      
      const url = showEditModal 
      ? `http://localhost:5000/api/classes/${classId}`
  : 'http://localhost:5000/api/dashboard/admin/classes';
      
      const method = showEditModal ? 'PUT' : 'POST';
      console.log('Form submission - selectedClass._id demo:', selectedClass?.id);

      // Prepare form data with proper duration handling and validated IDs
      // Get user data from stored token or context
      const userData = JSON.parse(localStorage.getItem('userData'));
      // Log full userData for debugging
      console.log('📝 FULL userData from localStorage:', userData);

      // Get selected subject details
      const selectedSubject = subjects.find(s => s._id === formData.subject);
      console.log('Selected subject:', {
        id: selectedSubject?._id,
        name: selectedSubject?.subjectName,
        centerId: selectedSubject?.centerId
      });

      // Get center ID from assignments first, fall back to centerId
      const centerId = userData?.assignments?.center || userData?.centerId;
  const resolvedCenterId = centerId || userData?.center_id;
  console.log('Using center ID:', resolvedCenterId);

      // Convert subject ID to subject name for backend enum validation
      const submitData = { 
        ...formData,
        subject: selectedSubject?.subjectName || formData.subject, // Use subject name
        tutorId: selectedTutor._id,
        students: validStudents,
        centerId: resolvedCenterId,
        createdBy: userData?.id || userData?._id,
        paymentStatus: formData.paymentStatus || 'unpaid'
      };
      // Remove invalid date fields
      if (submitData.startDate === '' || submitData.startDate === 'Invalid date') {
        delete submitData.startDate;
      }
      if (submitData.endDate === '' || submitData.endDate === 'Invalid date') {
        delete submitData.endDate;
      }

      console.log('📤 Submitting data:', {
        subject: submitData.subject,
        centerId: submitData.centerId,
        tutorId: submitData.tutorId,
        createdBy: submitData.createdBy,
        paymentStatus: submitData.paymentStatus,
        students: submitData.students
      });
      
      if (showEditModal && classId) {
        submitData._id = classId;  // only send _id when editing
      }

      // Handle duration fields
      if (submitData.customDuration) {
        // Validate custom duration is a positive number
        const customDuration = parseInt(submitData.customDuration);
        if (isNaN(customDuration) || customDuration <= 0) {
          setError('Custom duration must be a positive number');
          return;
        }
        submitData.duration = customDuration; // Use custom duration as the main duration
        delete submitData.customDuration;     // Remove the custom duration field
      } else {
        // If customDuration is an empty string, remove it from payload to avoid DB type errors
        if (submitData.customDuration === '') {
          delete submitData.customDuration;
        }
        if (!submitData.duration) {
          setError('Duration is required');
          return;
        }
      }

      console.log('Submitting class data:', submitData);
      console.log('Submitting to:', url, 'with method:', method);
      console.log('Final URL:', url);
      console.log('HTTP method:', method);
      console.log('Payload:', submitData);



      // Enhanced validation before sending
      console.log('Validating submit data:', submitData);
      
      // Check if all required fields are present
      if (!submitData.title || !submitData.subject || !submitData.tutorId || !submitData.centerId || !submitData.createdBy) {
        console.error('Missing required fields:', {
          title: !submitData.title,
          subject: !submitData.subject,
          tutorId: !submitData.tutorId,
          centerId: !submitData.centerId,
          createdBy: !submitData.createdBy
        });
        setError('Missing required fields');
        return;
      }

      console.log('📤 Sending request with data:', submitData);
      console.log('📤 SENDING CLASS DATA TO SERVER...');
      console.log('%c 🎓 CREATING NEW CLASS 🎓 ', 'background: #4CAF50; color: white; padding: 4px; border-radius: 4px;');
      console.log('Submit Data:', submitData);
      
      // Log request details before sending
      console.log('=== CLASS CREATION REQUEST ===');
      console.log('URL:', url);
      console.log('Method:', method);
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('Data:', submitData);
      
      // Log request details before sending
      console.log('=== CLASS CREATION REQUEST ===');
      console.log('URL:', url);
      console.log('Method:', method);
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('Data:', submitData);

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(submitData)
      });
      
      // Log response details
      console.log('=== SERVER RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));
      
      // Clone response for debugging
      const responseClone = response.clone();
      const rawBody = await responseClone.text();
      console.log('Raw Response Body:', rawBody);


      console.log('📥 SERVER RESPONSE STATUS:', response.status);
      
      let responseData;
      try {
        responseData = await response.json();
        console.log('=== PARSED RESPONSE DATA ===');
        console.log('Success:', responseData.success);
        console.log('Error:', responseData.error);
        console.log('Message:', responseData.message);
        console.log('Details:', responseData.details);
        console.log('Full Response:', responseData);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response status:', response.status);
        console.error('Response headers:', Object.fromEntries(response.headers.entries()));
        // If status is 201/200, treat as success even if JSON is invalid
        if (response.status === 201 || response.status === 200) {
          setError('');
          closeModals();
          setFormData({
            title: '',
            description: '',
            subject: '',
            tutor: '',
            students: [],
            maxCapacity: 10,
            startTime: getCurrentTimeString(),
            duration: 35,
            customDuration: '',
            scheduleType: 'one-time',
            classDate: '',
            recurringDays: [],
            startDate: '',
            endDate: '',
            notes: ''
          });
          setSelectedSubjectId('');
          alert('Class scheduled successfully!');
          setTimeout(async () => {
            await loadClasses();
          }, 1000);
          return;
        } else {
          setError('Failed to create class: Server returned invalid response format.');
          return;
        }
      }

      // Only show error if status is 400+ or explicit error
      if (response.status >= 400 || responseData.error || responseData.success === false) {
        const errorMessage = responseData.message || responseData.error || 'Unknown error occurred';
        setError(`Failed to create class: ${errorMessage}`);
        return;
      }

      // Success: status 201/200 or explicit success
      setError('');
      closeModals();
      setFormData({
        title: '',
        description: '',
        subject: '',
        tutor: '',
        students: [],
        maxCapacity: 10,
        startTime: getCurrentTimeString(),
        duration: 35,
        customDuration: '',
        scheduleType: 'one-time',
        classDate: '',
        recurringDays: [],
        startDate: '',
        endDate: '',
        notes: ''
      });
      setSelectedSubjectId('');
      alert('Class scheduled successfully!');
      setTimeout(async () => {
        await loadClasses();
      }, 1000);
    } catch (error) {
      console.error('Submit error:', error);
      if (error.name !== 'AbortError') {
        setError(`Failed to ${showEditModal ? 'update' : 'create'} class: ${error.message}`);
      }
    }
  };

  const handleDelete = async (classId) => {
    console.log('🗑️ handleDelete called with classId:', classId);
    console.log('🗑️ classId type:', typeof classId);
    console.log('🗑️ classId value:', classId);
    
    if (!classId || classId === 'undefined' || classId === 'null') {
      console.error('❌ Invalid classId passed to handleDelete:', classId);
      setError('Cannot delete class: Invalid class ID');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this class?')) {
      return;
    }

    try {
      const token = getStoredToken();
      console.log('🗑️ Making DELETE request to:', `http://localhost:5000/api/classes/${classId}`);
      
      const response = await fetch(`http://localhost:5000/api/classes/${classId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('🗑️ Delete response:', data);

      if (data.success) {
        console.log('✅ Class deleted successfully');
        loadClasses();
      } else {
        console.error('❌ Delete failed:', data.error);
        setError(data.error || 'Failed to delete class');
      }
    } catch (error) {
      console.error('💥 Delete error:', error);
      setError('Failed to delete class');
    }
  };

  const handleStatusUpdate = async (classId, newStatus) => {
    try {
      const token = getStoredToken();
      const response = await fetch(`http://localhost:5000/api/classes/${classId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {
        loadClasses();
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Status update error:', error);
      setError('Failed to update status');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        console.warn('Invalid date for formatting:', date);
        return 'Invalid Date';
      }
      // Display in user's local timezone automatically
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', date, error);
      return 'Invalid Date';
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    try {
      // If time looks like a full date string (contains spaces or GMT), parse directly
      let timeObj;
      if (typeof time === 'string' && (time.includes('GMT') || /\w{3}\s+\w{3}\s+\d{1,2}/.test(time))) {
        timeObj = new Date(time);
      } else if (typeof time === 'string' && time.includes('T')) {
        // ISO-like string
        timeObj = new Date(time);
      } else {
        // Fallback: assume HH:MM and attach an arbitrary date
        timeObj = new Date(`2000-01-01T${time}`);
      }

      if (isNaN(timeObj.getTime())) {
        // Try Date.parse as one more attempt
        const parsed = Date.parse(time);
        if (!isNaN(parsed)) {
          timeObj = new Date(parsed);
        }
      }

      if (isNaN(timeObj.getTime())) {
        console.warn('Invalid time for formatting:', time);
        return 'Invalid Time';
      }

      // Display in user's local timezone automatically
      return timeObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
    } catch (error) {
      console.warn('Error formatting time:', time, error);
      return 'Invalid Time';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'scheduled': return styles.statusScheduled;
      case 'completed': return styles.statusCompleted;
      case 'cancelled': return styles.statusCancelled;
      default: return '';
    }
  };

  if (loading) {
    console.log('⏳ Component in loading state');
    return <div className={styles.loading}>Loading classes...</div>;
  }

  console.log('🎬 Rendering main component');
  console.log('📊 Current state:', {
    classesCount: classes.length,
    tutorsCount: tutors.length,
    studentsCount: students.length,
    loading,
    error,
    showAddModal,
    showEditModal,
    showViewModal
  });


  function getValidDaysBetween(startDate, endDate) {
    if (!startDate || !endDate) return [];

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn('Invalid dates for getValidDaysBetween:', startDate, endDate);
        return [];
      }

      if (start > end) {
        console.warn('Start date is after end date:', startDate, endDate);
        return [];
      }

      const days = new Set();

      for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        // getDay returns 0 (Sun) to 6 (Sat)
        days.add(dt.getDay()); 
      }

      return Array.from(days); // e.g., [4,5,6] for Thu, Fri, Sat
    } catch (error) {
      console.warn('Error in getValidDaysBetween:', error);
      return [];
    }
  }

const validDays = formData.scheduleType === 'weekly-recurring'
  ? getValidDaysBetween(formData.startDate, formData.endDate)
  : [];


  return (
    <div className={styles.scheduleClasses}>
      {/* Header */}
      <div className={styles.header}>
        <h2>Schedule Classes</h2>
        <div className={styles.headerActions}>
          <div className={styles.statusIndicator}>
            <div>📚 Classes: {classes.length}</div>
            <div>👨‍🏫 Tutors: {tutors.length} {tutorsLoading && '(loading...)'}</div>
            <div>🎓 Students: {students.length} {studentsLoading && '(loading...)'}</div>
            {error && <div style={{color: 'red'}}>❌ {error}</div>}
          </div>
          <button 
            className={styles.debugButton}
            onClick={async () => {
              console.log('🔍 === COMPREHENSIVE DEBUG INFO ===');
              
              // Check localStorage
              const token = getStoredToken();
              console.log('🔑 Token Status:', token ? '✅ Found' : '❌ Missing');
              if (token) {
                console.log('📄 Token Preview:', token.substring(0, 50) + '...');
                console.log('📏 Token Length:', token.length);
                
                // Try to decode JWT (client-side, just to see structure)
                try {
                  const parts = token.split('.');
                  if (parts.length === 3) {
                    const header = JSON.parse(atob(parts[0]));
                    const payload = JSON.parse(atob(parts[1]));
                    console.log('🎯 Token Header:', header);
                    console.log('📦 Token Payload:', payload);
                    console.log('⏰ Token Issued At:', new Date(payload.iat * 1000));
                    console.log('⏰ Token Expires At:', new Date(payload.exp * 1000));
                    console.log('👤 User Role:', payload.role);
                  } else {
                    console.log('❌ Token format invalid - should have 3 parts separated by dots');
                  }
                } catch (e) {
                  console.log('❌ Cannot decode token:', e.message);
                }
              }
              
              // Check current state
              console.log('📊 Component State:');
              console.log('  Tutors:', tutors.length, 'items');
              console.log('  Students:', students.length, 'items');
              console.log('  Classes:', classes.length, 'items');
              console.log('  Loading:', loading);
              console.log('  Error:', error);
              
              // Test API endpoints
              if (token) {
                console.log('🧪 Testing API Endpoints...');
                
                try {
                  // Test auth endpoint first
                  console.log('Testing auth...');
                  const authResponse = await fetch('http://localhost:5000/health', {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  console.log('🏥 Health check status:', authResponse.status);
                  
                  // Test tutors endpoint
                  console.log('Testing tutors endpoint...');
                  const tutorResponse = await fetch('http://localhost:5000/api/tutors?page=1&limit=3', {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  console.log('👨‍🏫 Tutor API Status:', tutorResponse.status);
                  const tutorData = await tutorResponse.json();
                  console.log('👨‍🏫 Tutor API Response:', tutorData);
                  
                  // Test students endpoint
                  console.log('Testing students endpoint...');
                  const studentResponse = await fetch('http://localhost:5000/api/students?page=1&limit=3', {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    }
                  });
                  console.log('🎓 Student API Status:', studentResponse.status);
                  const studentData = await studentResponse.json();
                  console.log('🎓 Student API Response:', studentData);
                  
                } catch (error) {
                  console.error('🚨 API Test Error:', error);
                }
              }
              
              console.log('✅ Debug complete! Check the details above.');
            }}
          >
            🔍 Debug
          </button>
          <button 
            className={styles.addButton}
            onClick={() => {
              console.log('🎯 Schedule New Class button clicked');
              openAddModal();
            }}
          >
            + Schedule New Class
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {/* Timezone Info */}
      <div className={styles.timezoneInfo}>
        <small>
          ⏰ Times displayed in your timezone: <strong>{getTimezoneDisplayString()}</strong>
        </small>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <input
            type="text"
            name="search"
            placeholder="Search classes..."
            value={filters.search}
            onChange={handleFilterChange}
            className={styles.searchInput}
          />
          
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            name="subject"
            value={filters.subject || ''}
            onChange={handleFilterChange}
            className={styles.filterSelect}
          >
            <option value="">All Subjects</option>
            {subjects.map(subject => (
              <option key={subject._id} value={subject.subjectName}>
                {subject.subjectName}
              </option>
            ))}
          </select>

          <select
            name="tutor"
            value={filters.tutor || ''}
            onChange={handleFilterChange}
            className={styles.filterSelect}
          >
            <option value="">All Tutors</option>
            {tutors.map(tutor => (
              <option key={tutor._id} value={tutor._id}>
                {tutor.firstName} {tutor.lastName}
              </option>
            ))}
          </select>

          <select
            name="scheduleType"
            value={filters.scheduleType}
            onChange={handleFilterChange}
            className={styles.filterSelect}
          >
            <option value="all">All Types</option>
            <option value="one-time">One-time</option>
            <option value="weekly-recurring">Weekly Recurring</option>
          </select>
        </div>
      </div>

      {/* Classes List */}
      <div className={styles.classList}>
        {classes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No classes found. Schedule your first class!</p>
          </div>
        ) : (
          <>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Subject</th>
                    <th>Tutor</th>
                    <th>Students</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((classItem, index) => {
                    console.log('🏗️ Rendering class item:', classItem);
                    console.log('🏗️ Class item _id:', classItem._id);
                    console.log('🏗️ Class item id:', classItem.id);
                    
                    const uniqueKey = classItem._id || classItem.id || `class-${index}`;
                    console.log('🏗️ Using key:', uniqueKey);
                    
                    return (
                    <tr key={uniqueKey}>
                      <td>
                        <div className={styles.classTitle}>
                          <strong>{classItem.title}</strong>
                          {classItem.description && (
                            <div className={styles.classDescription}>
                              {classItem.description.substring(0, 50)}
                              {classItem.description.length > 50 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {(() => {
                          // First, try to use subjectDetails from backend
                          if (classItem.subjectDetails) {
                            return `${classItem.subjectDetails.subjectName} (${classItem.subjectDetails.subjectCode})`;
                          }
                          // Second, try to use subjectName from backend
                          if (classItem.subjectName) {
                            return classItem.subjectName;
                          }
                          // Third, try to resolve subject name from frontend subjects list
                          const subjectDetails = subjects.find(s => s._id === classItem.subject || s.id === classItem.subject);
                          if (subjectDetails) {
                            return `${subjectDetails.subjectName} (${subjectDetails.subjectCode})`;
                          }
                          // Fallback: show subject ID with a warning
                          console.warn(`⚠️ Subject not found for class: ID=${classItem.subject}`);
                          return `[ID: ${classItem.subject}]`;
                        })()}
                      </td>
                      <td>
                        {classItem.tutor ? (
                          <div>
                            {classItem.tutor?.firstName || ''} {classItem.tutor?.lastName || ''}
                          </div>
                        ) : (
                          <span className={styles.noTutor}>No tutor assigned</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.studentCount}>
                          {classItem.students?.length || 0} / {classItem.maxCapacity}
                        </span>
                      </td>
                      <td>
                        <div className={styles.timeInfo}>
                          <div>
                            {classItem.scheduleType === 'one-time' 
                              ? formatDate(classItem.classDate)
                              : `${formatDate(classItem.startDate)} - ${formatDate(classItem.endDate)}`
                            }
                          </div>
                          <div className={styles.timeSlot}>
                            {formatTime(classItem.startTime)} 
                            ({classItem.customDuration || classItem.duration} min)
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.scheduleType}>
                          {classItem.scheduleType === 'one-time' ? 'One-time' : 'Recurring'}
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(classItem.status)}`}>
                          {classItem.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={styles.viewButton}
                            onClick={() => openViewModal(classItem)}
                            title="View Details"
                          >
                            👁️
                          </button>
                          <button
                            className={styles.editButton}
                            onClick={() => openEditModal(classItem)}
                            title="Edit Class"
                          >
                            ✏️
                          </button>
                          <select
                            value={classItem.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              const idToUse = classItem._id || classItem.id;
                              
                              if (!idToUse) {
                                console.error('❌ No valid ID found for status update:', classItem);
                                setError('Cannot update status: Missing class ID');
                                return;
                              }
                              
                              if (newStatus && newStatus !== classItem.status) {
                                handleStatusUpdate(idToUse, newStatus);
                              }
                            }}
                            className={styles.statusSelect}
                            title="Update Status (Only 'Cancelled' can be manually set; 'Completed' is auto-set when class ends)"
                          >
                            {classItem.status === 'scheduled' && (
                              <>
                                <option value="scheduled">Scheduled</option>
                                <option value="cancelled">Cancel Class</option>
                              </>
                            )}
                            {classItem.status === 'cancelled' && (
                              <option value="cancelled">❌ Cancelled</option>
                            )}
                            {classItem.status === 'completed' && (
                              <option value="completed">✅ Completed</option>
                            )}
                          </select>
                          <button
                            className={styles.deleteButton}
                            onClick={() => {
                              console.log('🗑️ Delete button clicked for class:', classItem);
                              console.log('🗑️ ClassItem._id:', classItem._id);
                              console.log('🗑️ ClassItem.id:', classItem.id);
                              const idToUse = classItem._id || classItem.id;
                              console.log('🗑️ ID to use for deletion:', idToUse);
                              
                              if (!idToUse) {
                                console.error('❌ No valid ID found for class item:', classItem);
                                setError('Cannot delete class: Missing class ID');
                                return;
                              }
                              
                              handleDelete(idToUse);
                            }}
                            title="Delete Class"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                </div>
                <div className={styles.pageInfo} style={{ flex: 1, textAlign: 'center' }}>
                  Page {currentPage} of {totalPages} ({totalClasses} total classes)
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Class Modal */}
      {(showAddModal || showEditModal) && (
        <div className={styles.modal}>
          {console.log('🎭 Rendering Add/Edit Modal')}
          {console.log('🎭 showAddModal:', showAddModal)}
          {console.log('🎭 showEditModal:', showEditModal)}
          {console.log('🎭 tutors.length:', tutors.length)}
          {console.log('🎭 students.length:', students.length)}
          {console.log('🎭 tutorsLoading:', tutorsLoading)}
          {console.log('🎭 studentsLoading:', studentsLoading)}
          
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{showEditModal ? 'Edit Class' : 'Schedule New Class'}</h3>
              <button className={styles.closeButton} onClick={closeModals}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              {error && (
                <div className={styles.modalError}>
                  {error}
                </div>
              )}
              
              {/* Schedule Validation Errors */}
              {validationErrors.length > 0 && (
                <div className={styles.validationErrors}>
                  <h4>⚠️ Schedule Conflicts</h4>
                  {validationErrors.map((errorMsg, index) => (
                    <div key={index} className={styles.validationError}>
                      {errorMsg}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Schedule Validation Warnings */}
              {validationWarnings.length > 0 && (
                <div className={styles.validationWarnings}>
                  <h4>⚠️ Schedule Warnings</h4>
                  {validationWarnings.map((warningMsg, index) => (
                    <div key={index} className={styles.validationWarning}>
                      {warningMsg}
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.formGrid}>
                {/* Basic Information */}
                <div className={styles.formSection}>
                  <h4>Class Information</h4>
                  
                  <div className={styles.formGroup}>
                    <label>Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter class title"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Subject *</label>
                    <SubjectDropdown
                      subjects={subjects}
                      loading={subjectsLoading}
                      value={formData.subject}
                      onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter class description"
                      rows="3"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Payment Status *</label>
                    <select
                      name="paymentStatus"
                      value={formData.paymentStatus}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="unpaid">Unpaid (Default)</option>
                      <option value="democlass">Demo Class (Free)</option>
                    </select>
                    <small className={styles.fieldHint}>
                      Demo classes will have $0 amount and be marked as demo status
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Amount *</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      placeholder="Enter class amount"
                      min="0"
                      step="0.01"
                      required
                    />
                    <small className={styles.fieldHint}>
                      Amount per session (e.g., 50.00)
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Currency *</label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CAD">CAD (C$)</option>
                      <option value="AUD">AUD (A$)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Notes</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Additional notes"
                      rows="2"
                    />
                  </div>
                </div>

                {/* Tutor Selection */}
                <div className={styles.formSection}>
                  <h4>Tutor Assignment</h4>
                  
                  <div className={styles.formGroup}>
                    <label>Tutor *</label>
                    <div className={styles.tutorSelectionContainer}>
                      {selectedTutor ? (
                        <div className={styles.selectedTutorDisplay}>
                          <div className={styles.selectedTutorInfo}>
                            <strong>{selectedTutor.firstName} {selectedTutor.lastName}</strong>
                            <span className={styles.tutorEmail}>{selectedTutor.email}</span>
                            {selectedTutor.tutorProfile?.subjects && (
                              <span className={styles.tutorSubjects}>
                                Subjects: {selectedTutor.tutorProfile.subjects.join(', ')}
                              </span>
                            )}
                            {selectedTutor.tutorProfile?.experience && (
                              <span className={styles.tutorExperience}>
                                {selectedTutor.tutorProfile.experience} years experience
                              </span>
                            )}
                            {selectedTutor.tutorProfile?.rating && 
                             typeof selectedTutor.tutorProfile.rating === 'object' && 
                             selectedTutor.tutorProfile.rating.average && 
                             selectedTutor.tutorProfile.rating.average > 0 && (
                              <span className={styles.tutorRating}>
                                Rating: {Number(selectedTutor.tutorProfile.rating.average).toFixed(1)}/5 ⭐ 
                                ({selectedTutor.tutorProfile.rating.count || 0} reviews)
                              </span>
                            )}
                            {/* Display tutor availability */}
                            {/* {selectedTutor.tutorProfile?.availability && typeof selectedTutor.tutorProfile.availability === 'object' && (
                              <div className={styles.tutorAvailability}>
                                <strong>Available Times:</strong>
                                <div className={styles.availabilityGrid}>
                                  {Object.entries(selectedTutor.tutorProfile.availability).map(([day, dayData]) => {
                                   
                                    if (!dayData || typeof dayData !== 'object' || !dayData.available) {
                                      return null;
                                    }
                                    
                                    if (!dayData.timeSlots || !Array.isArray(dayData.timeSlots) || dayData.timeSlots.length === 0) {
                                      return null;
                                    }

                                    return (
                                      <div key={day} className={styles.dayAvailability}>
                                        <span className={styles.dayName}>{day}:</span>
                                        <span className={styles.timeSlots}>
                                          {dayData.timeSlots.map(slot => {
                                            if (typeof slot === 'string') {
                                              return slot;
                                            } else if (slot && typeof slot === 'object' && slot.startTime && slot.endTime) {
                                              return `${slot.startTime}-${slot.endTime}`;
                                            }
                                            return '';
                                          }).filter(Boolean).join(', ')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )} */}  
                              {selectedTutor.tutorProfile?.availability && (
                              <div className={styles.tutorAvailability}>
                                <strong>Available Times:</strong>
                                <div className={styles.availabilityGrid}>
                                  {Object.entries(selectedTutor.tutorProfile.availability).map(([day, data]) => {
                                    const timeSlots = data?.timeSlotsZones;

                                    if (!data?.available || !Array.isArray(timeSlots) || timeSlots.length === 0) return null;

                                    return (
                                      <div key={day} className={styles.dayAvailability}>
                                        <span className={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}:</span>
                                        <span className={styles.timeSlots}>
                                          {timeSlots.map((slot, idx) => {
                                            // Use local time if available, otherwise UTC
                                            const start = slot.startTimeLocal || slot.startTimeUTC || '';
                                            const end = slot.endTimeLocal || slot.endTimeUTC || '';
                                            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                            return start && end ? `${start} - ${end} (${timeZone})` : null;
                                          }).filter(Boolean).join(', ')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          </div>
                          <button 
                            type="button"
                            className={styles.changeTutorButton}
                            onClick={() => setShowTutorSelectionModal(true)}
                          >
                            Change Tutor
                          </button>
                        </div>
                      ) : (
                        <div className={styles.noTutorSelected}>
                          <div className={styles.noTutorText}>
                            No tutor selected. Use the advanced search to find the perfect tutor.
                          </div>
                          <button 
                            type="button"
                            className={styles.selectTutorButton}
                            onClick={() => setShowTutorSelectionModal(true)}
                          >
                            Browse & Select Tutor
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Simple dropdown as fallback option */}
                    <div className={styles.simpleTutorSelection}>
                        {console.log('DEBUG tutors array for dropdown:', tutors)}
                      <p className={styles.alternativeText}>Or select from basic list:</p>
                      {tutorsLoading ? (
                        <div className={styles.loadingText}>Loading tutors...</div>
                      ) : (
                        <select
                          name="tutor"
                          value={formData.tutor}
                          onChange={handleInputChange}
                        >
                          <option value="">Select tutor (basic list)</option>
                            {tutors.map(tutor => (
                              <option key={tutor._id || tutor.id} value={tutor._id || tutor.id}>
                                {tutor.username} ({tutor.email})
                              </option>
                            ))}
                        </select>
                      )}
                      {tutors.length === 0 && !tutorsLoading && (
                        <div className={styles.noData}>No tutors available in basic list</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student Selection */}
                <div className={styles.formSection}>
                  <h4>Student Assignment</h4>
                  
                  <div className={styles.formGroup}>
                    <label>Max Capacity</label>
                    <input
                      type="number"
                      name="maxCapacity"
                      value={formData.maxCapacity}
                      onChange={handleInputChange}
                      min="1"
                      max="50"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Students ({formData.students.length} selected)</label>
                    <div className={styles.selectionControls}>
                      <button
                        type="button"
                        className={styles.selectButton}
                        onClick={() => setShowStudentSelectionModal(true)}
                      >
                        {formData.students.length > 0 ? 'Manage Students' : 'Select Students'}
                      </button>
                      {formData.students.length > 0 && (
                        <button
                          type="button"
                          className={styles.clearButton}
                          onClick={resetStudentSelection}
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    
                    {/* Display selected students with individual remove options */}
                      {console.log('DEBUG selected student IDs:', formData.students)}
                      {console.log('DEBUG loaded students array:', students)}
                    {formData.students.length > 0 && (
                      <div className={styles.selectedStudentsContainer}>
                        <h5>Selected Students:</h5>
                        <div className={styles.selectedStudentsList}>
                          {formData.students.map((studentId) => {
                            // Find student details from loaded students
                            const student = students.find(s => s._id === studentId || s.id === studentId);
                            console.log('👥 Rendering student:', student);
                            console.log('👥 Student profile:', student?.studentProfile);
                            console.log('👥 Academic info:', student?.studentProfile?.academicInfo);
                            
                            return (
                              <div key={studentId} className={styles.selectedStudentItem}>
                                <div className={styles.studentItemInfo}>
                                  <div className={styles.studentName}>
                                    {student
                                      ? `${student.firstName || student.username || ''} ${student.lastName || ''}`
                                      : (studentsLoading ? 'Loading...' : 'Student not found')}
                                  </div>
                                  {student && (
                                    <div className={styles.studentDetails}>
                                      <span className={styles.email}>{student.email}</span>
                                      {student.studentProfile?.grade && (
                                        <span className={styles.grade}>Grade: {student.studentProfile.grade}</span>
                                      )}
                                      {/* Display student subjects */}
                                      {student.studentProfile?.academicInfo?.subjects && student.studentProfile.academicInfo.subjects.length > 0 && (
                                        <span className={styles.subjects}>
                                          Subjects: {student.studentProfile.academicInfo.subjects.join(', ')}
                                        </span>
                                      )}
                                      {/* Display preferred subjects if different from main subjects */}
                                      {student.studentProfile?.academicInfo?.preferredSubjects && student.studentProfile.academicInfo.preferredSubjects.length > 0 && (
                                        <span className={styles.preferredSubjects}>
                                          Prefers: {student.studentProfile.academicInfo.preferredSubjects.join(', ')}
                                        </span>
                                      )}
                                      {/* Display struggling subjects */}
                                      {student.studentProfile?.academicInfo?.strugglingSubjects && student.studentProfile.academicInfo.strugglingSubjects.length > 0 && (
                                        <span className={styles.strugglingSubjects}>
                                          Needs help: {student.studentProfile.academicInfo.strugglingSubjects.join(', ')}
                                        </span>
                                      )}
                                      {/* Display student availability if available */}
                                      {student.studentProfile?.availability && (
                                        <div className={styles.availability}>
                                          <strong>Available Times:</strong>
                                          <div className={styles.availabilityList}>
                                            {Object.entries(student.studentProfile.availability).map(([day, dayInfo]) => (
                                              dayInfo && dayInfo.available && Array.isArray(dayInfo.timeSlotsZones) && dayInfo.timeSlotsZones.length > 0 && (
                                                <span key={day} className={styles.availabilityItem}>
                                                  {day}: {dayInfo.timeSlotsZones.map((slot, idx) => {
                                                    // Convert UTC times to local timezone for display
                                                    const startTimeLocal = slot.startTimeLocal || slot.startTimeUTC || '';
                                                    const endTimeLocal = slot.endTimeLocal || slot.endTimeUTC || '';
                                                    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                                    return (
                                                      <span key={idx}>{`${startTimeLocal} - ${endTimeLocal} (${timeZone})`}</span>
                                                    );
                                                  })}
                                                </span>
                                              )
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className={styles.removeStudentButton}
                                  onClick={() => handleRemoveStudent(studentId)}
                                  title="Remove this student"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Time Settings */}
                <div className={styles.formSection}>
                  <h4>Time Settings</h4>
                  
                  <div className={styles.bufferTimeInfo}>
                    ℹ️ Buffer time: {SCHEDULE_CONFIG.BUFFER_TIME_MINUTES} minutes between classes
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Start Time *</label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Duration Type</label>
                    <select
                      name="durationType"
                      value={formData.customDuration ? 'custom' : 'standard'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setFormData(prev => ({
                            ...prev,
                            customDuration: '35'
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            customDuration: ''
                          }));
                        }
                      }}
                    >
                      <option value="standard">Standard Duration</option>
                      <option value="custom">Custom Duration</option>
                    </select>
                  </div>

                  {!formData.customDuration ? (
                    <div className={styles.formGroup}>
                      <label>Duration *</label>
                      <select
                        name="duration"
                        value={formData.duration}
                        onChange={handleInputChange}
                        required
                      >
                        {durationOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className={styles.formGroup}>
                      <label>Custom Duration (minutes) *</label>
                      <input
                        type="number"
                        name="customDuration"
                        value={formData.customDuration}
                        onChange={handleInputChange}
                        placeholder="Enter duration in minutes"
                        min="30"
                        max="300"
                        required
                      />
                    </div>
                  )}
                </div>

                                {/* Schedule Type */}
                <div className={styles.formSection}>
                  <h4>Schedule Type</h4>
                  
                  <div className={styles.formGroup}>
                    <label>Type *</label>
                    <select
                      name="scheduleType"
                      value={formData.scheduleType}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="one-time">One-time Class</option>
                      <option value="weekly-recurring">Weekly Recurring</option>
                    </select>
                  </div>

                  {formData.scheduleType === 'one-time' ? (
                    <div className={styles.formGroup}>
                      <label>Class Date *</label>
                      <input
                        type="date"
                        name="classDate"
                        value={formData.classDate}
                        onChange={handleInputChange}
                        required
                        min={getMinScheduleDate()}
                      />
                    </div>
                  ) : (
                    <>
                      <div className={styles.formGroup}>
                        <label>Start Date *</label>
                        <input
                          type="date"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleInputChange}
                          required
                          min={getMinScheduleDate()}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>End Date *</label>
                        <input
                          type="date"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleInputChange}
                          required
                          min={formData.startDate || getMinScheduleDate()}
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label>Recurring Days *</label>
                        <div className={styles.daysList}>
                          {weekDays.map(day => (
                            <label key={day.value} className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                name="recurringDays"
                                value={day.value}
                                checked={formData.recurringDays.includes(day.value)}
                                onChange={handleInputChange}
                              />
                              {day.label}
                            </label>
                          ))}
                        </div>
                  </div>

                   {/* <div className={styles.formGroup}>
                  <label>Recurring Days *</label>
                  <div className={styles.daysList}>
                    {weekDays.map(day => {
                      // const isDisabled = !validDays.includes(day.value); // Disable if day not in validDays
                      const isDisabled = !validDays.includes(Number(day.value));
                      // const isDisabled = false;

                      return (
                        <label
                          key={day.value}
                          className={styles.checkboxLabel}
                          style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
                        >
                          <input
                            type="checkbox"
                            name="recurringDays"
                            value={day.value}
                            checked={formData.recurringDays.includes(day.value)}
                            onChange={handleInputChange}
                            disabled={isDisabled}
                          />
                          {day.label}
                        </label>
                      );
                    })}
                  </div>
                </div> */}
                    </>
                  )}
                </div>

                {/* Availability Check */}
                {(selectedTutor && formData.students.length > 0 && formData.startTime) && (
                  <div className={styles.formSection}>
                    <h4>Availability Check</h4>
                    {(() => {
                      const availabilityCheck = checkAvailabilityConflicts();
                      return (
                        <div className={styles.availabilityStatus}>
                          {availabilityCheck.hasConflicts ? (
                            <div className={styles.conflictsFound}>
                              <div className={styles.conflictHeader}>
                                ⚠️ <strong>Schedule Conflicts Found:</strong>
                              </div>
                              <div className={styles.conflictsList}>
                                {availabilityCheck.conflicts.map((conflict, index) => (
                                  <div key={index} className={styles.conflictItem}>
                                    <span className={`${styles.conflictType} ${styles[conflict.type]}`}>
                                      {conflict.type === 'tutor' ? '👨‍🏫' : '👨‍🎓'}
                                    </span>
                                    <span className={styles.conflictDetails}>
                                      <strong>{conflict.name}</strong> - {conflict.day}: {conflict.issue}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className={styles.conflictNote}>
                                <small>⚠️ You can still proceed, but conflicts should be resolved for optimal scheduling.</small>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.noConflicts}>
                              ✅ <strong>All participants are available for the scheduled time!</strong>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={closeModals}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                >
                  {showEditModal ? 'Update Class' : 'Schedule Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Class Modal */}
      {showViewModal && selectedClass && (
        <ErrorBoundary>
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h3>Class Details</h3>
                <button className={styles.closeButton} onClick={closeModals}>×</button>
              </div>
            
            <div className={styles.viewContent}>
              <div className={styles.viewSection}>
                <h4>Class Information</h4>
                <p><strong>Title:</strong> {selectedClass.title || 'N/A'}</p>
                <p><strong>Subject:</strong> {selectedClass.subjectName || selectedClass.subject || 'N/A'}</p>
                <p><strong>Description:</strong> {selectedClass.description || 'No description'}</p>
                <p><strong>Status:</strong> 
                  <span className={`${styles.statusBadge} ${getStatusBadgeClass(selectedClass.status)}`}>
                    {selectedClass.status || 'Unknown'}
                  </span>
                </p>
              </div>

              <div className={styles.viewSection}>
                <h4>Tutor</h4>
                {selectedClass.tutor ? (
                  <div>
                    <p><strong>Name:</strong> {(selectedClass.tutor?.firstName || '') + ' ' + (selectedClass.tutor?.lastName || '')}</p>
                    <p><strong>Email:</strong> {selectedClass.tutor.email}</p>
                  </div>
                ) : (
                  <p>No tutor assigned</p>
                )}
              </div>

              <div className={styles.viewSection}>
                <h4>Students ({selectedClass.studentDetails?.length || selectedClass.students?.length || 0} / {selectedClass.maxCapacity || 10})</h4>
                {console.log('🎓 selectedClass.studentDetails:', selectedClass.studentDetails)}
                {console.log('🎓 selectedClass.students:', selectedClass.students)}
                {selectedClass.studentDetails?.length > 0 ? (
                  <ul className={styles.studentsList}>
                    {selectedClass.studentDetails.map(student => (
                      <li key={student.id}>
                        {(student.firstName || 'Unknown') + ' ' + (student.lastName || '')} - {student.email || 'No email'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No students assigned</p>
                )}
              </div>

              <div className={styles.viewSection}>
                <h4>Schedule</h4>
                <p><strong>Type:</strong> {selectedClass.scheduleType === 'one-time' ? 'One-time' : (selectedClass.scheduleType === 'weekly-recurring' ? 'Weekly Recurring' : selectedClass.scheduleType)}</p>
                <p><strong>Start Time:</strong> {formatTime(selectedClass.startTime) || 'N/A'}</p>
                <p><strong>Duration:</strong> {selectedClass.customDuration || selectedClass.duration || 35} minutes</p>
                
                {selectedClass.scheduleType === 'one-time' ? (
                  <p><strong>Date:</strong> {formatDate(selectedClass.classDate) || 'N/A'}</p>
                ) : (
                  <>
                    <p><strong>Period:</strong> {formatDate(selectedClass.startDate) || 'N/A'} - {formatDate(selectedClass.endDate) || 'N/A'}</p>
                    <p><strong>Days:</strong> {(selectedClass.recurringDays && selectedClass.recurringDays.length > 0) ? selectedClass.recurringDays.join(', ') : 'Not specified'}</p>
                    {selectedClass.sessions && selectedClass.sessions.length > 0 && (
                      <div>
                        <p><strong>Sessions ({selectedClass.sessions.length}):</strong></p>
                        <ul className={styles.sessionsList}>
                          {selectedClass.sessions.slice(0, 10).map((session, index) => (
                            <li key={index}>
                              {formatDate(session.sessionDate) || 'N/A'} - {session.status || 'Unknown'}
                            </li>
                          ))}
                          {selectedClass.sessions.length > 10 && (
                            <li>... and {selectedClass.sessions.length - 10} more sessions</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedClass.notes && (
                <div className={styles.viewSection}>
                  <h4>Notes</h4>
                  <p>{selectedClass.notes}</p>
                </div>
              )}

              {/* Meeting Session Controls */}
              {selectedClass.scheduleType === 'one-time' && selectedClass.status === 'scheduled' && (
                <div className={styles.viewSection}>
                  <h4>Meeting Session</h4>
                  <p>Meeting controls will appear here when configured.</p>
                </div>
              )}

              <div className={styles.viewSection}>
                <h4>Created</h4>
                <p><strong>By:</strong> {selectedClass.createdBy?.firstName} {selectedClass.createdBy?.lastName}</p>
                <p><strong>On:</strong> {formatDate(selectedClass.createdAt)}</p>
              </div>
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={closeModals}
                className={styles.cancelButton}
              >
                Close
              </button>
              <button
                onClick={() => {
                  closeModals();
                  openEditModal(selectedClass);
                }}
                className={styles.submitButton}
              >
                Edit Class
              </button>
            </div>
          </div>
        </div>
        </ErrorBoundary>
      )}
      
      {/* Tutor Selection Modal */}
      <TutorSelectionModal
        isOpen={showTutorSelectionModal}
        onClose={() => setShowTutorSelectionModal(false)}
        onSelect={handleTutorSelection}
        selectedTutorId={selectedTutor?._id}
      />

      {/* Student Selection Modal */}
      <StudentSelectionModal
        isOpen={showStudentSelectionModal}
        onClose={() => setShowStudentSelectionModal(false)}
        onSelect={handleStudentSelection}
        selectedStudents={students.filter(s => formData.students.includes(s._id))}
      />
    </div>
  );
};


export default ScheduleClassesTab;
