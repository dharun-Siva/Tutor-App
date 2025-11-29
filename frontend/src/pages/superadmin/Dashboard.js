import React, { useState, useEffect, lazy, Suspense } from 'react';
import Header from '../../shared/components/Header';
import StatsCard from '../../shared/components/StatsCard';
import LoadingSpinner from '../../shared/components/LoadingSpinner';
import SystemHealth from './components/SystemHealth';
import CenterManagement from './components/CenterManagement';
import { dashboardAPI } from '../../utils/api';
import { getErrorMessage, formatMemoryUsage, formatUptime } from '../../utils/helpers';
import styles from './Dashboard.module.css';
const UserManagement = lazy(() => import('./components/UserManagement'));

const SuperAdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getSuperAdminData();
      console.log('Dashboard API Response:', response);
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  if (loading && !dashboardData) {
    return <LoadingSpinner fullScreen message="Loading SuperAdmin Dashboard..." />;
  }

  if (error) {
    return (
      <div className="dashboard">
        <Header title="SuperAdmin Dashboard" />
        <div className="container">
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
            <button className="btn btn-sm btn-outline ml-3" onClick={handleRefresh}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { data } = dashboardData || {};

  return (
    <div className={styles.dashboard}>
      <Header 
        title="SuperAdmin Dashboard" 
        subtitle="Complete system overview and management"
        actions={
          <button 
            className={`${styles.refreshBtn}`} 
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh Dashboard Data"
          >
            {loading ? (
              <div className={styles.spinner}></div>
            ) : (
              <span className={styles.refreshIcon}>🔄</span>
            )}
            Refresh
          </button>
        }
      />
      
      <div className={styles.container}>
        <div className={styles.dashboardContent}>
          {/* Key Metrics Overview */}
          <div className={styles.metricsSection}>
            <h2 className={styles.sectionTitle}>📊 System Overview</h2>
            <div className={styles.statsGrid}>
              <StatsCard
                title="Total Active Users"
                value={(data?.activeTutors || 0) + (data?.activeStudents || 0) + (data?.activeParents || 0) + (data?.activeAdmins || 0)}
                icon="👥"
                color="primary"
                subtitle={`${data?.activeTutors || 0} tutors, ${data?.activeStudents || 0} students, ${data?.activeParents || 0} parents`}
                trend={`${data?.activeAdmins || 0} active admins`}
              />
              <StatsCard
                title="Learning Centers"
                value={data?.activeCenters || 0}
                icon="🏢"
                color="success"
                subtitle={`${data?.totalCenters || 0} total centers`}
                trend={`${data?.activeCenters || 0} active centers`}
              />
              <StatsCard
                title="Active Admins"
                value={data?.activeAdmins || 0}
                icon="⚙️"
                color="info"
                subtitle="Active administrators"
                trend={`Total admins: ${data?.totalAdmins || 0}`}
              />
              <StatsCard
                title="System Health"
                value={formatUptime(data?.systemHealth?.uptime)}
                icon="💚"
                color="success"
                subtitle="Server uptime"
                trend="Running smoothly"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.quickActions}>
            <h3 className={styles.sectionTitle}>⚡ Quick Actions</h3>
            <div className={styles.actionCards}>
              <div className={`${styles.actionCard} ${styles.primaryAction}`} onClick={() => setActiveTab('centers')}>
                <div className={styles.actionIcon}>🏢</div>
                <div className={styles.actionContent}>
                  <h4>Manage Centers</h4>
                  <p>Create new centers and assign administrators</p>
                  <span className={styles.actionBadge}>
                    {data?.centersWithoutAdmin || 0} need attention
                  </span>
                </div>
              </div>
              
              <div className={`${styles.actionCard} ${styles.tertiaryAction}`} onClick={() => setActiveTab('system')}>
                <div className={styles.actionIcon}>📈</div>
                <div className={styles.actionContent}>
                  <h4>System Analytics</h4>
                  <p>Monitor system health and performance</p>
                  <span className={styles.actionBadge}>
                    {data?.systemHealth?.status === 'healthy' ? 'Healthy' : 'Issues'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          {/* Tab Navigation */}
          <div className={styles.tabNavigation}>
            <div className={styles.tabs}>
              <button 
                className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                📊 Overview
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'centers' ? styles.active : ''}`}
                onClick={() => setActiveTab('centers')}
              >
                🏢 Centers {data?.centersWithoutAdmin > 0 && <span className={styles.notificationBadge}>{data.centersWithoutAdmin}</span>}
              </button>
              {/* Users tab removed: now only accessible as a sub-tab under Centers */}
              <button 
                className={`${styles.tabButton} ${activeTab === 'system' ? styles.active : ''}`}
                onClick={() => setActiveTab('system')}
              >
                🔧 System
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === 'overview' && (
              <div className={styles.overviewContent}>
                <div className={styles.dashboardGrid}>
                  {/* User Distribution Chart */}
                  <div className={styles.chartCard}>
                    <div className={styles.cardHeader}>
                      <h3>👥 User Distribution</h3>
                      <span className={styles.totalCount}>Total: {data?.totalUsers}</span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.userDistribution}>
                        {data?.usersByRole && Object.entries(data.usersByRole).map(([role, count]) => {
                          const total = data.totalUsers;
                          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                          
                          const roleIcons = {
                            admins: '⚙️',
                            tutors: '👨‍🏫',
                            students: '👨‍🎓',
                            parents: '👨‍👩‍👧‍👦'
                          };
                          
                          return (
                            <div key={role} className={styles.distributionItem}>
                              <div className={styles.roleInfo}>
                                <span className={styles.roleIcon}>{roleIcons[role]}</span>
                                <span className={styles.roleName}>{(role ? role.charAt(0).toUpperCase() + role.slice(1) : '')}</span>
                                <span className={styles.roleCount}>{count} ({percentage}%)</span>
                              </div>
                              <div className={styles.progressBar}>
                                <div 
                                  className={styles.progressFill} 
                                  style={{ 
                                    width: `${percentage}%`,
                                    backgroundColor: percentage > 40 ? '#28a745' : percentage > 20 ? '#ffc107' : '#dc3545'
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Recent Centers */}
                  <div className={styles.chartCard}>
                    <div className={styles.cardHeader}>
                      <h3>🏢 Recent Centers</h3>
                      <span className={styles.totalCount}>{data?.totalCenters} total</span>
                    </div>
                    <div className={styles.cardBody}>
                      {data?.recentCenters && data.recentCenters.length > 0 ? (
                        <div className={styles.recentCenters}>
                          {data.recentCenters.map(center => (
                            <div key={center._id} className={styles.recentCenterItem}>
                              <div className={styles.centerHeader}>
                                <div className={styles.centerName}>{center.name}</div>
                                <span className={center.admin ? styles.adminAssigned : styles.adminNeeded}>
                                  {center.admin ? '✅' : '⚠️'}
                                </span>
                              </div>
                              <div className={styles.centerLocation}>
                                📍 {center.location.city}, {center.location.state}
                              </div>
                              <div className={styles.centerAdmin}>
                                👤 {center.admin ? center.admin.fullName : 'Admin needed'}
                              </div>
                              <div className={styles.centerDate}>
                                📅 {new Date(center.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.noData}>
                          <div className={styles.noDataIcon}>🏢</div>
                          <p>No centers created yet</p>
                          <button 
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={() => setActiveTab('centers')}
                          >
                            Create First Center
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* System Status */}
                  <div className={styles.chartCard}>
                    <div className={styles.cardHeader}>
                      <h3>🔧 System Status</h3>
                      <span className={`${styles.statusBadge} ${styles.healthy}`}>
                        {data?.systemHealth?.status === 'healthy' ? 'Healthy' : 'Issues'}
                      </span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.systemStats}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Uptime</span>
                          <span className={styles.statValue}>{formatUptime(data?.systemHealth?.uptime)}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Memory</span>
                          <span className={styles.statValue}>
                            {formatMemoryUsage(data?.systemHealth?.memory?.used)} used
                          </span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Environment</span>
                          <span className={styles.statValue}>Development</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className={styles.chartCard}>
                    <div className={styles.cardHeader}>
                      <h3>📋 Recent Activity</h3>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.activityList}>
                        {data?.recentUsers && data.recentUsers.slice(0, 5).map(user => (
                          <div key={user._id} className={styles.activityItem}>
                            <div className={styles.activityIcon}>
                              {user.role === 'admin' ? '⚙️' : 
                               user.role === 'tutor' ? '👨‍🏫' : 
                               user.role === 'student' ? '👨‍🎓' : '👨‍👩‍👧‍👦'}
                            </div>
                            <div className={styles.activityContent}>
                              <div className={styles.activityTitle}>
                                New {user.role} registered
                              </div>
                              <div className={styles.activityDetails}>
                                {user.fullName} ({user.email})
                              </div>
                              <div className={styles.activityTime}>
                                {new Date(user.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'centers' && (
              <CenterManagement />
            )}

            {/* Users tab content removed: now only accessible as a sub-tab under Centers */}

            {activeTab === 'system' && (
              <div className={styles.systemSection}>
                <SystemHealth 
                  healthData={data?.systemHealth} 
                  detailed={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
