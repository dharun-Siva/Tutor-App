import React, { useState, useEffect, useRef } from 'react';
import AgoraRTM from 'agora-rtm-sdk';

const Chat = ({ isOpen, onClose, channelName, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  const chatClientRef = useRef(null);
  const chatChannelRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add system message helper
  const addSystemMessage = (content) => {
    const systemMessage = {
      id: Date.now() + Math.random(),
      text: content,
      sender: {
        uid: 'System',
        name: 'System',
        isLocal: false
      },
      timestamp: new Date().toISOString(),
      type: 'system',
      isSystem: true
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const initializeChat = async () => {
    if (!currentUser || !channelName) {
      console.error('Missing required parameters for Chat initialization');
      return;
    }

    setIsConnecting(true);
    setConnectionError('');

    try {
      // Get RTM token from backend
      const tokenResponse = await fetch(`/api/rtm-token?uid=${currentUser}`);

      if (!tokenResponse.ok) {
        throw new Error(`Failed to get RTM token: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('RTM token received:', tokenData);

      const appId = import.meta.env.VITE_AGORA_APP_ID || tokenData.appId;
      
      if (!appId) {
        throw new Error('Agora App ID not configured');
      }

      // Initialize RTM client
      console.log('Creating RTM client with App ID:', appId);
      chatClientRef.current = AgoraRTM.createInstance(appId);

      // Add connection event listeners before login
      chatClientRef.current.on('ConnectionStateChanged', (newState, reason) => {
        console.log('RTM Connection state changed:', newState, reason);
        if (newState === 'CONNECTED') {
          setIsConnected(true);
          setIsConnecting(false);
          setConnectionError('');
        } else if (newState === 'DISCONNECTED' || newState === 'RECONNECTING') {
          if (newState === 'DISCONNECTED') {
            setIsConnected(false);
            addSystemMessage('❌ Disconnected from RTM');
          }
        }
      });

      // Add error event listener
      chatClientRef.current.on('error', (error) => {
        console.error('RTM Client error:', error);
        setConnectionError(`RTM Error: ${error.message || error}`);
        setIsConnecting(false);
        setIsConnected(false);
      });

      console.log('Attempting RTM login with user:', currentUser);

      // Login to RTM
      await chatClientRef.current.login({
        uid: currentUser,
        token: tokenData.token
      });
      console.log('Successfully logged into RTM');

      // Create and join channel
      const channel = chatClientRef.current.createChannel(channelName);
      chatChannelRef.current = channel;

      // Set up channel event listeners
      channel.on('ChannelMessage', (message, memberId) => {
        console.log('Channel message received:', message.text, 'from:', memberId);
        
        try {
          const messageData = JSON.parse(message.text);
          
          // Don't add our own messages (we already have them locally)
          if (messageData.senderId !== currentUser) {
            const newMessage = {
              id: messageData.id,
              text: messageData.text,
              sender: {
                uid: memberId,
                name: messageData.senderName || memberId,
                isLocal: false
              },
              timestamp: messageData.timestamp,
              type: 'text'
            };
            
            setMessages(prev => [...prev, newMessage]);
          }
        } catch (error) {
          console.error('Error parsing channel message:', error);
          
          // Fallback for plain text messages
          const newMessage = {
            id: Date.now() + Math.random(),
            text: message.text,
            sender: {
              uid: memberId,
              name: memberId,
              isLocal: false
            },
            timestamp: new Date().toISOString(),
            type: 'text'
          };
          
          setMessages(prev => [...prev, newMessage]);
        }
      });

      channel.on('MemberJoined', (memberId) => {
        console.log('Member joined channel:', memberId);
        setOnlineUsers(prev => [...prev, memberId]);
        addSystemMessage(`👋 ${memberId} joined the chat`);
      });

      channel.on('MemberLeft', (memberId) => {
        console.log('Member left channel:', memberId);
        setOnlineUsers(prev => prev.filter(id => id !== memberId));
        addSystemMessage(`👋 ${memberId} left the chat`);
      });

      // Join the channel
      await channel.join();
      console.log('Successfully joined RTM channel:', channelName);

      // Get member list
      const members = await channel.getMembers();
      setOnlineUsers(members);
      console.log('Current channel members:', members);
      
      setIsConnected(true);
      setIsConnecting(false);
      addSystemMessage(`🎉 Connected to Agora RTM! Welcome ${currentUser}`);
      addSystemMessage(`📡 Real-time chat with users on different devices is now active!`);
      
    } catch (error) {
      console.error('Chat initialization failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to connect to chat server';
      
      // Provide specific error messages based on error type
      if (error.message.includes('token') || error.code === 'TOKEN_EXPIRED') {
        errorMessage = 'Authentication failed - invalid or expired token';
      } else if (error.message.includes('network') || error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error - please check your internet connection';
      } else if (error.code === 'LOGIN_FAILED') {
        errorMessage = 'Login failed - please check your credentials';
      } else if (error.message.includes('APPID')) {
        errorMessage = 'Invalid App ID - please check configuration';
      } else if (error.code === 'CONNECTION_FAILED') {
        errorMessage = 'Connection failed - RTM service may not be enabled';
      } else {
        errorMessage = `Connection failed: ${error.message || error.code || 'Unknown error'}`;
      }
      
      setConnectionError(errorMessage);
      setIsConnecting(false);
      setIsConnected(false);
      
      // Add system message with error details
      addSystemMessage(`❌ ${errorMessage}`);
      if (error.code) {
        addSystemMessage(`🔍 Error code: ${error.code}`);
      }
    }
  };

  const cleanupChat = async () => {
    try {
      if (chatChannelRef.current) {
        await chatChannelRef.current.leave();
        console.log('Left RTM channel');
        chatChannelRef.current = null;
      }
      
      if (chatClientRef.current) {
        await chatClientRef.current.logout();
        console.log('Logged out from RTM');
        chatClientRef.current = null;
      }
      
      setIsConnected(false);
      setIsConnecting(false);
      setMessages([]);
      setOnlineUsers([]);
      setConnectionError('');
    } catch (error) {
      console.error('Chat cleanup error:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !isConnected || !chatChannelRef.current) {
      console.log('Cannot send message:', { 
        hasMessage: !!newMessage.trim(), 
        isConnected, 
        hasChannel: !!chatChannelRef.current 
      });
      return;
    }

    try {
      // Create message with metadata
      const messageData = {
        id: Date.now() + Math.random(),
        text: newMessage,
        senderId: currentUser,
        senderName: currentUser,
        timestamp: new Date().toISOString()
      };

      // Send message through RTM channel
      await chatChannelRef.current.sendMessage({
        text: JSON.stringify(messageData)
      });

      console.log('Message sent successfully via RTM');

      // Add message to local state immediately
      const localMessage = {
        id: messageData.id,
        text: newMessage,
        sender: {
          uid: currentUser,
          name: currentUser,
          isLocal: true
        },
        timestamp: messageData.timestamp,
        type: 'text'
      };

      setMessages(prev => [...prev, localMessage]);
      setNewMessage('');

    } catch (error) {
      console.error('Failed to send message via RTM:', error);
      addSystemMessage(`❌ Failed to send message: ${error.message}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Initialize chat when component mounts or when dependencies change
  useEffect(() => {
    if (isOpen && currentUser && channelName) {
      initializeChat();
    }

    // Cleanup when component unmounts or closes
    return () => {
      if (!isOpen) {
        cleanupChat();
      }
    };
  }, [isOpen, currentUser, channelName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupChat();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="chat-overlay">
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-title">
            <h3>💬 Chat - {channelName}</h3>
            <span className="chat-users-count">
              {isConnecting ? '🔄 Connecting to Agora RTM...' : 
               isConnected ? `✅ RTM Connected (${onlineUsers.length} online)` : 
               '❌ Disconnected'}
            </span>
          </div>
          <button 
            className="btn btn-danger chat-close-btn" 
            onClick={onClose}
            title="Close Chat"
          >
            ❌
          </button>
        </div>

        {connectionError && (
          <div className="chat-error">
            <span className="error-text">⚠️ {connectionError}</span>
            {!isConnected && (
              <button 
                className="btn btn-sm btn-primary" 
                onClick={() => {
                  setConnectionError('');
                  initializeChat();
                }}
                style={{ marginLeft: '10px', fontSize: '12px' }}
              >
                🔄 Retry
              </button>
            )}
          </div>
        )}

        <div className="chat-messages">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`chat-message ${message.sender.isLocal ? 'local' : 'remote'} ${message.isSystem ? 'system' : ''}`}
            >
              {!message.isSystem && (
                <div className="message-sender">
                  {message.sender.name} {message.sender.isLocal ? '(You)' : ''}
                </div>
              )}
              <div className="message-content">
                {message.text}
              </div>
              <div className="message-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input">
          <div className="input-group">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "Type your message..." : "Connecting..."}
              disabled={!isConnected}
              className="form-control"
            />
            <button 
              onClick={sendMessage}
              disabled={!isConnected || !newMessage.trim()}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
          {isConnected && (
            <div className="chat-status">
              ✅ Real-time chat with Agora RTM is active!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
