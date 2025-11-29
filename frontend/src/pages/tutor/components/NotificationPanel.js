import React, { useState, useEffect } from 'react';
import styles from './NotificationPanel.module.css';

const NotificationPanel = ({ notifications = [], onDismiss, onAction }) => {
  const [visibleNotifications, setVisibleNotifications] = useState(notifications);

  useEffect(() => {
    setVisibleNotifications(notifications);
  }, [notifications]);

  const getNotificationIcon = (type) => {
    const icons = {
      session_reminder: 'fa-clock',
      student_joined: 'fa-user-plus',
      session_starting: 'fa-video',
      message: 'fa-envelope',
      system: 'fa-info-circle',
      warning: 'fa-exclamation-triangle',
      error: 'fa-exclamation-circle',
      success: 'fa-check-circle'
    };
    return icons[type] || 'fa-bell';
  };

  const getPriorityClass = (priority) => {
    const classes = {
      low: styles.priorityLow,
      medium: styles.priorityMedium,
      high: styles.priorityHigh,
      urgent: styles.priorityUrgent
    };
    return classes[priority] || classes.medium;
  };

  const handleDismiss = (notificationId) => {
    setVisibleNotifications(prev => 
      prev.filter(n => n.id !== notificationId)
    );
    if (onDismiss) {
      onDismiss(notificationId);
    }
  };

  const handleAction = (notification, action) => {
    if (onAction) {
      onAction(notification, action);
    }
    // Auto-dismiss after action unless it's a persistent notification
    if (!notification.persistent) {
      handleDismiss(notification.id);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (visibleNotifications.length === 0) {
    return (
      <div className={styles.notificationPanel}>
        <div className={styles.emptyState}>
          <i className="fas fa-bell-slash fa-2x text-muted mb-2"></i>
          <p className="text-muted">No notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.notificationPanel}>
      <div className={styles.notificationHeader}>
        <h3>
          <i className="fas fa-bell mr-2"></i>
          Notifications
          <span className={styles.notificationCount}>{visibleNotifications.length}</span>
        </h3>
      </div>
      
      <div className={styles.notificationList}>
        {visibleNotifications.map((notification) => (
          <div 
            key={notification.id}
            className={`${styles.notificationItem} ${getPriorityClass(notification.priority)}`}
          >
            <div className={styles.notificationIcon}>
              <i className={`fas ${getNotificationIcon(notification.type)}`}></i>
            </div>
            
            <div className={styles.notificationContent}>
              <div className={styles.notificationHeader}>
                <h5 className={styles.notificationTitle}>{notification.title}</h5>
                <span className={styles.notificationTime}>
                  {formatTimeAgo(notification.timestamp)}
                </span>
              </div>
              
              <p className={styles.notificationMessage}>{notification.message}</p>
              
              {notification.details && (
                <div className={styles.notificationDetails}>
                  {notification.details.sessionTime && (
                    <p className="small text-muted">
                      <i className="fas fa-clock mr-1"></i>
                      {new Date(notification.details.sessionTime).toLocaleString()}
                    </p>
                  )}
                  {notification.details.className && (
                    <p className="small text-muted">
                      <i className="fas fa-chalkboard mr-1"></i>
                      {notification.details.className}
                    </p>
                  )}
                  {notification.details.studentCount && (
                    <p className="small text-muted">
                      <i className="fas fa-users mr-1"></i>
                      {notification.details.studentCount} students
                    </p>
                  )}
                </div>
              )}
              
              {notification.actions && notification.actions.length > 0 && (
                <div className={styles.notificationActions}>
                  {notification.actions.map((action, index) => (
                    <button
                      key={index}
                      className={`btn btn-sm ${action.style || 'btn-primary'}`}
                      onClick={() => handleAction(notification, action)}
                    >
                      {action.icon && <i className={`fas fa-${action.icon} mr-1`}></i>}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              className={styles.dismissButton}
              onClick={() => handleDismiss(notification.id)}
              title="Dismiss notification"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
      </div>
      
      {visibleNotifications.length > 5 && (
        <div className={styles.notificationFooter}>
          <button className="btn btn-sm btn-outline">
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
