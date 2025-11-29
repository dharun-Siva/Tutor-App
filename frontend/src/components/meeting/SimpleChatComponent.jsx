import React, { useState, useEffect, useRef } from 'react';

const SimpleChatComponent = ({ isOpen, onClose, channelName, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simple localStorage-based chat for local testing
  useEffect(() => {
    if (!isOpen) return;

    const chatKey = `chat_${channelName}`;
    
    // Load existing messages
    const savedMessages = localStorage.getItem(chatKey);
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
    }

    // Listen for storage changes (messages from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === chatKey && e.newValue) {
        try {
          const newMessages = JSON.parse(e.newValue);
          setMessages(newMessages);
        } catch (error) {
          console.error('Error parsing storage messages:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isOpen, channelName]);

  const addSystemMessage = (text) => {
    const systemMessage = {
      id: Date.now() + Math.random(),
      text,
      sender: {
        uid: 'system',
        name: 'System',
        isSystem: true
      },
      timestamp: new Date().toISOString()
    };
    
    const newMessages = [...messages, systemMessage];
    setMessages(newMessages);
    
    // Save to localStorage
    const chatKey = `chat_${channelName}`;
    localStorage.setItem(chatKey, JSON.stringify(newMessages));
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now() + Math.random(),
      text: newMessage,
      sender: {
        uid: currentUser,
        name: currentUser,
        isLocal: true
      },
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, message];
    setMessages(newMessages);
    
    // Save to localStorage
    const chatKey = `chat_${channelName}`;
    localStorage.setItem(chatKey, JSON.stringify(newMessages));
    
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (isOpen && channelName && currentUser) {
      addSystemMessage(`💬 ${currentUser} joined the chat`);
    }
  }, [isOpen, channelName, currentUser]);

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
          <h5 className="mb-0">💬 Local Chat</h5>
          <small className="text-muted">
            <span className="text-success">● Local Storage</span>
          </small>
        </div>
        <button 
          className="btn btn-sm btn-outline-secondary" 
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Info Banner */}
      <div className="alert alert-info m-2 p-2 small">
        <strong>Note:</strong> This is a local chat using localStorage. 
        For real Agora Chat, you need to:
        <br />
        1. Create a Chat project in Agora Console
        <br />
        2. Get the correct Chat App Key
        <br />
        3. Configure proper authentication
      </div>

      {/* Messages Area */}
      <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: 'calc(100vh - 250px)' }}>
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
          />
          <button 
            className="btn btn-primary" 
            onClick={sendMessage}
            disabled={!newMessage.trim()}
          >
            📤
          </button>
        </div>
        <small className="text-muted">Local chat - messages sync across browser tabs</small>
      </div>
    </div>
  );
};

export default SimpleChatComponent;
