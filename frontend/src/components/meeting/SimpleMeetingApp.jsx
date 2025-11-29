import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import axios from 'axios';
import './SimpleMeeting.css';

const SimpleMeetingApp = ({ config }) => {
  // State management
  const [channelName, setChannelName] = useState(config?.channelName || '');
  const [userName, setUserName] = useState(config?.userName || '');
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Refs
  const agoraClient = useRef(null);
  const localVideoTrack = useRef(null);
  const localAudioTrack = useRef(null);

  // Initialize Agora client
  useEffect(() => {
    agoraClient.current = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });

    // Set up event listeners
    agoraClient.current.on('user-published', handleUserPublished);
    agoraClient.current.on('user-unpublished', handleUserUnpublished);
    agoraClient.current.on('user-joined', handleUserJoined);
    agoraClient.current.on('user-left', handleUserLeft);

    return () => {
      if (agoraClient.current) {
        agoraClient.current.removeAllListeners();
      }
    };
  }, []);

  // Auto-join if config is provided
  useEffect(() => {
    if (config && config.channelName && !isJoined) {
      setChannelName(config.channelName);
      setUserName(config.userName);
      handleJoin();
    }
  }, [config, isJoined]);

  const handleUserJoined = (user) => {
    console.log('User joined:', user.uid);
  };

  const handleUserLeft = (user, reason) => {
    console.log('User left:', user.uid, 'Reason:', reason);
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
  };

  const handleUserPublished = async (user, mediaType) => {
    await agoraClient.current.subscribe(user, mediaType);
    
    if (mediaType === 'video') {
      setRemoteUsers(prev => {
        const existing = prev.find(u => u.uid === user.uid);
        if (existing) {
          return prev.map(u => u.uid === user.uid ? { ...u, videoTrack: user.videoTrack } : u);
        }
        return [...prev, { uid: user.uid, videoTrack: user.videoTrack, audioTrack: user.audioTrack }];
      });
    }

    if (mediaType === 'audio') {
      setRemoteUsers(prev => {
        const existing = prev.find(u => u.uid === user.uid);
        if (existing) {
          return prev.map(u => u.uid === user.uid ? { ...u, audioTrack: user.audioTrack } : u);
        }
        return [...prev, { uid: user.uid, videoTrack: user.videoTrack, audioTrack: user.audioTrack }];
      });
    }
  };

  const handleUserUnpublished = (user, mediaType) => {
    if (mediaType === 'video') {
      setRemoteUsers(prev => 
        prev.map(u => u.uid === user.uid ? { ...u, videoTrack: null } : u)
      );
    }
  };

  const generateToken = async (channel, uid = 0) => {
    try {
      const response = await axios.post('/api/token', {
        channelName: channel,
        uid: uid,
        role: 'publisher'
      });
      return response.data.token;
    } catch (error) {
      console.error('Token generation failed:', error);
      throw new Error('Failed to generate token');
    }
  };

  const handleJoin = async () => {
    if (!channelName || !userName) {
      setError('Please enter channel name and user name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Generate token
      const token = await generateToken(channelName);

      // Create local tracks
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
      localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();

      // Join channel
      const uid = await agoraClient.current.join(
        process.env.REACT_APP_AGORA_APP_ID || 'your-app-id',
        channelName,
        token,
        null
      );

      // Publish local tracks
      await agoraClient.current.publish([localAudioTrack.current, localVideoTrack.current]);

      // Play local video
      localVideoTrack.current.play('local-video');

      setIsJoined(true);
      console.log('Successfully joined channel:', channelName);

    } catch (err) {
      console.error('Failed to join channel:', err);
      setError('Failed to join meeting: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      // Stop local tracks
      if (localAudioTrack.current) {
        localAudioTrack.current.stop();
        localAudioTrack.current.close();
        localAudioTrack.current = null;
      }
      
      if (localVideoTrack.current) {
        localVideoTrack.current.stop();
        localVideoTrack.current.close();
        localVideoTrack.current = null;
      }

      // Leave channel
      await agoraClient.current.leave();
      
      setIsJoined(false);
      setRemoteUsers([]);
      console.log('Left the channel');

    } catch (err) {
      console.error('Failed to leave channel:', err);
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack.current) {
      await localAudioTrack.current.setMuted(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack.current) {
      await localVideoTrack.current.setMuted(!isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    }
  };

  // Render remote video players
  useEffect(() => {
    remoteUsers.forEach(user => {
      if (user.videoTrack) {
        user.videoTrack.play(`remote-video-${user.uid}`);
      }
    });
  }, [remoteUsers]);

  return (
    <div className="meeting-container">
      {/* Header */}
      <div className="meeting-header">
        <h3>Meeting: {channelName}</h3>
        <p>User: {userName}</p>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {/* Join Form */}
      {!isJoined && (
        <div className="join-form">
          <div className="form-group">
            <label>Channel Name:</label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Enter channel name"
            />
          </div>
          <div className="form-group">
            <label>Your Name:</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <button 
            onClick={handleJoin} 
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? 'Joining...' : 'Join Meeting'}
          </button>
        </div>
      )}

      {/* Video Area */}
      {isJoined && (
        <div className="video-container">
          {/* Local Video */}
          <div className="video-player local-player">
            <div id="local-video" className="video-element"></div>
            <div className="video-label">You ({userName})</div>
          </div>

          {/* Remote Videos */}
          {remoteUsers.map(user => (
            <div key={user.uid} className="video-player remote-player">
              <div id={`remote-video-${user.uid}`} className="video-element"></div>
              <div className="video-label">User {user.uid}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {isJoined && (
        <div className="meeting-controls">
          <button 
            onClick={toggleAudio}
            className={`btn ${isAudioMuted ? 'btn-danger' : 'btn-success'}`}
          >
            {isAudioMuted ? '🔇' : '🔊'} {isAudioMuted ? 'Unmute' : 'Mute'}
          </button>
          
          <button 
            onClick={toggleVideo}
            className={`btn ${isVideoMuted ? 'btn-danger' : 'btn-success'}`}
          >
            {isVideoMuted ? '📹' : '📷'} {isVideoMuted ? 'Turn On' : 'Turn Off'}
          </button>
          
          <button 
            onClick={handleLeave}
            className="btn btn-danger"
          >
            Leave Meeting
          </button>
        </div>
      )}
    </div>
  );
};

export default SimpleMeetingApp;