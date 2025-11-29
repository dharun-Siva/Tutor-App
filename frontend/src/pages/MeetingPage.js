import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Navigate, useSearchParams  } from 'react-router-dom';
import MeetingApp from '../components/meeting/App.jsx';
import LoadingSpinner from '../shared/components/LoadingSpinner';
import { isAuthenticated, getStoredUser } from '../utils/helpers';
import { useLocation } from 'react-router-dom';

const MeetingPage = () => {
  const { meetingId } = useParams();
  const location = useLocation();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meetingConfig, setMeetingConfig] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [autoJoinTriggered, setAutoJoinTriggered] = useState(false);

  const user = getStoredUser();
    useEffect(() => {
    const loadMeetingConfig = async () => {
      try {
        // Authentication and user check
        if (!isAuthenticated() || !user) {
          setError('Please login to join the meeting');
          setLoading(false);
          return;
        }

        let finalMeetingId;
        let userName;
        let userId;
        let role;
  let classIdFromQuery = null;

        // Check if this is the clean session-class URL (after URL replacement)
        if (location.pathname === '/meeting/session-class') {
          // Try to get data from history state first (after URL replacement)
          const historyState = window.history.state;
          if (historyState && historyState.meetingId) {
            finalMeetingId = historyState.meetingId;
            userName = historyState.userName;
            userId = historyState.userId;
            role = historyState.role;
            console.log('📋 Retrieved meeting data from history state:', historyState);
          } else {
            setError('Meeting session data not found. Please try joining again from the dashboard.');
            setLoading(false);
            return;
          }
        } else {
          // Original URL with meetingId parameter
          if (!meetingId || (!meetingId.startsWith('session-') && !meetingId.startsWith('class-'))) {
            setError('Invalid meeting ID format');
            setLoading(false);
            return;
          }


            // Get URL search parameters
            const urlParams = new URLSearchParams(location.search);
            const shouldDisplayClean = urlParams.get('displayClean') === 'true';

            finalMeetingId = meetingId;
            userName = urlParams.get('userName') || user.username || user.firstName || 'User';
            userId = urlParams.get('userId') || user.id;
            role = urlParams.get('role') || user.role;
            // Pass through DB class id if provided (classId query param)
            classIdFromQuery = urlParams.get('classId');


          console.log('📋 Meeting details:', { 
            meetingId: finalMeetingId, 
            userName, 
            userId, 
            role,
            shouldDisplayClean
          });

          // If displayClean is true, change the browser URL to show clean version
          if (shouldDisplayClean) {
            console.log('🎨 Changing browser URL to clean display version');
            window.history.replaceState(
              { meetingId: finalMeetingId, userName, userId, role }, // Store original data in history state
              'Meeting Session', // Page title
              '/meeting/session-class' // Clean URL to display
            );
          }
        }

        // Set meeting configuration for auto-join
        const config = {
          meetingId: finalMeetingId,
          channelName: finalMeetingId,
          userName: userName,
          userId: userId,
          role: role,
          classId: classIdFromQuery || null,
          autoJoin: true // Add this to trigger auto-join
        };

        // Only update state if the config has changed
        if (JSON.stringify(meetingConfig) !== JSON.stringify(config)) {
          setMeetingConfig(config);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading meeting config:', err);
        setError('Failed to load meeting configuration');
        setLoading(false);
      }
    };

    loadMeetingConfig();
    
  }, [meetingId, user]);
  

  const joinChannel = useCallback(() => {
  if (!meetingConfig) {
    setError('Meeting configuration is missing.');
    return;
  }

  const { channelName, userName, userId, role } = meetingConfig;

  if (!channelName || !userName || !userId || !role) {
    setError('Invalid meeting configuration.');
    return;
  }

  try {
    setLoading(true);
    setError(null);

    // Logic to actually join the meeting, e.g., initialize Agora, Zoom, etc.
    // This will depend on your SDK or meeting library integration.

    console.log(`Joining channel: ${channelName} as ${userName} (${role})`);

    // Example: Set isJoined to true to switch UI to meeting screen
    setIsJoined(true);

    // Optionally, do other SDK join actions here

  } catch (err) {
    console.error('Failed to join meeting:', err);
    setError('Failed to join meeting. Please try again.');
  } finally {
    setLoading(false);
  }
}, [meetingConfig]);

 
  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }

  // Show loading spinner
  if (loading) {
    return (
      <LoadingSpinner 
        size="lg" 
        message="Loading meeting..." 
        fullScreen={true} 
      />
    );
  }

  // Show error if any
  if (error) {
    return (
      <div className="meeting-error-container" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div className="alert alert-danger" style={{ maxWidth: '500px' }}>
          <h4>Meeting Error</h4>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.history.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Render the meeting app
  console.log('🎬 MeetingPage rendering MeetingApp with config:', meetingConfig);
  
  return (
    <div className="meeting-page-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <MeetingApp config={meetingConfig} />
    </div>
  );
}

export default MeetingPage;