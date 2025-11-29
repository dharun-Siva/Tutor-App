import React, { useState, useEffect } from 'react';
import styles from './MeetingControls.module.css';
import axios from 'axios';

const MeetingControls = ({ 
  classData, 
  userRole = 'admin', // 'admin', 'tutor', 'student'
  onSessionCreated, 
  onJoinSession, 
  onLeaveSession,
  onCompleteSession,
  allowJoinAnytime = false
}) => {
  const [sessionData, setSessionData] = useState(null);
  //  const[classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInSession, setIsInSession] = useState(false);
  const [timeStatus, setTimeStatus] = useState('not-ready'); // 'not-ready', 'ready', 'live', 'ended'
  const [sessionRatings, setSessionRatings] = useState({
    tutorRating: 5,
    studentRating: 5,
    sessionNotes: ''
  });


  // Check for existing session when component mounts
  useEffect(() => {
    if (classData?.id || classData?._id) {
      checkExistingSession();
      console.log('class data', classData);
    }
  }, [classData]);

  // Set up time-based status checking
  useEffect(() => {
    // We need either a startTime or a classDate to compute the window
    if (!classData?.startTime && !classData?.classDate) return;

    const parseClassWindow = () => {
      // classData.startTime could be an ISO datetime or an HH:MM with classDate
      let classStart;
      let classEnd;

      try {
        // Prefer sessionData scheduled times when available (more authoritative)
        if (sessionData && sessionData.scheduledStartTime) {
          classStart = new Date(sessionData.scheduledStartTime);
        }
        if (sessionData && sessionData.scheduledEndTime) {
          classEnd = new Date(sessionData.scheduledEndTime);
        }

        // If not provided by sessionData, fall back to classData values
        if (!classStart) {
        // If startTime looks like HH:MM and we have classDate, combine them
        if (classData.startTime && /^\d{2}:\d{2}$/.test(classData.startTime) && classData.classDate) {
          const datePart = (typeof classData.classDate === 'string')
            ? classData.classDate
            : new Date(classData.classDate).toISOString().slice(0,10);
          classStart = new Date(`${datePart}T${classData.startTime}:00`);
        } else {
          // try direct parse, then Date.parse fallback
          classStart = new Date(classData.startTime);
          if (isNaN(classStart.getTime())) {
            const parsed = Date.parse(classData.startTime);
            if (!isNaN(parsed)) classStart = new Date(parsed);
          }
        }

        // Determine classEnd: use endTime if present, otherwise compute from duration
        if (!classEnd) {
          if (classData.endTime && /^\d{2}:\d{2}$/.test(classData.endTime) && classData.classDate) {
          const datePart = (typeof classData.classDate === 'string')
            ? classData.classDate
            : new Date(classData.classDate).toISOString().slice(0,10);
          classEnd = new Date(`${datePart}T${classData.endTime}:00`);
          } else if (classData.endTime) {
            classEnd = new Date(classData.endTime);
            if (isNaN(classEnd.getTime())) {
              const parsedEnd = Date.parse(classData.endTime);
              if (!isNaN(parsedEnd)) classEnd = new Date(parsedEnd);
            }
          }
        }

        if (!classEnd) {
          const durationMin = classData.duration || classData.customDuration || 35;
          classEnd = new Date(classStart.getTime() + durationMin * 60 * 1000);
        }
        }
      } catch (err) {
        console.warn('Error parsing class start/end times:', err);
        // Fallback: try classDate + startTime combination, then best-effort
        try {
          if (classData.classDate && classData.startTime && /^\d{2}:\d{2}$/.test(classData.startTime)) {
            const datePart = (typeof classData.classDate === 'string') ? classData.classDate : new Date(classData.classDate).toISOString().slice(0,10);
            classStart = new Date(`${datePart}T${classData.startTime}:00`);
          } else {
            classStart = new Date(classData.classDate || classData.startTime);
          }
        } catch (err2) {
          classStart = new Date();
        }
        const durationMin = classData.duration || classData.customDuration || 35;
        classEnd = new Date(classStart.getTime() + durationMin * 60 * 1000);
      }

      // Debug logs to help reproduce timezone/format issues
      console.log('parseClassWindow -> classStart=', classStart && classStart.toISOString(), 'classEnd=', classEnd && classEnd.toISOString(), 'source startTime=', classData.startTime, 'classDate=', classData.classDate, 'sessionScheduledStart=', sessionData?.scheduledStartTime);

      return { classStart, classEnd };
    };

    const checkTimeStatus = () => {
      const now = new Date();
      const { classStart, classEnd } = parseClassWindow();

      // Meeting window: 15 minutes before to 30 minutes after class
      const joinWindowStart = new Date(classStart.getTime() - 15 * 60 * 1000);
      const joinWindowEnd = new Date(classEnd.getTime() + 30 * 60 * 1000);

      if (now < joinWindowStart) {
        setTimeStatus('not-ready');
      } else if (now >= joinWindowStart && now <= classEnd) {
        setTimeStatus(now >= classStart ? 'live' : 'ready');
      } else if (now <= joinWindowEnd) {
        setTimeStatus('ending');
      } else {
        setTimeStatus('ended');
      }
    };

    checkTimeStatus();
    const interval = setInterval(checkTimeStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [classData]);


const checkExistingSession = async () => {
  try {
    const token = localStorage.getItem('token');
    const classIdForQuery = classData.id || classData._id;

    const response = await fetch(`/api/sessions?classId=${classIdForQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      console.log("checkExistingSession → API return:", data);


      if (data.sessions?.length > 0) {
        setSessionData(data.sessions[0]);
        console.log('✅ Session found:', data.sessions[0]);
      } else {
        console.log('ℹ️ No sessions found for this class.');
      }
    } else {
      console.error('❌ Failed to fetch sessions:', response.status);
    }
  } catch (error) {
    console.error('❌ Error checking existing session:', error);
  }
};




  const createSession = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          classId: classData.id,
          meetingPlatform: 'agora'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSessionData(data.session);
        if (onSessionCreated) onSessionCreated(data.session);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to create session');
      }
    } catch (error) {
      setError('Error creating session');
      console.error('Error creating session:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sessions/${sessionData._id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsInSession(true);
        if (onJoinSession) onJoinSession(data);

        // Generate meeting URL for Agora meeting app
        const meetingUrl = generateMeetingUrl(sessionData, userRole);

        // Open Agora meeting app in new tab
        window.open(meetingUrl, '_blank', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to join session');
      }
    } catch (error) {
      setError('Error joining session');
      console.error('Error joining session:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate meeting URL for Agora meeting server
  const generateMeetingUrl = (sessionData, userRole) => {
    const meetingServerUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');

    const params = new URLSearchParams({
      meetingId: sessionData.meetingId,
      userName: userInfo.name || `${userRole}_${userInfo.id}`,
      userRole: userRole,
      classId: classData.id || classData._id,
      sessionId: sessionData._id
    });

    return `${meetingServerUrl}?${params.toString()}`;
  };

  const leaveSession = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sessions/${sessionData._id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsInSession(false);
        if (onLeaveSession) onLeaveSession(data);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to leave session');
      }
    } catch (error) {
      setError('Error leaving session');
      console.error('Error leaving session:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeSession = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sessions/${sessionData._id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(sessionRatings)
      });

      if (response.ok) {
        const data = await response.json();
        setSessionData(data.session);
        setIsInSession(false);
        if (onCompleteSession) onCompleteSession(data);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to complete session');
      }
    } catch (error) {
      setError('Error completing session');
      console.error('Error completing session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = (field, value) => {
    setSessionRatings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeStatusMessage = () => {
    if (!classData?.startTime) return '';
    
    const now = new Date();
    const classStart = new Date(classData.startTime);
    const minutesUntilStart = Math.ceil((classStart - now) / (1000 * 60));
    
    switch (timeStatus) {
      case 'not-ready':
        return `Meeting available ${minutesUntilStart} minutes before class starts`;
      case 'ready':
        return `Meeting ready to join (${Math.abs(minutesUntilStart)} minutes until class)`;
      case 'live':
        return 'Class is live now!';
      case 'ending':
        return 'Class time ended, but meeting still available';
      case 'ended':
        return 'Meeting window has closed';
      default:
        return '';
    }
  };


  const canShowMeetingControls = () => {
    // Admin can always see controls
    if (userRole === 'admin') return true;
    // Allow join anytime for one-time classes if prop is set
    if (allowJoinAnytime && userRole === 'student') return true;
    // For students and tutors, only show during meeting window
    return ['ready', 'live', 'ending'].includes(timeStatus);
  };

  const canCreateSession = () => {
    return userRole === 'admin' || (userRole === 'tutor' && ['ready', 'live'].includes(timeStatus));
  };


  const canJoinSession = () => {
    if (!sessionData) {
      return false;
    }
    // Allow join anytime for one-time classes if prop is set
    if (allowJoinAnytime && userRole === 'student' && sessionData.status === 'scheduled') {
      return true;
    }
    const validStatuses = ['ready', 'live', 'ending'];
    const isJoinable = sessionData.status === 'scheduled' && validStatuses.includes(timeStatus);
    return isJoinable;
  };



console.log("Render check → sessionData:", sessionData);
console.log("Render check → canJoinSession:", canJoinSession());
console.log("Render check → isInSession:", isInSession);

  if (!classData) {
    return <div className={styles.noClass}>No class selected</div>;
  }
console.log('User role:', userRole);
console.log('Session data:', sessionData);
console.log('Can create session:', canCreateSession());
console.log('Can join session:', canJoinSession());
console.log('Can show meeting controls:', canShowMeetingControls());

  return (
    <div className={styles.meetingControls}>
      <div className={styles.classInfo}>
        <h3>{classData.subject} - Grade {classData.grade}</h3>
        <p>Scheduled: {formatDateTime(classData.startTime)} - {formatDateTime(classData.endTime)}</p>
        <p>Tutor: {classData.tutorName}</p>
        <p>Student: {classData.studentName}</p>
        
        {/* Time Status Indicator */}
        <div className={`${styles.timeStatus} ${styles[timeStatus]}`}>
          <i className={`fas ${
            timeStatus === 'not-ready' ? 'fa-clock' :
            timeStatus === 'ready' ? 'fa-play-circle' :
            timeStatus === 'live' ? 'fa-video' :
            timeStatus === 'ending' ? 'fa-hourglass-end' :
            'fa-stop-circle'
          }`}></i>
          {getTimeStatusMessage()}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {!canShowMeetingControls() && userRole !== 'admin' ? (
        <div className={styles.timeInfo}>
          <p>Meeting controls will be available 15 minutes before class starts.</p>
        </div>
      ) : (
        <>

        {!sessionData ? (
          <div className={styles.createSession}>
            {canCreateSession() ? (
              <>
                <p>No meeting session exists for this class.</p>
                <button 
                  onClick={createSession}
                  disabled={loading}
                  className={styles.createButton}
                >
                  {loading ? 'Creating...' : 'Create Meeting Session'}
                </button>
              </>
            ) : (
              <>
                {/* <p>Meeting session will be created by the tutor or admin</p> */}
                {canJoinSession() && (
                  <p className={styles.note}>
                    You will be able to join the session once it's created.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
            <div className={styles.sessionControls}>
              <div className={styles.sessionInfo}>
                <h4>Meeting Session</h4>
                <p>Status: <span className={`${styles.status} ${styles[sessionData.status]}`}>
                  {sessionData.status}
                </span></p>
                {sessionData.actualStartTime && (
                  <p>Started: {formatDateTime(sessionData.actualStartTime)}</p>
                )}
                {sessionData.actualEndTime && (
                  <p>Ended: {formatDateTime(sessionData.actualEndTime)}</p>
                )}
                
                {/* Role-specific information */}
                {userRole === 'tutor' && (
                  <div className={styles.tutorInfo}>
                    <i className="fas fa-chalkboard-teacher"></i>
                    <span>You are the host of this session</span>
                  </div>
                )}
                {userRole === 'student' && (
                  <div className={styles.studentInfo}>
                    <i className="fas fa-user-graduate"></i>
                    <span>You are joining as a student</span>
                  </div>
                )}
              </div>

              <div className={styles.meetingActions}>
                {/* Show Join button if scheduled, user not in session and can join */}
                {sessionData.status === 'scheduled' && !isInSession && canJoinSession() && (
                  <button 
                    onClick={joinSession}
                    disabled={loading}
                    className={styles.joinButton}
                  >
                    {loading ? 'Joining...' : `Join Meeting${userRole === 'tutor' ? ' as Host' : ''}`}
                  </button>
                )}

                {/* Show Leave and Complete buttons when in-progress and user is in session */}
                {sessionData.status === 'in-progress' && isInSession && (
                  <div className={styles.inSessionControls}>
                    <button 
                      onClick={leaveSession}
                      disabled={loading}
                      className={styles.leaveButton}
                    >
                      {loading ? 'Leaving...' : 'Leave Meeting'}
                    </button>
                    
                    {(userRole === 'tutor' || userRole === 'admin') && (
                      <button 
                        onClick={completeSession}
                        disabled={loading}
                        className={styles.completeButton}
                      >
                        {loading ? 'Completing...' : 'Complete Session'}
                      </button>
                    )}
                  </div>
                )}

                {/* Show Rejoin button if in-progress but user is not in session yet can join */}
                {sessionData.status === 'in-progress' && !isInSession && canJoinSession() && (
                  <button 
                    onClick={joinSession}
                    disabled={loading}
                    className={styles.rejoinButton}
                  >
                    {loading ? 'Rejoining...' : 'Rejoin Meeting'}
                  </button>
                )}


                {sessionData.meetingId && (
                  <a
                    href={generateMeetingUrl(sessionData, userRole)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.meetingLink}
                  >
                    <i className="fas fa-external-link-alt"></i>
                    Open Meeting Room
                  </a>
                )}
              </div>

              {sessionData.status === 'in-progress' && (userRole === 'tutor' || userRole === 'admin') && (
                <div className={styles.sessionRatings}>
                  <h5>Session Feedback</h5>
                  <div className={styles.ratingGroup}>
                    <label>
                      Tutor Rating:
                      <select 
                        value={sessionRatings.tutorRating}
                        onChange={(e) => handleRatingChange('tutorRating', parseInt(e.target.value))}
                      >
                        {[1,2,3,4,5].map(rating => (
                          <option key={rating} value={rating}>{rating} Stars</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  
                  <div className={styles.ratingGroup}>
                    <label>
                      Student Rating:
                      <select 
                        value={sessionRatings.studentRating}
                        onChange={(e) => handleRatingChange('studentRating', parseInt(e.target.value))}
                      >
                        {[1,2,3,4,5].map(rating => (
                          <option key={rating} value={rating}>{rating} Stars</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  
                  <div className={styles.ratingGroup}>
                    <label>
                      Session Notes:
                      <textarea 
                        value={sessionRatings.sessionNotes}
                        onChange={(e) => handleRatingChange('sessionNotes', e.target.value)}
                        placeholder="Enter any notes about this session..."
                        rows="3"
                      />
                    </label>
                  </div>
                </div>
              )}

              {sessionData.status === 'completed' && (
                <div className={styles.completedSession}>
                  <h5>Session Completed</h5>
                  <p>Duration: {sessionData.actualDuration} minutes</p>
                  {sessionData.tutorRating && <p>Tutor Rating: {sessionData.tutorRating}/5</p>}
                  {sessionData.studentRating && <p>Student Rating: {sessionData.studentRating}/5</p>}
                  {sessionData.sessionNotes && <p>Notes: {sessionData.sessionNotes}</p>}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MeetingControls;
