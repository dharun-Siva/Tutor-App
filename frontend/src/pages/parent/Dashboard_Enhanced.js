import React, { useState, useEffect } from 'react';
import ParentClassesTableWithPagination from './components/ParentClassesTableWithPagination';
import Header from '../../shared/components/Header';
import StatsCard from '../../shared/components/StatsCard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import BillingReport from '../../components/BillingReport';
import ParentBillingView from './components/ParentBillingView';
import { ProgressChart, EnhancedCard, NotificationCenter } from '../../components/enhanced';
import { getStoredUser, clearStoredAuth } from '../../utils/helpers';
import styles from './Dashboard_Enhanced.module.css';

const ParentDashboardEnhanced = () => {
    const user = getStoredUser();

  const [activeTab, setActiveTab] = useState('overview');
    // ...existing state...
  // Session Participants state/hooks
  const [sessionParticipants, setSessionParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');

  // Load session participants when SessionParticipants tab is activated
  useEffect(() => {
    if (activeTab === 'SessionParticipants' && user?.id && !participantsLoading) {
      loadSessionParticipants();
    }
    // eslint-disable-next-line
  }, [activeTab, user?.id]);

  // Fetch session participants for parent's children
  const loadSessionParticipants = async () => {
    setParticipantsLoading(true);
    setParticipantsError('');
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const response = await fetch('http://localhost:5000/api/session-participants/parent', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch session participants');
      }
      const data = await response.json();
      setSessionParticipants(data.data || []);
    } catch (error) {
      setParticipantsError(error.message || 'Failed to load session participants');
    } finally {
      setParticipantsLoading(false);
    }
  };

  // Filter state
  const [filterTutor, setFilterTutor] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Get unique subjects and statuses for dropdowns
  const uniqueSubjects = Array.from(new Set(sessionParticipants.map(sp => sp.meeting_class_id?.subject).filter(Boolean)));
  // const uniqueStatuses = Array.from(new Set(sessionParticipants.map(sp => sp.paymentStatus).filter(Boolean)));

  // Filtering logic
  const filteredParticipants = sessionParticipants.filter(sp => {
    const tutorName = sp.tutor ? `${sp.tutor.firstName} ${sp.tutor.lastName}`.toLowerCase() : '';
    const studentName = `${sp.participant_id?.firstName || ''} ${sp.participant_id?.lastName || ''}`.toLowerCase();
    const subject = sp.meeting_class_id?.subject || '';
    return (
      (!filterTutor || tutorName.includes(filterTutor.toLowerCase())) &&
      (!filterStudent || studentName.includes(filterStudent.toLowerCase())) &&
      (!filterSubject || subject === filterSubject)
    );
  });

  // Pagination state for session participants (frontend only)
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionRowsPerPage, setSessionRowsPerPage] = useState(3); // default 3 per page
  const sessionTotalPages = Math.max(1, Math.ceil(filteredParticipants.length / sessionRowsPerPage));
  const paginatedParticipants = filteredParticipants.slice(
    (sessionPage - 1) * sessionRowsPerPage,
    sessionPage * sessionRowsPerPage
  );

  // Reset to first page if filters or rows per page change
  useEffect(() => {
    setSessionPage(1);
  }, [filterTutor, filterStudent, filterSubject, sessionRowsPerPage]);

  // Render session participants tab
  const renderSessionParticipants = () => (
    <div className={styles.sessionsContent}>
      <div className={styles.sessionsHeader}>
        <h3>Session Participants (Your Children)</h3>
        <div className={styles.headerActions}>
          <input
            type="text"
            placeholder="Filter by Tutor Name"
            value={filterTutor}
            onChange={e => setFilterTutor(e.target.value)}
            style={{ width: 140 }}
          />
          <input
            type="text"
            placeholder="Filter by Student Name"
            value={filterStudent}
            onChange={e => setFilterStudent(e.target.value)}
            style={{ width: 140 }}
          />
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: 140 }}>
            <option value="">All Subjects</option>
            {uniqueSubjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          <button className={styles.refreshBtn} onClick={loadSessionParticipants} disabled={participantsLoading}>
            {participantsLoading ? (
              <div className={styles.spinner}></div>
            ) : (
              <i className="fas fa-sync-alt"></i>
            )}
            Refresh
          </button>
        </div>
      </div>
      {participantsLoading && <LoadingSpinner />}
      {participantsError && <div className={styles.errorMessage}>{participantsError}</div>}
      {!participantsLoading && !participantsError && (
        <div className={styles.sessionsTableContainer}>
          {paginatedParticipants.length > 0 ? (
            <>
              <table className={styles.sessionsTable}>
                <thead>
                  <tr>
                    <th>Child Name</th>
                    <th>Session Title</th>
                    <th>Subject</th>
                    <th>Tutor</th>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>JoinAt</th>
                    <th>EndAt</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedParticipants.map((sp, index) => (
                    <tr key={index}>
                      <td>{sp.childName || '-'}</td>
                      <td>{sp.sessionTitle || '-'}</td>
                      <td>{sp.subject || '-'}</td>
                      <td>{sp.tutor || '-'}</td>
                      <td>{sp.date || '-'}</td>
                      <td>{sp.startTime || '-'}</td>
                      <td>{sp.joinedAt || '-'}</td>
                      <td>{sp.endedAt || '-'}</td>
                      <td>{sp.duration || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Minimal Pagination Controls, centered */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
                <button
                  disabled={sessionPage === 1}
                  onClick={() => setSessionPage(sessionPage - 1)}
                  style={{ minWidth: 120, marginRight: 24, padding: '8px 24px', borderRadius: 6, border: '1px solid #bfc3c9', background: sessionPage === 1 ? '#e5e7eb' : '#fff', color: sessionPage === 1 ? '#888' : '#0074d9', fontWeight: 500, fontSize: 16, cursor: sessionPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 18, fontWeight: 500, color: '#222', minWidth: 120, textAlign: 'center' }}>
                  Page {sessionPage} of {sessionTotalPages}
                </span>
                <button
                  disabled={sessionPage === sessionTotalPages}
                  onClick={() => setSessionPage(sessionPage + 1)}
                  style={{ minWidth: 120, marginLeft: 24, padding: '8px 24px', borderRadius: 6, border: '1px solid #0074d9', background: sessionPage === sessionTotalPages ? '#fff' : '#fff', color: sessionPage === sessionTotalPages ? '#888' : '#0074d9', fontWeight: 500, fontSize: 16, cursor: sessionPage === sessionTotalPages ? 'not-allowed' : 'pointer', boxShadow: sessionPage !== sessionTotalPages ? '0 0 0 2px #e5f1fb' : 'none' }}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>👥</div>
              <h4>No Session Participants Found</h4>
              <p>Your children have no session participation records yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
  const [classes, setClasses] = useState([]); // Changed from sessions to classes
  const [children, setChildren] = useState([]);
  const [messages, setMessages] = useState([]);
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parentInfo, setParentInfo] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showComposeForm, setShowComposeForm] = useState(false);
  const [composeForm, setComposeForm] = useState({
    title: '',
    content: '',
    priority: 'normal'
  });
  const [sending, setSending] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  
  // Progress/Assignments state
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [progressFilters, setProgressFilters] = useState({
    studentId: 'all',
    status: 'all',
    dateRange: 'month',
    subject: 'all',
    className: 'all',
    searchText: ''
  });
  
  // Communication sub-tabs and filtering
  const [communicationTab, setCommunicationTab] = useState('inquiries');
  const [messageFilters, setMessageFilters] = useState({
    readStatus: 'all', // all, read, unread
    priority: 'all', // all, urgent, normal, info
    searchText: '',
    dateRange: 'all' // all, today, week, month
  });
  
  //const user = getStoredUser();

  // Helper functions for message filtering and sorting
  const filterMessages = (msgs, type) => {
    if (!msgs || !Array.isArray(msgs)) return [];
    
    // First filter by message type
    let filteredMessages = msgs.filter(msg => {
      if (type === 'inquiries') {
        // Show messages that were sent BY the parent (sender_id is parent's id)
        return msg.sender_id === user?.id && msg.type === 'parent_inquiry';
      } else if (type === 'announcements') {
        // Show messages sent TO the parent (recipient_id is parent's id or is_broadcast is true)
        return msg.recipient_id === user?.id || msg.is_broadcast === true;
      }
      return true;
    });

    // Apply filters
    filteredMessages = filteredMessages.filter(msg => {
      // Read status filter
      if (messageFilters.readStatus !== 'all') {
        const isRead = msg.isReadByUser || (msg.readBy && msg.readBy.some(read => read.user === user?.id));
        if (messageFilters.readStatus === 'read' && !isRead) return false;
        if (messageFilters.readStatus === 'unread' && isRead) return false;
      }

      // Priority filter
      if (messageFilters.priority !== 'all' && msg.priority !== messageFilters.priority) {
        return false;
      }

      // Search text filter
      if (messageFilters.searchText) {
        const searchLower = messageFilters.searchText.toLowerCase();
        const titleMatch = msg.title?.toLowerCase().includes(searchLower);
        const contentMatch = msg.content?.toLowerCase().includes(searchLower);
        if (!titleMatch && !contentMatch) return false;
      }

      // Date range filter
      if (messageFilters.dateRange !== 'all') {
        const msgDate = new Date(msg.createdAt);
        const now = new Date();
        const diffTime = now - msgDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (messageFilters.dateRange === 'today' && diffDays > 1) return false;
        if (messageFilters.dateRange === 'week' && diffDays > 7) return false;
        if (messageFilters.dateRange === 'month' && diffDays > 30) return false;
      }

      return true;
    });

    // Sort: Unread first, then by newest date
    return filteredMessages.sort((a, b) => {
      const aRead = a.isReadByUser || (a.readBy && a.readBy.some(read => read.user === user?.id));
      const bRead = b.isReadByUser || (b.readBy && b.readBy.some(read => read.user === user?.id));
      
      // Unread messages first
      if (!aRead && bRead) return -1;
      if (aRead && !bRead) return 1;
      
      // Then by newest date
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  // Logout function
  const handleLogout = () => {
    clearStoredAuth();
    window.location.href = '/login';
  };

  // Mock data for enhanced UI demonstration
  const mockData = {
    children: [
      {
        id: 1,
        name: 'Emily Johnson',
        grade: '5th Grade',
        avatar: 'EJ',
        subjects: ['Math', 'Science', 'English'],
        upcomingSession: {
          subject: 'Mathematics',
          time: '3:00 PM Today',
          tutor: 'Ms. Sarah Wilson'
        },
        progress: {
          overall: 85,
          subjects: {
            Math: 90,
            Science: 82,
            English: 83
          }
        },
        achievements: ['Perfect Attendance', 'Math Star', 'Science Explorer']
      },
      {
        id: 2,
        name: 'Alex Johnson',
        grade: '8th Grade', 
        avatar: 'AJ',
        subjects: ['Algebra', 'Chemistry', 'Literature'],
        upcomingSession: {
          subject: 'Chemistry',
          time: '4:30 PM Tomorrow',
          tutor: 'Dr. Michael Chen'
        },
        progress: {
          overall: 78,
          subjects: {
            Algebra: 85,
            Chemistry: 75,
            Literature: 74
          }
        },
        achievements: ['Science Fair Winner', 'Reading Champion']
      }
    ],
    recentActivities: [
      {
        id: 1,
        type: 'session_completed',
        child: 'Emily',
        subject: 'Math',
        description: 'Completed Algebra basics session',
        time: '2 hours ago',
        icon: '✅'
      },
      {
        id: 2,
        type: 'assignment_submitted',
        child: 'Alex',
        subject: 'Chemistry',
        description: 'Submitted Lab Report #3',
        time: '5 hours ago',
        icon: '📝'
      },
      {
        id: 3,
        type: 'progress_milestone',
        child: 'Emily',
        subject: 'Science',
        description: 'Reached 85% progress milestone',
        time: '1 day ago',
        icon: '🎯'
      }
    ],
    notifications: [
      {
        id: 1,
        type: 'reminder',
        title: 'Session Starting Soon',
        message: 'Emily\'s Math session starts in 30 minutes',
        time: '30 min',
        priority: 'high'
      },
      {
        id: 2,
        type: 'achievement',
        title: 'New Achievement Unlocked!',
        message: 'Alex earned "Science Explorer" badge',
        time: '2 hours',
        priority: 'medium'
      }
    ]
  };

  // Load overview data when Overview tab is activated
  useEffect(() => {
    if (activeTab === 'overview' && user?.id && !overviewLoaded && !loading) {
      loadOverviewData();
    }
  }, [activeTab, user?.id, overviewLoaded]); // Use overviewLoaded flag to prevent continuous calls

  // Load classes when Sessions tab is activated
  useEffect(() => {
    if (activeTab === 'sessions' && user?.id && !sessionsLoaded && !loading) {
      loadParentSessions();
    }
  }, [activeTab, user?.id, sessionsLoaded]); // Use sessionsLoaded flag instead of classes.length

  // Load messages when Communication tab is activated
  useEffect(() => {
    if (activeTab === 'communication' && user?.id && messages.length === 0) {
      loadMessages();
    }
  }, [activeTab, user?.id, messages.length]);

  // Load assignments when Progress tab is activated
  useEffect(() => {
    if (activeTab === 'progress' && user?.id) {
      fetchAssignments();
    }
  }, [activeTab, user?.id, progressFilters]);

  // Load messages from API
  const loadMessages = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      console.log('Loading messages for parent...');
      
      // Fetch both received and sent messages in parallel
      const [receivedResponse, sentResponse] = await Promise.all([
        fetch('http://localhost:5000/api/messages/parent', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/messages/parent/sent', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      if (!receivedResponse.ok || !sentResponse.ok) {
        const failedResponse = !receivedResponse.ok ? receivedResponse : sentResponse;
        console.error('Failed to load messages:', failedResponse.status);
        throw new Error(`Failed to fetch messages: ${failedResponse.status}`);
      }

      const [receivedData, sentData] = await Promise.all([
        receivedResponse.json(),
        sentResponse.json()
      ]);
      
      console.log('✅ Received messages loaded:', receivedData);
      console.log('✅ Sent messages loaded:', sentData);
      
      // Combine both received and sent messages
      const receivedMessages = receivedData.success && receivedData.data ? receivedData.data.messages : [];
      const sentMessages = sentData.success && sentData.data ? sentData.data.messages : [];
      const messagesArray = [...receivedMessages, ...sentMessages];
      setMessages(messagesArray || []);
      console.log('✅ Messages set to state:', messagesArray);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Mark message as read
  const markMessageAsRead = async (messageId) => {
    try {
      // Handle different ID fields
      if (!messageId) {
        console.error('No message ID provided');
        return;
      }

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Message marked as read:', messageId);
        // Update local state to mark as read
        setMessages(messages.map(msg => {
          const msgId = msg.id; // Use msg.id instead of msg._id
          if (msgId === messageId) {
            return {
              ...msg,
              is_read: true,
              isReadByUser: true,
              readAt: new Date(),
              readBy: [...(msg.readBy || []), { user: user.id, readAt: new Date() }]
            };
          }
          return msg;
        }));
      } else {
        const errorData = await response.json();
        console.error('Failed to mark message as read:', errorData);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Send message from parent to admin
  const sendMessageToAdmin = async () => {
    if (!composeForm.title.trim() || !composeForm.content.trim()) {
      alert('Please fill in both title and message content');
      return;
    }

    try {
      setSending(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5000/api/messages/parent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: composeForm.title.trim(),
          content: composeForm.content.trim(),
          priority: composeForm.priority
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Message sent to admin:', data);
        
        // Reset form and switch to inquiries tab
        setComposeForm({ title: '', content: '', priority: 'normal' });
        
        // Reload messages first to ensure we have the latest data
        await loadMessages();
        
        // Then switch to inquiries tab
        setCommunicationTab('inquiries');
        
        alert('Message sent to admin successfully!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  // Load parent's overview data
  const loadOverviewData = async () => {
    if (loading) {
      console.log('Already loading, skipping request');
      return;
    }
    
    try {
      console.log('Starting to load parent overview data...');
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      console.log('🔍 Checking auth token:', token ? `${token.substring(0, 20)}...` : 'No token found');
      console.log('🔍 User from storage:', user);
      console.log('🔍 User role:', user?.role);
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      console.log('Making request to: /api/dashboard-enhanced/parent');
      
      const response = await fetch('http://localhost:5000/api/dashboard-enhanced/parent', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Response received:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Error response:', errorData);
        
        if (response.status === 401) {
          console.error('❌ Authentication failed - redirecting to login');
          clearStoredAuth();
          window.location.href = '/login';
          return;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Parent overview data received:', data);

      if (data.data) {
        setOverviewData(data.data);
        setChildren(data.data.children || []);
        setOverviewLoaded(true); // Mark overview as loaded to prevent continuous calls
        console.log('✅ Overview data loaded successfully');
      } else {
        console.warn('⚠️ No data in response');
        setOverviewData({
          children: [],
          totalChildren: 0,
          activeSessions: 0,
          averageProgress: 0,
          achievements: 0,
          recentActivities: [],
          notifications: []
        });
        setOverviewLoaded(true); // Mark as loaded even if no data
      }

    } catch (error) {
      console.error('❌ Error loading parent overview:', error);
      setError(error.message || 'Failed to load overview data. Please try again.');
      setOverviewLoaded(true); // Mark as loaded even on error to prevent infinite retries
    } finally {
      setLoading(false);
    }
  };

  // Fetch homework assignments and progress
  const fetchAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      setError('');

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      const response = await fetch('http://localhost:5000/api/homework-assignments/parent', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          clearStoredAuth();
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Assignments data received:', data);

      if (data.success && data.data) {
        setAssignments(data.data);
      } else {
        setAssignments([]);
      }

    } catch (error) {
      console.error('❌ Error fetching assignments:', error);
      setError(error.message || 'Failed to load assignments. Please try again.');
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  // Load parent's children's sessions
  const loadParentSessions = async () => {
    if (loading) {
      console.log('Already loading, skipping request');
      return;
    }
    
    try {
      console.log('Starting to load parent sessions...');
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      // Add cache buster to prevent browser caching
      const cacheBuster = Date.now();
      
      // Construct API URL properly to avoid duplicate /api
      const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const apiUrl = apiBaseUrl.endsWith('/api') ? apiBaseUrl : `${apiBaseUrl}/api`;
      
      console.log('Making request to:', `${apiUrl}/sessions/parent?_t=${cacheBuster}`);
      
            const response = await fetch(`http://localhost:5000/api/sessions/parent-classes?_t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.status === 401) {
        setError('Session expired. Please log in again.');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      console.log('API Response:', result);
      
      if (result.success && result.data) {
        // Handle the new classes-only response structure
        setClasses(result.data.classes || []); // Changed to classes
        setChildren(result.data.children || []);
        setParentInfo(result.data.parentInfo || {});
        setSessionsLoaded(true); // Mark sessions as loaded to prevent continuous calls
        console.log('Successfully loaded classes:', result.data.classes?.length || 0);
      } else {
        throw new Error(result.message || 'Unexpected response format');
      }

    } catch (error) {
      console.error('❌ Error loading parent sessions:', error);
      setError(error.message || 'Failed to load sessions. Please try again.');
      setSessionsLoaded(true); // Mark as loaded even on error to prevent infinite retries
    } finally {
      setLoading(false);
    }
  };

  const renderWelcomeSection = () => (
    <div className={styles.welcomeSection}>
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeContent}>
          <div className={styles.welcomeText}>
            <h2>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.fullName || 'Parent'}! 👋</h2>
            <p>Welcome to your enhanced Parent Dashboard with a rich, modern interface designed for the best user experience.</p>
            <div className={styles.upgradeNotice}>
              <span className={styles.upgradeIcon}>✨</span>
              <span>You're now using the enhanced dashboard with improved design and functionality!</span>
            </div>
          </div>
          <div className={styles.welcomeStats}>
            <div className={styles.quickStat}>
              <div className={styles.quickStatNumber}>{mockData.children.length}</div>
              <div className={styles.quickStatLabel}>Children</div>
            </div>
            <div className={styles.quickStat}>
              <div className={styles.quickStatNumber}>
                {mockData.children.reduce((acc, child) => acc + child.subjects.length, 0)}
              </div>
              <div className={styles.quickStatLabel}>Active Subjects</div>
            </div>
            <div className={styles.quickStat}>
              <div className={styles.quickStatNumber}>
                {Math.round(mockData.children.reduce((acc, child) => acc + child.progress.overall, 0) / mockData.children.length)}%
              </div>
              <div className={styles.quickStatLabel}>Avg Progress</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderChildrenOverview = () => (
    <div className={styles.childrenSection}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>👨‍👩‍👧‍👦</span>
        Your Children
      </h3>
      {loading && <LoadingSpinner />}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {!loading && !error && (
        <div className={styles.childrenGrid}>
          {(overviewData?.children || []).map(child => (
            <EnhancedCard
              key={child.id}
              variant="default"
              size="medium"
              hover={true}
              className={styles.childCard}
            >
              <div className={styles.childHeader}>
                <div className={styles.childAvatar}>
                  <div className={styles.avatarCircle}>
                    {child.avatar}
                  </div>
                  <div className={styles.childInfo}>
                    <h4 className={styles.childName}>{child.name}</h4>
                    <p className={styles.childGrade}>{child.grade}</p>
                  </div>
                </div>
                <ProgressChart 
                  data={child.progress.overall}
                  type="circular"
                  size="medium"
                  showLabel={true}
                  color="primary"
                />
              </div>

              <div className={styles.childSubjects}>
                <h5>Current Subjects</h5>
                <div className={styles.subjectTags}>
                  {child.subjects.map(subject => (
                    <span key={subject} className={styles.subjectTag}>
                      {subject}
                    </span>
                  ))}
                </div>
              </div>

              {child.upcomingSession && (
                <div className={styles.upcomingSession}>
                  <div className={styles.sessionHeader}>
                    <span className={styles.sessionIcon}>📅</span>
                    <span>Next Session</span>
                  </div>
                  <div className={styles.sessionDetails}>
                    <div className={styles.sessionSubject}>{child.upcomingSession.subject}</div>
                    <div className={styles.sessionTime}>{child.upcomingSession.time}</div>
                    <div className={styles.sessionTutor}>with {child.upcomingSession.tutor}</div>
                  </div>
                </div>
              )}
            </EnhancedCard>
          ))}
          {(!overviewData?.children || overviewData.children.length === 0) && !loading && (
            <div className={styles.noData}>
              <p>No children found. Please contact support to link your children's accounts.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderRecentActivity = () => (
    <div className={styles.activitySection}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>📈</span>
        Recent Activity
      </h3>
      <div className={styles.activityList}>
        {(overviewData?.recentActivities || []).map(activity => (
          <div key={activity.id} className={styles.activityItem}>
            <div className={styles.activityIcon}>{activity.icon}</div>
            <div className={styles.activityContent}>
              <div className={styles.activityDescription}>
                <strong>{activity.child}</strong> - {activity.description}
              </div>
              <div className={styles.activityMeta}>
                <span className={styles.activitySubject}>{activity.subject}</span>
                <span className={styles.activityTime}>{activity.time}</span>
              </div>
            </div>
          </div>
        ))}
        {(!overviewData?.recentActivities || overviewData.recentActivities.length === 0) && (
          <div className={styles.noActivity}>
            <p>No recent activity to display.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <NotificationCenter 
      notifications={overviewData?.notifications || []}
      maxDisplay={5}
      onNotificationClick={(notification) => {
        console.log('Notification clicked:', notification);
      }}
      onMarkAsRead={(notificationId) => {
        console.log('Mark as read:', notificationId);
      }}
      onClearAll={() => {
        console.log('Clear all notifications');
      }}
    />
  );

  const renderOverview = () => (
    <div className={styles.overviewContent}>
      {renderWelcomeSection()}
      
      <div className={styles.statsSection}>
        <div className={styles.statsGrid}>
          <StatsCard
            title="Total Children"
            value={overviewData?.totalChildren || 0}
            icon="👨‍👩‍👧‍👦"
            color="primary"
            subtitle="Active learners"
            trend={{ type: 'up', value: '+2 this year' }}
          />
          <StatsCard
            title="Active Classes"
            value={overviewData?.activeSessions || 0}
            icon="📚"
            color="success"
            subtitle="Enrolled classes"
            trend={{ type: 'up', value: '+3 from last month' }}
          />
          <StatsCard
            title="Average Progress"
            value={`${overviewData?.averageProgress || 0}%`}
            icon="📈"
            color="info"
            subtitle="Across all subjects"
            trend={{ type: 'up', value: '+5% this month' }}
          />
          <StatsCard
            title="Achievements"
            value={overviewData?.achievements || 0}
            icon="🏆"
            color="warning"
            subtitle="Badges earned"
            trend={{ type: 'up', value: '+4 this week' }}
          />
        </div>
      </div>

      <div className={styles.overviewMainContent}>
        <div className={styles.leftColumn}>
          {renderChildrenOverview()}
        </div>
        <div className={styles.rightColumn}>
          {renderRecentActivity()}
          {renderNotifications()}
        </div>
      </div>
    </div>
  );

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to get status class
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'complete':
        return styles.statusComplete;
      case 'in-progress':
      case 'in_progress':
      case 'started':
        return styles.statusInProgress;
      case 'not-started':
      case 'not_started':
      case 'incomplete':
      default:
        return styles.statusIncomplete;
    }
  };

  // Helper function to get status display text
  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'complete':
        return 'Complete';
      case 'in-progress':
      case 'in_progress':
      case 'started':
        return 'In Progress';
      case 'not-started':
      case 'not_started':
      case 'incomplete':
      default:
        return 'Incomplete';
    }
  };

  // Filter assignments based on current filters
  const filteredAssignments = assignments.filter(assignment => {
    // Student filter
    if (progressFilters.studentId !== 'all' && 
        assignment.student?._id !== progressFilters.studentId) {
      return false;
    }

    // Status filter
    if (progressFilters.status !== 'all') {
      const assignmentStatus = getStatusText(assignment.status).toLowerCase().replace(' ', '-');
      if (assignmentStatus !== progressFilters.status) {
        return false;
      }
    }

    // Subject filter
    if (progressFilters.subject !== 'all') {
      const assignmentSubject = assignment.homework?.subjectId?.name || assignment.class?.subject || '';
      if (assignmentSubject.toLowerCase() !== progressFilters.subject.toLowerCase()) {
        return false;
      }
    }

    // Class name filter
    if (progressFilters.className !== 'all') {
      const assignmentClass = assignment.class?.title || assignment.class?.name || assignment.className || '';
      if (assignmentClass.toLowerCase() !== progressFilters.className.toLowerCase()) {
        return false;
      }
    }

    // Search text filter (searches across multiple fields)
    if (progressFilters.searchText.trim()) {
      const searchTerm = progressFilters.searchText.toLowerCase().trim();
      const searchableText = [
        assignment.student?.fullName || assignment.student?.firstName || assignment.student?.name || '',
        assignment.tutor?.fullName || assignment.tutor?.firstName || assignment.tutor?.name || '',
        assignment.class?.title || assignment.class?.name || assignment.className || '',
        assignment.homework?.subjectId?.name || assignment.class?.subject || '',
        assignment.homework?.homeworkName || assignment.homework?.title || assignment.title || 'Assignment',
        formatDate(assignment.assignedDate || assignment.createdAt),
        formatDate(assignment.startDate),
        formatDate(assignment.dueDate),
        getStatusText(assignment.status)
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }

    // Date range filter
    if (progressFilters.dateRange !== 'all') {
      const assignedDate = new Date(assignment.assignedDate || assignment.createdAt);
      const now = new Date();
      const diffTime = now - assignedDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      switch (progressFilters.dateRange) {
        case 'month':
          if (diffDays > 30) return false;
          break;
        case 'quarter':
          if (diffDays > 90) return false;
          break;
        case 'year':
          if (diffDays > 365) return false;
          break;
        default:
          break;
      }
    }

    return true;
  });

  // Get unique subjects and class names for filter options
  //const uniqueSubjects = [...new Set(assignments.map(assignment => 
    //assignment.homework?.subjectId?.name || assignment.class?.subject || 'Unknown'
  //).filter(Boolean))]


  const uniqueClasses = [...new Set(assignments.map(assignment => 
    assignment.class?.name || assignment.className || 'Unknown'
  ).filter(Boolean))];

  const renderProgress = () => (
    <div className={styles.progressContent}>
      <div className={styles.progressHeader}>
        <h3>Homework Assignments & Progress</h3>
        <div className={styles.progressFilters}>
          <div className={styles.filterRow}>
            <input
              type="text"
              placeholder="Search by name, subject, class, date, status..."
              className={styles.searchInput}
              value={progressFilters.searchText}
              onChange={(e) => setProgressFilters(prev => ({ ...prev, searchText: e.target.value }))}
            />
            <button
              className={styles.clearFiltersBtn}
              onClick={() => setProgressFilters({
                studentId: 'all',
                status: 'all',
                dateRange: 'month',
                subject: 'all',
                className: 'all',
                searchText: ''
              })}
            >
              Clear All
            </button>
          </div>
          <div className={styles.filterRow}>
            <select 
              className={styles.filterSelect}
              value={progressFilters.studentId}
              onChange={(e) => setProgressFilters(prev => ({ ...prev, studentId: e.target.value }))}
            >
              <option value="all">All Students</option>
              {(overviewData?.children || []).map(child => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
            <select 
              className={styles.filterSelect}
              value={progressFilters.subject}
              onChange={(e) => setProgressFilters(prev => ({ ...prev, subject: e.target.value }))}
            >
              <option value="all">All Subjects</option>
              {uniqueSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <select 
              className={styles.filterSelect}
              value={progressFilters.className}
              onChange={(e) => setProgressFilters(prev => ({ ...prev, className: e.target.value }))}
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map(className => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
            <select 
              className={styles.filterSelect}
              value={progressFilters.status}
              onChange={(e) => setProgressFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">All Status</option>
              <option value="incomplete">Incomplete</option>
              <option value="in-progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
            <select 
              className={styles.filterSelect}
              value={progressFilters.dateRange}
              onChange={(e) => setProgressFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            >
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.progressTableContainer}>
        {assignmentsLoading ? (
          <div className={styles.tableLoading}>
            <LoadingSpinner />
            <p>Loading assignments...</p>
          </div>
        ) : (
          <>
            {filteredAssignments.length > 0 ? (
              <table className={styles.progressTable}>
                <thead>
                  <tr>
                    <th>Class Name</th>
                    <th>Subject</th>
                    <th>Student Name</th>
                    <th>Tutor Name</th>
                    <th>Assignment</th>
                    <th>Assigned Date</th>
                    <th>Start Date</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment._id}>
                      <td>{assignment.class?.title || assignment.class?.name || '-'}</td>
                      <td>{assignment.homework?.subjectId?.name || assignment.class?.subject || '-'}</td>
                      <td>{assignment.student?.fullName || assignment.student?.firstName || assignment.student?.name || '-'}</td>
                      <td>{assignment.tutor?.fullName || assignment.tutor?.firstName || assignment.tutor?.name || assignment.class?.tutor?.fullName || '-'}</td>
                      <td>{assignment.homework?.homeworkName || assignment.homework?.title || assignment.title || 'Assignment'}</td>
                      <td>{formatDate(assignment.assignedDate || assignment.createdAt)}</td>
                      <td>{formatDate(assignment.startDate)}</td>
                      <td>{formatDate(assignment.dueDate)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(assignment.status)}`}>
                          {getStatusText(assignment.status)}
                        </span>
                      </td>
                      <td>
                        <button 
                          className={styles.actionButton}
                          onClick={() => {
                            // TODO: Implement view assignment details
                            console.log('View assignment:', assignment._id);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.noData}>
                <p>
                  {assignments.length === 0 
                    ? 'No assignments found. Assignments will appear here once they are created.'
                    : 'No assignments match the current filters.'
                  }
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Helper function to check if class is happening today
  const isToday = (classItem) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (classItem.scheduleType === 'weekly-recurring') {
      if (classItem.recurringDays && classItem.recurringDays.length > 0) {
        const dayOfWeek = now.getDay();
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = daysOfWeek[dayOfWeek];
        return classItem.recurringDays.includes(currentDayName);
      }
    } else if (classItem.classDate) {
      const classDate = new Date(classItem.classDate);
      return classDate >= today && classDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }
    return false;
  };

  // Helper function to get today's class time for recurring classes
  const getTodayClassTime = (classItem) => {
    if (classItem.scheduleType !== 'weekly-recurring' || !classItem.startTime) return null;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Parse time string (e.g., "16:42")
    const [hours, minutes] = classItem.startTime.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    const classDateTime = new Date(today);
    classDateTime.setHours(hours, minutes, 0, 0);
    return classDateTime;
  };

  // Helper function to determine class time status and join availability (similar to tutor dashboard)
  const getClassTimeStatus = (classItem) => {
    const now = new Date();
    let startTime;

    if (classItem.scheduleType === 'weekly-recurring') {
      if (!isToday(classItem)) {
        return { 
          canJoin: false, 
          reason: 'Not scheduled for today',
          status: 'not-today',
          timeUntilClass: null
        };
      }
      startTime = getTodayClassTime(classItem);
    } else {
      startTime = new Date(classItem.classDate);
      if (classItem.startTime) {
        const [hours, minutes] = classItem.startTime.split(':').map(Number);
        startTime.setHours(hours, minutes, 0, 0);
      }
    }

    if (!startTime) {
      return { 
        canJoin: false, 
        reason: 'Invalid class time',
        status: 'invalid',
        timeUntilClass: null
      };
    }

    const duration = classItem.duration || 60;
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    const timeUntilStart = startTime.getTime() - now.getTime();
    const timeUntilEnd = endTime.getTime() - now.getTime();

    // Class is currently in progress
    if (now >= startTime && now <= endTime) {
      return {
        canJoin: true,
        reason: 'Class is currently in progress',
        status: 'in-progress',
        timeUntilClass: 0,
        isLive: true
      };
    }

    // Class starts within 15 minutes
    if (timeUntilStart > 0 && timeUntilStart <= 15 * 60 * 1000) {
      return {
        canJoin: true,
        reason: 'Class starts soon',
        status: 'starting-soon',
        timeUntilClass: timeUntilStart,
        startingSoon: true
      };
    }

    // Class starts later today
    if (timeUntilStart > 15 * 60 * 1000) {
      return {
        canJoin: false,
        reason: `Class starts at ${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        status: 'scheduled',
        timeUntilClass: timeUntilStart
      };
    }

    // Class has ended
    return {
      canJoin: false,
      reason: 'Class has ended',
      status: 'ended',
      timeUntilClass: null
    };
  };

  // Helper function to format class time
  const formatClassTime = (classItem) => {
    if (classItem.scheduleType === 'weekly-recurring') {
      return {
        date: classItem.recurringDays ? classItem.recurringDays.map(day => day.charAt(0).toUpperCase() + day.slice(1)).join(', ') : 'Weekly',
        start: classItem.startTime ? classItem.startTime : 'TBD',
        end: classItem.startTime && classItem.duration ? 
          new Date(new Date(`2000-01-01T${classItem.startTime}:00`).getTime() + classItem.duration * 60 * 1000)
            .toTimeString().slice(0, 5) : 'TBD'
      };
    } else {
      const classDate = new Date(classItem.classDate);
      return {
        date: classDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        start: classItem.startTime || 'TBD',
        end: classItem.startTime && classItem.duration ? 
          new Date(new Date(`2000-01-01T${classItem.startTime}:00`).getTime() + classItem.duration * 60 * 1000)
            .toTimeString().slice(0, 5) : 'TBD'
      };
    }
  };

  // Helper function to handle joining a class
  const handleJoinClass = (classItem) => {
    const timeStatus = getClassTimeStatus(classItem);
    
    if (timeStatus.canJoin && classItem.meetingLink) {
      console.log('🎯 Parent joining class via meeting link:', classItem.meetingLink);
      window.open(classItem.meetingLink, '_blank');
    } else {
      alert(timeStatus.reason || 'Unable to join class at this time');
    }
  };

  const renderSessions = () => (
    <div className={styles.sessionsContent}>
      <div className={styles.sessionsHeader}>
        <h3>Classes & Session Schedule</h3>
        <div className={styles.headerActions}>
          <div className={styles.currentTime}>
            <i className="fas fa-clock"></i>
            <span>{new Date().toLocaleString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short'
            })}</span>
          </div>
          <button className={styles.refreshBtn} onClick={loadParentSessions} disabled={loading}>
            {loading ? (
              <div className={styles.spinner}></div>
            ) : (
              <i className="fas fa-sync-alt"></i>
            )}
            Refresh
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      
      {error && (
        <div className={styles.errorMessage}>
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className={styles.sessionsTableContainer}>
          {/* Classes Table - Similar to Tutor Dashboard with Pagination */}
          {classes.length > 0 ? (
            <ParentClassesTableWithPagination classes={classes} />
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>�</div>
              <h4>No Classes Found</h4>
              <p>Your children don't have any classes scheduled at the moment.</p>
              <p className={styles.emptyStateSubtext}>Contact your center administrator to schedule classes for your children.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCommunication = () => {
    const getPriorityIcon = (priority) => {
      switch(priority) {
        case 'urgent': return '�';
        case 'normal': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '📩';
      }
    };

    const getPriorityClass = (priority) => {
      switch(priority) {
        case 'urgent': return styles.priorityUrgent;
        case 'normal': return styles.priorityNormal;
        case 'info': return styles.priorityInfo;
        default: return styles.priorityNormal;
      }
    };

    const formatDate = (dateString) => {
      try {
        // Handle both created_at and updated_at fields
        const timestamp = dateString || null;
        if (!timestamp) return 'No date';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          return 'Invalid Date';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        // Format the time
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        // Format the date based on how recent it is
        let dateStr;
        if (diffMins < 1) {
          return 'Just now';
        } else if (diffMins < 60) {
          return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
        } else if (diffHours < 24) {
          return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        } else if (diffDays === 0) {
          dateStr = 'Today';
        } else if (diffDays === 1) {
          dateStr = 'Yesterday';
        } else if (diffDays < 7) {
          dateStr = `${diffDays} days ago`;
        } else {
          dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        }
        
        return `${dateStr} at ${timeStr}`;
      } catch (error) {
        console.error('Date formatting error:', error);
        return 'Date error';
      }
    };

    const isMessageRead = (message) => {
      if (message.isReadByUser !== undefined) {
        return message.isReadByUser;
      }
      return message.readBy && message.readBy.some(read => read.user === user.id);
    };

    const handleMessageClick = (message) => {
      if (!isMessageRead(message)) {
        markMessageAsRead(message.id); // Use message.id instead of message._id
      }
    };

    const renderFilters = () => (
      <div className={styles.messageFilters}>
        <div className={styles.filterGroup}>
          <input
            type="text"
            placeholder="Search messages..."
            value={messageFilters.searchText}
            onChange={(e) => setMessageFilters({...messageFilters, searchText: e.target.value})}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <select
            value={messageFilters.readStatus}
            onChange={(e) => setMessageFilters({...messageFilters, readStatus: e.target.value})}
            className={styles.filterSelect}
          >
            <option value="all">All Messages</option>
            <option value="unread">Unread Only</option>
            <option value="read">Read Only</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <select
            value={messageFilters.priority}
            onChange={(e) => setMessageFilters({...messageFilters, priority: e.target.value})}
            className={styles.filterSelect}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="info">Info</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <select
            value={messageFilters.dateRange}
            onChange={(e) => setMessageFilters({...messageFilters, dateRange: e.target.value})}
            className={styles.filterSelect}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>
      </div>
    );

    const renderMessageList = (messagesList, emptyMessage) => (
      <div className={styles.messagesList}>
        {messagesList.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📭</div>
            <h4>No Messages</h4>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          messagesList.map((message) => (
            <div 
              key={message._id} 
              className={`${styles.messageItem} ${!isMessageRead(message) ? styles.unread : ''} ${getPriorityClass(message.priority)}`}
              onClick={() => handleMessageClick(message)}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.messageAvatar}>
                {getPriorityIcon(message.priority)}
                {!isMessageRead(message) && <span className={styles.unreadDot}>🔴</span>}
              </div>
              <div className={styles.messageContent}>
                <div className={styles.messageHeader}>
                  <span className={styles.messageSender}>
                    {message.sender_id === user?.id 
                      ? `To: Admin`
                      : `From: Admin - ${message.sender_first_name} ${message.sender_last_name}`
                    }
                  </span>
                  <span className={styles.messageTime}>
                    {formatDate(message.created_at)}
                  </span>
                  {!isMessageRead(message) && (
                    <span className={styles.unreadIndicator}>●</span>
                  )}
                </div>
                <div className={styles.messageSubject}>
                  <span className={`${styles.priorityBadge} ${getPriorityClass(message.priority)}`}>
                    {message.priority.toUpperCase()}
                  </span>
                  {message.title}
                </div>
                <div className={styles.messagePreview}>
                  {message.content.length > 100 
                    ? `${message.content.substring(0, 100)}...`
                    : message.content
                  }
                </div>
                {message.expiresAt && new Date(message.expiresAt) > new Date() && (
                  <div className={styles.messageExpiry}>
                    Expires: {formatDate(message.expiresAt)}
                  </div>
                )}
              </div>
              <div className={styles.messageActions}>
                {/* Only show Mark Read button for received messages (not for sent messages) */}
                {!isMessageRead(message) && message.recipient_id === user?.id && (
                  <button 
                    className={styles.messageAction}
                    onClick={(e) => {
                      e.stopPropagation();
                      markMessageAsRead(message.id); // Use message.id instead of message._id
                    }}
                  >
                    ✓ Mark Read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );

    const inquiryMessages = filterMessages(messages, 'inquiries');
    const announcementMessages = filterMessages(messages, 'announcements');

    return (
      <div className={styles.communicationContent}>
        <div className={styles.communicationHeader}>
          <h3>Communication Center</h3>
          <button className={styles.refreshBtn} onClick={loadMessages}>
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
        </div>

        {/* Communication Sub-Tabs */}
        <div className={styles.communicationTabs}>
          <button 
            className={`${styles.commTab} ${communicationTab === 'inquiries' ? styles.active : ''}`}
            onClick={() => setCommunicationTab('inquiries')}
          >
            <i className="fas fa-question-circle"></i>
            My Inquiries ({inquiryMessages.length})
          </button>
          <button 
            className={`${styles.commTab} ${communicationTab === 'announcements' ? styles.active : ''}`}
            onClick={() => setCommunicationTab('announcements')}
          >
            <i className="fas fa-bullhorn"></i>
            Announcements ({announcementMessages.length})
          </button>
          <button 
            className={`${styles.commTab} ${communicationTab === 'compose' ? styles.active : ''}`}
            onClick={() => setCommunicationTab('compose')}
          >
            <i className="fas fa-plus-circle"></i>
            Send Message
          </button>
        </div>

        {/* Filters (show only for message lists) */}
        {communicationTab !== 'compose' && renderFilters()}

        {/* Tab Content */}
        <div className={styles.communicationTabContent}>
          {communicationTab === 'inquiries' && (
            <div className={styles.tabPanel}>
              <div className={styles.tabHeader}>
                <h4>My Inquiries to Admin</h4>
                <span className={styles.messageCount}>
                  {inquiryMessages.length} message{inquiryMessages.length !== 1 ? 's' : ''}
                </span>
              </div>
              {renderMessageList(inquiryMessages, "You haven't sent any messages to the admin yet.")}
            </div>
          )}

          {communicationTab === 'announcements' && (
            <div className={styles.tabPanel}>
              <div className={styles.tabHeader}>
                <h4>Announcements from Admin</h4>
                <span className={styles.messageCount}>
                  {announcementMessages.length} message{announcementMessages.length !== 1 ? 's' : ''}
                </span>
              </div>
              {renderMessageList(announcementMessages, "No announcements from administration yet.")}
            </div>
          )}

          {communicationTab === 'compose' && (
            <div className={styles.tabPanel}>
              <div className={styles.composeForm}>
                <h4>Send Message to Admin</h4>
                <div className={styles.formGroup}>
                  <label>Subject:</label>
                  <input
                    type="text"
                    value={composeForm.title}
                    onChange={(e) => setComposeForm({ ...composeForm, title: e.target.value })}
                    placeholder="Enter message subject..."
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Priority:</label>
                  <select
                    value={composeForm.priority}
                    onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value })}
                    className={styles.formSelect}
                  >
                    <option value="info">Info</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Message:</label>
                  <textarea
                    value={composeForm.content}
                    onChange={(e) => setComposeForm({ ...composeForm, content: e.target.value })}
                    placeholder="Type your message here..."
                    rows="6"
                    className={styles.formTextarea}
                  />
                </div>
                <div className={styles.formActions}>
                  <button 
                    className={styles.sendBtn} 
                    onClick={sendMessageToAdmin}
                    disabled={sending || !composeForm.title.trim() || !composeForm.content.trim()}
                  >
                    {sending ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Sending...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane"></i>
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.dashboard}>
      <Header 
        title="Parent Dashboard" 
        userRole="parent"
        userName={user?.fullName || `${user?.firstName} ${user?.lastName}` || user?.firstName}
        onLogout={handleLogout}
        rightActions={
          <button className={styles.headerAction}>
            <i className="fas fa-bell"></i>
            <span className={styles.notificationCount}>
              {overviewData?.notifications?.length || 0}
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
                {(user?.fullName || user?.firstName || 'P').charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h4 className={styles.profileName}>
                    {user?.fullName || `${user?.firstName} ${user?.lastName}` || user?.firstName || 'Parent'}
                  </h4>
                  <p className={styles.profileRole}>Parent Account</p>
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
                className={`${styles.sidebarButton} ${activeTab === 'billing' ? styles.active : ''}`}
                onClick={() => setActiveTab('billing')}
                title="Billing"
              >
                <i className="fas fa-dollar-sign"></i>
                <span className={styles.sidebarButtonText}>Billing</span>
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
              {activeTab === 'billing' && (
                <div className={styles.billingContent}>
                  <ParentBillingView parentId={user?.id} />
                </div>
              )}
                            {activeTab === 'SessionParticipants' && renderSessionParticipants()}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboardEnhanced;
