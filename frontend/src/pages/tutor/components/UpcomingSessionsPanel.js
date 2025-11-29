import React, { useState, useEffect } from 'react';
import SessionCard from './SessionCard';
import styles from './UpcomingSessionsPanel.module.css';

const UpcomingSessionsPanel = ({ 
  sessions = [], 
  onJoinSession, 
  onEditSession, 
  onCancelSession,
  onCreateSession,
  loading = false,
  error = null,
  onRefresh
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filter, setFilter] = useState('all'); // all, today, tomorrow, thisWeek
  const [sortBy, setSortBy] = useState('time'); // time, priority

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const filterSessions = (sessions) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'today':
        return sessions.filter(session => {
          const sessionDate = new Date(session.scheduledStartTime);
          return sessionDate >= today && sessionDate < tomorrow;
        });
      case 'tomorrow':
        return sessions.filter(session => {
          const sessionDate = new Date(session.scheduledStartTime);
          const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
          return sessionDate >= tomorrow && sessionDate < dayAfterTomorrow;
        });
      case 'thisWeek':
        return sessions.filter(session => {
          const sessionDate = new Date(session.scheduledStartTime);
          return sessionDate >= now && sessionDate <= weekFromNow;
        });
      default:
        return sessions.filter(session => {
          const sessionDate = new Date(session.scheduledStartTime);
          return sessionDate >= now;
        });
    }
  };

  const sortSessions = (sessions) => {
    switch (sortBy) {
      case 'priority':
        return [...sessions].sort((a, b) => {
          // Sort by: can join > starting soon > future sessions
          const aCanJoin = a.canJoin ? 3 : 0;
          const bCanJoin = b.canJoin ? 3 : 0;
          
          const aTimeUntil = new Date(a.scheduledStartTime).getTime() - currentTime.getTime();
          const bTimeUntil = new Date(b.scheduledStartTime).getTime() - currentTime.getTime();
          
          const aStartingSoon = aTimeUntil <= 60 * 60 * 1000 ? 2 : 1; // 1 hour
          const bStartingSoon = bTimeUntil <= 60 * 60 * 1000 ? 2 : 1;
          
          const aPriority = aCanJoin + aStartingSoon;
          const bPriority = bCanJoin + bStartingSoon;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          return new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime);
        });
      default:
        return [...sessions].sort((a, b) => 
          new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime)
        );
    }
  };

  const getSessionsToShow = () => {
    const filtered = filterSessions(sessions);
    return sortSessions(filtered);
  };

  const getFilterCount = (filterType) => {
    return filterSessions(sessions).length;
  };

  const getNextSession = () => {
    const upcomingSessions = sessions
      .filter(session => new Date(session.scheduledStartTime) > currentTime)
      .sort((a, b) => new Date(a.scheduledStartTime) - new Date(b.scheduledStartTime));
    
    return upcomingSessions[0] || null;
  };

  const handleJoinSession = (session) => {
    if (onJoinSession) {
      onJoinSession(session._id || session.id);
    }
  };

  const handleViewDetails = (session) => {
    // Open session details modal or navigate to details page
    console.log('View session details:', session);
  };

  const sessionsToShow = getSessionsToShow();
  const nextSession = getNextSession();
  const hasJoinableSessions = sessions.some(s => s.canJoin);

  if (loading) {
    return (
      <div className={styles.upcomingSessionsPanel}>
        <div className={styles.loadingState}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading sessions...</span>
          </div>
          <p>Loading your upcoming sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.upcomingSessionsPanel}>
        <div className={styles.errorState}>
          <i className="fas fa-exclamation-triangle fa-2x text-danger mb-2"></i>
          <h4>Unable to load sessions</h4>
          <p className="text-muted">{error}</p>
          <button className="btn btn-outline-primary btn-sm" onClick={onRefresh}>
            <i className="fas fa-redo"></i> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.upcomingSessionsPanel}>
      <div className={styles.panelHeader}>
        <div className={styles.headerTitle}>
          <h3>
            <i className="fas fa-calendar-alt mr-2"></i>
            Upcoming Sessions
            {sessions.length > 0 && (
              <span className={styles.sessionCount}>{sessions.length}</span>
            )}
          </h3>
          {hasJoinableSessions && (
            <div className={styles.joinableAlert}>
              <i className="fas fa-exclamation-circle mr-1"></i>
              Sessions ready to join!
            </div>
          )}
        </div>
        
        <div className={styles.headerActions}>
          <button 
            className="btn btn-success btn-sm mr-2"
            onClick={onCreateSession}
          >
            <i className="fas fa-plus"></i> New Session
          </button>
          <button 
            className="btn btn-outline-secondary btn-sm"
            onClick={onRefresh}
          >
            <i className="fas fa-sync"></i>
          </button>
        </div>
      </div>

      {/* Next Session Alert */}
      {nextSession && (
        <div className={styles.nextSessionAlert}>
          <div className={styles.alertContent}>
            <div className={styles.alertIcon}>
              <i className="fas fa-clock"></i>
            </div>
            <div className={styles.alertInfo}>
              <strong>Next Session:</strong> {nextSession.className} at{' '}
              {new Date(nextSession.scheduledStartTime).toLocaleTimeString()}
              {nextSession.canJoin && (
                <button 
                  className="btn btn-success btn-xs ml-2"
                  onClick={() => handleJoinSession(nextSession)}
                >
                  Join Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Sort */}
      <div className={styles.controlsBar}>
        <div className={styles.filterTabs}>
          <button 
            className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({getFilterCount('all')})
          </button>
          <button 
            className={`${styles.filterTab} ${filter === 'today' ? styles.active : ''}`}
            onClick={() => setFilter('today')}
          >
            Today ({getFilterCount('today')})
          </button>
          <button 
            className={`${styles.filterTab} ${filter === 'tomorrow' ? styles.active : ''}`}
            onClick={() => setFilter('tomorrow')}
          >
            Tomorrow ({getFilterCount('tomorrow')})
          </button>
          <button 
            className={`${styles.filterTab} ${filter === 'thisWeek' ? styles.active : ''}`}
            onClick={() => setFilter('thisWeek')}
          >
            This Week ({getFilterCount('thisWeek')})
          </button>
        </div>
        
        <div className={styles.sortControls}>
          <label className="mr-2">Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control form-control-sm"
          >
            <option value="time">Time</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      <div className={styles.sessionsList}>
        {sessionsToShow.length === 0 ? (
          <div className={styles.emptyState}>
            <i className="fas fa-calendar-times fa-3x text-muted mb-3"></i>
            <h4>No sessions {filter !== 'all' ? `for ${filter}` : 'scheduled'}</h4>
            <p className="text-muted">
              {filter !== 'all' 
                ? `No sessions found for ${filter}. Try changing the filter.`
                : 'Schedule your first session to get started with your students.'
              }
            </p>
            <button className="btn btn-primary" onClick={onCreateSession}>
              <i className="fas fa-plus"></i> Schedule Session
            </button>
          </div>
        ) : (
          sessionsToShow.map((session) => (
            <SessionCard
              key={session._id || session.id}
              session={session}
              onJoin={handleJoinSession}
              onEdit={onEditSession}
              onCancel={onCancelSession}
              onViewDetails={handleViewDetails}
              showActions={true}
            />
          ))
        )}
      </div>

      {/* Load More */}
      {sessionsToShow.length > 5 && (
        <div className={styles.loadMoreSection}>
          <button className="btn btn-outline-primary">
            View All Sessions ({sessions.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default UpcomingSessionsPanel;
