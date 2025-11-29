import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../shared/components/Header';
import StatsCard from '../../shared/components/StatsCard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import MeetingControls from '../../components/MeetingControls';
import { getStoredUser } from '../../utils/helpers';
import api, { homeworkAPI } from '../../utils/api';
import styles from './Dashboard.module.css';
import { parseStartTime } from '../../utils/timeParser';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [loading, setLoading] = useState(false); // Initialize as false
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [assignments, setAssignments] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [showStudyCalendar, setShowStudyCalendar] = useState(false);
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(new Date());
  const [studyCalendarData, setStudyCalendarData] = useState([]);
  
  // useRef to track if initial API calls have been made (prevents StrictMode double-calls)
  const classesInitializedRef = useRef(false);
  const assignmentsInitializedRef = useRef(false);
  
  const user = getStoredUser();

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Refresh assignments when component becomes visible (user returns from homework)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id && activeTab === 'assignments') {
        console.log('🔄 Page became visible, refreshing assignments...');
        refreshAssignments();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id, assignmentFilter, activeTab]);

  // Load student's classes only once on mount (prevents StrictMode double-call)
  useEffect(() => {
    if (user?.id && !classesInitializedRef.current) {
      console.log('📚 Initial load of student classes triggered');
      classesInitializedRef.current = true;
      loadStudentClasses();
    }
  }, [user?.id]);

  // Load classes when Classes tab is activated (if not already loaded)
  useEffect(() => {
    if (activeTab === 'classes' && user?.id && upcomingClasses.length === 0 && !loading && classesInitializedRef.current) {
      console.log('📚 Classes tab activated - loading additional data if needed');
      loadStudentClasses();
    }
  }, [activeTab, user?.id]);

  // Load assignments only once on mount (prevents StrictMode double-call)
  useEffect(() => {
    if (user?.id && !assignmentsInitializedRef.current) {
      console.log('📚 Initial load of assignments triggered');
      assignmentsInitializedRef.current = true;
      loadAssignments(assignmentFilter === 'all' ? null : assignmentFilter);
    }
  }, [user?.id, assignmentFilter]);

  // Auto-refresh assignments every 2 minutes when on assignments tab to catch status updates
  useEffect(() => {
    if (activeTab === 'assignments' && user?.id) {
      const refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing assignments...');
        loadAssignments(assignmentFilter === 'all' ? null : assignmentFilter);
      }, 120000); // Refresh every 2 minutes

      return () => clearInterval(refreshInterval);
    }
  }, [activeTab, user?.id, assignmentFilter]);

  const loadStudentClasses = async () => {
    // Prevent multiple simultaneous calls
    if (loading) {
      console.log('❌ Skipping API call - already loading');
      return;
    }
    
    console.log('🔄 Loading student classes...');
    
    try {
      setLoading(true);
      setError('');
      
      // Use correct token key (accessToken is the primary, token is fallback)
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        console.log('❌ No authentication token found');
        return;
      }

      if (!user?.id) {
        setError('User information not available. Please refresh the page.');
        console.log('❌ No user ID found. User object:', user);
        return;
      }

      console.log('📋 Making API call with user ID:', user.id);

      // Add abort controller for cleanup
      const controller = new AbortController();
      
  const response = await fetch(`/api/classes/student-classes`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📊 API Response:', data);
        
        if (data.success && Array.isArray(data.data)) {
          // Sort classes chronologically (earliest first)
          const sortedClasses = data.data.sort((a, b) => {
            const dateA = parseStartTime(a) || new Date(a.classDate || 0);
            const dateB = parseStartTime(b) || new Date(b.classDate || 0);
            return dateA - dateB;
          });
          
          setUpcomingClasses(sortedClasses);
          setError('');
          console.log('✅ Classes loaded successfully:', sortedClasses.length, 'classes');
        } else {
          setUpcomingClasses([]);
          setError('Invalid response format from server');
          console.log('❌ Invalid response format:', data);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Server error: ${response.status}`;
        setError(errorMessage);
        console.log('❌ API error:', errorMessage);
      }
    } catch (err) {
      // Don't set error for aborted requests
      if (err.name !== 'AbortError') {
        const errorMessage = 'Unable to load your classes. Please check your connection and try again.';
        setError(errorMessage);
        console.error('❌ Error loading student classes:', err);
      } else {
        console.log('🚫 Request aborted');
      }
    } finally {
      setLoading(false);
      console.log('🏁 Loading completed');
    }
  };

  const loadAssignments = async (filterStatus = null, forceRefresh = false) => {
    if (assignmentLoading && !forceRefresh) {
      console.log('❌ Skipping assignment API call - already loading');
      return;
    }

    // Clear any cached data to ensure fresh load
    localStorage.removeItem('assignments');

    try {
      setAssignmentLoading(true);
      console.log('📚 Loading student assignments for user:', user.id, 'with filter:', filterStatus);
      
      // Clear cache to force fresh data
      if (forceRefresh) {
        console.log('🔄 Forcing fresh data load');
      }
      
      const response = await api.get('/homework-assignments/student');
      const data = response.data;
      console.log('📊 Student assignments response:', data);
      
      if (data.success && Array.isArray(data.assignments)) {
        let assignments = data.assignments.map(assignment => ({
          _id: assignment._id,
          status: assignment.status || 'assigned', // Default to 'assigned' if no status
          dueDate: assignment.due_date,
          instructions: assignment.instructions,
          startDate: assignment.start_date,
          class_id: assignment.class_id,
          homework: {
            id: assignment.homework_id,
            homeworkName: assignment.homeworkName || 'Homework Assignment',
            fileName: assignment.fileName,
            mimeType: assignment.mimeType,
            exerciseData: assignment.exerciseData ? JSON.parse(assignment.exerciseData) : null
          }
        }));
        
        // Apply status filter if needed
        if (filterStatus && filterStatus !== 'all') {
          assignments = assignments.filter(a => a.status === filterStatus);
        }

        // Sort assignments to show completed ones properly
        const sortedAssignments = assignments.sort((a, b) => {
          // Sort by status priority: inprogress > assigned > completed
          const statusPriority = { 'inprogress': 0, 'assigned': 1, 'completed': 2 };
          if (a.status !== b.status) {
            return (statusPriority[a.status] || 3) - (statusPriority[b.status] || 3);
          }
          // Then by date (newest first)
          return new Date(b.assignedDate) - new Date(a.assignedDate);
        });
        
        setAssignments(sortedAssignments);
        console.log(`✅ Successfully loaded ${sortedAssignments.length} assignments`);
        
        // Log assignment status breakdown
        const statusBreakdown = sortedAssignments.reduce((acc, assignment) => {
          acc[assignment.status] = (acc[assignment.status] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Assignment status breakdown:', statusBreakdown);
      } else {
        console.log('⚠️ No assignments data in response');
        setAssignments([]);
      }
    } catch (err) {
      console.error('❌ Error loading student assignments:', err);
      setAssignments([]);
      // Don't show error message for assignments, just log it
    } finally {
      setAssignmentLoading(false);
      console.log('🏁 Assignment loading completed');
    }
  };

  // Mock data for demo purposes
  const mockData = {
    profile: {
      name: 'Sarah Wilson',
      grade: '8th Grade',
      studentId: 'STU001',
      enrollmentDate: '2024-08-15'
    },
    classes: [
      {
        id: '1',
        name: 'Mathematics',
        teacher: 'Ms. Johnson',
        grade: 'A-',
        attendance: 95,
        nextClass: '2025-09-02 10:00 AM',
        assignments: 3
      },
      {
        id: '2',
        name: 'Science',
        teacher: 'Mr. Smith',
        grade: 'A',
        attendance: 98,
        nextClass: '2025-09-02 2:00 PM',
        assignments: 2
      },
      {
        id: '3',
        name: 'English Literature',
        teacher: 'Mrs. Davis',
        grade: 'B+',
        attendance: 92,
        nextClass: '2025-09-03 9:00 AM',
        assignments: 4
      }
    ],
    assignments: [
      {
        id: '1',
        title: 'Algebra Practice Set',
        subject: 'Mathematics',
        dueDate: '2025-09-05',
        status: 'pending',
        priority: 'high'
      },
      {
        id: '2',
        title: 'Science Lab Report',
        subject: 'Science',
        dueDate: '2025-09-07',
        status: 'in-progress',
        priority: 'medium'
      },
      {
        id: '3',
        title: 'Book Review: To Kill a Mockingbird',
        subject: 'English Literature',
        dueDate: '2025-09-10',
        status: 'pending',
        priority: 'low'
      },
      {
        id: '4',
        title: 'Math Quiz Preparation',
        subject: 'Mathematics',
        dueDate: '2025-09-03',
        status: 'completed',
        priority: 'high'
      }
    ],
    schedule: [
      { time: '9:00 AM', subject: 'Mathematics', teacher: 'Ms. Johnson', room: 'Room 101' },
      { time: '10:30 AM', subject: 'Break', teacher: '', room: '' },
      { time: '11:00 AM', subject: 'Science', teacher: 'Mr. Smith', room: 'Lab 202' },
      { time: '12:30 PM', subject: 'Lunch', teacher: '', room: '' },
      { time: '1:30 PM', subject: 'English Literature', teacher: 'Mrs. Davis', room: 'Room 305' },
      { time: '3:00 PM', subject: 'Study Hall', teacher: '', room: 'Library' }
    ],
    recentGrades: [
      { subject: 'Mathematics', assignment: 'Quiz #3', grade: 'A-', date: '2025-08-30' },
      { subject: 'Science', assignment: 'Lab Experiment', grade: 'A', date: '2025-08-29' },
      { subject: 'English', assignment: 'Essay Writing', grade: 'B+', date: '2025-08-28' }
    ]
  };

  const stats = [
    {
      title: 'Current GPA',
      value: '3.7',
      icon: 'fas fa-graduation-cap',
      color: 'success',
      change: '+0.2',
      changeType: 'positive'
    },
    {
      title: 'Classes Enrolled',
      value: mockData.classes.length,
      icon: 'fas fa-book-open',
      color: 'primary',
      change: '+0',
      changeType: 'neutral'
    },
    {
      title: 'Assignments Due',
      value: assignments.filter(a => a.status !== 'completed').length,
      icon: 'fas fa-tasks',
      color: 'warning',
      change: '-1',
      changeType: 'positive'
    },
    {
      title: 'Average Attendance',
      value: `${Math.round(mockData.classes.reduce((acc, cls) => acc + cls.attendance, 0) / mockData.classes.length)}%`,
      icon: 'fas fa-calendar-check',
      color: 'info',
      change: '+3%',
      changeType: 'positive'
    }
  ];

  // Helper functions
  const getTimeOfDay = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const isCurrentTime = (timeStr) => {
    const now = currentTime;
    const [timeHour] = timeStr.match(/\d+/g);
    const isPM = timeStr.includes('PM');
    let hour = parseInt(timeHour);
    if (isPM && hour !== 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    
    const currentHour = now.getHours();
    return Math.abs(currentHour - hour) <= 1;
  };

  // Helper function to get today's class time for recurring classes
  // const getTodayClassTime = (classItem) => {
  //   try {
  //     const today = new Date();
      
  //     // Get day name in lowercase (monday, tuesday, etc.)
  //     const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  //     const dayName = daysOfWeek[today.getDay()];
      
  //     console.log('📅 Checking class for today:', dayName, 'Class recurring days:', classItem.recurringDays);
      
  //     // For weekly recurring classes, check if today is a recurring day
  //     if (classItem.scheduleType === 'weekly-recurring' && classItem.recurringDays) {
  //       if (!classItem.recurringDays.includes(dayName)) {
  //         console.log('❌ No class today - not in recurring days');
  //         return null; // No class today
  //       }
  //     }

  //     // // Create today's class datetime
  //     const timeString = classItem.startTime || '00:00';
  //     console.log('🕐 Class start time string:', timeString);
      
  //     if (!timeString.includes(':')) {
  //       console.error('❌ Invalid time format:', timeString);
  //       return null;
  //     }
      
  //     const [hours, minutes] = timeString.split(':');
  //     const hoursInt = parseInt(hours);
  //     const minutesInt = parseInt(minutes || '0');
      
  //     console.log('🕐 Parsed time - Hours:', hoursInt, 'Minutes:', minutesInt);
      
  //     if (isNaN(hoursInt) || isNaN(minutesInt) || hoursInt < 0 || hoursInt > 23 || minutesInt < 0 || minutesInt > 59) {
  //       console.error('❌ Invalid time values - Hours:', hoursInt, 'Minutes:', minutesInt);
  //       return null;
  //     }
      
  //     const classDateTime = new Date(today);
  //     classDateTime.setHours(hoursInt, minutesInt, 0, 0);

      
  //     console.log('✅ Today\'s class time:', classDateTime);
  //     return classDateTime;
  //   } catch (error) {
  //     console.error('❌ Error in getTodayClassTime:', error);
  //     return null;
  //   }
  // };



  function getTodayClassTime(classItem) {
  try {
    const today = new Date();

    // Get and sanitize the time string
    const timeStringRaw = classItem?.startTime || '00:00';
    const timeString = typeof timeStringRaw === 'string' 
      ? timeStringRaw.trim() 
      : '';

    console.log('🕐 Raw start time value:', timeStringRaw);
    console.log('🕐 Sanitized start time string:', timeString);

    // Check for valid time string format
    if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) {
      console.error('❌ Invalid time format:', timeString);
      return null;
    }

    // Parse hours and minutes
    const [hoursStr, minutesStr] = timeString.split(':');
    const hoursInt = parseInt(hoursStr, 10);
    const minutesInt = parseInt(minutesStr || '0', 10);

    console.log('🕐 Parsed time - Hours:', hoursInt, 'Minutes:', minutesInt);

    // Validate time values
    if (
      isNaN(hoursInt) || isNaN(minutesInt) ||
      hoursInt < 0 || hoursInt > 23 ||
      minutesInt < 0 || minutesInt > 59
    ) {
      console.error('❌ Invalid time values - Hours:', hoursInt, 'Minutes:', minutesInt);
      return null;
    }

    // Build final Date object with today's date and parsed time
    const classDateTime = new Date(today);
    classDateTime.setHours(hoursInt, minutesInt, 0, 0);

    console.log('✅ Final class datetime:', classDateTime);

    return classDateTime;

  } catch (error) {
    console.error('❌ Error in getTodayClassTime:', error);
    return null;
  }
}


  // Class time management functions
  // const isToday = (classItem) => {
  //   if (classItem.scheduleType === 'weekly-recurring') {
  //     return getTodayClassTime(classItem) !== null;
  //   } else {
  //     const today = new Date();
  //     const classDate = new Date(classItem.startTime || classItem.classDate);
  //     return today.toDateString() === classDate.toDateString();
  //   }
  // };

  const isToday = (classItem) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (classItem.scheduleType === 'weekly-recurring') {
    return getTodayClassTime(classItem) !== null;
  } else {
    const classDateTime = getOneTimeClassDateTime(classItem);
    if (!classDateTime) return false;

    const classDate = new Date(classDateTime);
    classDate.setHours(0, 0, 0, 0);

    return classDate.toDateString() === today.toDateString();
  }
};

  

  // Removed getClassTimeStatus function since we're now allowing direct join without time validation

  

  const formatClassTime = (classItem) => {
    let startTime;
    
    try {
      // Use the converted startTime from backend if available (which already accounts for timezone)
      // The backend returns startTime already converted to student's timezone
      const timeString = classItem.startTime || '00:00';
      
      if (classItem.scheduleType === 'weekly-recurring') {
        startTime = getTodayClassTime(classItem);
        if (!startTime) {
          // For display purposes, show the general time
          const [hours, minutes] = timeString.split(':');
          const tempDate = new Date();
          tempDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          startTime = tempDate;
        }
      } else {
      // Use shared parser to construct a date for one-time classes
        // startTime = new Date(classItem.startTime || classItem.classDate);
        startTime = getOneTimeClassDateTime(classItem) || parseStartTime(classItem);

      }
      
      // Validate that startTime is a valid date
      if (isNaN(startTime.getTime())) {
        console.error('❌ Invalid start time:', classItem.startTime);
        // Fallback to current time
        startTime = new Date();
      }
      
      const duration = classItem.customDuration || classItem.duration || 60;
      const endTime = new Date(startTime.getTime() + duration * 60000);
      
      // Validate end time
      if (isNaN(endTime.getTime())) {
        console.error('❌ Invalid end time calculation');
        return {
          start: 'Invalid Time',
          end: 'Invalid Time',
          date: 'Invalid Date'
        };
      }
      
      return {
        start: startTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }),
        end: endTime.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }),
        date: classItem.scheduleType === 'weekly-recurring' 
          ? `Recurring: ${classItem.recurringDays?.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ') || 'Not specified'}`
          : startTime.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
      };
    } catch (error) {
      console.error('❌ Error formatting class time:', error);
      return {
        start: 'Error',
        end: 'Error',
        date: 'Error formatting date'
      };
    }
  };


 const handleJoinClass = async (classItem) => {
  try {
    console.log('🔗 Preparing to join meeting for class:', classItem.title);
    
    // Use the meeting ID directly from classItem (no need for extra API call)
    let latestMeetingId = classItem.meetingId;
    
    console.log('✅ Using meeting ID from class data:', latestMeetingId);

    // Use the latest meeting ID or fallback options
    let rawMeetingId = latestMeetingId || classItem.meetingLink?.split('/meeting/')[1] || classItem._id;
    
    // Ensure meeting ID has correct prefix for MeetingPage validation
    const meetingId = rawMeetingId.startsWith('class-') || rawMeetingId.startsWith('session-') 
      ? rawMeetingId 
      : `class-${rawMeetingId}`;
    
    // Get user details for meeting configuration - construct proper full name
    const userName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user?.firstName || user?.username || 'Student';
    const userId = user?.id;
    const role = user?.role || 'student';

    console.log('🔗 Raw meeting ID:', rawMeetingId);
    console.log('🔗 Formatted meeting ID:', meetingId);
    console.log('👤 User details:', { userName, userId, role });
    console.log('📋 Class item:', { id: classItem.id, title: classItem.title });
    console.log('📋 Class meeting data:', { meetingId: latestMeetingId, originalMeetingId: classItem.meetingId, meetingLink: classItem.meetingLink });

    // Validate meeting ID exists
    if (!meetingId) {
      console.error('❌ No meeting ID available for this class');
      alert('Unable to join meeting: No meeting ID found for this class');
      return;
    }

    // Record session participation before opening meeting
    console.log('[DEBUG] classItem before join:', classItem);
      console.log('[DEBUG] Selected class before join:', classItem._id || classItem.id, classItem.title);
    try {
      console.log('📝 Recording session participation...');
      console.log('[GUARD] Full classItem before join:', classItem);
      
      // Get authentication token
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      // Defensive: Ensure all required fields are present
      if (!classItem.title || !classItem.startTime || !classItem.duration) {
        console.warn('[WARN] Missing required join fields:', {
          title: classItem.title,
          start_time: classItem.startTime,
          duration: classItem.duration
        });
      }
        // Prefer DB primary key, then id, then meetingId (URL identifier), then extract from meetingLink
        const meetingClassId = classItem._id || classItem.id || classItem.meetingId || (classItem.meetingLink && classItem.meetingLink.split('/meeting/')[1]) || null;
      const joinPayload = {
        meeting_class_id: meetingClassId,
        title: classItem.title || '',
        start_time: classItem.startTime || '',
        duration: classItem.duration || 0
      };
      console.log('[DEBUG] Join payload:', joinPayload);
      const participationResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(joinPayload)
      });

      if (participationResponse.ok) {
        const participationData = await participationResponse.json();
        console.log('Participation response:', participationData);
        // Determine the canonical class id to store for the meeting tab.
        // Prefer DB value returned by backend, otherwise fall back to the id we sent (meetingClassId) or the class item's DB id.
        const dbMeetingClassId = participationData?.data?.meeting_class_id || participationData?.data?.meetingClassId || participationData?.meeting_class_id;
        const finalClassIdToStore = (dbMeetingClassId && dbMeetingClassId !== 'undefined') ? dbMeetingClassId : (meetingClassId || classDbId || '');
        if (finalClassIdToStore && finalClassIdToStore !== 'undefined') {
          localStorage.setItem('meeting_class_id', finalClassIdToStore);
          console.log('[DEBUG] Stored meeting_class_id in localStorage:', finalClassIdToStore);
        } else {
          console.warn('[WARN] No valid meeting_class_id to store after join:', { participationData, meetingClassId, classDbId });
        }

        // Store sessionParticipantId only when backend returned a valid id
        const sessionId = participationData?.sessionParticipantId || participationData?.data?.id || participationData?.data?._id;
        if (sessionId && String(sessionId).trim() !== '' && String(sessionId) !== 'undefined') {
          localStorage.setItem('sessionParticipantId', String(sessionId));
          console.log('[DEBUG] Stored sessionParticipantId in localStorage:', String(sessionId));
        } else {
          console.warn('[WARN] No valid sessionParticipantId returned from join response, not writing to localStorage', participationData);
        }

        // Also store class metadata so the meeting tab has the canonical values for /end
        try {
          const classTitle = participationData?.data?.title || classItem.title || '';
          const classStartTime = participationData?.data?.start_time || classItem.startTime || '';
          const classDuration = participationData?.data?.duration || classItem.duration || '';
          if (classTitle) localStorage.setItem('classTitle', classTitle);
          if (classStartTime) localStorage.setItem('classStartTime', classStartTime);
          if (classDuration !== undefined && classDuration !== null) localStorage.setItem('classDuration', String(classDuration));
          console.log('[DEBUG] Stored class metadata in localStorage:', { classTitle, classStartTime, classDuration });
        } catch (e) {
          console.warn('[WARN] Failed to persist class metadata to localStorage', e);
        }
        console.log('✅ Session participation recorded:', participationData.message);
      } else {
        console.warn('⚠️ Failed to record session participation:', participationResponse.status);
      }
    } catch (participationError) {
      console.error('❌ Error recording session participation:', participationError);
      // Continue with meeting join even if participation recording fails
    }

  // Open meeting in new tab with full functional URL (background)
  // Include DB classId as query param so the meeting page can use the primary key (meeting_class_id)
  const classDbId = classItem._id || classItem.id || '';
  const meetingUrl = `/meeting/${meetingId}?userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&classId=${encodeURIComponent(classDbId)}&displayClean=true`;
    window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    
  } catch (error) {
    console.error('❌ Error joining meeting:', error);
    
    // Fallback to original class data if API call fails
    let rawFallbackId = classItem.meetingId || classItem.meetingLink?.split('/meeting/')[1] || classItem._id;
    const fallbackMeetingId = rawFallbackId.startsWith('class-') || rawFallbackId.startsWith('session-') 
      ? rawFallbackId 
      : `class-${rawFallbackId}`;
    if (fallbackMeetingId) {
      console.log('🔄 Using fallback meeting ID:', fallbackMeetingId);
      // Guard: Print full classItem before fallback join
      console.log('[GUARD] Full classItem before fallback join:', classItem);
      // Try to record participation even in fallback, always send all required fields
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const fallbackJoinPayload = {
          meeting_class_id: classItem._id || classItem.id,
          title: classItem.title || '',
          start_time: classItem.startTime || '',
          duration: classItem.duration || 0
        };
        if (!classItem.title || !classItem.startTime || !classItem.duration) {
          console.warn('[WARN] Fallback: Missing required join fields:', fallbackJoinPayload);
        }
        const participationResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/join`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fallbackJoinPayload)
        });
        if (participationResponse.ok) {
          // Parse participation response and attempt to store canonical class/session ids
          try {
            const participationData = await participationResponse.json();
            const dbMeetingClassId = participationData?.data?.meeting_class_id || participationData?.data?.meetingClassId || participationData?.meeting_class_id;
            const classDbIdFallback = classItem._id || classItem.id || '';
            const finalClassIdToStore = (dbMeetingClassId && dbMeetingClassId !== 'undefined') ? dbMeetingClassId : (classDbIdFallback || '');
            if (finalClassIdToStore && finalClassIdToStore !== 'undefined') {
              localStorage.setItem('meeting_class_id', finalClassIdToStore);
              console.log('[DEBUG] (fallback) Stored meeting_class_id in localStorage:', finalClassIdToStore);
            }

            const sessionId = participationData?.sessionParticipantId || participationData?.data?.id || participationData?.data?._id;
            if (sessionId && String(sessionId).trim() !== '' && String(sessionId) !== 'undefined') {
              localStorage.setItem('sessionParticipantId', String(sessionId));
              console.log('[DEBUG] (fallback) Stored sessionParticipantId in localStorage:', String(sessionId));
            }
          } catch (e) {
            console.warn('[WARN] Could not parse fallback participation response body', e);
          }
          console.log('✅ Fallback session participation recorded');
        }
      } catch (participationError) {
        console.error('❌ Fallback participation recording failed:', participationError);
      }
      const userName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.firstName || user?.username || 'Student';
      const userId = user?.id;
      const role = user?.role || 'student';
    const classDbId = classItem._id || classItem.id || '';
    const meetingUrl = `/meeting/${fallbackMeetingId}?userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&classId=${encodeURIComponent(classDbId)}&displayClean=true`;
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('Unable to join meeting: An error occurred while fetching meeting details');
    }
  }
};


// const getOneTimeClassDateTime = (classItem) => {
//   if (!classItem.classDate || !classItem.startTime) return null;

//   const date = new Date(classItem.classDate);
//   const [hours, minutes] = classItem.startTime.split(':').map(Number);

//   if (isNaN(hours) || isNaN(minutes)) return null;

//   date.setHours(hours, minutes, 0, 0);
//   return date;
// };

const getOneTimeClassDateTime = (classItem) => {
  if (!classItem.classDate || !classItem.startTime) return null;

  const date = new Date(classItem.classDate);
  const [hours, minutes] = classItem.startTime.split(':').map(Number);

  if (
    isNaN(hours) || isNaN(minutes) ||
    hours < 0 || hours > 23 ||
    minutes < 0 || minutes > 59
  ) {
    return null;
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
};



  const renderOverview = () => (
    <div className={styles.overviewContent}>
      {/* Welcome Section */}
      <div className={styles.welcomeSection}>
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeText}>
            <h2>Good {getTimeOfDay()}, {user?.firstName || 'Student'}! 👋</h2>
            <p>Ready to continue your learning journey? You have {assignments.filter(a => a.status !== 'completed').length} assignments due this week.</p>
          </div>
          <div className={styles.welcomeImage}>
            <div className={styles.avatarContainer}>
              <img 
                src={user?.profilePicture || `${process.env.REACT_APP_UI_AVATARS_BASE_URL || 'https://ui-avatars.com/api'}/?name=${user?.firstName || 'Student'}&background=4f46e5&color=fff&size=80`} 
                alt="Profile" 
                className={styles.avatar}
              />
              <div className={styles.statusBadge}>
                <div className={styles.statusDot}></div>
                Online
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid with Modern Cards */}
      <div className={styles.statsContainer}>
        <h3 className={styles.sectionHeading}>Academic Overview</h3>
        <div className={styles.statsGrid}>
          {stats.map((stat, index) => (
            <div key={index} className={styles.modernStatCard}>
              <div className={styles.statIcon}>
                <i className={stat.icon}></i>
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.title}</div>
                <div className={`${styles.statChange} ${styles[stat.changeType]}`}>
                  <i className={`fas fa-arrow-${stat.changeType === 'positive' ? 'up' : 'down'}`}></i>
                  {stat.change}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions with Modern Design */}
      <div className={styles.quickActionsContainer}>
        <h3 className={styles.sectionHeading}>Quick Actions</h3>
        <div className={styles.quickActionsGrid}>
          <button className={styles.modernActionCard} onClick={() => setActiveTab('classes')}>
            <div className={styles.actionIcon}>
              <i className="fas fa-play-circle"></i>
            </div>
            <div className={styles.actionContent}>
              <h4>Join Next Class</h4>
              <p>Mathematics in 30 mins</p>
            </div>
            <div className={styles.actionArrow}>
              <i className="fas fa-chevron-right"></i>
            </div>
          </button>
          
          <button className={styles.modernActionCard} onClick={() => setActiveTab('assignments')}>
            <div className={styles.actionIcon}>
              <i className="fas fa-clipboard-list"></i>
            </div>
            <div className={styles.actionContent}>
              <h4>View Assignments</h4>
              <p>{assignments.filter(a => a.status !== 'completed').length} pending</p>
            </div>
            <div className={styles.actionArrow}>
              <i className="fas fa-chevron-right"></i>
            </div>
          </button>
          
          <button className={styles.modernActionCard}>
            <div className={styles.actionIcon}>
              <i className="fas fa-chart-line"></i>
            </div>
            <div className={styles.actionContent}>
              <h4>Progress Report</h4>
              <p>View performance</p>
            </div>
            <div className={styles.actionArrow}>
              <i className="fas fa-chevron-right"></i>
            </div>
          </button>
          
          <button className={styles.modernActionCard}>
            <div className={styles.actionIcon}>
              <i className="fas fa-bell"></i>
            </div>
            <div className={styles.actionContent}>
              <h4>Notifications</h4>
              <p>2 new messages</p>
            </div>
            <div className={styles.actionArrow}>
              <i className="fas fa-chevron-right"></i>
            </div>
          </button>
        </div>
      </div>

      {/* Today's Schedule with Timeline */}
      <div className={styles.scheduleContainer}>
        <h3 className={styles.sectionHeading}>Today's Schedule</h3>
        <div className={styles.scheduleTimeline}>
          {mockData.schedule.map((item, index) => (
            <div key={index} className={`${styles.timelineItem} ${isCurrentTime(item.time) ? styles.currentItem : ''}`}>
              <div className={styles.timelineDot}></div>
              <div className={styles.timelineTime}>{item.time}</div>
              <div className={styles.timelineContent}>
                <h4>{item.subject}</h4>
                {item.teacher && <p>{item.teacher} • {item.room}</p>}
              </div>
              {isCurrentTime(item.time) && (
                <div className={styles.currentIndicator}>
                  <span>Now</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className={styles.activityContainer}>
        <h3 className={styles.sectionHeading}>Recent Activity</h3>
        <div className={styles.activityFeed}>
          {mockData.recentGrades.map((grade, index) => (
            <div key={index} className={styles.activityItem}>
              <div className={styles.activityIcon}>
                <i className="fas fa-star"></i>
              </div>
              <div className={styles.activityContent}>
                <h4>New Grade: {grade.grade}</h4>
                <p>{grade.subject} - {grade.assignment}</p>
                <span className={styles.activityTime}>{grade.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const handleStartAssignment = async (assignment) => {
    console.log('🚀 Starting assignment:', assignment);
    
    try {
      if (assignment.status === 'completed') {
        // For completed assignments, navigate to review page
        console.log('📋 Assignment completed - navigating to review page');
        navigate(`/student/review/${assignment._id}`);
        return;
      }
      
      // Update assignment status to 'inprogress' if it's currently 'assigned'
      if (assignment.status === 'assigned') {
        await homeworkAPI.updateAssignmentStatus(assignment._id, { status: 'inprogress' });
        // Reload assignments to reflect the status change
        await loadAssignments(assignmentFilter === 'all' ? null : assignmentFilter);
      }
      
      // For non-completed assignments, navigate to the homework page
      navigate(`/student/homework/${assignment._id}`);
      
    } catch (error) {
      console.error('❌ Error starting assignment:', error);
      // Navigate to homework page even if status update fails, no popup
      if (assignment.status === 'completed') {
        navigate(`/student/review/${assignment._id}`);
      } else {
        navigate(`/student/homework/${assignment._id}`);
      }
    }
  };

  const handleDownloadAssignment = (assignment) => {
    console.log('📥 Downloading assignment:', assignment);
    
    if (assignment.homework?.filePath) {
      // Create download link
      const link = document.createElement('a');
      link.href = `/api/uploads/${assignment.homework.filePath}`;
      link.download = assignment.homework.filePath;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('No file available for download.');
    }
  };

  const handleFilterChange = (filterType) => {
    console.log('📊 Changing assignment filter to:', filterType);
    setAssignmentFilter(filterType);
    // loadAssignments will be called automatically due to useEffect dependency on assignmentFilter
  };

  // Add a method to refresh assignments (useful when returning from homework pages)
  const refreshAssignments = () => {
    console.log('🔄 Refreshing assignments...');
    loadAssignments(assignmentFilter === 'all' ? null : assignmentFilter);
  };

  const renderAssignments = () => (
    <div className={styles.assignmentsContent}>
      <div className={styles.assignmentsHeader}>
        <h3 className={styles.sectionHeading}>My Assignments</h3>
        <div className={styles.assignmentFilters}>
          <button 
            className={`${styles.filterBtn} ${assignmentFilter === 'all' ? styles.active : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All
          </button>
          <button 
            className={`${styles.filterBtn} ${assignmentFilter === 'assigned' ? styles.active : ''}`}
            onClick={() => handleFilterChange('assigned')}
          >
            Assigned
          </button>
          <button 
            className={`${styles.filterBtn} ${assignmentFilter === 'inprogress' ? styles.active : ''}`}
            onClick={() => handleFilterChange('inprogress')}
          >
            In Progress
          </button>
          <button 
            className={`${styles.filterBtn} ${assignmentFilter === 'completed' ? styles.active : ''}`}
            onClick={() => handleFilterChange('completed')}
          >
            Completed
          </button>
        </div>
      </div>
      
      {assignmentLoading ? (
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Loading your assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className={styles.noAssignments}>
          <div className={styles.emptyState}>
            <i className="fas fa-clipboard-list" style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }}></i>
            <h4>No Assignments Yet</h4>
            <p>Your tutor hasn't assigned any homework yet. Check back soon!</p>
          </div>
        </div>
      ) : (
        (() => {
          const filteredAssignments = assignments.filter(assignment => {
            if (assignmentFilter === 'all') return true;
            return assignment.status === assignmentFilter;
          });

          if (filteredAssignments.length === 0) {
            return (
              <div className={styles.noAssignments}>
                <div className={styles.emptyState}>
                  <i className="fas fa-clipboard-list" style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }}></i>
                  <h4>No {assignmentFilter === 'all' ? '' : assignmentFilter.charAt(0).toUpperCase() + assignmentFilter.slice(1)} Assignments</h4>
                  <p>
                    {assignmentFilter === 'completed' 
                      ? 'You haven\'t completed any assignments yet. Start working on your assigned homework!'
                      : assignmentFilter === 'inprogress'
                      ? 'No assignments in progress. Start working on an assigned homework!'
                      : assignmentFilter === 'assigned'
                      ? 'No new assignments. Great job staying on top of your work!'
                      : 'Your tutor hasn\'t assigned any homework yet. Check back soon!'
                    }
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div className={styles.assignmentsGrid}>
              {filteredAssignments.map(assignment => (
                <div key={assignment._id} className={`${styles.assignmentCard} ${styles[assignment.status]}`}>
                  <div className={styles.assignmentHeader}>
                    <div className={`${styles.statusBadge} ${styles[assignment.status]}`}>
                      {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                    </div>
                  </div>
                  
                  <div className={styles.assignmentBody}>
                    <h4 className={styles.assignmentTitle}>
                      {assignment.homework?.homeworkName || 'Homework Assignment'}
                    </h4>
                    <div className={styles.assignmentMeta}>
                      <div className={styles.dateInfo}>
                        <span className={styles.startDate}>
                          <i className="fas fa-calendar-alt"></i>
                          Started: {new Date(assignment.start_date).toLocaleDateString()}
                        </span>
                        {assignment.due_date && (
                          <span className={styles.dueDate}>
                            <i className="fas fa-clock"></i>
                            Due: {new Date(assignment.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {assignment.instructions && (
                        <p className={styles.instructions}>{assignment.instructions}</p>
                      )}
                    </div>
                  </div>
              
              <div className={styles.assignmentActions}>
                {assignment.status === 'completed' ? (
                  <>
                    <button 
                      className={styles.startButton}
                      onClick={() => navigate(`/student/review/${assignment._id}`)}
                    >
                      View
                    </button>
                    <button 
                      className={styles.primaryBtn} 
                      onClick={() => navigate(`/student/review/${assignment._id}`)}
                    >
                      <i className="fas fa-eye"></i>
                      Review
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      className={styles.startButton}
                      onClick={() => navigate(`/student/homework/${assignment._id}`)}
                    >
                      Start
                    </button>
                    <button 
                      className={styles.primaryBtn} 
                      onClick={() => handleStartAssignment(assignment)}
                    >
                      <i className="fas fa-play"></i>
                      {assignment.status === 'inprogress' ? 'Continue' : 'Start Work'}
                    </button>
                  </>
                )}
                {assignment.homework?.filePath && (
                  <button className={styles.secondaryBtn} onClick={() => handleDownloadAssignment(assignment)}>
                    <i className="fas fa-download"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
            </div>
          );
        })()
      )}
    </div>
  );

  const renderClasses = () => (
    <div className={styles.classesContent}>
      <div className={styles.classesHeader}>
        <h3 className={styles.sectionHeading}>My Classes</h3>
        <div className={styles.headerControls}>
          <div className={styles.currentTime}>
            <i className="fas fa-clock"></i>
            <span>Current Time: {currentTime.toLocaleString('en-US', {
              weekday: 'short',
              month: 'short', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })}</span>
          </div>
          <button 
            className={styles.primaryBtn} 
            onClick={loadStudentClasses}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Refreshing...
              </>
            ) : (
              <>
                <i className="fas fa-refresh"></i>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
          <p>Loading your classes...</p>
        </div>
      ) : error ? (
        <div className={styles.errorContainer}>
          <i className="fas fa-exclamation-triangle"></i>
          <h4>Unable to load your classes</h4>
          <p>{error}</p>
          <button onClick={loadStudentClasses} className={styles.retryBtn}>
            <i className="fas fa-refresh"></i>
            Try Again
          </button>
        </div>
      ) : upcomingClasses.length === 0 ? (
        <div className={styles.emptyState}>
          <i className="fas fa-calendar-alt"></i>
          <h4>No upcoming classes</h4>
          <p>You have no scheduled classes at this time.</p>
          <button onClick={loadStudentClasses} className={styles.secondaryBtn}>
            <i className="fas fa-refresh"></i>
            Refresh
          </button>
        </div>
      ) : (
        <div className={styles.classesGrid}>
          {upcomingClasses.map(classItem => {
            const timeFormat = formatClassTime(classItem);
            
            return (
              <div key={classItem._id} className={styles.classCard}>
                <div className={styles.classHeader}>
                  <div className={styles.classIcon}>
                    <i className="fas fa-book"></i>
                  </div>
                  <div className={styles.classInfo}>
                    <h4 className={styles.className}>{classItem.title || classItem.subject}</h4>
                    <p className={styles.classTeacher}>
                      {classItem.tutor ? (classItem.tutor.name || `${classItem.tutor.firstName} ${classItem.tutor.lastName}`) : 'No tutor assigned'}
                    </p>
                  </div>
                  <div className={styles.statusBadge}>
                    Ready to Join
                  </div>
                </div>
                
                <div className={styles.classBody}>
                  {/* Class Schedule Info */}
                  <div className={styles.scheduleInfo}>
                    <div className={styles.scheduleItem}>
                      <i className="fas fa-calendar"></i>
                      <span>{timeFormat.date}</span>
                    </div>
                    <div className={styles.scheduleItem}>
                      <i className="fas fa-clock"></i>
                      <span>{timeFormat.start} - {timeFormat.end}</span>
                    </div>
                    <div className={styles.scheduleItem}>
                      <i className="fas fa-hourglass-half"></i>
                      <span>{classItem.customDuration || classItem.duration || 60} minutes</span>
                    </div>
                    {classItem.scheduleType === 'weekly-recurring' && (
                      <div className={styles.scheduleItem}>
                        <i className="fas fa-repeat"></i>
                        <span>Weekly on {classItem.recurringDays?.map(day => 
                          day.charAt(0).toUpperCase() + day.slice(1)).join(', ') || 'Not specified'}</span>
                      </div>
                    )}
                  </div>

                  {/* Class Ready to Join */}
                  <div className={styles.readyStatus}>
                    <i className="fas fa-play-circle"></i>
                    <span>Ready to join class</span>
                  </div>

                  <div className={styles.classStats}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Type:</span>
                      <span className={styles.statValue}>
                        {classItem.scheduleType === 'weekly-recurring' ? 'Weekly' : 'One-time'}
                      </span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>Subject:</span>
                      <span className={styles.statValue}>{classItem.subject || 'N/A'}</span>
                    </div>
                    {classItem.maxCapacity && (
                      <div className={styles.statItem}>
                        <span className={styles.statLabel}>Capacity:</span>
                        <span className={styles.statValue}>{classItem.students?.length || 0}/{classItem.maxCapacity}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Meeting Controls for scheduled classes */}
                  {/* {(classItem.scheduleType === 'one-time' || 
                    (classItem.scheduleType === 'weekly-recurring' && isToday(classItem))) && 
                   ['scheduled', 'in-progress'].includes(classItem.status) && (
                    <div className={styles.meetingSection}>
                      <MeetingControls
                        classData={{
                          id: classItem._id,
                          subject: classItem.title || classItem.subject,
                          grade: classItem.grade || 'N/A',
                          startTime: classItem.scheduleType === 'weekly-recurring' 
                            ? getTodayClassTime(classItem)?.toISOString() 
                            : classItem.startTime || classItem.classDate,
                          endTime: (() => {
                            const start = classItem.scheduleType === 'weekly-recurring' 
                              ? getTodayClassTime(classItem) 
                              : new Date(classItem.startTime || classItem.classDate);
                            if (start) {
                              const duration = classItem.customDuration || classItem.duration || 60;
                              return new Date(start.getTime() + duration * 60000).toISOString();
                            }
                            return null;
                          })(),
                          tutorName: classItem.tutor ? (classItem.tutor.name || `${classItem.tutor.firstName} ${classItem.tutor.lastName}`) : 'No tutor assigned',
                          studentName: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'You'
                        }}
                        userRole="student"
                        onJoinSession={(data) => {
                          console.log('Student joined session:', data);
                        }}
                        onLeaveSession={(data) => {
                          console.log('Student left session:', data);
                        }}
                      />
                    </div>
                  )} */}

                  {(
                    (classItem.scheduleType === 'one-time' && ['scheduled', 'in-progress'].includes(classItem.status)) ||
                    (classItem.scheduleType === 'weekly-recurring' && isToday(classItem) && ['scheduled', 'in-progress'].includes(classItem.status))
                  ) && (
                    <div className={styles.meetingSection}>
                      <MeetingControls
                        classData={{
                          id: classItem._id,
                          subject: classItem.title || classItem.subject,
                          grade: classItem.grade || 'N/A',
                          startTime: classItem.scheduleType === 'weekly-recurring'
                            ? getTodayClassTime(classItem)?.toISOString()
                            : (getOneTimeClassDateTime(classItem) || parseStartTime(classItem))?.toISOString(),
                          endTime: (() => {
                            const start = classItem.scheduleType === 'weekly-recurring'
                              ? getTodayClassTime(classItem)
                              : (getOneTimeClassDateTime(classItem) || parseStartTime(classItem));
                            if (start) {
                              const duration = classItem.customDuration || classItem.duration || 60;
                              return new Date(start.getTime() + duration * 60000).toISOString();
                            }
                            return null;
                          })(),
                          tutorName: classItem.tutor
                            ? (classItem.tutor.name || `${classItem.tutor.firstName} ${classItem.tutor.lastName}`)
                            : 'No tutor assigned',
                          studentName: user?.firstName
                            ? `${user.firstName} ${user.lastName || ''}`
                            : 'You'
                        }}
                        userRole="student"
                        onJoinSession={(data) => {
                          console.log('Student joined session:', data);
                        }}
                        onLeaveSession={(data) => {
                          console.log('Student left session:', data);
                        }}
                        allowJoinAnytime={classItem.scheduleType === 'one-time'}
                      />
                    </div>
                  )}


                </div>
                
                <div className={styles.classActions}>
                  {/* Direct Join Button - Always Available */}
                  <button 
                    className={styles.joinBtn}
                    onClick={() => handleJoinClass(classItem)}
                  >
                    <i className="fas fa-video"></i>
                    Join Now
                  </button>

                  {/* Additional Actions */}
                  <button className={styles.secondaryBtn}>
                    <i className="fas fa-eye"></i>
                    Details
                  </button>
                  
                  <button className={styles.secondaryBtn}>
                    <i className="fas fa-file-alt"></i>
                    Summary
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Function to get next class from upcomingClasses with proper timing
  const getNextClass = () => {
    if (upcomingClasses.length === 0) return null;
    
    const now = new Date();
    const currentTime = now.getTime();
    
    // First, get all classes that could be active today
    const todaysClasses = upcomingClasses.filter(classItem => {
      // Treat missing scheduleType as 'one-time' (fallback)
      const scheduleType = classItem.scheduleType || 'one-time';
      
      if (scheduleType === 'one-time') {
        const classDateTime = getOneTimeClassDateTime(classItem);
        return classDateTime && classDateTime.toDateString() === now.toDateString();
      } else if (scheduleType === 'weekly-recurring') {
        return isToday(classItem);
      }
      return false;
    });
    
    // Sort classes by proximity to current time
    const classesWithTimes = todaysClasses.map(classItem => {
      // Treat missing scheduleType as 'one-time' (fallback)
      const scheduleType = classItem.scheduleType || 'one-time';
      let classDateTime = null;
      
      if (scheduleType === 'one-time') {
        classDateTime = getOneTimeClassDateTime(classItem);
      } else if (scheduleType === 'weekly-recurring') {
        classDateTime = getTodayClassTime(classItem);
      }
      
      return {
        classItem,
        classDateTime,
        timeDiff: classDateTime ? Math.abs(classDateTime.getTime() - currentTime) : Infinity
      };
    }).filter(item => item.classDateTime !== null);
    
    // Sort by time difference (closest first)
    classesWithTimes.sort((a, b) => a.timeDiff - b.timeDiff);
    
    // Return the closest class today, or the first upcoming class
    return classesWithTimes[0]?.classItem || upcomingClasses[0];
  };

  const nextClass = getNextClass();

  // Function to get class timing status and button text
  const getClassStatus = (classItem) => {
    if (!classItem) return { status: 'none', text: 'No Classes Today', subtext: 'Check your schedule for upcoming classes', canJoin: false };
    
    const now = new Date();
    let classDateTime = null;
    
    // Try to get class date/time based on scheduleType
    if (classItem.scheduleType === 'one-time' || !classItem.scheduleType) {
      // Default to one-time if scheduleType is not specified
      classDateTime = getOneTimeClassDateTime(classItem);
    } else if (classItem.scheduleType === 'weekly-recurring') {
      classDateTime = getTodayClassTime(classItem);
    }
    
    // Fallback: try to parse startTime if classDateTime is still null
    if (!classDateTime && classItem.startTime) {
      try {
        const timeStringRaw = classItem.startTime;
        const timeString = typeof timeStringRaw === 'string' ? timeStringRaw.trim() : '';
        
        if (timeString && timeString.includes(':')) {
          const [hoursStr, minutesStr] = timeString.split(':');
          const hoursInt = parseInt(hoursStr, 10);
          const minutesInt = parseInt(minutesStr || '0', 10);
          
          if (!isNaN(hoursInt) && !isNaN(minutesInt) && hoursInt >= 0 && hoursInt <= 23 && minutesInt >= 0 && minutesInt <= 59) {
            classDateTime = new Date(now);
            classDateTime.setHours(hoursInt, minutesInt, 0, 0);
            console.log('✅ Fallback parsed class datetime:', classDateTime);
          }
        }
      } catch (error) {
        console.error('❌ Error parsing fallback startTime:', error);
      }
    }
    
    if (!classDateTime) {
      return { status: 'scheduled', text: 'Join Class', subtext: `${classItem.title || classItem.subject} - Time not specified`, canJoin: false };
    }
    
    const timeDiff = classDateTime.getTime() - now.getTime();
    const minutesDiff = Math.round(timeDiff / (1000 * 60));
    
    // Calculate class end time based on duration
    const classDuration = classItem.duration || 0;
    const classEndTime = new Date(classDateTime.getTime() + classDuration * 60000);
    const endTimeDiff = classEndTime.getTime() - now.getTime();
    const minutesUntilEnd = Math.round(endTimeDiff / (1000 * 60));
    
    // Class is in the past (ended more than 15 minutes ago)
    if (minutesUntilEnd < -15) {
      return { status: 'ended', text: 'Class Ended', subtext: `${classItem.title || classItem.subject} ended ${Math.abs(minutesUntilEnd)} minutes ago`, canJoin: false };
    }
    
    // Class is currently active (started and hasn't ended yet)
    if (minutesDiff <= 15 && minutesUntilEnd > -15) {
      return { status: 'active', text: 'Join Live Class', subtext: `${classItem.title || classItem.subject} is ready to join`, canJoin: true };
    }
    
    // Class is upcoming today (more than 15 minutes away)
    if (minutesDiff > 15 && minutesDiff <= 1440) { // Within 24 hours
      const hours = Math.floor(minutesDiff / 60);
      const mins = minutesDiff % 60;
      const timeUntil = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;
      return { status: 'upcoming', text: 'Class Starting Soon', subtext: `${classItem.title || classItem.subject} starts in ${timeUntil}`, canJoin: false };
    }
    
    // Fallback for far future classes
    return { status: 'scheduled', text: 'Join Class', subtext: `${classItem.title || classItem.subject}`, canJoin: false };
  };

  const classStatus = getClassStatus(nextClass);

  // Calendar functions
  const handleCalendarMonthChange = (direction) => {
    const newMonth = new Date(selectedCalendarMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedCalendarMonth(newMonth);
  };

  const getStudyDataForDate = (date) => {
    // Check if there are any assignments due on this date
    const dateString = date.toDateString();
    const todayAssignments = assignments.filter(assignment => {
      const dueDate = new Date(assignment.dueDate).toDateString();
      const assignedDate = new Date(assignment.assignedDate).toDateString();
      return dateString === dueDate || dateString === assignedDate || 
             (date >= new Date(assignment.assignedDate) && date <= new Date(assignment.dueDate));
    });

    if (todayAssignments.length === 0) return { status: 'noTasks', assignments: [] };

    const hasCompleted = todayAssignments.some(a => a.status === 'completed');
    const hasInProgress = todayAssignments.some(a => a.status === 'inprogress');
    const hasPending = todayAssignments.some(a => a.status === 'assigned');

    let status = 'pending';
    if (hasCompleted && !hasInProgress && !hasPending) {
      status = 'completed';
    } else if (hasInProgress) {
      status = 'inProgress';
    }

    return { status, assignments: todayAssignments };
  };

  const renderStudyCalendar = () => {
    const year = selectedCalendarMonth.getFullYear();
    const month = selectedCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const today = new Date();

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const studyData = getStudyDataForDate(currentDate);
      const isToday = currentDate.toDateString() === today.toDateString();
      const isPast = currentDate < today;

      days.push(
        <div
          key={day}
          className={`${styles.calendarDay} ${styles[studyData.status]} ${isToday ? styles.today : ''}`}
          onClick={() => studyData.assignments.length > 0 && handleDayClick(currentDate, studyData.assignments)}
        >
          <div className={styles.dayNumber}>{day}</div>
          {studyData.assignments.length > 0 && (
            <div className={styles.dayIndicator}>
              <div className={styles.taskCount}>{studyData.assignments.length}</div>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const handleDayClick = (date, assignments) => {
    // Show assignment details for the selected day
    console.log('Day clicked:', date, 'Assignments:', assignments);
    // You can implement a modal or detailed view here
  };

  return (
    <div className={styles.dashboard}>
      <Header 
        title="Student Dashboard" 
        subtitle={`Welcome back, ${user?.fullName || user?.firstName || mockData.profile.name}`}
        user={user}
      />
      
      <div className={styles.container}>
        {/* Big Start Button Section */}
        <div className={styles.startSection}>
          <div className={styles.bigStartCard}>
            <div className={styles.startContent}>
              <h2>Ready to Learn?</h2>
              <p>{classStatus.subtext}</p>
              <div className={styles.actionButtons}>
                <button 
                  className={`${styles.bigStartButton} ${styles[classStatus.status] || ''}`}
                  onClick={() => {
                    if (classStatus.canJoin) {
                      handleJoinClass(nextClass);
                    } else if (classStatus.status === 'none' || classStatus.status === 'ended') {
                      loadStudentClasses();
                    } else {
                      // For upcoming/scheduled classes not yet joinable, show the schedule
                      loadStudentClasses();
                    }
                  }}
                  disabled={!classStatus.canJoin}
                >
                  <i className={`fas ${classStatus.status === 'active' ? 'fa-video' : 
                                     classStatus.status === 'upcoming' ? 'fa-clock' :
                                     classStatus.status === 'none' ? 'fa-calendar' : 'fa-play'}`}></i>
                  {classStatus.text}
                </button>
                <button 
                  className={styles.studyCalendarButton}
                  onClick={() => setShowStudyCalendar(!showStudyCalendar)}
                >
                  <i className="fas fa-calendar-alt"></i>
                  Study Calendar
                </button>
              </div>
              {nextClass && (
                <div className={styles.classInfo}>
                  <span>
                    <i className="fas fa-user"></i>
                    {nextClass.tutor ? (nextClass.tutor.name || `${nextClass.tutor.firstName} ${nextClass.tutor.lastName}`) : 'Tutor assigned'}
                  </span>
                  <span>
                    <i className="fas fa-clock"></i>
                    {nextClass.customDuration || nextClass.duration || 60} minutes
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Study Calendar Section - Collapsible */}
        {showStudyCalendar && (
          <div className={styles.studyCalendarSection}>
            <div className={styles.calendarHeader}>
              <h3>Study Calendar</h3>
              <button 
                className={styles.closeCalendarBtn}
                onClick={() => setShowStudyCalendar(false)}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className={styles.monthControls}>
              <button 
                onClick={() => handleCalendarMonthChange('prev')} 
                className={styles.monthBtn}
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              
              <div className={styles.monthSelector}>
                <h4>{selectedCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
              </div>
              
              <button 
                onClick={() => handleCalendarMonthChange('next')} 
                className={styles.monthBtn}
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            <div className={styles.calendarGrid}>
              {renderStudyCalendar()}
            </div>
            
            <div className={styles.calendarLegend}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.completed}`}></div>
                <span>Completed</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.inProgress}`}></div>
                <span>In Progress</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.pending}`}></div>
                <span>Pending</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendDot} ${styles.noTasks}`}></div>
                <span>No Tasks</span>
              </div>
            </div>
          </div>
        )}

        {/* Homework Section */}
        <div className={styles.homeworkSection}>
          <div className={styles.homeworkHeader}>
            <h3>Your Homework</h3>
            <div className={styles.homeworkStats}>
              <span className={styles.statItem}>
                <i className="fas fa-clock"></i>
                {assignments.filter(a => a.status === 'assigned').length} Pending
              </span>
              <span className={styles.statItem}>
                <i className="fas fa-play-circle"></i>
                {assignments.filter(a => a.status === 'inprogress').length} In Progress
              </span>
              <span className={styles.statItem}>
                <i className="fas fa-check-circle"></i>
                {assignments.filter(a => a.status === 'completed').length} Completed
              </span>
            </div>
          </div>
          
          <div className={styles.homeworkTable}>
            {assignmentLoading ? (
              <div className={styles.loadingContainer}>
                <LoadingSpinner />
                <p>Loading your homework...</p>
              </div>
            ) : assignments.length === 0 ? (
              <div className={styles.emptyHomework}>
                <i className="fas fa-clipboard-check"></i>
                <h4>No homework assigned yet</h4>
                <p>You're all caught up! New assignments will appear here.</p>
              </div>
            ) : (
              <div className={styles.homeworkList}>
                {assignments.map((assignment, index) => {
                  console.log(`📝 Assignment ${index}:`, assignment);
                  return (
                  <div key={assignment._id} className={`${styles.homeworkCard} ${styles[assignment.status]}`}>
                    <div className={styles.homeworkMain}>
                      <div className={styles.homeworkIcon}>
                        <i className={assignment.status === 'completed' ? 'fas fa-check-circle' : 
                                     assignment.status === 'inprogress' ? 'fas fa-play-circle' : 
                                     'fas fa-clock'}></i>
                      </div>
                      <div className={styles.homeworkInfo}>
                        <h4>{assignment.title || assignment.homework?.homeworkName || 'Homework Assignment'}</h4>
                        <p className={styles.homeworkSubject}>
                          <i className="fas fa-book"></i>
                          {assignment.subject || assignment.homework?.subjectId?.name || 'Subject'} • {assignment.grade || assignment.homework?.grade || 'Grade'}
                        </p>
                        <div className={styles.homeworkMeta}>
                          <span className={styles.dueDate}>
                            <i className="fas fa-calendar"></i>
                            Due: {assignment.dueDate && !isNaN(new Date(assignment.dueDate)) 
                              ? new Date(assignment.dueDate).toLocaleDateString()
                              : 'Not specified'}
                          </span>
                          <span className={`${styles.statusBadge} ${styles[assignment.status]}`}>
                            {assignment.status === 'assigned' ? 'Pending' :
                             assignment.status === 'inprogress' ? 'In Progress' :
                             'Completed'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.homeworkActions}>
                      {assignment.status === 'completed' ? (
                        <button 
                          className={`${styles.startHomeworkBtn} ${styles.viewBtn}`}
                          onClick={() => handleStartAssignment(assignment)}
                        >
                          <i className="fas fa-eye"></i>
                          View
                        </button>
                      ) : (
                        <button 
                          className={styles.startHomeworkBtn}
                          onClick={() => handleStartAssignment(assignment)}
                        >
                          <i className="fas fa-play"></i>
                          {assignment.status === 'assigned' ? 'Start' : 'Continue'}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
