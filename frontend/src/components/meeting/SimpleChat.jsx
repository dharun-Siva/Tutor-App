import React, { useState, useEffect, useRef } from 'react';

const SimpleChat = ({ isOpen, onClose, channelName, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages from localStorage
  useEffect(() => {
    if (!channelName) return;
    
    const savedMessages = localStorage.getItem(`chat_${channelName}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }

    // Add user to online list
    const onlineKey = `online_${channelName}`;
    const currentOnline = JSON.parse(localStorage.getItem(onlineKey) || '[]');
    if (!currentOnline.includes(currentUser)) {
      const newOnline = [...currentOnline, currentUser];
      localStorage.setItem(onlineKey, JSON.stringify(newOnline));
      setOnlineUsers(newOnline);
    }

    // Listen for storage changes (for cross-tab sync)
    const handleStorageChange = (e) => {
      if (e.key === `chat_${channelName}` && e.newValue) {
        setMessages(JSON.parse(e.newValue));
      }
      if (e.key === onlineKey && e.newValue) {
        setOnlineUsers(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      // Remove user from online list when component unmounts
      const currentOnline = JSON.parse(localStorage.getItem(onlineKey) || '[]');
      const filtered = currentOnline.filter(user => user !== currentUser);
      localStorage.setItem(onlineKey, JSON.stringify(filtered));
    };
  }, [channelName, currentUser]);

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
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    const updatedMessages = [...messages, message];
    setMessages(updatedMessages);
    
    // Save to localStorage
    localStorage.setItem(`chat_${channelName}`, JSON.stringify(updatedMessages));
    
    setNewMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-overlay">
      <div className="chat-container">
        <div className="chat-header">
          <div className="chat-title">
            <h3>💬 Chat - {channelName}</h3>
            <span className="chat-users-count">
              ✅ Simple Chat ({onlineUsers.length} online)
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

        <div className="chat-messages">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`chat-message ${message.sender.isLocal ? 'local' : 'remote'}`}
            >
              <div className="message-sender">
                {message.sender.name} {message.sender.isLocal ? '(You)' : ''}
              </div>
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
              placeholder="Type your message..."
              className="form-control"
            />
            <button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className="btn btn-primary"
            >
              Send
            </button>
          </div>
          <div className="chat-status">
            ✅ Local chat active (messages sync across browser tabs)
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleChat;
