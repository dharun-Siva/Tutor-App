
import React, { useState, useEffect, useCallback, useRef } from 'react';
import BillingsTable from './components/BillingsTable';
import Header from '../../shared/components/Header';
import StatsCard from '../../shared/components/StatsCard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import MeetingControls from '../../components/MeetingControls';
import CompactClassesList from '../../components/CompactClassesList';
import HomeworkAssignment from './components/HomeworkAssignment';
import { dashboardAPI } from '../../utils/api';
import { getStoredUser } from '../../utils/helpers';
import './Dashboard.module.css';
import styles from './Dashboard.module.css';
import { parseStartTime } from '../../utils/timeParser';

const TutorDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [todaysSchedule, setTodaysSchedule] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayLoading, setTodayLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const user = getStoredUser();
  
  // Ref to prevent duplicate API calls on mount
  const dataLoadedRef = useRef(false);

  // Memoize the user ID to prevent unnecessary re-renders
  const userId = user?.id;

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Loading tutor dashboard data...');
      
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please login again.');
        setLoading(false);
        return;
      }

      // Use the dashboardAPI utility which handles the correct base URL
      const response = await dashboardAPI.getTutorData();
      console.log('Dashboard data received:', response.data);
      setDashboardData(response.data);
      setError(null);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (err.response) {
        const errorMsg = err.response.data?.error || err.response.data?.message || `Server error (${err.response.status})`;
        setError(errorMsg);
      } else if (err.request) {
        setError('Unable to connect to server. Please check if the backend is running.');
      } else {
        setError(`Network error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTodaysSchedule = useCallback(async () => {
    try {
      setTodayLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      console.log('Loading today\'s schedule...');
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/dashboard/tutor/today`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Today\'s schedule data received:', data);
        setTodaysSchedule(data.data?.todaysSchedule || []);
      } else {
        console.error('Failed to load today\'s schedule:', response.status);
      }
    } catch (err) {
      console.error('Error loading today\'s schedule:', err);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // Helper function to check if a date is today
  const isToday = (classItem) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (classItem.scheduleType === 'weekly-recurring' && classItem.recurringDays) {
      const dayOfWeek = now.getDay();
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDayName = daysOfWeek[dayOfWeek];
      return classItem.recurringDays.includes(currentDayName);
    } else if (classItem.startTime || classItem.classDate) {
      const classDate = parseStartTime(classItem);
      return !isNaN(classDate.getTime()) && classDate >= today && classDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return false;
  };

  // Helper function to get today's class time for recurring classes
  const getTodayClassTime = (classItem) => {
    if (classItem.scheduleType !== 'weekly-recurring' || !classItem.startTime) return null;
    
    const now = new Date();
    const classTime = parseStartTime(classItem);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return new Date(today.getTime() + (classTime.getHours() * 60 + classTime.getMinutes()) * 60 * 1000);
  };

  // Helper function to determine class time status and join availability (same as student dashboard)
  const getClassTimeStatus = (classItem) => {
    // Support both classItem.tutor (object or id) and classItem.tutorId
    const tutorId = classItem.tutorId || (classItem.tutor && (classItem.tutor._id || classItem.tutor));
    if (!tutorId || !user || tutorId.toString() !== user.id.toString()) {
      return {
        status: 'not-assigned',
        message: 'You are not assigned to this class',
        canJoin: false,
        timeUntil: null
      };
    }

    // For one-time classes, allow join at any time after scheduling (ignore date)
    if (classItem.scheduleType !== 'weekly-recurring') {
      return {
        status: 'can-join',
        message: 'You can join this class',
        canJoin: true,
        timeUntil: null
      };
    }

    // For recurring classes, keep original logic
    const now = new Date();
    let startTime;
    if (classItem.scheduleType === 'weekly-recurring') {
      if (!isToday(classItem)) {
        const dayOfWeek = now.getDay();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        let nextClassDay = null;
        for (let i = 1; i <= 7; i++) {
          const checkDay = (dayOfWeek + i) % 7;
          const checkDayName = daysOfWeek[checkDay];
          if (classItem.recurringDays && classItem.recurringDays.includes(checkDayName)) {
            nextClassDay = checkDayName;
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
      const joinTime = new Date(startTime.getTime() - 15 * 60000);
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
          message: `Class in progress (${minutesLeft} min left)` ,
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
    }
  };

  // Helper function to format class time for display
  const formatClassTime = (classItem) => {
    let startTime;
    
    try {
      if (classItem.scheduleType === 'weekly-recurring') {
        startTime = getTodayClassTime(classItem);
        if (!startTime) {
          return {
            date: 'Recurring class',
            start: 'Time not set',
            end: 'Time not set'
          };
        }
      } else {
        startTime = parseStartTime(classItem);
      }

      if (!startTime || isNaN(startTime.getTime())) {
        return {
          date: 'Invalid date',
          start: 'Invalid time',
          end: 'Invalid time'
        };
      }

      const duration = classItem.customDuration || classItem.duration || 60;
      const endTime = new Date(startTime.getTime() + duration * 60000);

      return {
        date: startTime.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        start: startTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        end: endTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    } catch (error) {
      return {
        date: 'Error formatting date',
        start: 'Error formatting time',
        end: 'Error formatting time'
      };
    }
  };

  // Handle joining a class with latest meeting ID
  const handleJoinClass = async (classItem) => {
    const timeStatus = getClassTimeStatus(classItem);
    
    if (!timeStatus.canJoin) {
      alert(`Cannot join class: ${timeStatus.message}`);
      return;
    }

    try {
      console.log('🔗 Tutor preparing to join meeting for class:', classItem.title || classItem.subject);
      
      // First, fetch the latest class data to ensure we have the most recent meeting ID
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/dashboard/tutor/dashboard`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      let latestMeetingId = classItem.meetingId;
      let latestMeetingLink = classItem.meetingLink;
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.classes) {
          // Find the current class in the fresh data
          const updatedClass = data.data.classes.find(cls => cls.id === classItem.id);
          if (updatedClass) {
            latestMeetingId = updatedClass.meetingId || latestMeetingId;
            latestMeetingLink = updatedClass.meetingLink || latestMeetingLink;
            console.log('✅ Tutor fetched latest meeting data:', { meetingId: latestMeetingId, meetingLink: latestMeetingLink });
          } else {
            console.log('⚠️ Tutor using original meeting data as fallback');
          }
        }
      } else {
        console.log('⚠️ Failed to fetch latest class data, tutor using original meeting data');
      }

      // Build meeting URL with user details - construct proper full name
      const userName = user?.firstName && user?.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.firstName || user?.username || 'Tutor';
      const userId = user?.id;
      const role = user?.role || 'tutor';
      
      let meetingUrl;
      
      // Use meeting ID to construct URL (preferred method)
      if (latestMeetingId) {
        const classDbId = classItem._id || classItem.id || '';
        meetingUrl = `/meeting/${latestMeetingId}?userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&classId=${encodeURIComponent(classDbId)}&displayClean=true`;
        console.log('🎯 Tutor joining with latest meeting ID:', latestMeetingId);
      } 
      // Fallback to meeting link if available
      else if (latestMeetingLink) {
  const classDbId = classItem._id || classItem.id || '';
  meetingUrl = `${latestMeetingLink}?userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&classId=${encodeURIComponent(classDbId)}&displayClean=true`;
        console.log('🎯 Tutor joining via meeting link:', latestMeetingLink);
      }
      // Final fallback for meeting session link
      else if (classItem.meetingSession?.meetingLink) {
  const classDbId = classItem._id || classItem.id || '';
  meetingUrl = `${classItem.meetingSession.meetingLink}?userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&classId=${encodeURIComponent(classDbId)}&displayClean=true`;
        console.log('🎯 Tutor joining via session meeting link:', classItem.meetingSession.meetingLink);
      } else {
        alert(`No meeting session found for ${classItem.subject || classItem.title}. Please create a meeting session first or contact your administrator.`);
        console.log('❌ No meeting data available for class:', classItem);
        return;
      }

      console.log('👤 Tutor details:', { userName, userId, role });
      console.log('📋 Class meeting data:', { 
        id: classItem.id, 
        title: classItem.title || classItem.subject,
        meetingId: latestMeetingId, 
        meetingLink: latestMeetingLink 
      });

      // Record session participation before opening meeting
      try {
        console.log('📝 Recording session participation...');
        // Prefer DB primary key, then id, then meetingId (URL identifier), then extract from meetingLink
        const meetingClassId = classItem._id || classItem.id || classItem.meetingId || (classItem.meetingLink && classItem.meetingLink.split('/meeting/')[1]) || null;
        const participationResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/join`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            meeting_class_id: meetingClassId
          })
        });

        if (participationResponse.ok) {
          const participationData = await participationResponse.json();
          console.log('Participation response:', participationData);
          // Determine canonical class id to store (prefer backend returned id)
          const dbMeetingClassId = participationData?.data?.meeting_class_id || participationData?.data?.meetingClassId || participationData?.meeting_class_id;
          const finalClassIdToStore = (dbMeetingClassId && dbMeetingClassId !== 'undefined') ? dbMeetingClassId : (meetingClassId || classItem._id || classItem.id || '');
          if (finalClassIdToStore && finalClassIdToStore !== 'undefined') {
            localStorage.setItem('meeting_class_id', finalClassIdToStore);
            console.log('[DEBUG] [TUTOR] Stored meeting_class_id in localStorage:', finalClassIdToStore);
          }

          // Store sessionParticipantId only when backend returned a valid id
          const sessionId = participationData?.sessionParticipantId || participationData?.data?.id || participationData?.data?._id;
          if (sessionId && String(sessionId).trim() !== '' && String(sessionId) !== 'undefined') {
            localStorage.setItem('sessionParticipantId', String(sessionId));
            console.log('[DEBUG] [TUTOR] Stored sessionParticipantId in localStorage:', String(sessionId));
          } else {
            console.warn('[WARN] [TUTOR] No valid sessionParticipantId returned from join response, not writing to localStorage', participationData);
          }

          // Persist class metadata for meeting tab to use (avoids default 'Class')
          try {
            const classTitle = participationData?.data?.title || classItem.title || '';
            const classStartTime = participationData?.data?.start_time || classItem.startTime || '';
            const classDuration = participationData?.data?.duration || classItem.duration || '';
            if (classTitle) localStorage.setItem('classTitle', classTitle);
            if (classStartTime) localStorage.setItem('classStartTime', classStartTime);
            if (classDuration !== undefined && classDuration !== null) localStorage.setItem('classDuration', String(classDuration));
            console.log('[DEBUG] [TUTOR] Stored class metadata in localStorage:', { classTitle, classStartTime, classDuration });
          } catch (e) {
            console.warn('[WARN] [TUTOR] Failed to persist class metadata to localStorage', e);
          }

          console.log('✅ Session participation recorded:', participationData.message);
        } else {
          console.warn('⚠️ Failed to record session participation:', participationResponse.status);
        }
      } catch (participationError) {
        console.error('❌ Error recording session participation:', participationError);
        // Continue with meeting join even if participation recording fails
      }

      // Open meeting in new tab
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
      
    } catch (error) {
      console.error('❌ Error joining meeting:', error);
      
      // Fallback to original class data if API call fails
      const fallbackMeetingId = classItem.meetingId;
      const fallbackMeetingLink = classItem.meetingLink;
      
      if (fallbackMeetingId || fallbackMeetingLink) {
        console.log('🔄 Tutor using fallback meeting data');
        const userName = user?.firstName && user?.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user?.firstName || user?.username || 'Tutor';
        const userId = user?.id;
        const role = user?.role || 'tutor';
        
        let meetingUrl;
        if (fallbackMeetingId) {
            const classDbId = classItem._id || classItem.id || '';
            meetingUrl = `/meeting/${fallbackMeetingId}?userName=${encodeURIComponent(userName)}&userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&classId=${encodeURIComponent(classDbId)}&displayClean=true`;
          } else {
          meetingUrl = `${fallbackMeetingLink}?userName=${userName}&userId=${userId}&role=${role}&displayClean=true`;
        }
        
        window.open(meetingUrl, '_blank', 'noopener,noreferrer');
      } else {
        alert('Unable to join meeting: An error occurred while fetching meeting details');
      }
    }
  };

  useEffect(() => {
    // Load dashboard data when component mounts (only once)
    if (userId && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      console.log('📊 Loading dashboard data for user:', userId);
      loadDashboardData();
      loadTodaysSchedule();
    } else if (!userId) {
      setError('User not found. Please login again.');
      setLoading(false);
    }
  }, [userId]); // Only depend on userId, not the functions

  const loadTutorClasses = useCallback(async () => {
    try {
      setClassesLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      console.log('Loading tutor classes...');
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/dashboard/tutor/classes`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Classes data received:', data);
        setAllClasses(data.data || []);
      } else {
        console.error('Failed to load classes:', response.status);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setClassesLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      setStudentsLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      console.log('Loading students...', { hasToken: !!token, tokenLength: token?.length });
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/dashboard/tutor/students`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Students response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Students data received:', data);
        console.log('Setting students to:', data.data || []);
        setStudents(data.data || []);
      } else {
        console.error('Failed to load students:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (err) {
      console.error('Error loading students:', err);
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  // Enhanced refresh function that reloads specific sections
  const handleRefresh = useCallback(async () => {
    console.log('Manual refresh triggered');
    await Promise.all([
      loadDashboardData(),
      loadTodaysSchedule(),
      activeTab === 'classes' ? loadTutorClasses() : Promise.resolve(),
      activeTab === 'students' ? loadStudents() : Promise.resolve()
    ]);
  }, [loadDashboardData, loadTodaysSchedule, loadTutorClasses, loadStudents, activeTab]);

  // Load data when tab changes
  const handleTabChange = useCallback((tab) => {
    console.log('🎯 REGULAR Dashboard - Tab clicked:', tab);
    setActiveTab(tab);
    console.log('🎯 REGULAR Dashboard - Active tab set to:', tab);
    if (tab === 'classes' && allClasses.length === 0) {
      loadTutorClasses();
    } else if (tab === 'students') {
      console.log('Students tab clicked, force loading students...');
      loadStudents();
    }
  }, [loadTutorClasses, loadStudents]);

  // Render functions for different tabs
  const renderOverview = () => {
    const stats = {
      students: data?.totalStudents || 7,
      studentsChange: 2,
      sessions: 0,
      hours: 0,
    };

    return (
      <div className={styles.overviewContent}>
        <h2 className={styles.sectionTitle}>Overview</h2>
        
        {/* Statistics Cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <i className="fas fa-users"></i>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.students}</div>
              <div className={styles.statLabel}>Total Students</div>
              <div className={styles.statChange}>
                <span className={styles.changePositive}>+{stats.studentsChange} this month</span>
              </div>
              <div className={styles.statSubtext}>Across all classes</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <i className="fas fa-calendar-check"></i>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.sessions}</div>
              <div className={styles.statLabel}>Scheduled Sessions</div>
              <div className={styles.statSubtext}>By admin</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon}>
              <i className="fas fa-clock"></i>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.hours}h</div>
              <div className={styles.statLabel}>Teaching Hours</div>
              <div className={styles.statSubtext}>This month</div>
            </div>
          </div>
        </div>

        {/* Active Classes Section */}
        <div className={styles.activeClassesSection}>
          <h3 className={styles.sectionTitle}>Active Classes</h3>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <i className="fas fa-graduation-cap"></i>
            </div>
            <h4>No active classes at the moment</h4>
            <p>When you are assigned to classes, they will appear here.</p>
          </div>
        </div>
      </div>
    );
  };

  const renderProgress = () => (
    <div className={styles.tabContent}>
      <h2>Progress Tracking</h2>
      <p>Student progress and performance analytics coming soon...</p>
    </div>
  );

  const renderSessions = () => (
    <div className={styles.tabContent}>
      <h2>Session Management</h2>
      <p>Session scheduling and management features coming soon...</p>
    </div>
  );

  const renderCommunication = () => (
    <div className={styles.tabContent}>
      <h2>Communication Center</h2>
      <p>Messages and communication with students and administrators coming soon...</p>
    </div>
  );

  const renderBilling = () => (
    <div className={styles.tabContent}>
      <h2>Billing & Payments</h2>
      <p>Billing information and payment tracking coming soon...</p>
    </div>
  );

  const renderSessionParticipants = () => (
    <div className={styles.tabContent}>
      <h2>Session Participants</h2>
      <p>View and manage session participants coming soon...</p>
    </div>
  );

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  if (loading && !dashboardData) {
    return <LoadingSpinner fullScreen message="Loading Tutor Dashboard..." />;
  }

  if (error) {
    return (
      <div className="dashboard">
        <Header title="Tutor Dashboard" />
        <div className="container">
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
            <button className="btn btn-sm btn-outline ml-3" onClick={handleRefresh} disabled={loading}>
              {loading ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { data } = dashboardData || {};

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
              {0} {/* TODO: Add notification count */}
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
                className={`${styles.sidebarButton} ${activeTab === 'progress' ? styles.active : ''}`}
                onClick={() => setActiveTab('progress')}
                title="Progress"
              >
                <i className="fas fa-chart-line"></i>
                <span className={styles.sidebarButtonText}>Progress</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'sessions' ? styles.active : ''}`}
                onClick={() => setActiveTab('sessions')}
                title="Sessions"
              >
                <i className="fas fa-calendar-alt"></i>
                <span className={styles.sidebarButtonText}>Sessions</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'communication' ? styles.active : ''}`}
                onClick={() => setActiveTab('communication')}
                title="Communication"
              >
                <i className="fas fa-comments"></i>
                <span className={styles.sidebarButtonText}>Communication</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'billings' ? styles.active : ''}`}
                onClick={() => setActiveTab('billings')}
                title="Billings"
              >
                <i className="fas fa-file-invoice-dollar"></i>
                <span className={styles.sidebarButtonText}>Billings</span>
              </button>
              <button 
                className={`${styles.sidebarButton} ${activeTab === 'SessionParticipants' ? styles.active : ''}`}
                onClick={() => setActiveTab('SessionParticipants')}
                title="SessionParticipants"
              >
                <i className="fas fa-users"></i>
                <span className={styles.sidebarButtonText}>Session Participants</span>
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
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'progress' && renderProgress()}
              {activeTab === 'sessions' && renderSessions()}
              {activeTab === 'communication' && renderCommunication()}
              {activeTab === 'classes' && (
                <CompactClassesList
                  classes={allClasses}
                  loading={classesLoading}
                  error={error}
                  onRefresh={handleRefresh}
                  onJoinClass={handleJoinClass}
                  getClassTimeStatus={getClassTimeStatus}
                  formatClassTime={formatClassTime}
                  user={user}
                />
              )}
              {activeTab === 'billings' && (
                <BillingsTable billings={data?.billings || []} />
              )}
              {activeTab === 'SessionParticipants' && renderSessionParticipants()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorDashboard;
