import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import styles from './MessageManagement.module.css';

const MessageManagement = () => {
  const [activeTab, setActiveTab] = useState('inquiries'); // 'inquiries', 'sent', or 'compose'
  const [allMessages, setAllMessages] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messageForm, setMessageForm] = useState({
    title: '',
    content: '',
    recipientId: '', // null for broadcast, array for multiple recipients
    priority: 'normal',
    type: 'general',
    recipientType: 'broadcast' // 'broadcast' or 'individual'
  });
  const [selectedParents, setSelectedParents] = useState([]);
  
  // Message filters (same as parent dashboard)
  const [messageFilters, setMessageFilters] = useState({
    readStatus: 'all', // all, read, unread
    priority: 'all', // all, urgent, normal, info
    searchText: '',
    dateRange: 'all' // all, today, week, month
  });

  // Track if we've already loaded messages to prevent StrictMode double-invoke
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadAllMessages();
    }
  }, []);

  // Load parents when recipient type changes to individual
  useEffect(() => {
    if (messageForm.recipientType === 'individual') {
      loadParents();
    }
  }, [messageForm.recipientType]);

    // Get current admin ID from token
  const getCurrentAdminId = () => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return null;
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      return tokenData?.id;
    } catch (e) {
      console.error('Error parsing token:', e);
      return null;
    }
  };

  // Helper function to filter messages by type and criteria
  const filterMessages = (msgs, type) => {
    if (!msgs || !Array.isArray(msgs)) return [];
    
    const currentAdminId = getCurrentAdminId();

    // First filter by message type
    let filteredMessages = msgs.filter(msg => {
      if (type === 'inquiries') {
        return msg.type === 'parent_inquiry';
      } else if (type === 'sent') {
        // Show messages where current admin is the sender
        return msg.sender_id === currentAdminId;
      }
      return true;
    });

    // Apply filters
    filteredMessages = filteredMessages.filter(msg => {
      // Read status filter
      if (messageFilters.readStatus !== 'all') {
        const isRead = msg.isReadByUser || (msg.readBy && msg.readBy.length > 0);
        if (messageFilters.readStatus === 'read' && !isRead) return false;
        if (messageFilters.readStatus === 'unread' && isRead) return false;
      }

      // Priority filter
      if (messageFilters.priority !== 'all' && msg.priority !== messageFilters.priority) {
        return false;
      }

      // Search text filter
      if (messageFilters.searchText) {
        const searchLower = messageFilters.searchText.toLowerCase();
        const titleMatch = msg.title?.toLowerCase().includes(searchLower);
        const contentMatch = msg.content?.toLowerCase().includes(searchLower);
        const senderMatch = `${msg.senderId?.firstName} ${msg.senderId?.lastName}`.toLowerCase().includes(searchLower);
        if (!titleMatch && !contentMatch && !senderMatch) return false;
      }

      // Date range filter
      if (messageFilters.dateRange !== 'all') {
        const msgDate = new Date(msg.createdAt);
        const now = new Date();
        const diffTime = now - msgDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (messageFilters.dateRange === 'today' && diffDays > 1) return false;
        if (messageFilters.dateRange === 'week' && diffDays > 7) return false;
        if (messageFilters.dateRange === 'month' && diffDays > 30) return false;
      }

      return true;
    });

    // Sort: Unread first, then by newest date
    return filteredMessages.sort((a, b) => {
      const aRead = a.isReadByUser || (a.readBy && a.readBy.length > 0);
      const bRead = b.isReadByUser || (b.readBy && b.readBy.length > 0);
      
      // Unread messages first
      if (!aRead && bRead) return -1;
      if (aRead && !bRead) return 1;
      
      // Then by newest date
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  const loadAllMessages = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      // Load both received and sent messages in parallel
      const [receivedResponse, sentResponse] = await Promise.all([
        fetch('http://localhost:5000/api/messages/admin', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5000/api/messages/admin/sent', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (receivedResponse.ok && sentResponse.ok) {
        const [receivedData, sentData] = await Promise.all([
          receivedResponse.json(),
          sentResponse.json()
        ]);
        
        // Combine both received and sent messages
        const allMessages = [
          ...(receivedData.data?.messages || []),
          ...(sentData.data?.messages || [])
        ];
        
        console.log('✅ Admin all messages:', { received: receivedData, sent: sentData });
        setAllMessages(allMessages);
      } else {
        throw new Error('Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadParents = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      // First try to get parents directly from the parents endpoint
      const response = await fetch('http://localhost:5000/api/parents', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          // Add cache control to prevent 304 responses
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load parents');
      }

      const responseData = await response.json();
      console.log('API Response:', responseData); // Debug log

      let parentsList = [];
      
      // Handle different response structures
      if (responseData.data?.users) {
        parentsList = responseData.data.users;
      } else if (responseData.data?.parents) {
        parentsList = responseData.data.parents;
      } else if (Array.isArray(responseData.data)) {
        parentsList = responseData.data;
      } else if (Array.isArray(responseData)) {
        parentsList = responseData;
      }

      if (parentsList.length === 0) {
        console.warn('No parents found in the response');
        setError('No parents found');
        setParents([]);
        return;
      }

      // Map the parent data according to the API response structure
      const formattedParents = parentsList.map(parent => ({
        id: parent.id,
        firstName: parent.first_name || parent.firstName || '',
        lastName: parent.last_name || parent.lastName || '',
        email: parent.email || ''
      }));

      console.log('Formatted parents:', formattedParents); // Debug log
      setParents(formattedParents);

    } catch (error) {
      console.error('Error loading parents:', error);
      setError('Failed to load parents list. Please try again.');
      setParents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!messageForm.title || !messageForm.content) {
      setError('Title and content are required');
      return;
    }

    if (messageForm.recipientType === 'individual' && selectedParents.length === 0) {
      setError('Please select at least one parent when sending individual messages');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      const messageData = {
        title: messageForm.title,
        content: messageForm.content,
        priority: messageForm.priority,
        type: messageForm.type,
        recipientId: messageForm.recipientType === 'individual' ? selectedParents[0] : null,
        isBroadcast: messageForm.recipientType === 'broadcast'
      };

      const response = await fetch('http://localhost:5000/api/messages/admin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(messageData)
      });

      if (response.ok) {
        setMessageForm({
          title: '',
          content: '',
          recipientId: '',
          priority: 'normal',
          type: 'general'
        });
        loadAllMessages(); // Refresh messages list
        setActiveTab('sent'); // Switch to sent messages tab
        setError('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    if (field === 'recipientType') {
      setMessageForm(prev => ({
        ...prev,
        recipientType: value,
        recipientId: value === 'broadcast' ? '' : prev.recipientId
      }));
      // Reset selected parents if switching to broadcast
      if (value === 'broadcast') {
        setSelectedParents([]);
      }
    } else if (field === 'selectedParents') {
      // Handle parent selection
      setSelectedParents(value);
      setMessageForm(prev => ({
        ...prev,
        recipientId: value.length > 0 ? value : '' // Store selected parent IDs
      }));
    } else {
      setMessageForm(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  // Get messages based on current tab
  const inquiryMessages = filterMessages(allMessages, 'inquiries');
  const sentMessages = filterMessages(allMessages, 'sent');

  const renderFilters = () => (
    <div className={styles.messageFilters}>
      <div className={styles.filterGroup}>
        <input
          type="text"
          placeholder="Search messages..."
          value={messageFilters.searchText}
          onChange={(e) => setMessageFilters({...messageFilters, searchText: e.target.value})}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.filterGroup}>
        <select
          value={messageFilters.readStatus}
          onChange={(e) => setMessageFilters({...messageFilters, readStatus: e.target.value})}
          className={styles.filterSelect}
        >
          <option value="all">All Messages</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read Only</option>
        </select>
      </div>
      <div className={styles.filterGroup}>
        <select
          value={messageFilters.priority}
          onChange={(e) => setMessageFilters({...messageFilters, priority: e.target.value})}
          className={styles.filterSelect}
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="normal">Normal</option>
          <option value="info">Info</option>
        </select>
      </div>
      <div className={styles.filterGroup}>
        <select
          value={messageFilters.dateRange}
          onChange={(e) => setMessageFilters({...messageFilters, dateRange: e.target.value})}
          className={styles.filterSelect}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last Week</option>
          <option value="month">Last Month</option>
        </select>
      </div>
    </div>
  );

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // If it's today
      if (date.toDateString() === today.toDateString()) {
        return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      // If it's yesterday
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      // Otherwise show full date
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Date formatting error:', e);
      return 'N/A';
    }
  };

  const markAsRead = async (message) => {
    if (!message || !message.id) {
      console.error('Invalid message:', message);
      setError('Cannot mark message as read: Invalid message');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:5000/api/messages/${message.id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Update the specific message in the UI
        setAllMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === message.id
              ? { ...msg, is_read: true }
              : msg
          )
        );

        // Clear any existing error
        setError('');
        
        // Refresh the messages list to update counts
        await loadAllMessages();
      } else {
        throw new Error(data.message || 'Failed to mark message as read');
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
      setError('Failed to mark message as read: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderMessageList = (messagesList, emptyMessage) => (
    <div className={styles.messagesList}>
      {messagesList.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <h4>No Messages</h4>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        messagesList.map((message, index) => (
          <div 
            key={message._id || message.id || `msg-${index}`}
            className={`${styles.messageItem} ${!message.isReadByUser ? styles.unread : ''}`}
          >
            <div className={styles.messageAvatar}>
              {message.priority === 'urgent' ? '🔥' : 
               message.priority === 'normal' ? '⚠️' : 'ℹ️'}
              {!message.isReadByUser && activeTab === 'inquiries' && 
                <span className={styles.unreadDot}>🔴</span>
              }
            </div>
            <div className={styles.messageContent}>
              <div className={styles.messageHeader}>
                <span className={styles.messageSender}>
                  {activeTab === 'inquiries' 
                    ? `From: ${message.senderId?.firstName} ${message.senderId?.lastName}`
                    : `To: ${message.recipientId ? 'Individual Parent' : 'All Parents'}`
                  }
                </span>
                <span className={styles.messageTime}>
                  {formatDate(message.created_at || message.createdAt)}
                </span>
                {activeTab === 'inquiries' && !message.isReadByUser && (
                  <span className={styles.unreadIndicator}>●</span>
                )}
              </div>
              <div className={styles.messageSubject}>
                <span className={`${styles.priorityBadge} ${styles[`priority${message.priority.charAt(0).toUpperCase() + message.priority.slice(1)}`]}`}>
                  {message.priority.toUpperCase()}
                </span>
                {message.title}
              </div>
              <div className={styles.messagePreview}>
                {message.content.length > 100 
                  ? `${message.content.substring(0, 100)}...`
                  : message.content
                }
              </div>
              {message.type && (
                <div className={styles.messageType}>
                  Type: {message.type.charAt(0).toUpperCase() + message.type.slice(1).replace('_', ' ')}
                </div>
              )}
              {activeTab === 'inquiries' && !message.is_read && (
                <button 
                  onClick={() => markAsRead(message)} 
                  className={styles.markAsReadButton}
                  disabled={loading}
                >
                  {loading ? 'Marking as Read...' : 'Mark as Read'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className={styles.messageManagement}>
      <div className={styles.header}>
        <h3>Communication Center</h3>
        <button 
          className={styles.refreshButton}
          onClick={loadAllMessages}
        >
          <i className="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>

      {/* Communication Sub-Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'inquiries' ? styles.active : ''}`}
          onClick={() => setActiveTab('inquiries')}
        >
          <i className="fas fa-question-circle"></i>
          Parent Inquiries ({inquiryMessages.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'sent' ? styles.active : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          <i className="fas fa-paper-plane"></i>
          My Messages ({sentMessages.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'compose' ? styles.active : ''}`}
          onClick={() => setActiveTab('compose')}
        >
          <i className="fas fa-plus-circle"></i>
          Send Message
        </button>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {/* Filters (show only for message lists) */}
      {activeTab !== 'compose' && renderFilters()}

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {loading && <LoadingSpinner />}
        
        {activeTab === 'inquiries' && (
          <div className={styles.tabPanel}>
            <div className={styles.tabHeader}>
              <h4>Parent Inquiries</h4>
              <span className={styles.messageCount}>
                {inquiryMessages.length} message{inquiryMessages.length !== 1 ? 's' : ''}
              </span>
            </div>
            {renderMessageList(inquiryMessages, "No inquiries from parents yet.")}
          </div>
        )}

        {activeTab === 'sent' && (
          <div className={styles.tabPanel}>
            <div className={styles.tabHeader}>
              <h4>Messages Sent by Admin</h4>
              <span className={styles.messageCount}>
                {sentMessages.length} message{sentMessages.length !== 1 ? 's' : ''}
              </span>
            </div>
            {renderMessageList(sentMessages, "You haven't sent any messages yet.")}
          </div>
        )}

        {activeTab === 'compose' && (
          <div className={styles.tabPanel}>
            <div className={styles.composeForm}>
              <h4>Compose New Message</h4>
              <form onSubmit={handleSendMessage}>
                <div className={styles.formGroup}>
                  <label>Recipient Type:</label>
                  <select
                    value={messageForm.recipientType}
                    onChange={(e) => handleFormChange('recipientType', e.target.value)}
                    className={styles.formControl}
                  >
                    <option value="broadcast">All Parents (Broadcast)</option>
                    <option value="individual">Individual Parents</option>
                  </select>
                  
                  {messageForm.recipientType === 'individual' && (
                    <div className={styles.parentSelection}>
                      <div className={styles.parentSelectionHeader}>
                        <label>Select Parents:</label>
                        <button 
                          type="button" 
                          className={styles.reloadButton}
                          onClick={loadParents}
                          disabled={loading}
                        >
                          <i className="fas fa-sync-alt"></i> Reload Parents
                        </button>
                      </div>
                      <div className={styles.parentList}>
                        {loading ? (
                          <div className={styles.loading}>Loading parents...</div>
                        ) : parents.length > 0 ? (
                          parents.map(parent => (
                            <div key={parent.id} className={styles.parentCheckbox}>
                              <input
                                type="checkbox"
                                id={`parent-${parent.id}`}
                                checked={selectedParents.includes(parent.id)}
                                onChange={(e) => {
                                  const newSelected = e.target.checked
                                    ? [...selectedParents, parent.id]
                                    : selectedParents.filter(id => id !== parent.id);
                                  handleFormChange('selectedParents', newSelected);
                                }}
                              />
                              <label htmlFor={`parent-${parent.id}`}>
                                {parent.firstName} {parent.lastName} {parent.email ? `(${parent.email})` : ''}
                              </label>
                            </div>
                          ))
                        ) : error ? (
                          <div className={styles.error}>
                            {error}
                            <button 
                              type="button" 
                              className={styles.retryButton}
                              onClick={loadParents}
                            >
                              Try Again
                            </button>
                          </div>
                        ) : (
                          <div className={styles.noParents}>
                            No parents found. Please check your connection.
                            <button 
                              type="button" 
                              className={styles.retryButton}
                              onClick={loadParents}
                            >
                              Try Again
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <small className={styles.helpText}>
                    {messageForm.recipientType === 'broadcast' 
                      ? "Message will be sent to all parents" 
                      : `Selected ${selectedParents.length} parent(s) to receive this message`}
                  </small>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Priority:</label>
                    <select
                      value={messageForm.priority}
                      onChange={(e) => handleFormChange('priority', e.target.value)}
                      className={styles.formControl}
                    >
                      <option value="info">Info</option>
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Type:</label>
                    <select
                      value={messageForm.type}
                      onChange={(e) => handleFormChange('type', e.target.value)}
                      className={styles.formControl}
                    >
                      <option value="general">General</option>
                      <option value="announcement">Announcement</option>
                      <option value="reminder">Reminder</option>
                      <option value="alert">Alert</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Title:</label>
                  <input
                    type="text"
                    value={messageForm.title}
                    onChange={(e) => handleFormChange('title', e.target.value)}
                    className={styles.formControl}
                    placeholder="Enter message title"
                    maxLength={200}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Content:</label>
                  <textarea
                    value={messageForm.content}
                    onChange={(e) => handleFormChange('content', e.target.value)}
                    className={styles.formTextarea}
                    placeholder="Enter your message content"
                    rows={6}
                    maxLength={2000}
                    required
                  />
                </div>

                <div className={styles.formActions}>
                  <button 
                    type="submit" 
                    className={styles.sendButton}
                    disabled={loading}
                  >
                    {loading ? <LoadingSpinner size="small" /> : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageManagement;