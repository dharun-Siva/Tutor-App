import React, { useState, useEffect } from 'react';
import styles from './SessionCard.module.css';

const SessionCard = ({ 
  session, 
  onJoin, 
  onEdit, 
  onCancel, 
  onViewDetails,
  showActions = true,
  compact = false 
}) => {
  const [timeUntilStart, setTimeUntilStart] = useState(null);
  const [isStartingSoon, setIsStartingSoon] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const startTime = new Date(session.scheduledStartTime);
      const timeDiff = startTime.getTime() - now.getTime();
      
      setTimeUntilStart(timeDiff);
      setIsStartingSoon(timeDiff <= 15 * 60 * 1000 && timeDiff > 0); // 15 minutes
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [session.scheduledStartTime]);

  const formatTimeUntil = (milliseconds) => {
    if (milliseconds <= 0) return 'Started';
    
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getStatusColor = () => {
    if (session.status === 'completed') return 'success';
    if (session.status === 'cancelled') return 'danger';
    if (session.status === 'in_progress') return 'warning';
    if (isStartingSoon) return 'warning';
    return 'primary';
  };

  const getStatusIcon = () => {
    if (session.status === 'completed') return 'fa-check-circle';
    if (session.status === 'cancelled') return 'fa-times-circle';
    if (session.status === 'in_progress') return 'fa-play-circle';
    if (isStartingSoon) return 'fa-clock';
    return 'fa-calendar';
  };

  const canJoinSession = () => {
    return session.canJoin && timeUntilStart <= 15 * 60 * 1000 && timeUntilStart > -30 * 60 * 1000;
  };

  const handleJoinClick = () => {
    if (onJoin && canJoinSession()) {
      onJoin(session);
    }
  };

  const cardClasses = [
    styles.sessionCard,
    compact ? styles.compact : '',
    isStartingSoon ? styles.startingSoon : '',
    session.status === 'in_progress' ? styles.inProgress : '',
    session.status === 'completed' ? styles.completed : '',
    session.status === 'cancelled' ? styles.cancelled : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses}>
      <div className={styles.sessionHeader}>
        <div className={styles.sessionInfo}>
          <h4 className={styles.sessionTitle}>
            {session.className || session.title}
            <span className={`${styles.statusBadge} badge badge-${getStatusColor()}`}>
              <i className={`fas ${getStatusIcon()}`}></i>
              {session.status || 'scheduled'}
            </span>
          </h4>
          
          {session.subject && (
            <p className={styles.sessionSubject}>
              <i className="fas fa-book mr-1"></i>
              {session.subject}
            </p>
          )}
          
          {session.description && (
            <p className={styles.sessionDescription}>{session.description}</p>
          )}
        </div>
        
        <div className={styles.sessionTiming}>
          <div className={styles.scheduledTime}>
            <i className="fas fa-clock mr-1"></i>
            {new Date(session.scheduledStartTime).toLocaleString()}
          </div>
          
          {timeUntilStart !== null && timeUntilStart > 0 && (
            <div className={`${styles.timeUntil} ${isStartingSoon ? styles.urgent : ''}`}>
              {isStartingSoon ? 'Starting in ' : 'Starts in '}
              {formatTimeUntil(timeUntilStart)}
            </div>
          )}
          
          {timeUntilStart !== null && timeUntilStart <= 0 && timeUntilStart > -30 * 60 * 1000 && (
            <div className={styles.timeUntil}>
              <span className="text-success">Session is live!</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.sessionMeta}>
        <div className={styles.sessionDetails}>
          {session.duration && (
            <span className={styles.metaItem}>
              <i className="fas fa-hourglass-half"></i>
              {session.duration} min
            </span>
          )}
          
          {session.studentCount !== undefined && (
            <span className={styles.metaItem}>
              <i className="fas fa-users"></i>
              {session.studentCount} students
            </span>
          )}
          
          {session.meetingPlatform && (
            <span className={styles.metaItem}>
              <i className="fas fa-video"></i>
              {session.meetingPlatform}
            </span>
          )}
          
          {session.location && (
            <span className={styles.metaItem}>
              <i className="fas fa-map-marker-alt"></i>
              {session.location}
            </span>
          )}
        </div>
      </div>

      {session.notes && (
        <div className={styles.sessionNotes}>
          <i className="fas fa-sticky-note mr-1"></i>
          {session.notes}
        </div>
      )}

      {session.participants && session.participants.length > 0 && (
        <div className={styles.sessionParticipants}>
          <div className={styles.participantsHeader}>
            <i className="fas fa-users mr-1"></i>
            Participants ({session.participants.length})
          </div>
          <div className={styles.participantsList}>
            {session.participants.slice(0, 3).map((participant, index) => (
              <div key={index} className={styles.participantItem}>
                <div className={styles.participantAvatar}>
                  {participant.name?.charAt(0) || 'U'}
                </div>
                <span className={styles.participantName}>
                  {participant.name || 'Unknown'}
                </span>
                <span className={`${styles.participantStatus} ${styles[participant.status]}`}>
                  {participant.status}
                </span>
              </div>
            ))}
            {session.participants.length > 3 && (
              <div className={styles.participantItem}>
                <span className="text-muted">
                  +{session.participants.length - 3} more
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {showActions && (
        <div className={styles.sessionActions}>
          {canJoinSession() && (
            <button 
              className="btn btn-success btn-sm"
              onClick={handleJoinClick}
            >
              <i className="fas fa-video mr-1"></i>
              Join Session
            </button>
          )}
          
          {session.status === 'scheduled' && timeUntilStart > 60 * 60 * 1000 && ( // More than 1 hour
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={() => onEdit && onEdit(session)}
            >
              <i className="fas fa-edit mr-1"></i>
              Edit
            </button>
          )}
          
          <button 
            className="btn btn-outline-info btn-sm"
            onClick={() => onViewDetails && onViewDetails(session)}
          >
            <i className="fas fa-info-circle mr-1"></i>
            Details
          </button>
          
          {session.status === 'scheduled' && (
            <button 
              className="btn btn-outline-danger btn-sm"
              onClick={() => onCancel && onCancel(session)}
            >
              <i className="fas fa-times mr-1"></i>
              Cancel
            </button>
          )}
          
          {session.meetingUrl && (
            <a 
              href={session.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-secondary btn-sm"
            >
              <i className="fas fa-external-link-alt mr-1"></i>
              Meeting Link
            </a>
          )}
        </div>
      )}
      
      {isStartingSoon && (
        <div className={styles.urgentNotice}>
          <i className="fas fa-exclamation-triangle mr-1"></i>
          Session starting soon! Students may be waiting.
        </div>
      )}
    </div>
  );
};

export default SessionCard;
