import React, { useRef, useEffect, useState } from 'react';
import { WhiteWebSdk } from 'white-web-sdk';

const EnhancedWhiteboard = ({ isVisible, roomUuid, whiteboardToken, whiteboardUid, onClose }) => {
  const whiteboardRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentBrushSize, setCurrentBrushSize] = useState(2);
  const [currentTool, setCurrentTool] = useState('pencil');
  const [currentColor, setCurrentColor] = useState([0, 0, 0]);

  // Compute unique member statistics to avoid duplicate/ghost counts
  const computeMemberStats = (members) => {
    const list = Array.isArray(members) ? members : [];
    const seen = new Set();
    const uniqueMembers = [];

    for (const m of list) {
      if (!m) continue;
      const id = m.memberId || (m.memberState && (m.memberState.uid || m.memberState.userId)) || JSON.stringify(m);
      if (!seen.has(id)) {
        seen.add(id);
        uniqueMembers.push(m);
      }
    }

    const now = Date.now();
    const activeCount = uniqueMembers.filter((m) => {
      const s = m.memberState;
      if (!s || typeof s !== 'object') return false;
      const hasUid = !!(s.uid || s.userId);
      const hasPayload = !!s.userPayload;
      const lastActiveRecent = s.lastActive && (now - s.lastActive < 30000);
      const conn = s.connectionState;
      const isConnected = !conn || conn === 'connected' || conn === 'connecting';
      return lastActiveRecent || (isConnected && (hasUid || hasPayload));
    }).length;

    return {
      totalUnique: uniqueMembers.length,
      active: activeCount,
      inactive: Math.max(0, uniqueMembers.length - activeCount),
      uniqueMembers,
    };
  };

  useEffect(() => {
    // Cleanup previous connection first
    if (room) {
      console.log('🧹 Cleaning up previous whiteboard connection');
      try {
        room.disconnect();
      } catch (e) {
        console.log('Previous room already disconnected');
      }
      setRoom(null);
    }

    // Auto-join when visible and required params exist
    const canAutoJoin = isVisible && roomUuid && whiteboardToken && (typeof whiteboardUid !== 'undefined' && whiteboardUid !== null);
    if (canAutoJoin) {
      if (whiteboardRef.current) {
        initializeWhiteboard();
      } else {
        setTimeout(() => {
          if (whiteboardRef.current) {
            initializeWhiteboard();
          } else {
            console.warn('Whiteboard DOM not ready for auto-join; user may click Join Room.');
          }
        }, 50);
      }
    }

    return () => {
      if (room) {
        console.log('🧹 Cleanup: Disconnecting whiteboard room');
        try {
          room.disconnect();
        } catch (e) {
          console.log('Room already disconnected');
        }
        setRoom(null);
      }
    };
  }, [isVisible, roomUuid, whiteboardToken, whiteboardUid]);

  const initializeWhiteboard = async () => {
    // Prevent duplicate initialization
    if (room) {
      console.warn('initializeWhiteboard called but room already exists');
      return;
    }

    if (!whiteboardRef.current) {
      console.warn('initializeWhiteboard called but whiteboardRef DOM element is not ready');
      return;
    }
    try {
      setIsLoading(true);
      setError('');

      console.log('Initializing whiteboard with:', {
        roomUuid,
        whiteboardToken: whiteboardToken ? `${whiteboardToken.substring(0, 20)}...` : 'missing',
        whiteboardUid,
        appIdentifier: import.meta.env.VITE_WHITEBOARD_APP_ID || 'qxwMEI0fEfCs2NUPClLbJA/cthEEegcnHjCgQ'
      });

      // Initialize Whiteboard SDK with hardcoded fallback for debugging
      const appIdentifier = import.meta.env.VITE_WHITEBOARD_APP_ID || 'qxwMEI0fEfCs2NUPClLbJA/cthEEegcnHjCgQ';
      
      const whiteWebSdk = new WhiteWebSdk({
        appIdentifier: appIdentifier,
        region: 'us-sv', // Must match the region used in room creation
        useMobXState: true,
        loggerOptions: {
          reportQualityMode: 'always',
          reportLevelMask: 'debug'
        }
      });

      console.log('WhiteWebSdk initialized with appIdentifier:', appIdentifier);

      // Validate required parameters
      if (!roomUuid) {
        throw new Error('Room UUID is required');
      }
      if (!whiteboardToken) {
        throw new Error('Whiteboard token is required');
      }

      // Join the whiteboard room
      const whiteboardRoom = await whiteWebSdk.joinRoom({
        uuid: roomUuid,
        roomToken: whiteboardToken,
        uid: whiteboardUid,
        userPayload: {
          name: `User ${whiteboardUid}`,
        },
        floatBar: false, // Disable default floating toolbar as we have our own
        hotKeys: {
          changeToSelector: "s",
          changeToLaserPointer: "z",
          changeToPencil: "p",
          changeToRectangle: "r",
          changeToEllipse: "c",
          changeToEraser: "e",
          changeToText: "t",
          changeToStraight: "l",
          changeToArrow: "a",
          changeToHand: "h",
        },
      });

      console.log('Whiteboard room joined successfully');

      // Bind whiteboard to DOM element
      try {
        whiteboardRoom.bindHtmlElement(whiteboardRef.current);
      } catch (bindError) {
        console.error('Failed to bind whiteboard to DOM element:', bindError);
        throw new Error('Failed to bind whiteboard to DOM element');
      }

      // Set up event listeners
      whiteboardRoom.callbacks.on("onRoomStateChanged", (modifyState) => {
        console.log("📋 Room state changed:", modifyState);
      });

      whiteboardRoom.callbacks.on("onPhaseChanged", (phase) => {
        console.log("🔄 Phase changed:", phase);
      });

      whiteboardRoom.callbacks.on("onDisconnectWithError", (error) => {
        console.error("❌ Whiteboard disconnected with error:", error);
        setError(`Whiteboard connection lost: ${error.message}`);
      });

      whiteboardRoom.callbacks.on("onRoomMembersChanged", (members) => {
        console.log("👥 Members changed event:", members);
      });

      setRoom(whiteboardRoom);
      
      console.log('Whiteboard initialized successfully');
    } catch (error) {
      console.error('Error initializing whiteboard:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('invalid appIdentifier')) {
        errorMessage = `Invalid App Identifier. Please check your Agora Whiteboard credentials.`;
      } else if (error.message.includes('token')) {
        errorMessage = 'Invalid whiteboard token. Please check your credentials and try again.';
      } else if (error.message.includes('room')) {
        errorMessage = 'Failed to join whiteboard room. The room may not exist or may be invalid.';
      }
      
      setError(`Failed to initialize whiteboard: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Tool functions
  const changeTool = (toolName) => {
    if (room) {
      setCurrentTool(toolName);
      const toolConfig = {
        currentApplianceName: toolName,
        strokeWidth: currentBrushSize,
        strokeColor: currentColor,
      };

      if (toolName === 'text') {
        toolConfig.textSize = 16;
      }

      room.setMemberState(toolConfig);
    }
  };

  const changeBrushSize = (size) => {
    setCurrentBrushSize(size);
    if (room) {
      room.setMemberState({
        strokeWidth: size,
      });
    }
  };

  const changeStrokeColor = (color) => {
    setCurrentColor(color);
    if (room) {
      room.setMemberState({
        strokeColor: color,
      });
    }
  };

  const clearWhiteboard = () => {
    if (room) {
      room.cleanCurrentScene();
    }
  };

  // Enhanced color palette with more options
  const predefinedColors = [
    { name: 'Black', value: [0, 0, 0] },
    { name: 'Red', value: [255, 0, 0] },
    { name: 'Blue', value: [0, 0, 255] },
    { name: 'Green', value: [0, 128, 0] },
    { name: 'Orange', value: [255, 165, 0] },
    { name: 'Purple', value: [128, 0, 128] },
    { name: 'Yellow', value: [255, 255, 0] },
    { name: 'Pink', value: [255, 192, 203] },
    { name: 'Brown', value: [165, 42, 42] },
    { name: 'Gray', value: [128, 128, 128] },
    { name: 'Light Blue', value: [173, 216, 230] },
    { name: 'Dark Green', value: [0, 100, 0] },
  ];

  // Brush sizes
  const brushSizes = [
    { name: 'XS', value: 1 },
    { name: 'S', value: 2 },
    { name: 'M', value: 4 },
    { name: 'L', value: 8 },
    { name: 'XL', value: 12 },
  ];

  // Drawing tools
  const drawingTools = [
    { name: 'pencil', icon: '✏️', label: 'Draw', color: '#28a745' },
    { name: 'text', icon: '📝', label: 'Text', color: '#007bff' },
    { name: 'eraser', icon: '🧹', label: 'Erase', color: '#fd7e14' },
    { name: 'selector', icon: '👆', label: 'Select', color: '#6f42c1' },
    { name: 'rectangle', icon: '⬜', label: 'Rectangle', color: '#17a2b8' },
    { name: 'ellipse', icon: '⭕', label: 'Circle', color: '#ffc107' },
    { name: 'arrow', icon: '➡️', label: 'Arrow', color: '#dc3545' },
    { name: 'straight', icon: '📏', label: 'Line', color: '#20c997' },
  ];

  if (!isVisible) return null;

  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      background: '#ffffff'
    }}>
      {/* Enhanced Toolbar */}
      <div style={{
        padding: '12px',
        borderBottom: '2px solid #e0e0e0',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        alignItems: 'center'
      }}>
        
        {/* Drawing Tools Section */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#495057', fontWeight: 'bold', marginRight: '8px' }}>Tools:</span>
          {drawingTools.map((tool, index) => (
            <button 
              key={index}
              onClick={() => changeTool(tool.name)}
              style={{
                padding: '8px 12px',
                fontSize: '12px',
                background: currentTool === tool.name ? tool.color : '#ffffff',
                color: currentTool === tool.name ? 'white' : tool.color,
                border: `2px solid ${tool.color}`,
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: currentTool === tool.name ? `0 2px 4px ${tool.color}40` : '0 1px 2px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                fontWeight: 'bold'
              }}
              title={`${tool.label} Tool`}
              onMouseEnter={(e) => {
                if (currentTool !== tool.name) {
                  e.target.style.background = `${tool.color}20`;
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentTool !== tool.name) {
                  e.target.style.background = '#ffffff';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {tool.icon} {tool.label}
            </button>
          ))}
        </div>

        {/* Brush Size Section */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#495057', fontWeight: 'bold', marginRight: '8px' }}>Size:</span>
          {brushSizes.map((size, index) => (
            <button
              key={index}
              onClick={() => changeBrushSize(size.value)}
              style={{
                width: '32px',
                height: '32px',
                border: currentBrushSize === size.value ? '2px solid #007bff' : '2px solid #dee2e6',
                borderRadius: '50%',
                cursor: 'pointer',
                backgroundColor: currentBrushSize === size.value ? '#007bff' : '#ffffff',
                color: currentBrushSize === size.value ? 'white' : '#495057',
                fontSize: '10px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              title={`${size.name} (${size.value}px)`}
              onMouseEnter={(e) => {
                if (currentBrushSize !== size.value) {
                  e.target.style.backgroundColor = '#e3f2fd';
                  e.target.style.borderColor = '#007bff';
                }
              }}
              onMouseLeave={(e) => {
                if (currentBrushSize !== size.value) {
                  e.target.style.backgroundColor = '#ffffff';
                  e.target.style.borderColor = '#dee2e6';
                }
              }}
            >
              {size.name}
            </button>
          ))}
        </div>
        
        {/* Color Picker Section */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#495057', fontWeight: 'bold', marginRight: '8px' }}>Colors:</span>
          {predefinedColors.map((color, index) => (
            <button
              key={index}
              onClick={() => changeStrokeColor(color.value)}
              style={{
                width: '28px',
                height: '28px',
                border: JSON.stringify(currentColor) === JSON.stringify(color.value) ? '3px solid #343a40' : '2px solid #dee2e6',
                borderRadius: '50%',
                cursor: 'pointer',
                backgroundColor: `rgb(${color.value[0]}, ${color.value[1]}, ${color.value[2]})`,
                padding: 0,
                transition: 'all 0.2s ease',
                boxShadow: JSON.stringify(currentColor) === JSON.stringify(color.value) ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 2px rgba(0,0,0,0.1)'
              }}
              title={color.name}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
              }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
          <button 
            onClick={clearWhiteboard}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220,53,69,0.3)',
              transition: 'all 0.2s ease',
              fontWeight: 'bold'
            }}
            title="Clear All"
            onMouseEnter={(e) => {
              e.target.style.background = '#c82333';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#dc3545';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            🗑️ Clear All
          </button>

          {/* Manual Join Room button */}
          <button
            onClick={async () => {
              console.log('User requested manual Join Room');
              if (!roomUuid || !whiteboardToken || typeof whiteboardUid === 'undefined' || whiteboardUid === null) {
                setError('Missing parameters to join whiteboard');
                return;
              }
              try {
                await initializeWhiteboard();
              } catch (e) {
                console.error('Manual join failed:', e);
                setError(e?.message || String(e));
              }
            }}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              background: isLoading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'default' : 'pointer',
              boxShadow: '0 2px 4px rgba(40,167,69,0.3)',
              transition: 'all 0.2s ease',
              fontWeight: 'bold'
            }}
            title="Join Room"
          >
            {isLoading ? '⏳ Joining...' : '🔗 Join Room'}
          </button>
        </div>
      </div>

      {/* Status Info */}
      {room && (
        <div style={{
          padding: '8px 12px',
          background: '#e8f5e8',
          color: '#155724',
          fontSize: '11px',
          borderBottom: '1px solid #c3e6cb',
          fontFamily: 'monospace',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            🏠 Room: {roomUuid?.substring(0, 8)}... | 👤 User: {whiteboardUid} | 🎨 Tool: {currentTool} | 📏 Size: {currentBrushSize}px
          </div>
          <div>
            👥 Users: {(() => {
              const stats = computeMemberStats(room.state.roomMembers);
              return stats.totalUnique;
            })()}
          </div>
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div style={{
          padding: '10px 12px',
          background: '#f8d7da',
          color: '#721c24',
          fontSize: '12px',
          borderBottom: '1px solid #f5c6cb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => {
              setError('');
              initializeWhiteboard();
            }}
            style={{
              padding: '4px 8px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '60px',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.95)',
          zIndex: 1000,
          fontSize: '16px',
          color: '#666',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ fontSize: '24px' }}>⏳</div>
          <div>Connecting to whiteboard...</div>
        </div>
      )}

      {/* Canvas Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div 
          ref={whiteboardRef} 
          style={{
            width: '100%',
            height: '100%',
            background: '#ffffff',
            display: isLoading ? 'none' : 'block'
          }}
        />
      </div>
    </div>
  );
};

export default EnhancedWhiteboard;