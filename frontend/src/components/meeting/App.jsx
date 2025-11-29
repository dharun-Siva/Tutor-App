import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
// Optional extensions - commented out for now
// import VirtualBackgroundExtension from 'agora-extension-virtual-background';
// import BeautyExtension from 'agora-extension-beauty-effect';
import axios from 'axios';
import WhiteboardAgora from './WhiteboardAgora.jsx';
// import Chat from './Chat.jsx'; // Temporarily disabled
import './MathClass.css';
import { useLocation, useParams } from 'react-router-dom';
import { getStoredUser } from '../../utils/helpers';

const App = ({ config }) => {
  console.log('🚀 MeetingApp component initialized with config:', config);
  console.log('🚀 MeetingApp component props received:', { config });
  
  const user = getStoredUser();
  //const { meetingId } = useParams(); 
  const meetingId = config?.meetingId;
  console.log('meetingId from URL params:', meetingId);
  const location = useLocation();
  
  // State management
  const [channelName, setChannelName] = useState('');
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [userId, setUserId] = useState('');
   const [role, setRole] = useState('');

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // User tracking state
  const [joinedUsers, setJoinedUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [localUserInfo, setLocalUserInfo] = useState({ uid: null, joinTime: null });

  // Whiteboard sharing state
  const [sharedWhiteboardRoomId, setSharedWhiteboardRoomId] = useState('');
  const [isJoiningExistingRoom, setIsJoiningExistingRoom] = useState(false);

  // Whiteboard state
  const [isWhiteboardVisible, setIsWhiteboardVisible] = useState(false);
  const [whiteboardRoom, setWhiteboardRoom] = useState(null);
  const [whiteboardToken, setWhiteboardToken] = useState('');
  const [whiteboardAppIdentifier, setWhiteboardAppIdentifier] = useState('');
  const [whiteboardUid, setWhiteboardUid] = useState('');
  const [whiteboardError, setWhiteboardError] = useState('');
  
  // Whiteboard ID sharing state
  const [currentWhiteboardId, setCurrentWhiteboardId] = useState('');
  const [pasteWhiteboardId, setPasteWhiteboardId] = useState('');
  const [showIdControls, setShowIdControls] = useState(false);
  const [isJoiningSharedWhiteboard, setIsJoiningSharedWhiteboard] = useState(false);
  const [whiteboardIdCopied, setWhiteboardIdCopied] = useState(false);

  // Chat state
  const [isChatVisible, setIsChatVisible] = useState(false);

  // Screen sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareTrack, setScreenShareTrack] = useState(null);

  // Camera switching state
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState('');
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // Virtual background state
  const [virtualBackgroundExtension, setVirtualBackgroundExtension] = useState(null);
  const [virtualBackgroundProcessor, setVirtualBackgroundProcessor] = useState(null);
  const [isVirtualBackgroundEnabled, setIsVirtualBackgroundEnabled] = useState(false);
  const [virtualBackgroundType, setVirtualBackgroundType] = useState('none');
  const [virtualBackgroundError, setVirtualBackgroundError] = useState('');
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState(null);
  const [isVirtualBackgroundProcessing, setIsVirtualBackgroundProcessing] = useState(false);

  // Session participant tracking state
  const [sessionParticipantId, setSessionParticipantId] = useState(null);

  // Participant names mapping state (UID to name)
  const [participantNames, setParticipantNames] = useState({});

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pinned video state
  const [pinnedUserId, setPinnedUserId] = useState(null);

  // Restore session participant ID from localStorage on component load
  useEffect(() => {
    const storedParticipantId = localStorage.getItem('sessionParticipantId');
    if (storedParticipantId) {
      setSessionParticipantId(storedParticipantId);
      console.log('🔄 Restored session participant ID from localStorage:', storedParticipantId);
    }
  }, []);

  // Debug function to check authentication status (accessible from browser console)
  React.useEffect(() => {
    window.debugSessionAuth = () => {
      const currentUser = getStoredUser();
      const accessToken = localStorage.getItem('accessToken');
      const fallbackToken = localStorage.getItem('token');
      const token = accessToken || fallbackToken;
      
      const authDebug = {
        user: currentUser ? {
          id: currentUser.id,
          role: currentUser.role,
          email: currentUser.email,
          name: currentUser.name
        } : null,
        tokens: {
          accessToken: accessToken ? {
            exists: true,
            length: accessToken.length,
            preview: `${accessToken.substring(0, 30)}...`,
            startsWithBearer: accessToken.startsWith('Bearer ')
          } : null,
          fallbackToken: fallbackToken ? {
            exists: true,
            length: fallbackToken.length,
            preview: `${fallbackToken.substring(0, 30)}...`,
            startsWithBearer: fallbackToken.startsWith('Bearer ')
          } : null,
          finalToken: token ? {
            exists: true,
            length: token.length,
            preview: `${token.substring(0, 30)}...`,
            startsWithBearer: token.startsWith('Bearer ')
          } : null
        },
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage),
        meeting: {
          channelName: channelName,
          meetingId: meetingId,
          isJoined: isJoined,
          meeting_class_id: channelName?.replace(/^(session-|class-)/, '')
        }
      };
      
      console.table(authDebug.tokens);
      console.log('🔍 Complete Authentication Debug:', authDebug);
      return authDebug;
    };
    
    // Cleanup
    return () => {
      delete window.debugSessionAuth;
    };
  }, [channelName, meetingId, isJoined]);

  // Fullscreen toggle function
  const toggleFullscreen = async () => {
    const elem = document.documentElement;
    
    if (!isFullscreen) {
      // Enter fullscreen
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // ESC key handler for fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Toggle pin for video
  const togglePinVideo = (uid) => {
    if (pinnedUserId === uid) {
      setPinnedUserId(null); // Unpin if already pinned
    } else {
      setPinnedUserId(uid); // Pin this user's video
      // Close whiteboard when pinning a video
      closeWhiteboard();
    }
  };

  // Initialize meeting with URL parameters and auto-join immediately
  useEffect(() => {
    console.log('🔍 Config received:', config);
    console.log('🔍 Current state - isJoined:', isJoined, 'isLoading:', isLoading);
    console.log('🔍 Client initialized:', !!clientRef.current);
    
    if (config && config.meetingId && config.userName && !isJoined && !isLoading && clientRef.current) {
      console.log('✅ Config is valid, setting up meeting...');
      
      // Check if session join already happened (to prevent duplicate API calls)
      // Do NOT skip auto-joining Agora just because a sessionParticipantId exists.
      // We still need to join the Agora channel and publish local tracks. Only
      // skip the server-side "recordSessionJoin" when a sessionParticipantId is present.
      const existingSessionId = localStorage.getItem('sessionParticipantId');
      if (existingSessionId) {
        console.log('⚠️ Session already joined previously; will skip server join but will continue to auto-join Agora client');
        // continue — do not return here so the client still joins the Agora channel
      }
      
      setChannelName(config.meetingId);
      setUserName(config.userName);
      
      // Generate unique personal whiteboard ID for each user
      if (!currentWhiteboardId) {
        const personalWhiteboardId = `wb_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;
        setCurrentWhiteboardId(personalWhiteboardId);
        console.log('📝 Generated personal whiteboard ID:', personalWhiteboardId);
      }
      
      console.log('🚀 Meeting initialized with config:', config);

      // Auto-join the actual channel immediately with a small delay to ensure state is set
      setTimeout(() => {
        console.log('🚀 Auto-joining meeting with slight delay...');
        console.log('🔍 Pre-join state check:', {
          channelName: config.meetingId,
          userName: config.userName,
          isJoined,
          isLoading,
          hasClient: !!clientRef.current
        });
        // Call joinChannel with the meetingId directly to avoid state timing issues
        joinChannelWithId(config.meetingId, config.userName);
      }, 1000); // Increased delay to ensure everything is ready
    } else {
      console.log('❌ Config not ready or already joining:', { 
        hasConfig: !!config, 
        meetingId: config?.meetingId, 
        userName: config?.userName,
        isJoined,
        isLoading,
        hasClient: !!clientRef.current
      });
    }
  }, [config, isJoined, isLoading]);

  // Reset processing state on mount to prevent stuck state
  useEffect(() => {
    setIsVirtualBackgroundProcessing(false);

    // Add cleanup on page unload/refresh
    const handleBeforeUnload = () => {
      // Clear session storage to prevent duplicate UIDs
      sessionStorage.removeItem('whiteboard-user-uid');
      console.log('🧹 Cleared session data on page unload');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Beauty effect state
  const [beautyExtension, setBeautyExtension] = useState(null);
  const [beautyProcessor, setBeautyProcessor] = useState(null);
  const [isBeautyEnabled, setIsBeautyEnabled] = useState(false);
  const [beautyError, setBeautyError] = useState('');
  const [beautySettings, setBeautySettings] = useState({
    lighteningContrastLevel: 1,
    lighteningLevel: 0.5,
    smoothnessLevel: 0.5,
    sharpnessLevel: 0.3,
    rednessLevel: 0.3,
    // Additional beauty options
    eyeEnlargingLevel: 0.0,
    faceSlimmingLevel: 0.0,
    cheekboneSlimmingLevel: 0.0,
    noseSlimmingLevel: 0.0,
    chinSlimmingLevel: 0.0,
    jawSlimmingLevel: 0.0,
    foreheadSlimmingLevel: 0.0,
    // Color adjustments
    saturationLevel: 0.0,
    contrastLevel: 0.0,
    brightnessLevel: 0.0
  });

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);
  const settingsPanelRef = useRef(null);

  // Refs for Agora client and tracks
  const clientRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const localVideoTrackRef = useRef(null);
  const localScreenTrackRef = useRef(null);
  const localVideoContainerRef = useRef(null);
  const localSidebarVideoRef = useRef(null);

  // Handle click outside settings panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(event.target)) {
        // Don't close if clicking on settings button itself
        const settingsButton = event.target.closest('button');
        if (settingsButton && settingsButton.textContent === 'Settings') {
          return;
        }
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSettings]);

  // Handle browser close/refresh to end session
  useEffect(() => {
    const handleBeforeUnload = async (event) => {
      if (isJoined && channelName) {
        // Record session end when user closes tab or refreshes
        try {
          console.log('🚪 Handling beforeunload - preparing session end data...');
          const meeting_class_id = config?.meetingId?.replace(/^(session-|class-)/, '') || 
                                  meetingId?.replace(/^(session-|class-)/, '') || 
                                  channelName?.replace(/^(session-|class-)/, '');
          
          console.log('🔍 BeforeUnload - meeting_class_id extracted:', meeting_class_id);
          
          if (meeting_class_id && user?.id) {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
            
            // Store session end data for the visibilitychange listener to handle
            const pendingEndData = {
              meeting_class_id,
              token,
              endedAt: new Date().toISOString()
            };
            
            // Include participant_id if available
            if (sessionParticipantId) {
              pendingEndData.participant_id = sessionParticipantId;
            }
            
            sessionStorage.setItem('pendingSessionEnd', JSON.stringify(pendingEndData));
            
            console.log('📝 Stored pending session end data for background processing:', {
              meeting_class_id,
              hasToken: !!token,
              hasParticipantId: !!sessionParticipantId
            });
          } else {
            console.warn('⚠️ BeforeUnload - missing data:', { meeting_class_id, userId: user?.id });
          }
        } catch (error) {
          console.error('❌ Error storing session end data on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isJoined, channelName, config, meetingId, user]);

  // Handle visibility change to process pending session ends
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Process any pending session end when page becomes hidden
        const pendingEndData = sessionStorage.getItem('pendingSessionEnd');
        if (pendingEndData) {
          try {
            const pendingEndDataParsed = JSON.parse(pendingEndData);
            // Always use meeting_class_id from localStorage if available
            const meeting_class_id = localStorage.getItem('meeting_class_id') || pendingEndDataParsed.meeting_class_id;
            const { token, participant_id, endedAt } = pendingEndDataParsed;

            // Get sessionParticipantId to ensure we update existing record instead of creating new one
            const sessionParticipantId = localStorage.getItem('sessionParticipantId');
            
            console.log('🔥 VISIBILITY CHANGE SESSION END TRIGGERED');
            console.log('🔍 Config object in visibility handler:', config);
            console.log('🔍 localStorage classTitle in visibility:', localStorage.getItem('classTitle'));
            console.log('🔍 localStorage meeting_class_id in visibility:', localStorage.getItem('meeting_class_id'));
            console.log('🔍 localStorage sessionParticipantId in visibility:', localStorage.getItem('sessionParticipantId'));
            console.log('🔍 meeting_class_id from pendingEndData:', meeting_class_id);
            
            // Get additional session data for consistency with main session end
            // FIXED: Prioritize config title over localStorage to avoid stale data
            const classTitle = config?.classTitle || config?.title || localStorage.getItem('classTitle') || 'Class';
            // FIXED: Prioritize config data over localStorage for all session metadata
            const classStartTime = config?.startTime || config?.start_time || localStorage.getItem('classStartTime') || new Date().toISOString();
            const classDuration = config?.duration || localStorage.getItem('classDuration') || '35';
            
            // Prepare session end payload for background processing
            const sessionEndPayload = {
              meeting_class_id,
              endedAt: endedAt || new Date().toISOString(),
              title: classTitle,
              start_time: classStartTime,
              duration: classDuration
            };

            // Include sessionParticipantId to update existing record (prevents duplicates)
            if (sessionParticipantId) {
              sessionEndPayload.sessionParticipantId = sessionParticipantId;
            }

            // Include participant_id if available
            if (participant_id) {
              sessionEndPayload.participant_id = participant_id;
            }

            // Use fetch with keepalive for better reliability
            const backendUrl = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
            const response= await fetch(`${backendUrl}/api/session/end`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(sessionEndPayload),
              keepalive: true // Important for requests during page unload
            });

            sessionStorage.removeItem('pendingSessionEnd');
            console.log('📝 Processed pending session end on visibility change');
            console.log('🔍 [VISIBILITY] Session end payload:', sessionEndPayload);
          } catch (error) {
            console.error('❌ Error processing pending session end:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Fetch participant names for the current meeting from backend
  const fetchParticipantNames = async () => {
    try {
      console.log(`🔍 Fetching participant names for meeting`);
      
      // Don't strip prefix for database lookup - use the full ID
      const meeting_class_id = config?.meetingId || 
                              meetingId || 
                              channelName;
      
      if (!meeting_class_id) {
        console.warn('⚠️ Could not determine meeting_class_id to fetch participant names');
        return;
      }

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ No auth token available to fetch participant names');
        return;
      }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
      
      // Fetch participants for this specific meeting
      const response = await axios.get(
        `${backendUrl}/api/session-participants/by-meeting/${meeting_class_id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data?.success && response.data?.data) {
        const participants = response.data.data;
        console.log(`📊 Fetched ${participants.length} session participants for meeting:`, participants);
        
        // Get current user ID
        const currentUser = getStoredUser();
        console.log(`👤 Current user ID for filtering: ${currentUser?.id}`);
        
        // Check if participants are empty or not yet created in database
        if (participants.length === 0) {
          console.log(`⏳ No participants in database yet (join in progress or first to join)`);
          console.log(`⚠️ Skipping name mapping - will retry on next poll`);
          return;
        }
        
        // Filter out the current user from participants list (we only want OTHER participants)
        const otherParticipants = participants.filter(p => p.participant_id !== currentUser?.id);
        console.log(`🔍 After filtering current user (${currentUser?.id}), remaining participants:`, otherParticipants.length);
        
        if (otherParticipants.length === 0) {
          console.log(`⏳ No OTHER participants in database (current user is alone)`);
          console.log(`💡 Waiting for others to join...`);
          return;
        }
        
        // Create a map of participant_id to participant info for direct lookup
        const participantById = {};
        otherParticipants.forEach(p => {
          participantById[p.participant_id] = p;
        });
        
        console.log(`📋 Participant map created with ${Object.keys(participantById).length} participants`);

        // Sort remaining participants by join time ascending (earliest first)
        const sortedParticipants = [...otherParticipants].sort((a, b) => 
          new Date(a.joined_at) - new Date(b.joined_at)
        );
        
        console.log(`📌 Sorted participants by join time:`, sortedParticipants.map(p => ({ name: p.name, joined_at: p.joined_at })));

        // Create a list of remote users sorted by UID (for consistent matching)
        const sortedRemoteUsers = [...remoteUsers].sort((a, b) => a.uid - b.uid);
        console.log(`👥 Remote users (Agora UIDs):`, sortedRemoteUsers.map(u => u.uid));
        
        if (sortedRemoteUsers.length === 0) {
          console.log(`⏳ No remote users in Agora channel yet`);
          return;
        }

        // Match participants to remote users
        // Strategy: Use index-based matching as primary method since we don't have direct UID-to-participant_id mapping
        // This is the most reliable way when participants are sorted by join time and remote users are sorted by UID
        const newMappings = {};
        
        sortedRemoteUsers.forEach((remoteUser, idx) => {
          // If we have a participant at this index and haven't already mapped this UID
          if (sortedParticipants[idx] && !participantNames[remoteUser.uid]) {
            const name = sortedParticipants[idx].name || `Participant ${idx + 1}`;
            newMappings[remoteUser.uid] = name;
            console.log(`✅ Mapped Agora UID ${remoteUser.uid} → "${name}" (index: ${idx})`);
          }
        });

        // Update the names state with new mappings
        if (Object.keys(newMappings).length > 0) {
          console.log(`📤 Updating participant names:`, newMappings);
          setParticipantNames(prev => ({
            ...prev,
            ...newMappings
          }));
        } else {
          console.log(`⏭️ No new mappings to update`);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching participant names:', error);
      // Don't throw - allow meeting to continue even if participant names fail
    }
  };

  // Fetch participant name from backend by querying session participants for this meeting
  const fetchParticipantName = async (uid) => {
    try {
      // Check if we already have the name cached
      if (participantNames[uid]) {
        console.log(`✅ Participant name already cached for UID ${uid}: ${participantNames[uid]}`);
        return;
      }

      console.log(`🔍 Fetching participant name for UID ${uid}`);
      
      const meeting_class_id = config?.meetingId?.replace(/^(session-|class-)/, '') || 
                              meetingId?.replace(/^(session-|class-)/, '') || 
                              channelName?.replace(/^(session-|class-)/, '');
      
      if (!meeting_class_id) {
        console.warn('⚠️ Could not determine meeting_class_id to fetch participant names');
        return;
      }

      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ No auth token available to fetch participant names');
        return;
      }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5000');
      
      // Fetch participants for this specific meeting
      const response = await axios.get(
        `${backendUrl}/api/session-participants/by-meeting/${meeting_class_id}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data?.success && response.data?.data) {
        const participants = response.data.data;
        console.log(`📊 Fetched ${participants.length} session participants for meeting`);
        
        // Build a map of participant data
        const nameMap = {};
        participants.forEach(p => {
          if (p.name) {
            nameMap[p.participant_id] = p.name;
            console.log(`📌 Participant ID ${p.participant_id}: ${p.name}`);
          }
        });

        // Update the names state
        setParticipantNames(prev => ({
          ...prev,
          ...nameMap
        }));
        
        console.log(`✅ Updated participant names map with ${Object.keys(nameMap).length} entries`);
      }
    } catch (error) {
      console.error('❌ Error fetching participant names:', error);
      // Don't throw - allow meeting to continue even if participant names fail
    }
  };

  // Initialize Agora client
  useEffect(() => {
    // Initialize virtual background extension - DISABLED FOR NOW
    const initVirtualBackground = () => {
      try {
        // const extension = new VirtualBackgroundExtension();
        
        // Check compatibility
        // if (!extension.checkCompatibility()) {
        //   console.warn('Virtual background is not supported by this browser');
        //   setVirtualBackgroundError('Virtual background is not supported by this browser');
        //   return;
        // }

        // Register the extension
        // AgoraRTC.registerExtensions([extension]);
        // setVirtualBackgroundExtension(extension);
        
        console.log('Virtual background extension disabled - skipping initialization');
      } catch (error) {
        console.error('Failed to initialize virtual background:', error);
        setVirtualBackgroundError(`Failed to initialize virtual background: ${error.message}`);
      }
    };

    // Initialize beauty effect extension - DISABLED
    const initBeautyEffect = () => {
      try {
        // const extension = new BeautyExtension();
        
        // Register the extension
        // AgoraRTC.registerExtensions([extension]);
        // setBeautyExtension(extension);
        
        console.log('Beauty effect extension disabled - skipping initialization');
      } catch (error) {
        console.error('Failed to initialize beauty effect:', error);
        setBeautyError(`Failed to initialize beauty effect: ${error.message}`);
      }
    };

    // Create Agora client
    clientRef.current = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });

    // Initialize extensions - DISABLED FOR NOW
    // initVirtualBackground();
    // initBeautyEffect();

    // Set up event listeners
    const handleUserPublished = async (user, mediaType) => {
      try {
        console.log(`📡 User ${user.uid} published ${mediaType}, subscribing...`);
        
        // Subscribe to the remote user
        await clientRef.current.subscribe(user, mediaType);
        console.log(`✅ Successfully subscribed to user ${user.uid} ${mediaType}`);
        
        // Update media status in joined users
        updateUserMediaStatus(user.uid, mediaType, true);
        
        setRemoteUsers(prevUsers => {
          const existingUser = prevUsers.find(u => u.uid === user.uid);
          if (existingUser) {
            console.log(`🔄 Updating existing user ${user.uid} with ${mediaType}`);
            return prevUsers.map(u => 
              u.uid === user.uid ? { ...u, [mediaType + 'Track']: user[mediaType + 'Track'] } : u
            );
          } else {
            console.log(`👤 Adding new remote user ${user.uid} with ${mediaType}`);
            return [...prevUsers, { 
              uid: user.uid, 
              [mediaType + 'Track']: user[mediaType + 'Track'] 
            }];
          }
        });

        // Play the remote audio immediately (doesn't need DOM element)
        if (mediaType === 'audio') {
          user.audioTrack.play();
          console.log(`🔊 Playing audio for user ${user.uid}`);
        }

        // Note: Video will be played in useEffect after DOM update

        console.log(`✅ User ${user.uid} published ${mediaType} - subscription complete`);
      } catch (error) {
        console.error(`❌ Error subscribing to user ${user.uid} ${mediaType}:`, error);
        setError(`Failed to subscribe to user ${user.uid}: ${error.message}`);
      }
    };

    const handleUserUnpublished = (user, mediaType) => {
      console.log(`🔇 User ${user.uid} unpublished ${mediaType}`);
      
      // Update media status in joined users
      updateUserMediaStatus(user.uid, mediaType, false);
      
      // Keep the user in the list but remove only the specific media track
      setRemoteUsers(prevUsers => 
        prevUsers.map(u => 
          u.uid === user.uid 
            ? { ...u, [mediaType + 'Track']: null }
            : u
        )
        // Don't filter out users - keep them in the list even without media
      );
    };

    // User joined channel (but not necessarily publishing media)
    const handleUserJoined = async (user) => {
      console.log(`🚪 User ${user.uid} joined the channel`);
      const joinTime = new Date().toISOString();
      
      // Fetch all participant names for this meeting to get the name of who just joined
      await fetchParticipantNames();
      
      setJoinedUsers(prevUsers => {
        const existingUser = prevUsers.find(u => u.uid === user.uid);
        if (!existingUser) {
          console.log(`👋 Adding new user ${user.uid} to joined users list`);
          const newUser = {
            uid: user.uid,
            joinTime,
            hasAudio: false,
            hasVideo: false,
            isOnline: true
          };
          setUserCount(prev => {
            const newCount = prev + 1;
            console.log(`📊 User count updated: ${newCount}`);
            return newCount;
          });
          setStatus(`User ${user.uid} joined the channel`);
          return [...prevUsers, newUser];
        } else {
          console.log(`⚠️ User ${user.uid} already exists in joined users list`);
        }
        return prevUsers;
      });
    };

    // User left channel
    const handleUserLeft = (user, reason) => {
      console.log('User left:', user.uid, 'Reason:', reason);
      
      setJoinedUsers(prevUsers => {
        const updatedUsers = prevUsers.map(u => 
          u.uid === user.uid ? { ...u, isOnline: false, leaveTime: new Date().toISOString(), leaveReason: reason } : u
        );
        setUserCount(prev => Math.max(0, prev - 1));
        setStatus(`User ${user.uid} left the channel (${reason})`);
        return updatedUsers;
      });

      // Also remove from remote users
      setRemoteUsers(prevUsers => prevUsers.filter(u => u.uid !== user.uid));
    };

    // Connection state changed
    const handleConnectionStateChanged = (curState, revState, reason) => {
      console.log('Connection state changed:', curState, 'Previous:', revState, 'Reason:', reason);
      setConnectionState(curState);
      
      if (curState === 'CONNECTED') {
        setStatus('Connected to channel');
      } else if (curState === 'RECONNECTING') {
        setStatus('Reconnecting...');
      } else if (curState === 'DISCONNECTED') {
        setStatus('Disconnected from channel');
      }
    };

    // Update user media status when they publish/unpublish
    const updateUserMediaStatus = (uid, mediaType, isPublished) => {
      setJoinedUsers(prevUsers => 
        prevUsers.map(user => 
          user.uid === uid 
            ? { ...user, [mediaType === 'video' ? 'hasVideo' : 'hasAudio']: isPublished }
            : user
        )
      );
    };

    // Register event listeners
    clientRef.current.on('user-published', handleUserPublished);
    clientRef.current.on('user-unpublished', handleUserUnpublished);
    clientRef.current.on('user-joined', handleUserJoined);
    clientRef.current.on('user-left', handleUserLeft);
    clientRef.current.on('connection-state-changed', handleConnectionStateChanged);

    // Cleanup on unmount
    return () => {
      // Cleanup virtual background processor
      if (virtualBackgroundProcessor) {
        virtualBackgroundProcessor.release().catch(console.error);
      }
      
      // Cleanup beauty effect processor
      if (beautyProcessor) {
        beautyProcessor.release().catch(console.error);
      }
      
      if (clientRef.current) {
        clientRef.current.off('user-published', handleUserPublished);
        clientRef.current.off('user-unpublished', handleUserUnpublished);
        clientRef.current.off('user-joined', handleUserJoined);
        clientRef.current.off('user-left', handleUserLeft);
        clientRef.current.off('connection-state-changed', handleConnectionStateChanged);
      }
    };
  }, []);

  // Load available cameras on component mount
  useEffect(() => {
    getAvailableCameras();
  }, []);

  // Effect to ensure local video plays in sidebar when joined (and not pinned)
  useEffect(() => {
    if (isJoined && localVideoTrackRef.current && !pinnedUserId) {
      // Play in sidebar when not pinned
      if (localSidebarVideoRef.current) {
        const timer = setTimeout(() => {
          try {
            localVideoTrackRef.current.play(localSidebarVideoRef.current);
            console.log('Local video track playing in sidebar after join');
          } catch (error) {
            console.error('Error playing local video in sidebar:', error);
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    } else if (isJoined && localVideoTrackRef.current && pinnedUserId === localUserInfo.uid) {
      // Play in main area when self-pinned
      if (localVideoContainerRef.current) {
        const timer = setTimeout(() => {
          try {
            localVideoTrackRef.current.play(localVideoContainerRef.current);
            console.log('Local video track playing in main area (pinned)');
          } catch (error) {
            console.error('Error playing local video in main area:', error);
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [isJoined, pinnedUserId, localUserInfo.uid]);

  // Effect to play remote videos when remoteUsers state changes
  useEffect(() => {
    console.log(`🎥 Remote users state changed: ${remoteUsers.length} users`);
    
    remoteUsers.forEach(user => {
      console.log(`👤 Processing user ${user.uid}: hasVideo=${!!user.videoTrack}, hasAudio=${!!user.audioTrack}`);
      
      if (user.videoTrack) {
        // Only play in sidebar if NOT pinned in main area
        // If pinned, the pinned effect will handle playing in the main area
        if (pinnedUserId !== user.uid) {
          const remoteVideoContainer = document.getElementById(`remote-${user.uid}`);
          console.log(`🎬 Video container for user ${user.uid}: ${!!remoteVideoContainer}`);
          
          if (remoteVideoContainer) {
            // Always try to play video, even if already playing (to handle track changes)
            try {
              // Stop any existing video first
              const existingVideo = remoteVideoContainer.querySelector('video');
              if (existingVideo) {
                console.log(`🔄 Replacing existing video for user ${user.uid}`);
              }
              
              user.videoTrack.play(remoteVideoContainer);
              console.log(`✅ Successfully playing remote video for user ${user.uid}`);
            } catch (error) {
              console.error(`❌ Error playing remote video for user ${user.uid}:`, error);
            }
          } else {
            console.log(`⏳ Container not found for user ${user.uid}, retrying in 200ms...`);
            // Retry after a longer delay to ensure DOM is ready
            setTimeout(() => {
              const retryContainer = document.getElementById(`remote-${user.uid}`);
              if (retryContainer && user.videoTrack && pinnedUserId !== user.uid) {
                try {
                  user.videoTrack.play(retryContainer);
                  console.log(`✅ Playing remote video for user ${user.uid} (retry)`);
                } catch (error) {
                  console.error(`❌ Error playing remote video for user ${user.uid} (retry):`, error);
                }
              }
            }, 100);
          }
        } else {
          console.log(`🎞️ User ${user.uid} is pinned, skipping sidebar play`);
        }
      }
    });
  }, [remoteUsers, pinnedUserId]);

  // Effect to play pinned video (remote or self)
  useEffect(() => {
    if (pinnedUserId) {
      // Handle self-pin
      if (pinnedUserId === localUserInfo.uid) {
        console.log('📌 Self-pinned - local video should display in main area');
        // Video is automatically shown in main area via the JSX conditional
      } else {
        // Handle remote user pin
        const pinnedUser = remoteUsers.find(user => user.uid === pinnedUserId);
        if (pinnedUser && pinnedUser.videoTrack) {
          const pinnedVideoContainer = document.getElementById(`pinned-remote-${pinnedUserId}`);
          if (pinnedVideoContainer) {
            try {
              pinnedUser.videoTrack.play(pinnedVideoContainer);
              console.log(`✅ Playing pinned remote video for user ${pinnedUserId}`);
            } catch (error) {
              console.error(`❌ Error playing pinned remote video for user ${pinnedUserId}:`, error);
            }
          }
        }
      }
    } else if (!pinnedUserId) {
      // When unpinning, re-trigger the sidebar video effect
      console.log(`📌 Video unpinned, re-playing sidebar videos...`);
      
      // Re-play local video in sidebar
      if (localVideoTrackRef.current && localSidebarVideoRef.current) {
        try {
          localVideoTrackRef.current.play(localSidebarVideoRef.current);
          console.log('✅ Re-playing local video in sidebar after unpin');
        } catch (error) {
          console.error('❌ Error re-playing local video in sidebar:', error);
        }
      }
      
      // Re-play remote videos in sidebar
      remoteUsers.forEach(user => {
        if (user.videoTrack) {
          const sidebarContainer = document.getElementById(`remote-${user.uid}`);
          if (sidebarContainer) {
            try {
              user.videoTrack.play(sidebarContainer);
              console.log(`✅ Re-playing sidebar video for user ${user.uid} after unpin`);
            } catch (error) {
              console.error(`❌ Error re-playing sidebar video for user ${user.uid}:`, error);
            }
          }
        }
      });
    }
  }, [pinnedUserId, remoteUsers, localUserInfo.uid]);

  // Effect to handle screen share re-playing when pin status changes
  useEffect(() => {
    if (isScreenSharing && localScreenTrackRef.current) {
      console.log('🎥 Screen share pin status changed, re-playing screen...');
      
      // If self-pinned, play in main area
      if (pinnedUserId === localUserInfo.uid && localVideoContainerRef.current) {
        try {
          localScreenTrackRef.current.play(localVideoContainerRef.current);
          console.log('✅ Screen track re-played in main area (self-pinned)');
        } catch (error) {
          console.error('❌ Error re-playing screen in main area:', error);
        }
      } 
      // If not pinned, play in sidebar
      else if (!pinnedUserId && localSidebarVideoRef.current) {
        try {
          localScreenTrackRef.current.play(localSidebarVideoRef.current);
          console.log('✅ Screen track re-played in sidebar (not pinned)');
        } catch (error) {
          console.error('❌ Error re-playing screen in sidebar:', error);
        }
      }
    }
  }, [pinnedUserId, isScreenSharing, localUserInfo.uid]);

  // Poll for participant names every 2 seconds while in a meeting
  // Stop polling once all remote users have names mapped
  useEffect(() => {
    if (!isJoined || remoteUsers.length === 0) {
      return;
    }

    // Check if all remote users already have names mapped
    const allNamesMapped = remoteUsers.every(user => participantNames[user.uid]);
    
    if (allNamesMapped && Object.keys(participantNames).length > 0) {
      console.log(`✅ All participant names already mapped (${remoteUsers.length}/${Object.keys(participantNames).length}), skipping poll`);
      return;
    }

    console.log(`🔄 Starting participant names polling... (${Object.keys(participantNames).length}/${remoteUsers.length} mapped)`);
    
    const pollInterval = setInterval(() => {
      // Check again if all names are now mapped
      const stillNeedNames = remoteUsers.filter(user => !participantNames[user.uid]);
      if (stillNeedNames.length === 0 && Object.keys(participantNames).length > 0) {
        console.log(`✅ All names now mapped, stopping poll`);
        clearInterval(pollInterval);
        return;
      }
      
      console.log(`🔄 Polling for names (${remoteUsers.length - stillNeedNames.length}/${remoteUsers.length} mapped)...`);
      fetchParticipantNames();
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(pollInterval);
      console.log('🔄 Stopped participant names polling');
    };
  }, [isJoined, remoteUsers.length, participantNames]);

  // Get available cameras
  const getAvailableCameras = async () => {
    try {
      const devices = await AgoraRTC.getCameras();
      console.log('Available cameras:', devices);
      setCameras(devices);
      
      // Set the first camera as default if no camera is selected
      if (devices.length > 0 && !currentCameraId) {
        setCurrentCameraId(devices[0].deviceId);
      }
      
      return devices;
    } catch (error) {
      console.error('Failed to get cameras:', error);
      return [];
    }
  };

  // Create local media tracks
  const createLocalTracks = async () => {
    try {
      console.log('🎥 Starting local track creation...');
      
      // Request permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        console.log('✅ Media permissions granted');
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
      } catch (permError) {
        console.error('❌ Media permissions denied:', permError);
        throw new Error('Camera and microphone permissions are required to join the meeting');
      }

      // Get available cameras first
      console.log('📹 Getting available cameras...');
      const availableCameras = await getAvailableCameras();
      console.log('📹 Available cameras:', availableCameras.length);
      
      // Create audio track
      console.log('🎤 Creating audio track...');
      localAudioTrackRef.current = await AgoraRTC.createMicrophoneAudioTrack();
      console.log('✅ Audio track created');
      
      // Create video track with specific camera if available
      const videoTrackConfig = currentCameraId && availableCameras.length > 0 
        ? { cameraId: currentCameraId }
        : {};
      
      console.log('📹 Creating video track with config:', videoTrackConfig);
      localVideoTrackRef.current = await AgoraRTC.createCameraVideoTrack(videoTrackConfig);
      console.log('✅ Video track created');
      
      // Re-apply all enabled processors using chaining
      if (isBeautyEnabled || isVirtualBackgroundEnabled) {
        try {
          await applyProcessorsToTrack(localVideoTrackRef.current);
          console.log('Processors re-applied to new video track');
        } catch (error) {
          console.warn('Failed to re-apply processors:', error);
          if (isBeautyEnabled) {
            setBeautyError('Beauty effects need to be re-enabled');
          }
          if (isVirtualBackgroundEnabled) {
            setVirtualBackgroundError('Virtual background needs to be re-enabled');
          }
        }
      }
      
      // Update current camera ID if not set or if default was used
      if (localVideoTrackRef.current) {
        const trackSettings = localVideoTrackRef.current.getMediaStreamTrack().getSettings();
        if (trackSettings.deviceId && (!currentCameraId || currentCameraId !== trackSettings.deviceId)) {
          setCurrentCameraId(trackSettings.deviceId);
          console.log('Video track created with camera:', trackSettings.deviceId);
        }
      }
      
      // Play local video - wait a bit for the DOM to be ready
      setTimeout(() => {
        if (localVideoContainerRef.current && localVideoTrackRef.current) {
          try {
            localVideoTrackRef.current.play(localVideoContainerRef.current);
            console.log('✅ Local video track started playing');
          } catch (playError) {
            console.error('❌ Error playing local video:', playError);
          }
        } else {
          console.warn('⚠️ Video container or track not ready for playback');
        }
      }, 100);
      
      console.log('✅ Local tracks creation completed successfully');
    } catch (error) {
      console.error('❌ Error creating local tracks:', error);
      
      // Cleanup any partially created tracks
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      
      throw new Error(`Failed to access camera/microphone: ${error.message}`);
    }
  };

  // Record session participation for billing/tracking
  const recordSessionJoin = async (meetingIdParam, agoraUid) => {
  // If we already have a sessionParticipantId stored locally, do not post a second join.
  const existingSessionParticipant = localStorage.getItem('sessionParticipantId');
  if (existingSessionParticipant) {
    console.log('📋 recordSessionJoin: sessionParticipantId already present in localStorage, skipping server join:', existingSessionParticipant);
    return;
  }
  // Debug: Print config.duration to verify scheduled duration
  console.log('[DEBUG] config.duration:', config?.duration);
    if (!meetingIdParam || !user?.id) {
      console.warn('⚠️ Cannot record session join - missing data:', { meetingId: meetingIdParam, userId: user?.id });
      return;
    }

    try {
      // NOTE: Do NOT clear localStorage here. Clearing from the meeting tab
      // can race with the dashboard caller that just stored these values.
      // Instead, only write values to localStorage after a successful join.
      console.log('[DEBUG] Full config object received:', JSON.stringify(config, null, 2));
      console.log('[DEBUG] config?.meetingId:', config?.meetingId);
      console.log('[DEBUG] config?.id:', config?.id);
      console.log('[DEBUG] config?.classId:', config?.classId);
      console.log('[DEBUG] config?.meeting_class_id:', config?.meeting_class_id);
      
      let meeting_class_id =  config?.id || config?.classId || config?.meeting_class_id;
      console.log('[DEBUG] Final meeting_class_id resolved:', meeting_class_id);
      
      // If still undefined, try extracting from URL as fallback
      if (!meeting_class_id && meetingIdParam) {
        meeting_class_id = meetingIdParam.replace(/^(session-|class-)/, '');
        console.log('[DEBUG] Fallback: extracting from URL meetingId:', meetingIdParam, '-> extracted:', meeting_class_id);
      }
      
      // Final check - if still no meeting_class_id, we can't proceed
      if (!meeting_class_id) {
        console.error('❌ Cannot record session join - no meeting_class_id found');
        console.error('❌ Config:', config);
        console.error('❌ meetingId from URL:', meetingIdParam);
        return;
      }
      const accessToken = localStorage.getItem('accessToken');
      const fallbackToken = localStorage.getItem('token');
      const token = accessToken || fallbackToken;

      if (!token) {
        console.error('❌ No authentication token found for session join');
        return;
      }

      console.log('📝 Recording session join...', { meeting_class_id, userId: user.id, agoraUid });
      
      // FIX: Use correct join endpoint
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        
          meeting_class_id: meeting_class_id,
          agoraUid: agoraUid || undefined
        })
      });

      // Always log response status and body for debugging
      let responseBody;
      try {
        responseBody = await response.clone().text();
      } catch (e) {
        responseBody = '[Could not read response body]';
      }
      console.log('🔍 Join response status:', response.status, 'body:', responseBody);
      if (response.ok) {
        const joinData = await response.json();
        if (joinData.data && joinData.data.meeting_class_id) {
          console.log('[DEBUG] Stored meeting_class_id in localStorage:', joinData.data.meeting_class_id);
        }
        console.log('Full join response:', joinData);
        console.log('✅ Session join recorded:', joinData.message);
        const sessionParticipantId = joinData.sessionParticipantId 
          || joinData.id 
          || (joinData.data && (joinData.data.id || joinData.data.sessionParticipantId || joinData.data._id));
        // Normalize sessionParticipantId to string if present (accept numbers too)
        const normalizedSessionParticipantId = sessionParticipantId != null ? String(sessionParticipantId) : null;
        if (normalizedSessionParticipantId && normalizedSessionParticipantId !== 'undefined' && normalizedSessionParticipantId.trim() !== '') {
          // Only write to localStorage after we have a valid ID from backend
          localStorage.setItem('sessionParticipantId', normalizedSessionParticipantId);
          setSessionParticipantId(normalizedSessionParticipantId);
          console.log('📋 Session participant ID stored:', normalizedSessionParticipantId);

          // Store class metadata for session end - prefer DB ID from join response
          const dbMeetingClassId = (joinData.data && (joinData.data.meeting_class_id || joinData.data.meetingClassId)) || meeting_class_id;
          console.log('🔍 Join response data:', joinData.data);
          console.log('🔍 dbMeetingClassId extracted:', dbMeetingClassId);
          console.log('🔍 Original meeting_class_id from config:', meeting_class_id);
          if (dbMeetingClassId && dbMeetingClassId !== 'undefined') {
            localStorage.setItem('meeting_class_id', dbMeetingClassId);
            console.log('📋 Database meeting_class_id stored:', dbMeetingClassId);
            console.log('📋 Verification - localStorage now contains:', localStorage.getItem('meeting_class_id'));
          }
            // Get title, start_time, duration from available data
            const classTitle = (config?.classTitle || config?.title || (typeof joinData.data === 'object' && joinData.data?.title) || 'Class');
            const classStartTime = (config?.startTime || config?.start_time || (typeof joinData.data === 'object' && joinData.data?.start_time) || new Date().toISOString());
            const classDuration = (config?.duration || (typeof joinData.data === 'object' && joinData.data?.duration) || null);
            const classCurrency = (config?.currency || (typeof joinData.data === 'object' && joinData.data?.currency) || 'USD');
            // Always use scheduled class duration from config, joinData, or classItem
            // let classDuration = null;
            // if (typeof config?.duration === 'number') {
            //   classDuration = config.duration;
            // } else if (typeof joinData.data === 'object' && typeof joinData.data.duration === 'number') {
            //   classDuration = joinData.data.duration;
            // }
            // Fallback to 330 only if all else fails
            //if (classDuration === null) classDuration = 330;
            localStorage.setItem('classTitle', classTitle);
            localStorage.setItem('classStartTime', classStartTime);
            localStorage.setItem('classDuration', classDuration);
            localStorage.setItem('classCurrency', classCurrency);
        } else {
          localStorage.removeItem('sessionParticipantId');
          setSessionParticipantId(null);
          console.warn('⚠️ Could not extract a valid sessionParticipantId from join response:', joinData, 'Extracted:', sessionParticipantId);
        }
      } else {
        console.error('❌ Failed to record session join:', response.status, responseBody);
      }
    } catch (error) {
      console.error('❌ Error recording session join:', error);
    }
  };

  // Join channel with specific ID and username (for auto-join)
  const joinChannelWithId = async (unusedMeetingId, username) => {
    if (!meetingId?.trim()) {
      setError('Please enter a channel name');
      console.error('❌ Join failed: No meeting ID provided');
      return;
    }

    if (!clientRef.current) {
      setError('Agora client not initialized');
      console.error('❌ Join failed: Agora client not initialized');
      return;
    }

    setIsLoading(true);
    setError('');
    console.log('🚀 Starting channel join process...', { meetingId: meetingId.trim(), username });

    // Set the state values for UI consistency
    setChannelName(meetingId.trim());
    setUserName(username);

    try {
  // Get token from meeting backend - prefer explicit backend URL, then config, then localhost:5000 for dev, else origin
  const serverUrl = process.env.REACT_APP_BACKEND_URL || config?.serverUrl || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
    console.log('🔗 Using server URL for token request:', serverUrl);
      console.log('📡 Requesting token for channel:', meetingId.trim());
      
      const response = await axios.post(`${serverUrl}/api/token`, {
        channelName: meetingId.trim(),
        uid: 0, // Let Agora assign a random UID
        role: 'publisher'
      });

      const { token, appId, uid, isMock } = response.data || {};
      console.log('✅ Token received (raw):', response.data);
      console.log('✅ Token parsed:', { appId, uid, tokenLength: token?.length, isMock });

      // Defensive check: token and appId are required for a real Agora connection
      if (!isMock && (!token || !appId)) {
        const msg = 'Token endpoint did not return required Agora credentials (appId or token). Check REACT_APP_BACKEND_URL or server configuration.';
        console.error('❌', msg, { responseData: response.data });
        throw new Error(msg);
      }

      if (isMock) {
        console.log('🎭 Mock mode detected - simulating Agora connection');
        
        // Simulate successful connection in mock mode
        setIsJoined(true);
        setIsLoading(false);
        setStatus('Connected to meeting (Mock Mode)');
        
        // Set mock user info
        setLocalUserInfo({ uid: uid || 12345, joinTime: new Date() });
        setUserCount(1);
        setConnectionState('CONNECTED');
        
        console.log('✅ Mock connection established - meeting interface ready');
        
        // Record session participation for billing/tracking (even in mock mode)
        await recordSessionJoin(meetingId.trim());
        return;
      }

      // Real Agora connection (only when credentials are properly configured)
      // Create local media tracks
      console.log('🎥 Creating local media tracks...');
      await createLocalTracks();
      console.log('✅ Local tracks created');

      // Join the channel
      console.log('🔗 Joining channel with Agora...', { appId, meetingId: meetingId.trim(), uid });
      await clientRef.current.join(appId, meetingId.trim(), token, uid);
      console.log('✅ Successfully joined Agora channel');

      // Track local user - prefer returned uid, else fallback to client-assigned uid
      const assignedUid = uid || clientRef.current?.uid || (localVideoTrackRef.current && localVideoTrackRef.current.getId && localVideoTrackRef.current.getId());
      setLocalUserInfo({
        uid: assignedUid,
        joinTime: new Date().toISOString()
      });
      setUserCount(0); // Start with 0 remote users, local user is added separately in display

      // Publish local tracks
      console.log('📤 Publishing local tracks...');
      await clientRef.current.publish([localAudioTrackRef.current, localVideoTrackRef.current]);
      console.log('✅ Local tracks published');

      setIsJoined(true);
      setStatus(`Successfully joined channel: ${meetingId.trim()} (Your UID: ${uid})`);
      setConnectionState('CONNECTED');
      console.log('🎉 Meeting joined successfully!');

      // Record session participation for billing/tracking - pass UID directly
      await recordSessionJoin(meetingId.trim(), assignedUid);
      
      // Check if there's an existing whiteboard room for auto-join (optional)
      setTimeout(async () => {
        try {
          const serverUrl = config?.serverUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
          const currentChannelName = meetingId.trim(); // Use the current meetingId instead of stale channelName
          console.log('🔍 Checking for whiteboard rooms for channel:', currentChannelName);
          const roomsResponse = await axios.get(`${serverUrl}/api/whiteboard-rooms/${currentChannelName}`);
          if (roomsResponse.data && roomsResponse.data.length > 0) {
            console.log('📋 Whiteboard room available for this channel. Click "Open Whiteboard" to join.');
            setStatus('Whiteboard room available - click "Open Whiteboard" to join');
            setTimeout(() => setStatus(''), 4000);
          }
        } catch (error) {
          // Silently fail - no existing whiteboard room
          console.log('No existing whiteboard room found for auto-notification');
        }
      }, 2000);
    } catch (error) {
      console.error('❌ Error joining channel:', error);
      setError(error.response?.data?.error || error.message || 'Failed to join channel');
      
      // Cleanup tracks if join failed
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Join channel (legacy function for manual join)
  const joinChannel = async () => {
    return joinChannelWithId(meetingId, userName);
  };

  // Leave channel
  const leaveChannel = async () => {
    setIsLoading(true);

    try {
      // Check if we're in mock mode (detect if we have real Agora client or not)
      const isMockMode = !clientRef.current || status.includes('Mock Mode');
      
      if (isMockMode) {
        console.log('🎭 Mock mode - simulating channel leave');
      } else {
        // Real Agora disconnection
        // Disable virtual background
        if (isVirtualBackgroundEnabled) {
          await disableVirtualBackground();
        }
        
        // Stop and close local tracks
        if (localAudioTrackRef.current) {
           // localAudioTrackRef.current.close();
          localAudioTrackRef.current = null;
        }
        if (localVideoTrackRef.current) {
          // localVideoTrackRef.current.close();
          localVideoTrackRef.current = null;
        }

        // Leave the channel
        // await clientRef.current.leave();
      }

      // Clean up whiteboard connection when leaving channel
      setIsWhiteboardVisible(false);
      setWhiteboardRoom('');
      setWhiteboardToken('');
      setWhiteboardUid('');
      
      // Clear whiteboard drawing for this meeting when ending the call
      if (channelName) {
        const whiteboardStorageKey = `whiteboard-drawing-${channelName}`;
        localStorage.removeItem(whiteboardStorageKey);
        console.log(`🎨 Whiteboard drawing cleared for meeting: ${channelName}`);
      }
      
      console.log('🧹 Whiteboard cleaned up on channel leave');

      setIsJoined(false);
      setRemoteUsers([]);
      setJoinedUsers([]);
      setUserCount(0);
      setLocalUserInfo({ uid: null, joinTime: null });
      setConnectionState('DISCONNECTED');
      setStatus('Meeting ended');
      setIsAudioMuted(false);
      setIsVideoMuted(false);

      // Record session end before navigating back
      try {
        console.log('📝 Recording session end...');
        console.log('🔍 Debug values for session end:', {
          configMeetingId: config?.meetingId,
          paramsMeetingId: meetingId,
          channelName: channelName,
          userId: user?.id,
          hasToken: !!(localStorage.getItem('accessToken') || localStorage.getItem('token'))
        });
        
        // Extract meeting class ID from config or meetingId
        const meeting_class_id = config?.meetingId?.replace(/^(session-|class-)/, '') || 
                                meetingId?.replace(/^(session-|class-)/, '') || 
                                channelName?.replace(/^(session-|class-)/, '');
        
        
        console.log('🔍 Extracted meeting_class_id:', meeting_class_id);
        
        if (meeting_class_id && user?.id) {
          // Enhanced token retrieval with debugging
          const accessToken = localStorage.getItem('accessToken');
          const fallbackToken = localStorage.getItem('token');
          const token = accessToken || fallbackToken;
          
          console.log('🔐 Token debug info:', {
            accessTokenExists: !!accessToken,
            accessTokenLength: accessToken ? accessToken.length : 0,
            fallbackTokenExists: !!fallbackToken,
            fallbackTokenLength: fallbackToken ? fallbackToken.length : 0,
            finalTokenExists: !!token,
            finalTokenLength: token ? token.length : 0,
            userId: user?.id,
            userRole: user?.role
          });
          
          if (!token) {
            console.error('❌ No authentication token found in localStorage');
            console.error('❌ Available localStorage keys:', Object.keys(localStorage));
            return;
          }
          
          console.log('🔥 MAIN SESSION END FUNCTION TRIGGERED - endSession()');
          console.log('🔍 Config object:', config);
          console.log('🔍 localStorage classTitle:', localStorage.getItem('classTitle'));
          console.log('🔍 localStorage meeting_class_id:', localStorage.getItem('meeting_class_id'));
          console.log('🔍 localStorage sessionParticipantId:', localStorage.getItem('sessionParticipantId'));
          console.log('🔍 meetingId from props:', meetingId);
          
              // --- PATCH: Always send correct metadata for session end ---
              // Use meeting_class_id from localStorage if available, else config, else meetingId
              const meeting_class_id = localStorage.getItem('meeting_class_id') || config?.meetingId || meetingId;
              const endedAt = new Date().toISOString();

              // Retrieve sessionParticipantId from localStorage, else backend fallback
              let sessionParticipantId = localStorage.getItem('sessionParticipantId');
              if (!sessionParticipantId) {
                try {
                  const userId = user?.id;
                  if (userId && meeting_class_id) {
                    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
                    const response = await fetch(`${backendUrl}/api/sessionparticipants/latest?userId=${userId}&meeting_class_id=${meeting_class_id}`);
                    if (response.ok) {
                      const data = await response.json();
                      sessionParticipantId = data.sessionParticipantId || data.id;
                      if (sessionParticipantId) {
                        localStorage.setItem('sessionParticipantId', sessionParticipantId);
                        console.log('✅ Fallback: sessionParticipantId from backend:', sessionParticipantId);
                      }
                    }
                  }
                } catch (err) {
                  console.warn('⚠️ Could not fetch latest sessionParticipantId:', err);
                }
              }
              if (!sessionParticipantId) {
                console.warn('⚠️ No session participant ID found in localStorage or backend. Session end will not update DB.');
                return; // Do not send request if ID is missing
              }

              // --- PATCH: Always use correct title, start_time, and duration ---
              // Title: Prefer localStorage, then config, then fallback
              // Prioritize current config title over localStorage to avoid stale data
              const sessionEndTitle = config?.classTitle || config?.title || localStorage.getItem('classTitle') || 'Class';
              // Start time: Prefer localStorage, then config, then fallback
              // Prioritize current config start time over localStorage to avoid stale data
              const sessionEndStartTime = config?.startTime || config?.start_time || localStorage.getItem('classStartTime') || new Date().toISOString();

              // Duration: Try to get from config first, then localStorage, else calculate from start_time
              let sessionEndDuration = config?.duration || config?.classDuration || localStorage.getItem('classDuration');
              if (!sessionEndDuration) {
                // Calculate duration if possible
                try {
                  const start = new Date(sessionEndStartTime);
                  const end = new Date(endedAt);
                  if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    sessionEndDuration = Math.round((end.getTime() - start.getTime()) / 1000); // seconds
                  }
                } catch (e) {
                  sessionEndDuration = 0;
                }
              }

              // Build payload
              const sessionEndPayload = {
                meeting_class_id: meeting_class_id,
                sessionParticipantId: sessionParticipantId,
                endedAt: endedAt,
                title: sessionEndTitle,
                start_time: sessionEndStartTime,
                duration: sessionEndDuration
              };
              
              console.log('🚀 FINAL SESSION END PAYLOAD:', sessionEndPayload);

              const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/end`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionEndPayload)
              });

              console.log('🔍 Session end payload prepared:', sessionEndPayload);

              // Validate endedAt timestamp
              if (!endedAt || isNaN(new Date(endedAt).getTime())) {
                console.error('❌ Invalid endedAt timestamp:', endedAt);
                console.warn('⚠️ Session end may fail due to invalid timestamp');
              }

              console.log('📤 Sending session end request to API...');
              console.log('📤 Request details:', {
                url: `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/session/end`,
                method: 'POST',
                payload: sessionEndPayload,
                tokenPreview: token ? `${token.substring(0, 20)}...` : 'null',
                hasParticipantId: !!sessionParticipantId,
                endedAtValid: !isNaN(new Date(endedAt).getTime())
              });
              console.log('📥 Session end API response status:', response.status);

              if (response.ok) {
                const endData = await response.json();
                console.log('✅ Session end recorded:', endData.message);
                console.log('📊 Session end data:', endData.data);

                // Clear session participant ID after successful end recording
                setSessionParticipantId(null);
                localStorage.removeItem('sessionParticipantId');
                console.log('🗑️ Session participant ID cleared from state and localStorage');
              } else {
                const errorData = await response.text();
                console.error('❌ Session end API error:', {
                  status: response.status,
                  statusText: response.statusText,
                  errorData: errorData,
                  meeting_class_id: meeting_class_id,
                  tokenExists: !!token,
                  userId: user?.id
                });

           // Try to parse error as JSON for better debugging
           try {
             const errorJson = JSON.parse(errorData);
             console.error('❌ Parsed error response:', errorJson);
           } catch (e) {
             console.error('❌ Raw error response:', errorData);
           }
         }
        } else {
          console.warn('⚠️ Missing data for session end recording:', {
            meeting_class_id,
            userId: user?.id,
            userExists: !!user,
            reason: !meeting_class_id ? 'No meeting class ID' : 'No user ID'
          });
        }
      } catch (sessionEndError) {
        console.error('❌ Error recording session end:', sessionEndError);
        console.error('❌ Session end error details:', {
          name: sessionEndError.name,
          message: sessionEndError.message,
          stack: sessionEndError.stack
        });
        // Continue with navigation even if session end recording fails
      }

      // End meeting and navigate back
      console.log('📞 Meeting ended - navigating back...');
      
      // Close current tab and go back to previous page
      if (window.history.length > 1) {
        // If there's history, go back
        window.history.back();
      } else {
        // If no history, close tab or navigate to dashboard
        try {
          window.close();
        } catch (e) {
          // If can't close (some browsers restrict this), navigate to dashboard
          window.location.href = '/dashboard';
        }
      }
      
    } catch (error) {
      console.error('Error leaving channel:', error);
      setError(`Failed to leave channel: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Whiteboard ID utility functions
  const generateWhiteboardId = () => {
    return `wb_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;
  };

  const copyWhiteboardId = async () => {
    try {
      await navigator.clipboard.writeText(currentWhiteboardId);
      setWhiteboardIdCopied(true);
      setTimeout(() => setWhiteboardIdCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy whiteboard ID:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentWhiteboardId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setWhiteboardIdCopied(true);
      setTimeout(() => setWhiteboardIdCopied(false), 2000);
    }
  };

  const joinSharedWhiteboard = async () => {
    if (!pasteWhiteboardId.trim()) {
      setWhiteboardError('Please enter a valid whiteboard ID');
      return;
    }

    setIsJoiningSharedWhiteboard(true);
    setWhiteboardError('');

    try {
      // Use the pasted ID as the new whiteboard room
      setWhiteboardRoom(pasteWhiteboardId.trim());
      setCurrentWhiteboardId(pasteWhiteboardId.trim());
      setPasteWhiteboardId('');
      setShowIdControls(false);
      
      console.log('📝 Joining shared whiteboard with ID:', pasteWhiteboardId.trim());
    } catch (error) {
      console.error('Failed to join shared whiteboard:', error);
      setWhiteboardError('Failed to join shared whiteboard');
    } finally {
      setIsJoiningSharedWhiteboard(false);
    }
  };

  // Toggle audio mute
  const toggleAudio = async () => {
    if (localAudioTrackRef.current) {
      await localAudioTrackRef.current.setMuted(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  // Toggle video mute
  const toggleVideo = async () => {
    if (localVideoTrackRef.current) {
      await localVideoTrackRef.current.setMuted(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  // Switch camera
  const switchCamera = async () => {
    if (isSwitchingCamera || !isJoined || !cameras.length) {
      console.log('Cannot switch camera:', {
        isSwitchingCamera,
        isJoined,
        camerasAvailable: cameras.length
      });
      return;
    }

    try {
      setIsSwitchingCamera(true);
      setStatus('Switching camera...');

      // Find next camera
      const currentIndex = cameras.findIndex(camera => camera.deviceId === currentCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCamera = cameras[nextIndex];
      
      console.log(`Switching from camera ${currentIndex} to camera ${nextIndex}:`, nextCamera.label);

      // Create new video track with the new camera
      const newVideoTrack = await AgoraRTC.createCameraVideoTrack({
        cameraId: nextCamera.deviceId
      });

      // Re-apply all enabled processors using chaining
      if (isBeautyEnabled || isVirtualBackgroundEnabled) {
        try {
          await applyProcessorsToTrack(newVideoTrack);
          console.log('Processors applied to new camera');
        } catch (error) {
          console.warn('Failed to apply processors to new camera:', error);
          if (isBeautyEnabled) {
            setBeautyError('Beauty effects need to be re-enabled');
          }
          if (isVirtualBackgroundEnabled) {
            setVirtualBackgroundError('Virtual background needs to be re-enabled');
          }
        }
      }

      // If we're in a call, replace the published track
      if (clientRef.current && localVideoTrackRef.current) {
        await clientRef.current.unpublish([localVideoTrackRef.current]);
        await localVideoTrackRef.current.close();
        
        // Update the ref and play locally
        localVideoTrackRef.current = newVideoTrack;
        localVideoTrackRef.current.play(localVideoContainerRef.current);
        
        // Publish the new track
        await clientRef.current.publish([newVideoTrack]);
      } else {
        // Just replace the track if not in a call
        if (localVideoTrackRef.current) {
          await localVideoTrackRef.current.close();
        }
        localVideoTrackRef.current = newVideoTrack;
        localVideoTrackRef.current.play(localVideoContainerRef.current);
      }

      // Update current camera ID
      setCurrentCameraId(nextCamera.deviceId);
      setStatus(`Switched to: ${nextCamera.label}`);
      console.log('Camera switched successfully');

    } catch (error) {
      console.error('Failed to switch camera:', error);
      setError(`Failed to switch camera: ${error.message}`);
      setStatus('Camera switch failed');
    } finally {
      setIsSwitchingCamera(false);
      // Clear status after 3 seconds
      setTimeout(() => setStatus(''), 3000);
    }
  };

  // Get camera display name
  const getCurrentCameraName = () => {
    if (!currentCameraId || !cameras.length) return 'Default Camera';
    
    const currentCamera = cameras.find(camera => camera.deviceId === currentCameraId);
    return currentCamera ? currentCamera.label : 'Unknown Camera';
  };

  // Run video test for diagnostics
  const runVideoTest = async () => {
    try {
      setStatus('Running video test...');
      console.log('🔍 Starting video test diagnostics');
      
      // Check camera access
      const testTrack = await AgoraRTC.createCameraVideoTrack();
      console.log('✅ Camera access successful');
      
      // Test video track properties
      console.log('📹 Video track info:', {
        enabled: testTrack.enabled,
        muted: testTrack.muted,
        videoHeight: testTrack.videoHeight,
        videoWidth: testTrack.videoWidth
      });
      
      // Clean up test track
      await testTrack.close();
      
      setStatus('Video test completed successfully');
      alert('Video test passed! Camera is working properly.');
      
    } catch (error) {
      console.error('❌ Video test failed:', error);
      setError(`Video test failed: ${error.message}`);
      setStatus('Video test failed');
      alert(`Video test failed: ${error.message}`);
    }
  };

  // Show video debug information
  const showVideoDebugInfo = () => {
    const debugInfo = {
      // Connection status
      isJoined,
      connectionState: clientRef.current?.connectionState || 'Not connected',
      
      // Local tracks status
      hasLocalVideo: !!localVideoTrackRef.current,
      hasLocalAudio: !!localAudioTrackRef.current,
      isVideoMuted,
      isAudioMuted,
      
      // Camera info
      currentCameraId,
      availableCameras: cameras.length,
      cameraName: getCurrentCameraName(),
      
      // Users info
      remoteUsers: remoteUsers.length,
      totalUsers: remoteUsers.length + (isJoined ? 1 : 0),
      
      // Effects status
      isBeautyEnabled,
      isVirtualBackgroundEnabled,
      virtualBackgroundType,
      
      // Screen sharing
      isScreenSharing,
      
      // Whiteboard
      whiteboardRoom: whiteboardRoom?.uuid || 'None',
      
      // Environment
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      
      // Errors
      lastError: error || 'None',
      beautyError: beautyError || 'None',
      virtualBackgroundError: virtualBackgroundError || 'None'
    };
    
    console.log('🔍 Debug Info:', debugInfo);
    
    // Create formatted output
    const formattedInfo = Object.entries(debugInfo)
      .map(([key, value]) => `${key}: ${JSON.stringify(value, null, 2)}`)
      .join('\n');
    
    // Show in alert and log
    alert(`Debug Information:\n\n${formattedInfo}`);
    setStatus('Debug info displayed in console and alert');
  };

  // Initialize virtual background processor - DISABLED
  const initVirtualBackgroundProcessor = async () => {
    // if (!virtualBackgroundExtension) {
    //   setVirtualBackgroundError('Virtual background extension not available');
    //   return null;
    // }

    try {
      console.log('Virtual background processor disabled');
      return null;
      
      // const processor = virtualBackgroundExtension.createProcessor();
      // await processor.init();
      
      // Set up overload handler
      // processor.onoverload = () => {
      //   console.warn('Virtual background overload detected, disabling...');
      //   setVirtualBackgroundError('System performance insufficient for virtual background');
      //   disableVirtualBackground();
      // };

      // setVirtualBackgroundProcessor(processor);
      // return processor;
    } catch (error) {
      console.error('Failed to initialize virtual background processor:', error);
      setVirtualBackgroundError(`Failed to initialize processor: ${error.message}`);
      return null;
    }
  };

  // Enable virtual background
  const enableVirtualBackground = async (type = 'blur', options = {}) => {
    try {
      console.log('🌟 Attempting to enable virtual background:', type);
      
      if (!localVideoTrackRef.current) {
        setVirtualBackgroundError('No video track available');
        return;
      }

      let processor = virtualBackgroundProcessor;
      if (!processor) {
        console.log('🌟 Initializing virtual background processor...');
        processor = await initVirtualBackgroundProcessor();
        if (!processor) {
          console.error('🌟 Failed to create virtual background processor');
          return;
        }
      }

      console.log('🌟 Virtual background processor ready:', !!processor);

      // Set virtual background options
      const backgroundOptions = { type };
      
      switch (type) {
        case 'blur':
          backgroundOptions.blurDegree = options.blurDegree || 2;
          break;
        case 'color':
          backgroundOptions.color = options.color || '#00ff00';
          break;
        case 'img':
          if (options.source) {
            backgroundOptions.source = options.source;
          }
          break;
        case 'none':
          // Portrait cutout effect
          break;
      }

      processor.setOptions(backgroundOptions);
      
      // Clear error first
      setVirtualBackgroundError('');
      setVirtualBackgroundType(type);

      // Apply all processors in chain
      await applyProcessorsToTrack(localVideoTrackRef.current);
      
      // Only set enabled state after successful application
      setIsVirtualBackgroundEnabled(true);
      console.log('🌟 Virtual background enabled:', type, backgroundOptions);
    } catch (error) {
      console.error('🌟 Failed to enable virtual background:', error);
      setVirtualBackgroundError(`Failed to enable background: ${error.message}`);
      setIsVirtualBackgroundEnabled(false);
      
      // If it's a piping error, try force reset
      if (error.message.includes('already piped')) {
        console.log('🔥 Attempting force reset due to piping error...');
        try {
          await forceResetProcessors(localVideoTrackRef.current);
          // Try again after force reset
          setIsVirtualBackgroundEnabled(true); // Set state before retry
          setVirtualBackgroundType(type);
          await applyProcessorsToTrack(localVideoTrackRef.current);
          setVirtualBackgroundError('');
          console.log('✅ Virtual background enabled after force reset');
        } catch (retryError) {
          console.error('❌ Force reset retry failed:', retryError);
          setVirtualBackgroundError(`Reset failed: ${retryError.message}`);
          setIsVirtualBackgroundEnabled(false);
        }
      }
    }
  };

  // Disable virtual background
  const disableVirtualBackground = async () => {
    try {
      console.log('🌟 Disabling virtual background...');
      
      // Clear error first
      setVirtualBackgroundError('');

      if (localVideoTrackRef.current) {
        // Re-apply remaining processors
        await applyProcessorsToTrack(localVideoTrackRef.current);
      }
      
      // Only set disabled state after successful operation
      setIsVirtualBackgroundEnabled(false);
      setVirtualBackgroundType('none');
      console.log('🌟 Virtual background disabled');
    } catch (error) {
      console.error('🌟 Failed to disable virtual background:', error);
      setVirtualBackgroundError(`Failed to disable background: ${error.message}`);
      // Keep the current enabled state if there's an error
    }
  };

  // Switch virtual background
  const switchVirtualBackground = async (type, options = {}) => {
    console.log('🔄 switchVirtualBackground called with:', type, options);
    
    // Prevent multiple simultaneous calls
    if (isVirtualBackgroundProcessing) {
      console.log('🌟 Virtual background switch already in progress...');
      return;
    }
    
    setIsVirtualBackgroundProcessing(true);
    
    // Add timeout to prevent stuck processing state
    const timeout = setTimeout(() => {
      console.warn('⚠️ Virtual background switch timeout, resetting processing state');
      setIsVirtualBackgroundProcessing(false);
    }, 10000); // 10 second timeout
    
    try {
      if (type === 'none' || type === 'disable') {
        console.log('🔄 Disabling virtual background...');
        await disableVirtualBackground();
      } else {
        console.log('🔄 Enabling virtual background with type:', type);
        await enableVirtualBackground(type, options);
      }
      console.log('✅ Virtual background switch completed successfully');
      
      // Apply Beauty Effects at the end if they are enabled
      if (isBeautyEnabled) {
        console.log('🎨 Auto-applying beauty effects after virtual background change...');
        try {
          await applyBeautySettings();
          console.log('✅ Beauty effects reapplied successfully');
        } catch (beautyError) {
          console.warn('⚠️ Failed to reapply beauty effects:', beautyError);
          // Don't fail the whole operation if beauty reapplication fails
        }
      }
      
    } catch (error) {
      console.error('❌ Virtual background switch failed:', error);
      setVirtualBackgroundError(`Switch failed: ${error.message}`);
    } finally {
      console.log('🔄 Resetting processing state');
      clearTimeout(timeout);
      setIsVirtualBackgroundProcessing(false);
    }
  };

  // Load background image
  const loadBackgroundImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      
      if (file instanceof File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        img.src = file;
      }
    });
  };

  // Initialize beauty effect processor - DISABLED
  const initBeautyProcessor = async () => {
    // if (!beautyExtension) {
    //   setBeautyError('Beauty extension not available');
    //   return null;
    // }

    try {
      console.log('Beauty effect processor disabled');
      // setBeautyProcessor(null);
      return null;
      
      // const processor = beautyExtension.createProcessor();
      
      // Set up overload handler
      // processor.onoverload = () => {
      //   console.warn('Beauty effect overload detected, disabling...');
      //   setBeautyError('System performance insufficient for beauty effects');
      //   disableBeautyEffect();
      // };

      // setBeautyProcessor(processor);
      // return processor;
    } catch (error) {
      console.error('Failed to initialize beauty processor:', error);
      setBeautyError(`Failed to initialize beauty processor: ${error.message}`);
      return null;
    }
  };

  // Safely unpipe a specific processor
  const safeUnpipeProcessor = async (processor, processorName) => {
    if (!processor) return;
    
    try {
      console.log(`🔄 Safely unpipecing ${processorName}...`);
      
      // Check if processor has unpipe method and is currently piped
      if (typeof processor.unpipe === 'function') {
        await processor.unpipe();
        console.log(`✅ ${processorName} unpiped successfully`);
      }
      
      // Also try to disable if it has disable method
      if (typeof processor.disable === 'function') {
        await processor.disable();
        console.log(`✅ ${processorName} disabled successfully`);
      }
      
      // Small delay to ensure operation completes
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.log(`ℹ️ ${processorName} unpipe/disable info:`, error.message);
    }
  };

  // Reset all processors and clear piping
  const resetAllProcessors = async (videoTrack) => {
    if (!videoTrack) return;

    console.log('🔄 Resetting all processors...');
    
    // Safely unpipe and disable processors individually
    await safeUnpipeProcessor(beautyProcessor, 'Beauty Processor');
    await safeUnpipeProcessor(virtualBackgroundProcessor, 'Virtual Background Processor');

    // Wait a bit for processors to fully disable
    await new Promise(resolve => setTimeout(resolve, 200));

    // Now unpipe everything from video track
    try {
      // First try to unpipe from processorDestination
      if (videoTrack.processorDestination) {
        try {
          videoTrack.processorDestination.unpipe();
          console.log('✅ Processor destination unpipelined');
        } catch (e) {
          console.log('ℹ️ Processor destination was not piped:', e.message);
        }
      }

      // Then unpipe the main video track
      videoTrack.unpipe();
      console.log('✅ Video track unpipelined');
    } catch (e) {
      console.log('ℹ️ No existing pipes to clear:', e.message);
    }

    // Additional wait to ensure everything is cleared
    await new Promise(resolve => setTimeout(resolve, 150));

    console.log('✅ All processors reset');
  };

  // Force reset - more aggressive cleanup for stuck processors
  const forceResetProcessors = async (videoTrack) => {
    if (!videoTrack) return;
    
    console.log('🔥 Force resetting all processors...');
    
    try {
      // Safely unpipe and disable processors
      await safeUnpipeProcessor(beautyProcessor, 'Beauty Processor');
      await safeUnpipeProcessor(virtualBackgroundProcessor, 'Virtual Background Processor');
      
      // Destroy and nullify processors
      if (beautyProcessor) {
        try {
          beautyProcessor.destroy?.();
        } catch (e) { 
          console.log('ℹ️ Beauty processor destroy:', e.message); 
        }
        setBeautyProcessor(null);
      }
      
      if (virtualBackgroundProcessor) {
        try {
          virtualBackgroundProcessor.destroy?.();
        } catch (e) { 
          console.log('ℹ️ VB processor destroy:', e.message); 
        }
        setVirtualBackgroundProcessor(null);
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force unpipe everything
      try {
        if (videoTrack.processorDestination) {
          videoTrack.processorDestination.unpipe();
        }
        videoTrack.unpipe();
      } catch (e) {
        console.log('ℹ️ Force unpipe:', e.message);
      }
      
      // Re-initialize processors if needed
      if (isBeautyEnabled) {
        await initBeautyProcessor();
      }
      if (isVirtualBackgroundEnabled) {
        await initVirtualBackgroundProcessor();
      }
      
      console.log('✅ Force reset complete');
    } catch (error) {
      console.error('❌ Force reset failed:', error);
    }
  };

  // Apply processors to video track (chained for compatibility)
  const applyProcessorsToTrack = async (videoTrack) => {
    if (!videoTrack) return;

    try {
      console.log('🔄 Starting processor application...');
      console.log('Current state:', {
        beautyEnabled: isBeautyEnabled,
        virtualBackgroundEnabled: isVirtualBackgroundEnabled,
        beautyProcessor: !!beautyProcessor,
        virtualBackgroundProcessor: !!virtualBackgroundProcessor
      });

      // First, completely reset all processors
      await resetAllProcessors(videoTrack);

      // Wait a bit after reset
      await new Promise(resolve => setTimeout(resolve, 150));

      // Now chain processors in order: Video → Beauty → Virtual Background → Destination
      let currentStream = videoTrack;

      // Apply beauty effect first (if enabled)
      if (isBeautyEnabled && beautyProcessor) {
        console.log('🎨 Applying beauty processor...');
        try {
          currentStream = currentStream.pipe(beautyProcessor);
          
          // Apply all beauty settings with detailed logging
          console.log('🎨 Applying beauty settings:', beautySettings);
          beautyProcessor.setOptions(beautySettings);
          
          await beautyProcessor.enable();
          console.log('✅ Beauty processor applied and enabled');
        } catch (error) {
          console.error('❌ Beauty processor error:', error);
          setBeautyError(`Beauty processor error: ${error.message}`);
          // Continue without beauty effects
        }
      }

      // Apply virtual background second (if enabled)  
      if (isVirtualBackgroundEnabled && virtualBackgroundProcessor) {
        console.log('🌟 Applying virtual background processor...');
        try {
          currentStream = currentStream.pipe(virtualBackgroundProcessor);
          await virtualBackgroundProcessor.enable();
          console.log('✅ Virtual background processor applied and enabled');
        } catch (error) {
          console.error('❌ Virtual background processor error:', error);
          setVirtualBackgroundError(`Virtual background error: ${error.message}`);
          // Continue without virtual background
        }
      }

      // Pipe to final destination
      console.log('🔄 Piping to processor destination...');
      
      // Make sure processor destination exists and is not already piped
      if (!videoTrack.processorDestination) {
        console.error('❌ No processor destination available');
        throw new Error('No processor destination available');
      }

      // Check if already piped to processor destination
      try {
        currentStream.pipe(videoTrack.processorDestination);
        console.log('✅ Successfully piped to processor destination');
      } catch (error) {
        if (error.message.includes('already piped')) {
          console.log('ℹ️ Already piped to processor destination, skipping...');
        } else {
          console.error('❌ Error piping to processor destination:', error);
          throw error;
        }
      }
      
      console.log('✅ All processors chained successfully!');
    } catch (error) {
      console.error('❌ Failed to apply processors:', error);
      
      // If there's an error, try to reset and apply just to destination
      try {
        console.log('🔄 Error recovery: resetting to basic video...');
        await resetAllProcessors(videoTrack);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Try to pipe directly to processor destination
        if (videoTrack.processorDestination) {
          try {
            videoTrack.pipe(videoTrack.processorDestination);
            console.log('✅ Basic video restored');
          } catch (pipeError) {
            console.log('ℹ️ Direct pipe failed, processor destination may already be connected');
          }
        }
      } catch (recoveryError) {
        console.error('❌ Failed to recover:', recoveryError);
      }
      
      throw error;
    }
  };

  // Enable beauty effect
  const enableBeautyEffect = async (settings = beautySettings) => {
    try {
      console.log('🎨 Attempting to enable beauty effects...');
      
      if (!localVideoTrackRef.current) {
        setBeautyError('No video track available');
        return;
      }

      let processor = beautyProcessor;
      if (!processor) {
        console.log('🎨 Initializing beauty processor...');
        processor = await initBeautyProcessor();
        if (!processor) {
          console.error('🎨 Failed to create beauty processor');
          setBeautyError('Failed to create beauty processor');
          return;
        }
      }

      console.log('🎨 Beauty processor ready:', !!processor);

      // First clear any errors
      setBeautyError('');
      
      // Set the settings but don't enable yet
      setBeautySettings(settings);

      // Apply all processors in chain
      await applyProcessorsToTrack(localVideoTrackRef.current);
      
      // Only set enabled state after successful application
      setIsBeautyEnabled(true);
      console.log('🎨 Beauty effects enabled with settings:', settings);
    } catch (error) {
      console.error('🎨 Failed to enable beauty effects:', error);
      setBeautyError(`Failed to enable beauty effects: ${error.message}`);
      setIsBeautyEnabled(false);
      
      // If it's a piping error, try force reset
      if (error.message.includes('already piped')) {
        console.log('🔥 Attempting force reset due to piping error...');
        try {
          await forceResetProcessors(localVideoTrackRef.current);
          // Try again after force reset
          setIsBeautyEnabled(true); // Set state before retry
          await applyProcessorsToTrack(localVideoTrackRef.current);
          setBeautyError('');
          console.log('✅ Beauty effects enabled after force reset');
        } catch (retryError) {
          console.error('❌ Force reset retry failed:', retryError);
          setBeautyError(`Reset failed: ${retryError.message}`);
          setIsBeautyEnabled(false);
        }
      }
    }
  };

  // Disable beauty effect
  const disableBeautyEffect = async () => {
    try {
      console.log('🎨 Disabling beauty effects...');
      
      // Clear error first
      setBeautyError('');

      if (localVideoTrackRef.current) {
        // Re-apply remaining processors
        await applyProcessorsToTrack(localVideoTrackRef.current);
      }
      
      // Only set disabled state after successful operation
      setIsBeautyEnabled(false);
      console.log('🎨 Beauty effects disabled');
    } catch (error) {
      console.error('🎨 Failed to disable beauty effects:', error);
      setBeautyError(`Failed to disable beauty effects: ${error.message}`);
      // Keep the current enabled state if there's an error
    }
  };

  // Update beauty settings (now just updates state, doesn't apply immediately)
  const updateBeautySettings = async (newSettings) => {
    console.log('🎨 Updating beauty settings state:', newSettings);
    const updatedSettings = { ...beautySettings, ...newSettings };
    setBeautySettings(updatedSettings);
    
    // Auto-apply changes immediately
    if (localVideoTrackRef.current) {
      try {
        await applyBeautySettings();
      } catch (error) {
        console.warn('⚠️ Auto-apply failed:', error);
      }
    }
  };

  // Apply beauty settings to processor
  const applyBeautySettings = async () => {
    try {
      console.log('🎨 Applying beauty settings...');
      
      if (!localVideoTrackRef.current) {
        console.log('❌ No video track available');
        setBeautyError('No video track available');
        return;
      }

      // If beauty effects aren't enabled, enable them first
      if (!isBeautyEnabled) {
        console.log('🎨 Beauty effects not enabled, enabling first...');
        await enableBeautyEffect(beautySettings);
        return;
      }

      // If enabled but no processor, something went wrong
      if (!beautyProcessor) {
        console.log('❌ Beauty processor not available, re-enabling...');
        await enableBeautyEffect(beautySettings);
        return;
      }

      // Apply current settings to the processor
      console.log('🎨 Applying settings to processor:', beautySettings);
      await beautyProcessor.setOptions(beautySettings);
      
      console.log('✅ Beauty settings applied successfully');
      setBeautyError(''); // Clear any previous errors
    } catch (error) {
      console.error('❌ Failed to apply beauty settings:', error);
      setBeautyError(`Failed to apply settings: ${error.message}`);
    }
  };

  // Start screen sharing
  const startScreenShare = async () => {
    try {
      if (!clientRef.current || !isJoined) {
        setError('Must join a channel first');
        return;
      }

      setStatus('Starting screen share...');

      // Create screen video track
      const screenTrack = await AgoraRTC.createScreenVideoTrack({
        // Screen share configuration
        encoderConfig: "1080p_1", // High quality for screen sharing
        optimizationMode: "detail", // Optimize for text and details
      });

      console.log('Screen track created:', screenTrack);

      // Stop current video track if it exists
      if (localVideoTrackRef.current) {
        await localVideoTrackRef.current.setMuted(true);
        await localVideoTrackRef.current.stop();
        await clientRef.current.unpublish(localVideoTrackRef.current);
      }

      // Publish screen track
      await clientRef.current.publish(screenTrack);
      console.log('Screen track published');

      // Update refs and state
      localScreenTrackRef.current = screenTrack;
      setScreenShareTrack(screenTrack);
      setIsScreenSharing(true);
      setStatus('Screen sharing started');

      // Play screen track locally
      // If self-pinned, play in main area; otherwise play in sidebar
      if (pinnedUserId === localUserInfo.uid && localVideoContainerRef.current) {
        try {
          screenTrack.play(localVideoContainerRef.current);
          console.log('✅ Screen track playing in main area (self-pinned)');
        } catch (error) {
          console.error('❌ Error playing screen track in main area:', error);
        }
      } else if (!pinnedUserId && localSidebarVideoRef.current) {
        try {
          screenTrack.play(localSidebarVideoRef.current);
          console.log('✅ Screen track playing in sidebar (not pinned)');
        } catch (error) {
          console.error('❌ Error playing screen track in sidebar:', error);
        }
      }

      // Listen for screen share end (when user clicks "Stop sharing" in browser)
      screenTrack.on('track-ended', () => {
        console.log('Screen share ended by user');
        stopScreenShare();
      });

    } catch (error) {
      console.error('Failed to start screen share:', error);
      setError(`Failed to start screen share: ${error.message}`);
      setStatus('');
    }
  };

  // Stop screen sharing
  const stopScreenShare = async () => {
    try {
      if (!localScreenTrackRef.current) return;

      setStatus('Stopping screen share...');

      // Stop and unpublish screen track
      await clientRef.current.unpublish(localScreenTrackRef.current);
      await localScreenTrackRef.current.stop();
      localScreenTrackRef.current.close();

      // Clear refs and state
      localScreenTrackRef.current = null;
      setScreenShareTrack(null);
      setIsScreenSharing(false);

      // Restart camera video if it was active before
      if (localVideoTrackRef.current && !isVideoMuted) {
        await localVideoTrackRef.current.setMuted(false);
        await clientRef.current.publish(localVideoTrackRef.current);
        
        // Play camera video locally in the correct container
        if (pinnedUserId === localUserInfo.uid && localVideoContainerRef.current) {
          // If self-pinned, play in main area
          try {
            localVideoTrackRef.current.play(localVideoContainerRef.current);
            console.log('✅ Camera video restored in main area (self-pinned)');
          } catch (error) {
            console.error('❌ Error playing camera in main area:', error);
          }
        } else if (!pinnedUserId && localSidebarVideoRef.current) {
          // If not pinned, play in sidebar
          try {
            localVideoTrackRef.current.play(localSidebarVideoRef.current);
            console.log('✅ Camera video restored in sidebar (not pinned)');
          } catch (error) {
            console.error('❌ Error playing camera in sidebar:', error);
          }
        }
      }

      setStatus('Screen sharing stopped');
      console.log('Screen sharing stopped');

    } catch (error) {
      console.error('Failed to stop screen share:', error);
      setError(`Failed to stop screen share: ${error.message}`);
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  // Create whiteboard room and get token
  const createWhiteboardRoom = async () => {
    try {
      setWhiteboardError('');
      setStatus('Creating whiteboard room...');
      
      // Create whiteboard room with a consistent name based on video channel only
      // This ensures users in the same video channel can always join the same whiteboard
      const roomName = `${channelName}-whiteboard`;
      
      console.log('Creating whiteboard room for channel:', channelName);
      const serverUrl = config?.serverUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const roomResponse = await axios.post(`${serverUrl}/api/whiteboard-room`, {
        name: roomName
      });

      const roomUuid = roomResponse.data.uuid;
      console.log('✅ Whiteboard room created:', roomUuid);
      console.log('📋 Room details:', roomResponse.data);
      
      // Store the room ID for sharing
      setSharedWhiteboardRoomId(roomUuid);
      setStatus('Getting whiteboard access token...');

      // Get whiteboard token
      const tokenResponse = await axios.post(`${serverUrl}/api/whiteboard-token`, {
        roomUuid,
        role: 'writer'
      });

      console.log('✅ Whiteboard token received');
      
      // Generate a consistent UID for this user session (more unique)
      let userUid = sessionStorage.getItem('whiteboard-user-uid'); // Use sessionStorage instead of localStorage
      if (!userUid) {
        userUid = `user_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        sessionStorage.setItem('whiteboard-user-uid', userUid);
        console.log('🆔 Generated new user UID:', userUid);
      } else {
        console.log('🆔 Using existing user UID:', userUid);
      }
      
      setWhiteboardRoom(roomUuid);
      setWhiteboardToken(tokenResponse.data.token);
      setWhiteboardUid(tokenResponse.data.uid || userUid);
      setIsWhiteboardVisible(true);
      
      // Store in localStorage so other users in the same channel can find it
      localStorage.setItem(`whiteboard-${channelName}`, roomUuid);
      console.log('📱 Stored whiteboard room in localStorage for channel:', channelName);
      
      setStatus(`Whiteboard created! Room: ${roomUuid.substring(0, 8)}... - Others can auto-join`);
    } catch (error) {
      console.error('❌ Error creating whiteboard:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create whiteboard';
      const errorDetails = error.response?.data?.details;
      
      let fullErrorMessage = errorMessage;
      if (errorDetails) {
        fullErrorMessage += ` (${errorDetails})`;
      }
      
      setWhiteboardError(fullErrorMessage);
      setStatus('');
      
      // Log additional debugging info
      if (error.response?.data) {
        console.error('Server error details:', error.response.data);
      }
    }
  };

  // Join existing whiteboard room
  const joinExistingWhiteboardRoom = async (roomUuid) => {
    try {
      setWhiteboardError('');
      setStatus(`Joining whiteboard room...`);
      
      // Check if we have a valid channel name
      if (!channelName || channelName.trim() === '') {
        setWhiteboardError('No channel name available. Please join a meeting first.');
        setStatus('');
        return;
      }
      
      // Use the provided roomUuid or the shared one from state
      let targetRoom = roomUuid || sharedWhiteboardRoomId;
      
      // If still no room, try localStorage
      if (!targetRoom) {
        targetRoom = localStorage.getItem(`whiteboard-${channelName}`);
        console.log('Checking localStorage for whiteboard room:', targetRoom);
      }
      
      if (!targetRoom) {
        // Try to find existing room by querying the backend for channel rooms
        try {
          const serverUrl = config?.serverUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
          const roomsResponse = await axios.get(`${serverUrl}/api/whiteboard-rooms/${channelName}`);
          if (roomsResponse.data && roomsResponse.data.length > 0) {
            targetRoom = roomsResponse.data[0].uuid;
            setSharedWhiteboardRoomId(targetRoom);
            localStorage.setItem(`whiteboard-${channelName}`, targetRoom);
            console.log('Found existing channel whiteboard via API:', targetRoom);
          } else {
            throw new Error('No whiteboard room found for this channel');
          }
        } catch (findError) {
          setWhiteboardError('No shared whiteboard found for this channel. Someone needs to create one first!');
          setStatus('');
          return;
        }
      }
      
      console.log('Joining whiteboard room:', targetRoom);

      // Get whiteboard token for existing room
      const serverUrl = config?.serverUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      const tokenResponse = await axios.post(`${serverUrl}/api/whiteboard-token`, {
        roomUuid: targetRoom,
        role: 'writer'
      });

      console.log('✅ Token received for existing room');
      
      // Use the same consistent UID for this user session (more unique)
      let userUid = sessionStorage.getItem('whiteboard-user-uid'); // Use sessionStorage instead of localStorage
      if (!userUid) {
        userUid = `user_${Math.random().toString(36).substr(2, 9)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        sessionStorage.setItem('whiteboard-user-uid', userUid);
        console.log('🆔 Generated new user UID:', userUid);
      } else {
        console.log('🆔 Using existing user UID:', userUid);
      }
      
      setWhiteboardRoom(targetRoom);
      setWhiteboardToken(tokenResponse.data.token);
      setWhiteboardUid(tokenResponse.data.uid || userUid);
      setIsWhiteboardVisible(true);
      setSharedWhiteboardRoomId(targetRoom);
      
      // Store in localStorage for future use
      localStorage.setItem(`whiteboard-${channelName}`, targetRoom);
      
      setStatus(`Joined whiteboard: ${targetRoom.substring(0, 8)}...`);
    } catch (error) {
      console.error('❌ Error joining whiteboard room:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to join whiteboard room';
      
      setWhiteboardError(`Failed to join: ${errorMessage}. Try creating a new whiteboard instead.`);
      setStatus('');
    }
  };

  // Toggle whiteboard visibility
  const toggleWhiteboard = () => {
    if (!whiteboardRoom) {
      createWhiteboardRoom();
    } else {
      setIsWhiteboardVisible(!isWhiteboardVisible);
    }
  };

  // Smart whiteboard opener - tries to join existing room, creates if none exists
  const openWhiteboard = async () => {
    try {
      if (!channelName || channelName.trim() === '') {
        setWhiteboardError('No channel name available. Please join a meeting first.');
        return;
      }

      setWhiteboardError('');
      setStatus('Opening whiteboard...');
      
      console.log('🎨 Opening whiteboard for channel:', channelName);
      
      const serverUrl = config?.serverUrl || process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
      
      // First, try to find existing whiteboard room for this channel
      let roomUuid = null;
      let roomToken = null;
      let roomUid = null;
      let isExistingRoom = false;
      
      try {
        const roomsResponse = await axios.get(`${serverUrl}/api/whiteboard-rooms/${channelName}`);
        if (roomsResponse.data && roomsResponse.data.length > 0) {
          roomUuid = roomsResponse.data[0].uuid;
          isExistingRoom = true;
          console.log('✅ Found existing whiteboard room:', roomUuid);
          setStatus('Joining existing whiteboard room...');
        }
      } catch (findError) {
        console.log('No existing room found, will create new one');
      }
      
      // If no existing room, create a new one
      if (!roomUuid) {
        console.log('Creating new whiteboard room...');
        setStatus('Creating new whiteboard room...');
        
        const roomName = `${channelName}-whiteboard`;
        const roomResponse = await axios.post(`${serverUrl}/api/whiteboard-room`, {
          name: roomName
        });
        
        roomUuid = roomResponse.data.uuid;
        console.log('✅ Created new whiteboard room:', roomUuid);
      }
      
      // Get access token for the room
      setStatus('Getting whiteboard access...');
      const tokenResponse = await axios.post(`${serverUrl}/api/whiteboard-token`, {
        roomUuid,
        role: 'writer'
      });
      
      roomToken = tokenResponse.data.token;
      roomUid = tokenResponse.data.uid || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const appIdentifier = tokenResponse.data.appIdentifier || tokenResponse.data.teamUUID || 'qxwMEI0fEfCs2NUPClLbJA/cthEEegcnHjCgQ';
      
      console.log('✅ Whiteboard access obtained');
      console.log('App Identifier from backend:', appIdentifier);
      
      // Set whiteboard state and show it
      setWhiteboardRoom(roomUuid);
      setWhiteboardToken(roomToken);
      setWhiteboardUid(roomUid);
      setWhiteboardAppIdentifier(appIdentifier);
      setSharedWhiteboardRoomId(roomUuid);
      setIsWhiteboardVisible(true);
      
      // Store in localStorage for future access
      localStorage.setItem(`whiteboard-${channelName}`, roomUuid);
      
      const statusMsg = isExistingRoom 
        ? `Joined existing whiteboard room!` 
        : `Created and joined new whiteboard room!`;
      setStatus(statusMsg);
      
      // Clear status after success
      setTimeout(() => setStatus(''), 3000);
      
    } catch (error) {
      console.error('❌ Error opening whiteboard:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to open whiteboard';
      setWhiteboardError(`Failed to open whiteboard: ${errorMessage}`);
      setStatus('');
    }
  };

  // Close whiteboard
  const closeWhiteboard = () => {
    console.log('🚪 Closing whiteboard...');
    setIsWhiteboardVisible(false);
    
    // Clear whiteboard state to force cleanup
    setTimeout(() => {
      setWhiteboardRoom('');
      setWhiteboardToken('');
      setWhiteboardUid('');
      setWhiteboardAppIdentifier('');
      console.log('🧹 Whiteboard state cleared');
    }, 500); // Small delay to allow proper disconnect
  };

useEffect(() => {
    // meetingId from route param
    if (meetingId) {
      setChannelName(meetingId);
    } else {
      console.warn('Meeting ID missing in URL path');
    }

    // extract query params
    const params = new URLSearchParams(location.search);
    const userNameParam = params.get('userName');
    const userIdParam = params.get('userId');
    const roleParam = params.get('role');

    if (userNameParam) setUserName(userNameParam);
    if (userIdParam) setUserId(userIdParam);
    if (roleParam) setRole(roleParam);

    // If we have URL parameters but no config, try to auto-join directly
    if (meetingId && userNameParam && !config && !isJoined && !isLoading && clientRef.current) {
      console.log('🔍 No config but URL params available, attempting direct join...');
      setTimeout(() => {
        if (!isJoined && !isLoading) { // Double check before joining
          console.log('🚀 Auto-joining from URL parameters...');
          console.log('🔍 URL-based join state check:', {
            meetingId,
            userNameParam,
            channelName,
            userName,
            isJoined,
            isLoading,
            hasClient: !!clientRef.current
          });
          joinChannelWithId(meetingId, userNameParam);
        }
      }, 1500); // Longer delay for URL-based join
    }

  }, [meetingId, location.search, config, isJoined, isLoading]);

useEffect(() => {
  if (user) {
    setUserName(user.username || user.firstName || 'User');
  }
}, [user]);


  // Add extensive error logging for debugging
  console.log('🔍 MeetingApp render - Config check:', {
    hasConfig: !!config,
    meetingId: config?.meetingId,
    userName: config?.userName,
    fullConfig: config
  });

  // Add error boundary and detailed logging
  if (!config) {
    console.error('❌ MeetingApp: No config provided!');
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Loading meeting configuration...</h3>
        <p>Please wait while we set up your meeting.</p>
      </div>
    );
  }

  if (!config.meetingId) {
    console.error('❌ MeetingApp: No meetingId in config!', config);
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h3>Meeting ID Missing</h3>
        <p>Unable to join meeting - no meeting ID provided.</p>
      </div>
    );
  }

  if (!config.userName) {
    console.error('❌ MeetingApp: No userName in config!', config);
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h3>User Name Missing</h3>
        <p>Unable to join meeting - no user name provided.</p>
      </div>
    );
  }

  console.log('✅ MeetingApp: All config checks passed, rendering meeting interface');

  return (
    <div className="math-class-app">
      {/* Show video interface immediately when config is available */}
      {config && config.meetingId && config.userName ? (
        // Main Math Class Interface
        <>
          {/* Main Content */}
          <div className="math-class-main" style={{ display: 'flex', height: '100vh', position: 'relative' }}>
            {/* Sidebar with Participants - Collapsible */}
            <div className="math-class-sidebar" style={{ 
              width: isSidebarCollapsed ? '0px' : '300px', 
              minWidth: isSidebarCollapsed ? '0px' : '250px',
              maxWidth: isSidebarCollapsed ? '0px' : '300px',
              transition: 'width 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className="participants-section">
                {!isSidebarCollapsed && (
                  <>
                    <div className="participants-title">
                      Participants ({userCount + 1}) | Remote: {remoteUsers.length}
                    </div>
                    
                    {/* Debug Info - 2 Column Layout */}
                    <div style={{ fontSize: '10px', color: '#1a2847', marginBottom: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontWeight: '500' }}>
                      <div>UserCount: {userCount}</div>
                      <div>RemoteUsers: {remoteUsers.length}</div>
                      <div>JoinedUsers: {joinedUsers.length}</div>
                      <div>LocalUID: {localUserInfo.uid}</div>
                    </div>
                  </>
                )}

                {/* Local User */}
                <div className="participant-tile local" style={{ position: 'relative' }}>
                  <div 
                    ref={localSidebarVideoRef}
                    id="local-sidebar-video"
                    className="participant-video"
                  />
                  {!isSidebarCollapsed && (
                    <>
                      <div className="participant-name">
                        {userName || `You (${localUserInfo.uid})`}
                      </div>
                      <button 
                        className="pin-button"
                        onClick={() => togglePinVideo(localUserInfo.uid)}
                        title={pinnedUserId === localUserInfo.uid ? 'Unpin' : 'Pin'}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: pinnedUserId === localUserInfo.uid ? '#ff9800' : 'rgba(255,255,255,0.7)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: pinnedUserId === localUserInfo.uid ? 'white' : '#333',
                          zIndex: 10
                        }}
                      >
                        📌
                      </button>
                    </>
                  )}
                </div>

                {/* Remote Users */}
                {!isSidebarCollapsed && (
                  remoteUsers.map((user) => (
                    <div key={user.uid} className="participant-tile" style={{ position: 'relative' }}>
                      <div 
                        id={`remote-${user.uid}`} 
                        className="participant-video"
                      />
                      <div className="participant-name">
                        {participantNames[user.uid] || `User ${user.uid}`}
                      </div>
                      <button 
                        className="pin-button"
                        onClick={() => togglePinVideo(user.uid)}
                        title={pinnedUserId === user.uid ? 'Unpin' : 'Pin'}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: pinnedUserId === user.uid ? '#ff9800' : 'rgba(255,255,255,0.7)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: pinnedUserId === user.uid ? 'white' : '#333',
                          zIndex: 10
                        }}
                      >
                        📌
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Collapse/Expand Button - Fixed at sidebar edge */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              style={{
                position: 'absolute',
                left: isSidebarCollapsed ? '0px' : '300px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '24px',
                height: '24px',
                background: '#4CAF50',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px',
                transition: 'left 0.3s ease',
                zIndex: 100,
                boxShadow: 'none',
                padding: '0'
              }}
              title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
              onMouseEnter={(e) => {
                e.target.style.background = '#45a049';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#4CAF50';
              }}
            >
              {isSidebarCollapsed ? '→' : '←'}
            </button>

            {/* Main Canvas Area */}
            <div className="main-canvas-area" style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100%'
            }}>


              <div className="canvas-content" style={{ 
                flex: 1,
                display: 'flex',
                minHeight: 0,
                position: 'relative',
                flexDirection: isWhiteboardVisible && pinnedUserId ? 'row' : 'column'
              }}>
                {/* Pinned Video - Show on left side when whiteboard is open */}
                {pinnedUserId && isWhiteboardVisible && (
                  <div style={{
                    width: '35%',
                    minWidth: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f0f4f8',
                    position: 'relative',
                    borderRight: '1px solid #ddd',
                    flex: '0 0 auto'
                  }}>
                    <div style={{
                      flex: 1,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#000',
                      borderRadius: '8px',
                      margin: '20px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {pinnedUserId === localUserInfo.uid ? (
                        <div 
                          ref={localVideoContainerRef}
                          style={{
                            width: '100%',
                            height: '100%'
                          }}
                        />
                      ) : (
                        <div 
                          id={`pinned-remote-${pinnedUserId}`}
                          style={{
                            width: '100%',
                            height: '100%'
                          }}
                        />
                      )}
                      <button 
                        onClick={() => setPinnedUserId(null)}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: '#ff4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          zIndex: 20
                        }}
                      >
                        Unpin ✕
                      </button>
                    </div>
                    <div style={{
                      padding: '10px',
                      fontSize: '14px',
                      color: '#333',
                      fontWeight: '500'
                    }}>
                      Pinned: User {pinnedUserId}
                    </div>
                  </div>
                )}

                {/* Center area - placeholder for main content when no whiteboard */}
                {!isWhiteboardVisible && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    fontSize: '18px',
                    flexDirection: 'column',
                    position: 'relative'
                  }}>
                    {/* Pinned Video Display */}
                    {pinnedUserId && (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f0f4f8',
                        position: 'relative'
                      }}>
                        <div style={{
                          flex: 1,
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#000',
                          borderRadius: '8px',
                          margin: '20px',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {pinnedUserId === localUserInfo.uid ? (
                            <div 
                              ref={localVideoContainerRef}
                              style={{
                                width: '100%',
                                height: '100%'
                              }}
                            />
                          ) : (
                            <div 
                              id={`pinned-remote-${pinnedUserId}`}
                              style={{
                                width: '100%',
                                height: '100%'
                              }}
                            />
                          )}
                          <button 
                            onClick={() => setPinnedUserId(null)}
                            style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              background: '#ff4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              zIndex: 20
                            }}
                          >
                            Unpin ✕
                          </button>
                        </div>
                        <div style={{
                          padding: '10px',
                          fontSize: '14px',
                          color: '#333',
                          fontWeight: '500'
                        }}>
                          Pinned: User {pinnedUserId}
                        </div>
                      </div>
                    )}
                    
                    {/* Default message when no video pinned */}
                    {!pinnedUserId && (
                      <>
                        Click "Open Whiteboard" button to start the whiteboard
                        <br />
                        <span style={{ fontSize: '14px', marginTop: '10px', color: '#999' }}>
                          or pin a participant video using the 📌 button
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Whiteboard Panel - Inside Canvas Area */}
                {isWhiteboardVisible && (
                  <div className="whiteboard-panel" style={{
                    flex: 1,
                    width: pinnedUserId && isWhiteboardVisible ? '65%' : '100%',
                    height: '100%',
                    background: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    position: pinnedUserId && isWhiteboardVisible ? 'relative' : 'absolute',
                    top: pinnedUserId && isWhiteboardVisible ? 'auto' : 0,
                    left: pinnedUserId && isWhiteboardVisible ? 'auto' : 0,
                    right: pinnedUserId && isWhiteboardVisible ? 'auto' : 0,
                    bottom: pinnedUserId && isWhiteboardVisible ? 'auto' : 0
                  }}>
                <div className="whiteboard-header" style={{
                  padding: '15px 20px',
                  borderBottom: '1px solid #ddd',
                  display: 'none',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
                    Whiteboard {whiteboardRoom ? `- ${whiteboardRoom.substring(0, 8)}...` : ''}
                  </h3>
                  <button 
                    onClick={() => setIsWhiteboardVisible(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '18px',
                      cursor: 'pointer',
                      color: '#666'
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                {/* Whiteboard ID Controls - HIDDEN */}
                <div className="whiteboard-id-controls" style={{
                  padding: '10px 20px',
                  borderBottom: '1px solid #eee',
                  background: '#f8f9fa',
                  display: 'none'
                }}>
                  {/* Current Whiteboard ID Display */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666', 
                      marginBottom: '5px',
                      fontWeight: '500' 
                    }}>
                      Your Whiteboard ID:
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#333',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {currentWhiteboardId || 'Generating...'}
                      </div>
                      <button
                        onClick={copyWhiteboardId}
                        disabled={!currentWhiteboardId}
                        style={{
                          background: whiteboardIdCopied ? '#28a745' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          cursor: currentWhiteboardId ? 'pointer' : 'not-allowed',
                          opacity: currentWhiteboardId ? 1 : 0.6,
                          transition: 'all 0.2s ease'
                        }}
                        title="Copy ID to clipboard"
                      >
                        {whiteboardIdCopied ? '✓ Copied!' : '📋 Copy'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Join Shared Whiteboard */}
                  <div>
                    <button
                      onClick={() => setShowIdControls(!showIdControls)}
                      style={{
                        background: 'none',
                        border: '1px solid #007bff',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: '#007bff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#007bff';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'none';
                        e.target.style.color = '#007bff';
                      }}
                    >
                      {showIdControls ? 'Cancel' : '🔗 Join Shared Whiteboard'}
                    </button>
                    
                    {showIdControls && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#666', 
                          marginBottom: '5px',
                          fontWeight: '500' 
                        }}>
                          Paste Whiteboard ID:
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <input
                            type="text"
                            value={pasteWhiteboardId}
                            onChange={(e) => setPasteWhiteboardId(e.target.value)}
                            placeholder="wb_xxxxx..."
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontFamily: 'monospace'
                            }}
                          />
                          <button
                            onClick={joinSharedWhiteboard}
                            disabled={isJoiningSharedWhiteboard || !pasteWhiteboardId.trim()}
                            style={{
                              background: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '6px 12px',
                              fontSize: '11px',
                              cursor: (isJoiningSharedWhiteboard || !pasteWhiteboardId.trim()) ? 'not-allowed' : 'pointer',
                              opacity: (isJoiningSharedWhiteboard || !pasteWhiteboardId.trim()) ? 0.6 : 1
                            }}
                          >
                            {isJoiningSharedWhiteboard ? 'Joining...' : 'Join'}
                          </button>
                        </div>
                        {whiteboardError && (
                          <div style={{
                            fontSize: '11px',
                            color: '#dc3545',
                            marginTop: '5px'
                          }}>
                            {whiteboardError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="whiteboard-content" style={{ flex: 1, position: 'relative' }}>
                  <WhiteboardAgora
                    isVisible={true}
                    roomUuid={whiteboardRoom}
                    whiteboardToken={whiteboardToken}
                    whiteboardUid={whiteboardUid}
                    appIdentifier={whiteboardAppIdentifier}
                    onClose={() => setIsWhiteboardVisible(false)}
                  />
                </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="bottom-controls">
            {/* Left side controls */}
            <div className="controls-left">
              <button 
                className={`control-button mic ${isAudioMuted ? 'muted' : ''}`}
                onClick={toggleAudio}
                title={isAudioMuted ? 'Unmute' : 'Mute'}
              >
                {isAudioMuted ? '🔇' : '🎤'}
              </button>

              <button 
                className={`control-button video ${isVideoMuted ? 'muted' : ''}`}
                onClick={toggleVideo}
                title={isVideoMuted ? 'Enable Video' : 'Disable Video'}
              >
                {isVideoMuted ? '📹' : '🚫'}
              </button>

              <button 
                className={`control-button whiteboard ${isWhiteboardVisible ? 'active' : ''}`}
                onClick={() => {
                  if (isWhiteboardVisible) {
                    closeWhiteboard();
                  } else {
                    openWhiteboard();
                  }
                }}
                title={isWhiteboardVisible ? 'Close Whiteboard' : 'Open Whiteboard'}
              >
                📋
              </button>

              <button 
                className="control-button screen"
                onClick={toggleScreenShare}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                {isScreenSharing ? '📴' : '🖥️'}
              </button>

              <button 
                className="control-button leave"
                onClick={leaveChannel}
                title="Leave Class"
              >
                📞
              </button>
            </div>

            {/* Right side controls */}
            <div className="controls-right">
              <button 
                className="control-button fullscreen"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? '⛔' : '⛶'}
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="settings-panel" ref={settingsPanelRef}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '1px solid #eee'
              }}>
                <h3 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: '600' }}>Settings</h3>
                <button 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '20px', 
                    cursor: 'pointer', 
                    color: '#666',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  onClick={() => setShowSettings(false)}
                >
                  ×
                </button>
              </div>
              <div className="settings-section">
                <div className="settings-title">Camera</div>
                <div className="settings-controls">
                  <button
                    className={`settings-button ${isSwitchingCamera ? 'active' : ''}`}
                    onClick={switchCamera}
                    disabled={isSwitchingCamera || cameras.length <= 1}
                  >
                    {isSwitchingCamera ? 'Switching...' : `Switch (${cameras.length})`}
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-title">Virtual Background</div>
                <div className="settings-controls">
                  <button
                    className={`settings-button ${virtualBackgroundType === 'none' ? 'active' : ''}`}
                    onClick={() => {
                      console.log('🔍 None button clicked');
                      switchVirtualBackground('none');
                    }}
                    disabled={!localVideoTrackRef.current || isVirtualBackgroundProcessing}
                  >
                    {isVirtualBackgroundProcessing && virtualBackgroundType === 'none' ? 'Processing...' : 'None'}
                  </button>
                  <button
                    className={`settings-button ${virtualBackgroundType === 'blur' ? 'active' : ''}`}
                    onClick={() => {
                      console.log('🔍 Blur button clicked');
                      switchVirtualBackground('blur', { blurDegree: 2 });
                    }}
                    disabled={!localVideoTrackRef.current || isVirtualBackgroundProcessing}
                  >
                    {isVirtualBackgroundProcessing && virtualBackgroundType === 'blur' ? 'Processing...' : 'Blur'}
                  </button>
                  <button
                    className={`settings-button ${virtualBackgroundType === 'color' ? 'active' : ''}`}
                    onClick={() => {
                      console.log('🔍 Green button clicked');
                      switchVirtualBackground('color', { color: '#00ff00' });
                    }}
                    disabled={!localVideoTrackRef.current || isVirtualBackgroundProcessing}
                  >
                    {isVirtualBackgroundProcessing && virtualBackgroundType === 'color' ? 'Processing...' : 'Green'}
                  </button>
                  
                  {/* Debug button to reset processing state */}
                  {isVirtualBackgroundProcessing && (
                    <button
                      className="settings-button"
                      style={{ borderColor: '#dc3545', color: '#dc3545' }}
                      onClick={() => {
                        console.log('🔧 Manual reset of processing state');
                        setIsVirtualBackgroundProcessing(false);
                      }}
                    >
                      Reset
                    </button>
                  )}
                  
                  <label className={`file-upload-button ${virtualBackgroundType === 'img' ? 'active' : ''}`}>
                    {isVirtualBackgroundProcessing && virtualBackgroundType === 'img' ? 'Processing...' : 
                     virtualBackgroundType === 'img' ? 'Custom Image ✓' : 'Upload Image'}
                    <input 
                      type="file" 
                      accept="image/*"
                      disabled={!localVideoTrackRef.current || isVirtualBackgroundProcessing}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            console.log('🖼️ Loading background image:', file.name);
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const img = new Image();
                              img.onload = async () => {
                                console.log('🖼️ Image loaded successfully, applying background...');
                                await switchVirtualBackground('img', { source: img });
                              };
                              img.onerror = (error) => {
                                console.error('🖼️ Failed to load image:', error);
                                setVirtualBackgroundError('Failed to load image');
                              };
                              img.crossOrigin = 'anonymous';
                              img.src = event.target.result;
                            };
                            reader.onerror = (error) => {
                              console.error('🖼️ Failed to read file:', error);
                              setVirtualBackgroundError('Failed to read image file');
                            };
                            reader.readAsDataURL(file);
                          } catch (error) {
                            console.error('🖼️ Upload error:', error);
                            setVirtualBackgroundError('Failed to upload image');
                          }
                        }
                        // Clear the input value to allow re-uploading the same file
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {virtualBackgroundError && (
                  <div style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '5px' }}>
                    {virtualBackgroundError}
                  </div>
                )}
              </div>

              <div className="settings-section">
                <div className="settings-title">Beauty Effects</div>
                <div className="slider-container">
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px', fontStyle: 'italic' }}>
                    Adjust settings - changes apply automatically
                  </div>
                  <h4 style={{ color: '#fff', fontSize: '14px', margin: '10px 0 15px 0', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Skin Enhancement</h4>
                    
                    <div className="slider-label">
                      <span>Smooth</span>
                      <span className="slider-value">{Math.round(beautySettings.smoothnessLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.smoothnessLevel}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateBeautySettings({ smoothnessLevel: value });
                      }}
                    />
                    
                    <div className="slider-label">
                      <span>Whiten</span>
                      <span className="slider-value">{Math.round(beautySettings.lighteningLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.lighteningLevel}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateBeautySettings({ lighteningLevel: value });
                      }}
                    />
                    
                    <div className="slider-label">
                      <span>Ruddy</span>
                      <span className="slider-value">{Math.round(beautySettings.rednessLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.rednessLevel}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateBeautySettings({ rednessLevel: value });
                      }}
                    />
                    
                    <div className="slider-label">
                      <span>Sharpness</span>
                      <span className="slider-value">{Math.round(beautySettings.sharpnessLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.sharpnessLevel}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        updateBeautySettings({ sharpnessLevel: value });
                      }}
                    />

                    <h4 style={{ color: '#fff', fontSize: '14px', margin: '15px 0 15px 0', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Face Shape</h4>
                    
                    <div className="slider-label">
                      <span>Eye Enlarging</span>
                      <span className="slider-value">{Math.round(beautySettings.eyeEnlargingLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.eyeEnlargingLevel}
                      onChange={(e) => updateBeautySettings({ eyeEnlargingLevel: parseFloat(e.target.value) })}
                    />
                    
                    <div className="slider-label">
                      <span>Face Slimming</span>
                      <span className="slider-value">{Math.round(beautySettings.faceSlimmingLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.faceSlimmingLevel}
                      onChange={(e) => updateBeautySettings({ faceSlimmingLevel: parseFloat(e.target.value) })}
                    />
                    
                    <div className="slider-label">
                      <span>Cheekbone Slimming</span>
                      <span className="slider-value">{Math.round(beautySettings.cheekboneSlimmingLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.cheekboneSlimmingLevel}
                      onChange={(e) => updateBeautySettings({ cheekboneSlimmingLevel: parseFloat(e.target.value) })}
                    />
                    
                    <div className="slider-label">
                      <span>Jaw Slimming</span>
                      <span className="slider-value">{Math.round(beautySettings.jawSlimmingLevel * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.jawSlimmingLevel}
                      onChange={(e) => updateBeautySettings({ jawSlimmingLevel: parseFloat(e.target.value) })}
                    />

                    <h4 style={{ color: '#fff', fontSize: '14px', margin: '15px 0 15px 0', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Color Adjustments</h4>
                    
                    <div className="slider-label">
                      <span>Brightness</span>
                      <span className="slider-value">{Math.round((beautySettings.brightnessLevel + 1) * 50)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-1" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.brightnessLevel}
                      onChange={(e) => updateBeautySettings({ brightnessLevel: parseFloat(e.target.value) })}
                    />
                    
                    <div className="slider-label">
                      <span>Contrast</span>
                      <span className="slider-value">{Math.round((beautySettings.contrastLevel + 1) * 50)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-1" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.contrastLevel}
                      onChange={(e) => updateBeautySettings({ contrastLevel: parseFloat(e.target.value) })}
                    />
                    
                    <div className="slider-label">
                      <span>Saturation</span>
                      <span className="slider-value">{Math.round((beautySettings.saturationLevel + 1) * 50)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="-1" 
                      max="1" 
                      step="0.01"
                      value={beautySettings.saturationLevel}
                      onChange={(e) => updateBeautySettings({ saturationLevel: parseFloat(e.target.value) })}
                    />

                  </div>
                  <div style={{ marginTop: '15px', textAlign: 'center' }}>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#888',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                      onClick={() => {
                        const resetSettings = {
                          lighteningContrastLevel: 1,
                          lighteningLevel: 0.5,
                          smoothnessLevel: 0.5,
                          sharpnessLevel: 0.3,
                          rednessLevel: 0.3,
                          eyeEnlargingLevel: 0.0,
                          faceSlimmingLevel: 0.0,
                          cheekboneSlimmingLevel: 0.0,
                          noseSlimmingLevel: 0.0,
                          chinSlimmingLevel: 0.0,
                          jawSlimmingLevel: 0.0,
                          foreheadSlimmingLevel: 0.0,
                          saturationLevel: 0.0,
                          contrastLevel: 0.0,
                          brightnessLevel: 0.0
                        };
                        updateBeautySettings(resetSettings);
                      }}
                    >
                      Reset to defaults
                    </button>
                  </div>
                {beautyError && (
                  <div style={{ color: '#ff6b6b', fontSize: '11px', marginTop: '5px' }}>
                    {beautyError}
                  </div>
                )}
              </div>

              {/* Diagnostic Section */}
              <div className="settings-section">
                <div className="settings-title">Diagnostics</div>
                <div className="settings-controls">
                  <button className="settings-button" onClick={runVideoTest}>
                    Test Video
                  </button>
                  <button className="settings-button" onClick={showVideoDebugInfo}>
                    Debug Info
                  </button>
                  <button 
                    className="settings-button" 
                    style={{ borderColor: '#dc3545', color: '#dc3545' }}
                    onClick={() => {
                      if (localVideoTrackRef.current) {
                        forceResetProcessors(localVideoTrackRef.current).then(() => {
                          console.log('Manual reset completed');
                        });
                      }
                    }}
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Component - Temporarily disabled */}
          {isChatVisible && (
            <div style={{ 
              position: 'fixed', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              color: 'white',
              background: '#333',
              padding: '20px',
              borderRadius: '8px'
            }}>
              Chat temporarily disabled
              <button onClick={() => setIsChatVisible(false)}>Close</button>
            </div>
            // <Chat
            //   isOpen={isChatVisible}
            //   onClose={() => setIsChatVisible(false)}
            //   currentUser={userName}
            //   channelName={channelName}
            // />
          )}
        </>
      ) : (
        // Show minimal loading or redirect if config is not ready
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          fontSize: '16px',
          color: '#666'
        }}>
          Initializing video meeting...
        </div>
      )}
    </div>
  );
};

export default App;
