import React from 'react';
import styles from './NotificationCenter.module.css';

const NotificationCenter = ({ 
  notifications = [], 
  maxDisplay = 5,
  onNotificationClick,
  onMarkAsRead,
  onClearAll 
}) => {
  const getNotificationIcon = (type) => {
    const icons = {
      reminder: '⏰',
      achievement: '🏆',
      session: '📚',
      assignment: '📝',
      grade: '📊',
      message: '💬',
      system: '⚙️',
      warning: '⚠️',
      success: '✅',
      info: 'ℹ️'
    };
    return icons[type] || '📢';
  };

  const getPriorityClass = (priority) => {
    return styles[`priority${priority?.charAt(0).toUpperCase() + priority?.slice(1)}`] || styles.priorityMedium;
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const displayNotifications = notifications.slice(0, maxDisplay);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={styles.notificationCenter}>
      <div className={styles.notificationHeader}>
        <div className={styles.headerTitle}>
          <span className={styles.notificationIcon}>🔔</span>
          <h3>Notifications</h3>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>{unreadCount}</span>
          )}
        </div>
        {notifications.length > 0 && (
          <div className={styles.headerActions}>
            <button 
              className={styles.actionBtn}
              onClick={onClearAll}
              title="Clear all notifications"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        )}
      </div>

      <div className={styles.notificationList}>
        {displayNotifications.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔕</div>
            <h4>All caught up!</h4>
            <p>No new notifications at the moment.</p>
          </div>
        ) : (
          displayNotifications.map((notification, index) => (
            <div 
              key={notification.id || index}
              className={`${styles.notificationItem} ${getPriorityClass(notification.priority)} ${!notification.read ? styles.unread : ''}`}
              onClick={() => onNotificationClick?.(notification)}
            >
              <div className={styles.notificationIcon}>
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className={styles.notificationContent}>
                <div className={styles.notificationTitle}>
                  {notification.title}
                </div>
                <div className={styles.notificationMessage}>
                  {notification.message}
                </div>
                <div className={styles.notificationMeta}>
                  <span className={styles.notificationTime}>
                    {formatTime(notification.timestamp || notification.time)}
                  </span>
                  {notification.category && (
                    <span className={styles.notificationCategory}>
                      {notification.category}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.notificationActions}>
                {!notification.read && (
                  <button 
                    className={styles.markReadBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead?.(notification.id);
                    }}
                    title="Mark as read"
                  >
                    <i className="fas fa-check"></i>
                  </button>
                )}
                <div className={styles.priorityIndicator}></div>
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > maxDisplay && (
        <div className={styles.notificationFooter}>
          <button className={styles.viewAllBtn}>
            View All ({notifications.length - maxDisplay} more)
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
