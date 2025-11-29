import React, { useRef, useEffect, useState } from 'react';
import { WhiteWebSdk } from 'white-web-sdk';

const WhiteboardAgora = ({ isVisible, roomUuid, whiteboardToken, whiteboardUid, appIdentifier, onClose }) => {
  const whiteboardRef = useRef(null);
  const initializeOnceRef = useRef(false);
  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isVisible && roomUuid && whiteboardToken && whiteboardUid && whiteboardRef.current && !initializeOnceRef.current && !room) {
      console.log('🎯 Initializing whiteboard (first time only)');
      initializeOnceRef.current = true;
      initializeWhiteboard();
    }

    return () => {
      if (room) {
        console.log('🧹 Cleaning up whiteboard room connection');
        room.disconnect();
        setRoom(null);
        initializeOnceRef.current = false;
      }
    };
  }, [isVisible, roomUuid, whiteboardToken, whiteboardUid, room]);

  const initializeWhiteboard = async () => {
    // Use App Identifier from props (backend) with fallback - declared at function scope
    const correctAppIdentifier = appIdentifier || process.env.REACT_APP_WHITEBOARD_APP_ID;
    
    try {
      setIsLoading(true);
      setError('');
      
      console.log('Initializing whiteboard with:', {
        roomUuid,
        whiteboardToken: whiteboardToken ? `${whiteboardToken.substring(0, 20)}...` : 'missing',
        whiteboardUid,
        appIdentifier: correctAppIdentifier
      });

      console.log('🔍 App Identifier sources:');
      console.log('- From props (backend):', appIdentifier);
      console.log('- From environment:', process.env.REACT_APP_WHITEBOARD_APP_ID);
      console.log('- Using:', correctAppIdentifier);
      
      const whiteWebSdk = new WhiteWebSdk({
        appIdentifier: correctAppIdentifier,
        region: 'us-sv', // Must match the region used in room creation
        useMobXState: true,
        loggerOptions: {
          reportQualityMode: 'always',
          reportLevelMask: 'debug'
        }
      });

      console.log('WhiteWebSdk initialized with appIdentifier:', correctAppIdentifier);

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
        uid: whiteboardUid || `user_${Date.now()}`,
        userPayload: {
          name: `User ${whiteboardUid || Date.now()}`,
        },
        floatBar: true, // Enable the floating toolbar
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
      whiteboardRoom.bindHtmlElement(whiteboardRef.current);

      // Set up event listeners for better debugging
      whiteboardRoom.callbacks.on("onRoomStateChanged", (modifyState) => {
        // Only log significant state changes, not every minor update
        if (modifyState.roomMembers || modifyState.broadcastState || modifyState.roomState) {
          console.log("Room state changed:", modifyState);
        }
      });

      whiteboardRoom.callbacks.on("onPhaseChanged", (phase) => {
        console.log("Phase changed:", phase);
      });

      whiteboardRoom.callbacks.on("onDisconnectWithError", (error) => {
        console.error("Whiteboard disconnected with error:", error);
        setError(`Whiteboard connection lost: ${error.message}`);
      });

      setRoom(whiteboardRoom);
      console.log('Whiteboard initialized successfully');
    } catch (error) {
      console.error('Error initializing whiteboard:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message.includes('invalid appIdentifier')) {
        errorMessage = `Invalid App Identifier. Please check your Agora Whiteboard credentials. Current App Identifier: ${correctAppIdentifier}`;
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

  const clearWhiteboard = () => {
    if (room) {
      room.cleanCurrentScene();
    }
  };

  const changeToDrawingTool = () => {
    if (room) {
      room.setMemberState({
        currentApplianceName: 'pencil',
        strokeColor: [0, 0, 0],
        strokeWidth: 2,
      });
    }
  };

  const changeToTextTool = () => {
    if (room) {
      room.setMemberState({
        currentApplianceName: 'text',
        textSize: 16,
      });
    }
  };

  const changeToEraserTool = () => {
    if (room) {
      room.setMemberState({
        currentApplianceName: 'eraser',
      });
    }
  };

  const changeToSelectorTool = () => {
    if (room) {
      room.setMemberState({
        currentApplianceName: 'selector',
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="whiteboard-overlay">
      <div className="whiteboard-container">
        <div className="whiteboard-header">
          <h3>Interactive Whiteboard</h3>
          <div className="whiteboard-controls">
            <button 
              className="btn btn-secondary" 
              onClick={changeToDrawingTool}
              title="Drawing Tool"
            >
              ✏️ Draw
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={changeToTextTool}
              title="Text Tool"
            >
              📝 Text
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={changeToEraserTool}
              title="Eraser Tool"
            >
              🗑️ Erase
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={changeToSelectorTool}
              title="Selector Tool"
            >
              👆 Select
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={clearWhiteboard}
              title="Clear Whiteboard"
            >
              🗑️ Clear
            </button>
            <button 
              className="btn btn-danger" 
              onClick={onClose}
              title="Close Whiteboard"
            >
              ❌ Close
            </button>
          </div>
        </div>

        {error && <div className="status error">{error}</div>}
        
        {isLoading && (
          <div className="whiteboard-loading">
            <div className="loading"></div>
            <span>Loading whiteboard...</span>
          </div>
        )}

        <div 
          ref={whiteboardRef} 
          className="whiteboard-canvas"
          style={{
            width: '100%',
            height: '500px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            display: isLoading ? 'none' : 'block'
          }}
        />
      </div>
    </div>
  );
};

export default WhiteboardAgora;