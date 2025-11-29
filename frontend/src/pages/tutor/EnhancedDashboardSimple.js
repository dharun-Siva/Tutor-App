import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../../shared/components/Header';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import MeetingControls from '../../components/MeetingControls';
import CompactClassesList from '../../components/CompactClassesList';
import HomeworkAssignment from './components/HomeworkAssignment';
import SessionParticipantsTable from './components/SessionParticipantsTable';
import SessionParticipantsSummaryCards from './components/SessionParticipantsSummaryCards';
import StudentsTable from './components/StudentsTable';
import { dashboardAPI, sessionParticipantsAPI } from '../../utils/api';
import { getErrorMessage, getStoredUser, clearStoredAuth } from '../../utils/helpers';
import { parseStartTime } from '../../utils/timeParser';
import './EnhancedDashboard.css';
import styles from './EnhancedDashboard.module.css';

const EnhancedTutorDashboard = () => {
  // State management
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sessionParticipants, setSessionParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [notifications] = useState([
    { id: 1, type: 'info', message: 'New student Sarah joined Advanced Mathematics', time: '5 min ago' },
    { id: 2, type: 'warning', message: 'Physics class scheduled in 30 minutes', time: '10 min ago' },
    { id: 3, type: 'success', message: 'Assignment graded successfully', time: '1 hour ago' }
  ]);
  
  // Student filtering state
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all');
  const [studentSortBy, setStudentSortBy] = useState('name');
  
  // Ref to prevent duplicate API calls on mount
  const dataLoadedRef = useRef(false);
  const participantsLoadedRef = useRef(false);
  
  const user = getStoredUser();
  

  // Callback to handle session participants data
  // const handleSessionParticipantsData = (data) => {
  //   setSessionParticipants(data);
  // };

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Helper function to check if a date is today
  const isToday = (classItem) => {
    const now = currentTime;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    console.log('🔍 [TUTOR] isToday check for:', classItem.name || classItem.title);
    console.log('🔍 [TUTOR] Schedule type:', classItem.scheduleType);
    console.log('🔍 [TUTOR] Recurring days:', classItem.recurringDays);
    
    if (classItem.scheduleType === 'weekly-recurring') {
      // If recurringDays is defined, use it
      if (classItem.recurringDays && classItem.recurringDays.length > 0) {
        const dayOfWeek = now.getDay();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = daysOfWeek[dayOfWeek];
        const isScheduledToday = classItem.recurringDays.includes(currentDayName);
        console.log('🔍 [TUTOR] Current day:', currentDayName, 'Scheduled for today?', isScheduledToday);
        return isScheduledToday;
      } else {
        // If no recurringDays specified, check if there's a session scheduled for today
        const hasSessionToday = (classItem.lastSession && 
          new Date(classItem.lastSession.sessionDate).toDateString() === today.toDateString()) ||
          (classItem.nextSession && 
          new Date(classItem.nextSession.sessionDate).toDateString() === today.toDateString());
        
        console.log('🔍 [TUTOR] No recurringDays, checking sessions. Has session today?', hasSessionToday);
        return hasSessionToday;
      }
    } else if (classItem.startTime || classItem.classDate) {
      const classDate = parseStartTime(classItem);
      const isToday = !isNaN(classDate.getTime()) && classDate >= today && classDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      console.log('🔍 [TUTOR] One-time class check. Is today?', isToday, 'parsed:', classDate);
      return isToday;
    }
    
    console.log('🔍 [TUTOR] No valid schedule found');
    return false;
  };

  // Helper function to get today's class time for recurring classes
  const getTodayClassTime = (classItem) => {
    if (classItem.scheduleType !== 'weekly-recurring' || !classItem.startTime) return null;
    
    console.log('🔍 [TUTOR] getTodayClassTime for:', classItem.name || classItem.title);
    console.log('🔍 [TUTOR] Start time:', classItem.startTime);
    
    const now = currentTime;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Parse time string (e.g., "16:00" or "17:45")
    const [hours, minutes] = classItem.startTime.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.error('❌ [TUTOR] Invalid time format:', classItem.startTime);
      return null;
    }
    
    const classDateTime = new Date(today);
    classDateTime.setHours(hours, minutes, 0, 0);
    
    console.log('🔍 [TUTOR] Calculated class time:', classDateTime.toLocaleString());
    return classDateTime;
  };

  // Helper function to determine class time status and join availability
  const getClassTimeStatus = (classItem) => {
    const now = currentTime;
    let startTime;

    console.log('🔍 [TUTOR] Analyzing class time status for:', classItem.title || classItem.subject || classItem.className);
    console.log('📅 [TUTOR] Current time:', now.toLocaleString());
    console.log('📅 [TUTOR] Current day:', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]);
    console.log('🔄 [TUTOR] Class schedule type:', classItem.scheduleType);
    console.log('📅 [TUTOR] Class recurring days:', classItem.recurringDays);
    console.log('📊 [TUTOR] Class status:', classItem.status);
    console.log('🔗 [TUTOR] Meeting link:', classItem.meetingLink ? 'Available' : 'Not available');
    console.log('🔗 [TUTOR] Session meeting link:', classItem.meetingSession?.meetingLink ? 'Available' : 'Not available');

    // ✅ CHECK IF CLASS IS CANCELLED OR COMPLETED
    if (classItem.status === 'cancelled') {
      return {
        status: 'cancelled',
        message: 'This class has been cancelled',
        canJoin: false,
        timeUntil: null
      };
    }

    if (classItem.status === 'completed') {
      return {
        status: 'completed',
        message: 'This class has been completed',
        canJoin: false,
        timeUntil: null
      };
    }

    // Handle different schedule types
    if (classItem.scheduleType === 'weekly-recurring') {
      if (!isToday(classItem)) {
        const dayOfWeek = now.getDay();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        let nextClassDay = null;
        let daysUntilNext = null;
        for (let i = 1; i <= 7; i++) {
          const checkDay = (dayOfWeek + i) % 7;
          const checkDayName = daysOfWeek[checkDay];
          if (classItem.recurringDays && classItem.recurringDays.includes(checkDayName)) {
            nextClassDay = checkDayName;
            daysUntilNext = i;
            break;
          }
        }
        
        return {
          status: 'not-today',
          message: nextClassDay ? `Next class: ${nextClassDay.charAt(0).toUpperCase() + nextClassDay.slice(1)}` : 'No upcoming classes this week',
          canJoin: false,
          timeUntil: null
        };
      }
      startTime = getTodayClassTime(classItem);
    } else {
      // Parse startTime robustly: support full date string, ISO classDate, or time-only strings like "12:15"
      startTime = parseStartTime(classItem);
      if (!isToday(classItem)) {
        return {
          status: 'not-today',
          message: 'Not scheduled for today',
          canJoin: false,
          timeUntil: null
        };
      }
    }

    // Validate startTime
    if (!startTime || isNaN(startTime.getTime())) {
      return {
        status: 'error',
        message: 'Invalid class time',
        canJoin: false,
        timeUntil: null
      };
    }

    const duration = classItem.customDuration || classItem.duration || 60;
    const endTime = new Date(startTime.getTime() + duration * 60000);
    const joinTime = new Date(startTime.getTime() - 15 * 60000); // 15 minutes before (tutors get earlier access)

    console.log('⏰ [TUTOR] Class times - Start:', startTime.toLocaleString(), 'End:', endTime.toLocaleString(), 'Join from:', joinTime.toLocaleString());
    console.log('⏱️ [TUTOR] Current vs Start time difference:', Math.round((startTime.getTime() - now.getTime()) / (60 * 1000)), 'minutes');

    if (now < joinTime) {
      const minutesUntil = Math.ceil((joinTime.getTime() - now.getTime()) / (60 * 1000));
      return {
        status: 'too-early',
        message: `Join available in ${minutesUntil} minutes`,
        canJoin: false,
        timeUntil: minutesUntil
      };
    }

    if (now >= joinTime && now < startTime) {
      const minutesUntil = Math.ceil((startTime.getTime() - now.getTime()) / (60 * 1000));
      return {
        status: 'can-join',
        message: `Class starts in ${minutesUntil} minutes`,
        canJoin: true,
        timeUntil: minutesUntil
      };
    }

    if (now >= startTime && now <= endTime) {
      const minutesLeft = Math.ceil((endTime.getTime() - now.getTime()) / (60 * 1000));
      return {
        status: 'in-progress',
        message: `Class in progress (${minutesLeft} min left)`,
        canJoin: true,
        timeUntil: null
      };
    }

    if (now > endTime) {
      return {
        status: 'ended',
        message: 'Class has ended',
        canJoin: false,
        timeUntil: null
      };
    }

    return {
      status: 'unknown',
      message: 'Status unknown',
      canJoin: false,
      timeUntil: null
    };
  };

  // Helper function to format class time display
  const formatClassTime = (classItem) => {
    let startTime;
    
    try {
      if (classItem.scheduleType === 'weekly-recurring') {
        startTime = getTodayClassTime(classItem);
        if (!startTime) {
          // For display purposes, show the general time
          const [hours, minutes] = (classItem.startTime || '00:00').split(':');
          const tempDate = new Date();
          tempDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          startTime = tempDate;
        }
      } else {
        // Use the same robust parsing as getClassTimeStatus
        startTime = parseStartTime(classItem);
      }
      
      // Validate that startTime is a valid date
      if (isNaN(startTime.getTime())) {
        console.error('❌ [TUTOR] Invalid start time:', classItem.startTime);
        // Fallback to current time
        startTime = new Date();
      }
      
      const duration = classItem.customDuration || classItem.duration || 60;
      const endTime = new Date(startTime.getTime() + duration * 60000);
      
      // Validate end time
      if (isNaN(endTime.getTime())) {
        console.error('❌ [TUTOR] Invalid end time calculation');
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
      console.error('❌ [TUTOR] Error formatting class time:', error);
      return {
        start: 'Error',
        end: 'Error',
        date: 'Error formatting date'
      };
    }
  };

  // Use shared parseStartTime from utils/timeParser for robustness

  // Helper function to get meeting link from various sources
  const getMeetingLink = (classItem) => {
    console.log('🔍 [TUTOR] Getting meeting link for:', classItem.name || classItem.title);
    
    // Check multiple sources for meeting links
    if (classItem.meetingLink) {
      console.log('🔗 [TUTOR] Found direct meeting link');
      return classItem.meetingLink;
    }
    
    if (classItem.meetingSession?.meetingLink) {
      console.log('🔗 [TUTOR] Found meeting session link');
      return classItem.meetingSession.meetingLink;
    }
    
    // Check lastSession for today's meetings
    if (classItem.lastSession?.meetingLink) {
      const sessionDate = new Date(classItem.lastSession.sessionDate);
      const today = new Date();
      
      console.log('🔍 [TUTOR] LastSession debug:', {
        sessionDateRaw: classItem.lastSession.sessionDate,
        sessionDate: sessionDate.toDateString(),
        today: today.toDateString(),
        sessionDateTime: sessionDate.toISOString(),
        todayDateTime: today.toISOString()
      });
      
      const isSessionToday = sessionDate.toDateString() === today.toDateString();
      
      if (isSessionToday) {
        console.log('🔗 [TUTOR] Found today\'s session meeting link in lastSession');
        return classItem.lastSession.meetingLink;
      } else {
        console.log('🔍 [TUTOR] LastSession not today - skipping');
      }
    }
    
    // Check nextSession for upcoming meetings
    if (classItem.nextSession?.meetingLink) {
      const sessionDate = new Date(classItem.nextSession.sessionDate);
      const today = new Date();
      
      console.log('🔍 [TUTOR] NextSession debug:', {
        sessionDateRaw: classItem.nextSession.sessionDate,
        sessionDate: sessionDate.toDateString(),
        today: today.toDateString()
      });
      
      const isSessionToday = sessionDate.toDateString() === today.toDateString();
      
      if (isSessionToday) {
        console.log('🔗 [TUTOR] Found today\'s session meeting link in nextSession');
        return classItem.nextSession.meetingLink;
      } else {
        console.log('🔍 [TUTOR] NextSession not today - skipping');
      }
    }
    
    console.log('❌ [TUTOR] No meeting link found in any source');
    return null;
  };

  // Handle joining a class
  const handleJoinClass = async (classItem) => {
    const timeStatus = getClassTimeStatus(classItem);
    
    console.log('🎯 [TUTOR] Attempting to join class:', classItem.title || classItem.subject || classItem.className);
    console.log('🎯 [TUTOR] Time status:', timeStatus);
    console.log('🎯 [TUTOR] Class data for meeting link check:', {
      directLink: classItem.meetingLink,
      sessionLink: classItem.meetingSession?.meetingLink,
      lastSessionLink: classItem.lastSession?.meetingLink,
      lastSessionDate: classItem.lastSession?.sessionDate,
      nextSessionLink: classItem.nextSession?.meetingLink,
      nextSessionDate: classItem.nextSession?.sessionDate
    });
    
    if (timeStatus.canJoin) {
      const meetingLink = getMeetingLink(classItem);
      
      if (meetingLink) {
        console.log('🎯 [TUTOR] Joining class via meeting link:', meetingLink);
        
        // Record session participation before opening meeting (like student dashboard)
        try {
          console.log('📝 [TUTOR] Recording session participation...');
          const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
          
          const participationResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/join`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              meeting_class_id: classItem.id
            })
          });

          if (participationResponse.ok) {
            const participationData = await participationResponse.json();
            console.log('✅ [TUTOR] Participation response:', participationData);

            // Determine canonical class id to store (prefer backend returned id)
            const dbMeetingClassId = participationData?.data?.meeting_class_id || participationData?.data?.meetingClassId || participationData?.meeting_class_id;
            const fallbackClassId = classItem._id || classItem.id || classItem.meetingId || (classItem.meetingLink && classItem.meetingLink.split('/meeting/')[1]) || '';
            const finalClassIdToStore = (dbMeetingClassId && dbMeetingClassId !== 'undefined') ? dbMeetingClassId : fallbackClassId;
            if (finalClassIdToStore && finalClassIdToStore !== 'undefined') {
              localStorage.setItem('meeting_class_id', finalClassIdToStore);
              console.log('📋 [TUTOR] Stored meeting_class_id in localStorage:', finalClassIdToStore);
            } else {
              console.warn('⚠️ [TUTOR] No valid meeting_class_id to store after join', { participationData, fallbackClassId });
            }

            // Store sessionParticipantId only when backend returned a valid id
            const sessionId = participationData?.sessionParticipantId || participationData?.data?._id || participationData?.data?.id;
            if (sessionId && String(sessionId).trim() !== '' && String(sessionId) !== 'undefined') {
              localStorage.setItem('sessionParticipantId', String(sessionId));
              console.log('✅ [TUTOR] Session participation recorded:', participationData.message, 'sessionParticipantId:', String(sessionId));
            } else {
              console.warn('⚠️ [TUTOR] Join response did not include a valid sessionParticipantId:', participationData);
            }

            // Persist class metadata so the meeting page has correct title/start_time/duration
            try {
              const classTitle = participationData?.data?.title || classItem.title || '';
              const classStartTime = participationData?.data?.start_time || classItem.startTime || '';
              const classDuration = participationData?.data?.duration || classItem.duration || '';
              if (classTitle) localStorage.setItem('classTitle', classTitle);
              if (classStartTime) localStorage.setItem('classStartTime', classStartTime);
              if (classDuration !== undefined && classDuration !== null) localStorage.setItem('classDuration', String(classDuration));
              console.log('📋 [TUTOR] Stored class metadata in localStorage:', { classTitle, classStartTime, classDuration });
            } catch (e) {
              console.warn('⚠️ [TUTOR] Failed to persist class metadata to localStorage', e);
            }
          } else {
            console.warn('⚠️ [TUTOR] Failed to record session participation:', participationResponse.status);
          }
        } catch (participationError) {
          console.error('❌ [TUTOR] Error recording session participation:', participationError);
          // Continue with meeting join even if participation recording fails
        }
        
        // Open meeting link
        window.open(meetingLink, '_blank');
      } else {
        // For tutors, suggest creating a session if none exists
        const errorMsg = `No meeting session found for ${classItem.subject || classItem.title || classItem.className}. Please create a meeting session first or contact your administrator.`;
        alert(errorMsg);
        console.log('❌ [TUTOR] No meeting link available for class:', classItem);
      }
    } else {
      const errorMsg = `Cannot join class: ${timeStatus.message}`;
      console.log('❌ [TUTOR]', errorMsg);
      alert(errorMsg);
    }
  };

  useEffect(() => {
    // Only load dashboard data once on mount
    if (user?.id && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      loadDashboardData();
    } else if (!user?.id) {
      setError('User not found. Please login again.');
      setLoading(false);
    }
  }, [user?.id]); // Depend on user?.id only

  // Load session participants when tab changes to session-participants
  useEffect(() => {
    if (activeTab === 'session-participants' && !participantsLoadedRef.current) {
      participantsLoadedRef.current = true;
      loadSessionParticipants();
    }
  }, [activeTab]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getEnhancedTutorData();
      console.log('🔧 [TUTOR] Full API Response:', response);
      console.log('🔧 [TUTOR] Dashboard Data:', response.data);
      console.log('🔧 [TUTOR] Stats Data:', response.data?.data?.stats);
      console.log('🔧 [TUTOR] Classes Count:', response.data?.data?.classes?.length);
      
      if (response.data?.data?.classes) {
        console.log('🔧 [TUTOR] Classes Data:', response.data.data.classes);
        response.data.data.classes.forEach((classItem, index) => {
          console.log(`🔧 [TUTOR] Class ${index + 1}:`, {
            name: classItem.name || classItem.title,
            subject: classItem.subject,
            meetingLink: classItem.meetingLink,
            meetingSession: classItem.meetingSession,
            scheduleType: classItem.scheduleType,
            startTime: classItem.startTime,
            allProperties: Object.keys(classItem)
          });
        });
      }
      
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadSessionParticipants = async () => {
    try {
      setParticipantsLoading(true);
      const response = await sessionParticipantsAPI.getHistory();
      if (response.data.success) {
        setSessionParticipants(response.data.data);
      }
    } catch (err) {
      console.error('Error loading session participants:', err);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const refreshData = () => {
    loadDashboardData();
    loadSessionParticipants();
  };

  // Logout function
  const handleLogout = () => {
    clearStoredAuth();
    window.location.href = '/login';
  };

  // Filter and sort students
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = dashboardData?.data?.students || [];

    // Apply search filter
    if (studentSearchTerm.trim()) {
      const searchLower = studentSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(student => {
        const name = (student.fullName || `${student.firstName} ${student.lastName}` || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        const grade = (student.grade || '').toLowerCase();
        return name.includes(searchLower) || email.includes(searchLower) || grade.includes(searchLower);
      });
    }

    // Apply status filter
    if (studentStatusFilter !== 'all') {
      filtered = filtered.filter(student => {
        // For now, all students are considered 'active'
        // You can modify this logic based on your actual student status field
        return studentStatusFilter === 'active';
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (studentSortBy) {
        case 'name':
          const nameA = (a.fullName || `${a.firstName} ${a.lastName}` || '').toLowerCase();
          const nameB = (b.fullName || `${b.firstName} ${b.lastName}` || '').toLowerCase();
          return nameA.localeCompare(nameB);
        case 'email':
          return (a.email || '').localeCompare(b.email || '');
        case 'grade':
          return (a.grade || '').localeCompare(b.grade || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [dashboardData?.data?.students, studentSearchTerm, studentStatusFilter, studentSortBy]);

  if (loading) {
    return (
      <div className="enhanced-dashboard">
        <Header title="Enhanced Tutor Dashboard" user={user} />
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading your enhanced dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="enhanced-dashboard">
        <Header title="Enhanced Tutor Dashboard" user={user} />
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Dashboard Error</h3>
          <p>{error}</p>
          <button onClick={refreshData} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <Header 
        title="Tutor Dashboard" 
        userRole="tutor"
        userName={user?.fullName || `${user?.firstName} ${user?.lastName}` || user?.firstName}
        onLogout={handleLogout}
        rightActions={
          <button className={styles.headerAction}>
            <i className="fas fa-bell"></i>
            <span className={styles.notificationCount}>
              {notifications?.length || 0}
            </span>
          </button>
        }
      />
      
      <div className={styles.dashboardLayout}>
        {/* Left Sidebar Navigation */}
        <div className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}>
          <div className={styles.sidebarProfile}>
            <div className={styles.profileInfo}>
              <div className={styles.profileAvatar}>
                {(user?.fullName || user?.firstName || 'T').charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h4 className={styles.profileName}>
                    {user?.fullName || `${user?.firstName} ${user?.lastName}` || user?.firstName || 'Tutor'}
                  </h4>
                  <p className={styles.profileRole}>Tutor Account</p>
                </div>
              )}
            </div>
          </div>
          
          <div className={styles.sidebarContent}>
            <nav className={styles.sidebarNav}>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'overview' ? styles.active : ''}`}
                onClick={() => setActiveTab('overview')}
                title="Overview"
              >
                <i className="fas fa-home"></i>
                <span className={styles.sidebarButtonText}>Overview</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'classes' ? styles.active : ''}`}
                onClick={() => setActiveTab('classes')}
                title="Classes"
              >
                <i className="fas fa-chalkboard-teacher"></i>
                <span className={styles.sidebarButtonText}>Classes</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'students' ? styles.active : ''}`}
                onClick={() => setActiveTab('students')}
                title="Students"
              >
                <i className="fas fa-user-graduate"></i>
                <span className={styles.sidebarButtonText}>Students</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'homework' ? styles.active : ''}`}
                onClick={() => setActiveTab('homework')}
                title="Homework"
              >
                <i className="fas fa-clipboard-list"></i>
                <span className={styles.sidebarButtonText}>Homework</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'materials' ? styles.active : ''}`}
                onClick={() => setActiveTab('materials')}
                title="Materials"
              >
                <i className="fas fa-folder-open"></i>
                <span className={styles.sidebarButtonText}>Materials</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'session-participants' ? styles.active : ''}`}
                onClick={() => setActiveTab('session-participants')}
                //title="Session Participants"
                title="Billings"
              >
                <i className="fas fa-file-invoice-dollar"></i>
               
                <span className={styles.sidebarButtonText}>Billings</span>
              </button>
            </nav>
          </div>
          
          {/* Collapse/Expand Toggle on the Right Edge */}
          <div className={styles.sidebarToggle}>
            <button 
              className={styles.toggleButton}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={styles.mainContent}>
          <div className={styles.container}>
            {/* Tab Content */}
            <div className={styles.tabContent}>
            {activeTab === 'overview' && (
              <div className="overview-content">
                {/* Quick Overview Statistics */}
                <div className={styles.overviewStatsSection}>
                  <h3 className={styles.overviewTitle}>Quick Overview</h3>
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <div className={styles.statIcon}>📚</div>
                      <div className={styles.statContent}>
                        <h3>{dashboardData?.data?.stats?.totalClasses || dashboardData?.data?.classes?.length || 0}</h3>
                        <p>Active Classes</p>
                        <small className={styles.statTrend}>+2 this month</small>
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <div className={styles.statIcon}>👥</div>
                      <div className={styles.statContent}>
                        <h3>{dashboardData?.data?.stats?.totalStudents || 0}</h3>
                        <p>Total Students</p>
                        <small className={styles.statSubLabel}>Across all classes</small>
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <div className={styles.statIcon}>📅</div>
                      <div className={styles.statContent}>
                        <h3>{dashboardData?.data?.classes?.length || 0}</h3>
                        <p>Scheduled Sessions</p>
                        <small className={styles.statSubLabel}>By admin</small>
                      </div>
                    </div>

                    <div className={styles.statCard}>
                      <div className={styles.statIcon}>⏰</div>
                      <div className={styles.statContent}>
                        <h3>{(() => {
                          const hours = dashboardData?.data?.stats?.totalTeachingHours || 0;
                          if (hours < 0.1) {
                            // Less than 6 minutes, show in minutes
                            const minutes = Math.round(hours * 60);
                            return minutes > 0 ? `${minutes}m` : '0m';
                          } else if (hours < 1) {
                            // Less than 1 hour, show with 1 decimal
                            return `${hours.toFixed(1)}h`;
                          } else {
                            // 1+ hours, show rounded
                            return `${Math.round(hours)}h`;
                          }
                        })()}</h3>
                        <p>Teaching Hours</p>
                        <small className={styles.statSubLabel}>This month</small>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="content-grid">
                  <div className="recent-activity">
                    <h3>🕒 Recent Activity</h3>
                    <div className="activity-list">
                      <div className="activity-item">
                        <span className="activity-icon success">✅</span>
                        <div className="activity-text">
                          <p>Advanced Mathematics class completed</p>
                          <small>2 hours ago</small>
                        </div>
                      </div>
                      <div className="activity-item">
                        <span className="activity-icon info">👨‍🎓</span>
                        <div className="activity-text">
                          <p>New student enrolled in Physics</p>
                          <small>4 hours ago</small>
                        </div>
                      </div>
                      <div className="activity-item">
                        <span className="activity-icon warning">📚</span>
                        <div className="activity-text">
                          <p>Material uploaded for SAT Prep</p>
                          <small>1 day ago</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="upcoming-schedule">
                    <h3>📅 Today's Schedule</h3>
                    <div className="schedule-list">
                      {(() => {
                        // Filter to only show today's classes from the main classes data
                        const todaysClasses = dashboardData?.data?.classes?.filter(item => {
                          const isScheduledToday = isToday(item);
                          console.log('🔍 [OVERVIEW] Checking if class is today:', {
                            className: item.name || item.title,
                            scheduleType: item.scheduleType,
                            startTime: item.startTime,
                            isToday: isScheduledToday,
                            hasLastSession: !!item.lastSession,
                            lastSessionDate: item.lastSession?.sessionDate,
                            hasNextSession: !!item.nextSession,
                            nextSessionDate: item.nextSession?.sessionDate
                          });
                          return isScheduledToday;
                        }) || [];
                        
                        console.log('📅 [OVERVIEW] Today\'s classes found:', todaysClasses.length);
                        console.log('📅 [OVERVIEW] All classes data:', dashboardData?.data?.classes?.map(c => ({
                          name: c.name || c.title,
                          scheduleType: c.scheduleType,
                          startTime: c.startTime
                        })));
                        
                        return todaysClasses.length > 0 ? (
                          todaysClasses.map((item, index) => {
                            const timeStatus = getClassTimeStatus(item);
                            const meetingLink = getMeetingLink(item);
                            
                            console.log('🎯 [OVERVIEW] Class status:', {
                              className: item.name || item.title,
                              timeStatus: timeStatus.status,
                              canJoin: timeStatus.canJoin,
                              hasMeetingLink: !!meetingLink
                            });
                            
                            return (
                            <div key={index} className="schedule-item" style={{
                              border: timeStatus.status === 'in-progress' ? '2px solid #28a745' : '1px solid #eee',
                              backgroundColor: timeStatus.status === 'in-progress' ? '#8892a0ff' : '#a9bae9ff'
                            }}>
                              <div className="schedule-time">
                                <span className="time-icon">⏰</span>
                                <span>{item.startTime || 'TBA'}</span>  
                                {timeStatus.status === 'in-progress' && (
                                  <span style={{color: '#28a745', fontWeight: 'bold', marginLeft: '8px'}}>
                                    🟢 LIVE
                                  </span>
                                )}
                              </div>
                              <div className="schedule-content">
                                <h5>{item.name || item.title}</h5>
                                <p>{item.subject}</p>
                                <div className="schedule-status">
                                  <small className={`status-message ${timeStatus.status}`}>
                                    {timeStatus.message}
                                  </small>
                                </div>
                                
                                {/* Meeting Link Status for Overview */}
                                <div className="meeting-link-status" style={{marginTop: '6px', marginBottom: '8px'}}>
                                  {(() => {
                                    if (meetingLink) {
                                      let sourceMessage = 'Meeting link available';
                                      let iconColor = '#28a745';
                                      
                                      if (item.meetingLink) {
                                        sourceMessage = 'Direct link ready';
                                      } else if (item.lastSession?.meetingLink) {
                                        sourceMessage = 'Session link ready';
                                        iconColor = '#007bff';
                                      } else if (item.nextSession?.meetingLink) {
                                        sourceMessage = 'Upcoming session ready';
                                        iconColor = '#6f42c1';
                                      }
                                      
                                      return (
                                        <small style={{color: iconColor, fontSize: '12px'}}>
                                          <i className="fas fa-check-circle"></i> {sourceMessage}
                                        </small>
                                      );
                                    } else {
                                      return (
                                        <small style={{color: '#ffc107', fontSize: '12px'}}>
                                          <i className="fas fa-exclamation-triangle"></i> No meeting link available
                                        </small>
                                      );
                                    }
                                  })()}
                                </div>
                                
                                <div className="schedule-actions">
                                  {/* Enhanced Join Button for Overview */}
                                  {timeStatus.canJoin ? (
                                    <button 
                                      className={`btn btn-sm btn-primary ${timeStatus.status === 'in-progress' ? 'btn-success' : ''}`}
                                      onClick={() => handleJoinClass(item)}
                                      disabled={!meetingLink}
                                      title={!meetingLink ? 'Meeting link not available yet' : timeStatus.message}
                                      style={{
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        padding: '6px 12px',
                                        minWidth: '100px',
                                        boxShadow: timeStatus.status === 'in-progress' ? '0 0 8px rgba(40, 167, 69, 0.4)' : 'none'
                                      }}
                                    >
                                      <i className="fas fa-video" style={{marginRight: '5px'}}></i>
                                      {!meetingLink ? 
                                        'Link Pending' : 
                                        timeStatus.status === 'in-progress' ? '🟢 JOIN NOW' : 'Join Session'
                                      }
                                    </button>
                                  ) : (
                                    <button 
                                      className="btn btn-sm btn-outline-secondary"
                                      disabled
                                      title={timeStatus.message}
                                      style={{
                                        fontSize: '13px',
                                        padding: '6px 12px',
                                        minWidth: '100px'
                                      }}
                                    >
                                      <i className={
                                        timeStatus.status === 'too-early' ? 'fas fa-clock' :
                                        timeStatus.status === 'ended' ? 'fas fa-check' :
                                        timeStatus.status === 'not-today' ? 'fas fa-calendar' :
                                        'fas fa-ban'
                                      } style={{marginRight: '5px'}}></i>
                                      {timeStatus.status === 'too-early' ? `Wait ${timeStatus.timeUntil}m` :
                                       timeStatus.status === 'ended' ? 'Ended' :
                                       timeStatus.status === 'not-today' ? 'Not Today' :
                                       'Unavailable'}
                                    </button>
                                  )}
                                  
                                  <button className="btn btn-sm btn-outline-info" style={{marginLeft: '6px'}}>
                                    <i className="fas fa-eye"></i> Details
                                  </button>
                                </div>
                              </div>
                            </div>
                            );
                          })
                        ) : (
                          <div className="empty-schedule">
                            <span className="empty-icon">📅</span>
                            <p>No classes scheduled for today</p>
                            <small>Check your weekly schedule or contact your administrator</small>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'classes' && (
              <div className="classes-content">
                <CompactClassesList
                  classes={dashboardData?.data?.classes || []}
                  loading={loading}
                  error={error}
                  onRefresh={refreshData}
                  onJoinClass={handleJoinClass}
                  getClassTimeStatus={getClassTimeStatus}
                  formatClassTime={formatClassTime}
                  user={user}
                />
              </div>
            )}

            {activeTab === 'students' && (
              <StudentsTable 
                students={dashboardData?.data?.students || []}
                searchTerm={studentSearchTerm}
                onSearchChange={setStudentSearchTerm}
                statusFilter={studentStatusFilter}
                onStatusFilterChange={setStudentStatusFilter}
                sortBy={studentSortBy}
                onSortChange={setStudentSortBy}
                loading={loading}
              />
            )}

            {activeTab === 'materials' && (
              <div className="materials-content">
                <div className="content-header">
                  <h3>📁 Course Materials</h3>
                  <button className="btn btn-primary">📤 Upload Material</button>
                </div>
                <div className="materials-grid">
                  <div className="material-card">
                    <div className="material-icon">📄</div>
                    <h5>Advanced Mathematics - Chapter 1</h5>
                    <p>📁 PDF • 2.5 MB</p>
                    <div className="material-actions">
                      <button className="btn-icon">👁️</button>
                      <button className="btn-icon">📥</button>
                      <button className="btn-icon">🗑️</button>
                    </div>
                  </div>
                  <div className="material-card">
                    <div className="material-icon">📊</div>
                    <h5>Physics Presentation</h5>
                    <p>📁 PPTX • 5.2 MB</p>
                    <div className="material-actions">
                      <button className="btn-icon">👁️</button>
                      <button className="btn-icon">📥</button>
                      <button className="btn-icon">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {activeTab === 'session-participants' && (
              <div className="session-participants-content">
                <div className="content-header">
                  <h3>Billings</h3>
                </div>
                {/* Summary Cards - Using shared sessionParticipants data */}
                <SessionParticipantsSummaryCards user={user} participants={sessionParticipants} />
                {/* Table - Using shared sessionParticipants data */}
                <SessionParticipantsTable user={user} participants={sessionParticipants} />
              </div>
            )}

            {activeTab === 'homework' && (
              <div className="homework-content">
                {console.log('🎯 Enhanced Dashboard - Homework tab is rendering, user:', user)}
                <HomeworkAssignment user={user} />
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedTutorDashboard;
