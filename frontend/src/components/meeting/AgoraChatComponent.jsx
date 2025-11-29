import React, { useState, useEffect, useRef } from 'react';
import AgoraChat from 'agora-chat';

const AgoraChatComponent = ({ isOpen, onClose, channelName, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [groupId, setGroupId] = useState('');
  
  const chatClientRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addLog = (text) => {
    const logMessage = {
      id: Date.now() + Math.random(),
      text,
      sender: {
        uid: 'system',
        name: 'System',
        isSystem: true
      },
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, logMessage]);
  };

  const connectToChat = async () => {
    if (isConnecting || isConnected) return;

    try {
      setIsConnecting(true);
      setConnectionError('');
      addLog('🔄 Connecting to Agora Chat...');

      // Use the Chat App Key from environment
      const appKey = import.meta.env.VITE_AGORA_CHAT_APP_KEY;
      
      if (!appKey) {
        throw new Error('Agora Chat App Key not configured in environment variables');
      }

      console.log('Using Chat App Key:', appKey);

      // Initialize Agora Chat client
      console.log('Creating Agora Chat client with App Key:', appKey);
      chatClientRef.current = new AgoraChat.connection({
        appKey: appKey,
      });

      // Add event handlers
      chatClientRef.current.addEventHandler('connection&message', {
        // Occurs when the app is connected to Agora Chat
        onConnected: () => {
          console.log('Connected to Agora Chat');
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError('');
          addLog(`✅ Connected to Agora Chat as ${currentUser}`);
          
          // Create or join group chat room
          createOrJoinGroup();
        },

        // Occurs when the app is disconnected from Agora Chat
        onDisconnected: () => {
          console.log('Disconnected from Agora Chat');
          setIsConnected(false);
          addLog('❌ Disconnected from Agora Chat');
        },

        // Occurs when a text message is received
        onTextMessage: (message) => {
          console.log('Text message received:', message);
          
          // Only add messages from the group we're in
          if (message.to === groupId || message.chatType === 'groupChat') {
            const newMessage = {
              id: message.id || Date.now() + Math.random(),
              text: message.msg,
              sender: {
                uid: message.from,
                name: message.from,
                isLocal: message.from === currentUser
              },
              timestamp: new Date(message.time || Date.now()).toISOString()
            };
            
            setMessages(prev => [...prev, newMessage]);
          }
        },

        // Occurs when the token is about to expire
        onTokenWillExpire: () => {
          console.log('Chat token will expire');
          addLog('⚠️ Chat token will expire soon');
        },

        // Occurs when the token has expired
        onTokenExpired: () => {
          console.log('Chat token expired');
          addLog('❌ Chat token has expired');
          setIsConnected(false);
        },

        onError: (error) => {
          console.error('Agora Chat error:', error);
          setConnectionError(`Chat Error: ${error.message || error}`);
          setIsConnecting(false);
          addLog(`❌ Chat error: ${error.message || error}`);
        },
      });

      console.log('Attempting to login to Agora Chat...');

      // Login to Agora Chat (for demo purposes, without token)
      // In production, you should use a proper token from your backend
      await chatClientRef.current.open({
        user: currentUser,
        // accessToken: token // Use this in production with proper token
      });

      console.log('Successfully logged into Agora Chat');

    } catch (error) {
      console.error('Chat connection error:', error);
      setConnectionError(`Connection failed: ${error.message}`);
      setIsConnecting(false);
      setIsConnected(false);
      addLog(`❌ Connection failed: ${error.message}`);
    }
  };

  const createOrJoinGroup = async () => {
    try {
      // Use channel name as group ID
      const targetGroupId = `group_${channelName}`;
      setGroupId(targetGroupId);
      
      // Try to join the group first
      try {
        await chatClientRef.current.joinGroup({
          groupId: targetGroupId
        });
        addLog(`✅ Joined group: ${targetGroupId}`);
      } catch (joinError) {
        // If join fails, try to create the group
        console.log('Group join failed, trying to create:', joinError);
        
        try {
          const groupOptions = {
            data: {
              groupname: `Chat Room ${channelName}`,
              desc: `Video call chat room for ${channelName}`,
              public: true,
              maxusers: 200,
              approval: false, // Auto-approve join requests
              allowinvites: true,
              inviteNeedConfirm: false
            }
          };
          
          const result = await chatClientRef.current.createGroup(groupOptions);
          const createdGroupId = result.data.groupid;
          setGroupId(createdGroupId);
          addLog(`✅ Created and joined group: ${createdGroupId}`);
        } catch (createError) {
          console.error('Failed to create group:', createError);
          addLog(`⚠️ Using direct chat mode`);
          setGroupId(targetGroupId); // Use original ID for fallback
        }
      }
    } catch (error) {
      console.error('Group setup error:', error);
      addLog(`⚠️ Group setup failed, using direct mode`);
    }
  };

  const cleanupChat = async () => {
    try {
      if (chatClientRef.current && isConnected) {
        // Leave group if we're in one
        if (groupId) {
          try {
            await chatClientRef.current.leaveGroup({
              groupId: groupId
            });
            console.log('Left group:', groupId);
          } catch (error) {
            console.log('Error leaving group:', error);
          }
        }
        
        await chatClientRef.current.close();
        console.log('Logged out from Agora Chat');
        chatClientRef.current = null;
      }
      
      setIsConnected(false);
      setIsConnecting(false);
      setMessages([]);
      setConnectionError('');
      setGroupId('');
    } catch (error) {
      console.error('Chat cleanup error:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !isConnected || !chatClientRef.current) {
      console.log('Cannot send message:', { 
        hasMessage: !!newMessage.trim(), 
        isConnected, 
        hasClient: !!chatClientRef.current 
      });
      return;
    }

    try {
      // Create message options
      const options = {
        chatType: groupId ? 'groupChat' : 'singleChat',
        type: 'txt',
        to: groupId || channelName,
        msg: newMessage,
      };

      // Create and send message
      const msg = AgoraChat.message.create(options);
      await chatClientRef.current.send(msg);

      console.log('Message sent successfully via Agora Chat');

      // Add message to local state immediately for group chat
      if (options.chatType === 'groupChat') {
        const localMessage = {
          id: Date.now() + Math.random(),
          text: newMessage,
          sender: {
            uid: currentUser,
            name: currentUser,
            isLocal: true
          },
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, localMessage]);
      }
      
      setNewMessage('');

    } catch (error) {
      console.error('Failed to send message:', error);
      addLog(`❌ Failed to send message: ${error.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Connect when component mounts and is opened
  useEffect(() => {
    if (isOpen && channelName && currentUser && !isConnected && !isConnecting) {
      connectToChat();
    }
  }, [isOpen, channelName, currentUser]);

  // Cleanup when component unmounts or closes
  useEffect(() => {
    if (!isOpen && isConnected) {
      cleanupChat();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChat();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="position-fixed" style={{
      top: 0,
      right: 0,
      width: '350px',
      height: '100vh',
      backgroundColor: 'white',
      boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Chat Header */}
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
        <div>
          <h5 className="mb-0">💬 Agora Chat</h5>
          <small className="text-muted">
            {isConnected ? (
              <span className="text-success">● Connected</span>
            ) : isConnecting ? (
              <span className="text-warning">● Connecting...</span>
            ) : (
              <span className="text-danger">● Disconnected</span>
            )}
            {groupId && <div className="small">Group: {groupId}</div>}
          </small>
        </div>
        <button 
          className="btn btn-sm btn-outline-secondary" 
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Connection Status */}
      {connectionError && (
        <div className="alert alert-danger m-2 p-2 small">
          {connectionError}
          <br />
          <button 
            className="btn btn-sm btn-outline-primary mt-1" 
            onClick={connectToChat}
            disabled={isConnecting}
          >
            🔄 Retry
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {messages.length === 0 ? (
          <div className="text-center text-muted">
            <p>No messages yet</p>
            <p>Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`mb-2 ${message.sender.isLocal ? 'text-end' : ''}`}
            >
              <div className={`d-inline-block p-2 rounded ${
                message.sender.isSystem 
                  ? 'bg-light text-dark small'
                  : message.sender.isLocal 
                    ? 'bg-primary text-white' 
                    : 'bg-light text-dark'
              }`} style={{
                maxWidth: '80%',
                fontSize: message.sender.isSystem ? '0.8rem' : '0.9rem'
              }}>
                {!message.sender.isSystem && !message.sender.isLocal && (
                  <div className="small fw-bold mb-1">{message.sender.name}</div>
                )}
                <div>{message.text}</div>
                <div className="small opacity-75 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-3 border-top">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConnected}
          />
          <button 
            className="btn btn-primary" 
            onClick={sendMessage}
            disabled={!isConnected || !newMessage.trim()}
          >
            📤
          </button>
        </div>
        {!isConnected && (
          <small className="text-muted">Connect to start chatting</small>
        )}
      </div>
    </div>
  );
};

export default AgoraChatComponent;
