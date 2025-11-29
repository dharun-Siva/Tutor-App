import React, { useEffect, useState, useMemo } from 'react';
import { getStoredUser, clearStoredAuth, formatRelativeTime } from '../../utils/helpers';
import styles from './Header.module.css';

const Header = ({ title, subtitle, showUserInfo = true, actions = null, user: propUser }) => {
  const storedUser = useMemo(() => getStoredUser(), []);
  const user = propUser || storedUser;
  const [centerLogo, setCenterLogo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoFetchAttempted, setLogoFetchAttempted] = useState(false);

  useEffect(() => {
    // Only fetch logo once per component mount
    if (logoFetchAttempted) return;
    
    // Fetch center logo if user is admin, student, parent, or tutor and has a center
    if (user && (user.role === 'admin' || user.role === 'student' || user.role === 'parent' || user.role === 'tutor') && user.center_id) {
      setLogoFetchAttempted(true);
      fetchCenterLogo(user.center_id);
    } else if (user && !user.center_id) {
      setLogoFetchAttempted(true);
    }
  }, [logoFetchAttempted, user]);

  const fetchCenterLogo = async (centerId) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/centers/${centerId}/logo`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.logoUrl) {
          setCenterLogo(data.data.logoUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching center logo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuth();
    window.location.href = '/login';
  };

  const getRoleColor = (role) => {
    const colors = {
      superadmin: 'badgeDanger',
      admin: 'badgePrimary',
      tutor: 'badgeSuccess',
      parent: 'badgeWarning',
      student: 'badgeInfo'
    };
    return colors[role] || 'badgeSecondary';
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            {centerLogo && user && (user.role === 'admin' || user.role === 'student' || user.role === 'parent' || user.role === 'tutor') && (
              <div className={styles.logoContainer}>
                <img src={centerLogo} alt="Center Logo" className={styles.centerLogo} />
              </div>
            )}
            <div className={styles.headerTitleSection}>
              <h1 className={styles.headerTitle}>{title}</h1>
              {subtitle && <p className={styles.headerSubtitle}>{subtitle}</p>}
            </div>
          </div>
          
          {actions && (
            <div className={styles.headerActions}>
              {actions}
            </div>
          )}

          {showUserInfo && user && (
            <div className={styles.headerUser}>
              <div className={styles.userAvatar}>
                {((user.fullName || user.username) || '').charAt(0).toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userDetails}>
                  <span className={styles.userName}>{user.fullName || user.username}</span>
                  <span className={`${styles.roleBadge} ${styles[getRoleColor(user.role)]}`}>
                    {user.role === 'superadmin' ? 'Super Admin' : (user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '')}
                  </span>
                </div>
                {user.lastLogin && (
                  <div className={styles.userLastLogin}>
                    Last login: {formatRelativeTime(user.lastLogin)}
                  </div>
                )}
              </div>
              <button 
                className={styles.logoutBtn}
                onClick={handleLogout}
                title="Logout"
              >
                <span className={styles.logoutIcon}>🚪</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
