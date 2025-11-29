import React, { useState, useEffect } from 'react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { centersAPI, usersAPI } from '../../../utils/api';
import { getErrorMessage } from '../../../utils/helpers';
import styles from './CenterManagement.module.css';

const CenterManagement = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('centers');
  
  // Centers state
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [availableAdmins, setAvailableAdmins] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoSuccess, setLogoSuccess] = useState(null);
  
  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Load centers and admins once on component mount
    loadCenters();
    loadAvailableAdmins();
  }, []);

  // Load users when switching to users tab
  useEffect(() => {
    if (activeTab === 'users') {
      setHasSearched(true);
      setUsersError(null);
      loadUsers();
    }
  }, [activeTab]);

  // Remove automatic loading when search terms change
  // Users will only load when search button is clicked

  const AdminManagementModal = ({ center, availableAdmins, onClose, onCreateAdmin, onAssignAdmin }) => {
    const [activeTab, setActiveTab] = useState('create');
    const [submitting, setSubmitting] = useState(false);
    const [newAdminData, setNewAdminData] = useState({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      phoneNumber: ''
    });

    const handleCreateAdmin = async (e) => {
      e.preventDefault();
      if (newAdminData.password !== newAdminData.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      setSubmitting(true);
      try {
        await onCreateAdmin(newAdminData);
      } finally {
        setSubmitting(false);
      }
    };

    const handleAssignAdmin = async (adminId) => {
      setSubmitting(true);
      try {
        await onAssignAdmin(adminId);
      } finally {
        setSubmitting(false);
      }
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setNewAdminData(prev => ({
        ...prev,
        [name]: value
      }));
    };

    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3>👨‍💼 Manage Admin for {center.name}</h3>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div className={styles.modalTabs}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'assign' ? styles.active : ''}`}
              onClick={() => setActiveTab('assign')}
            >
              Assign Existing Admin
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'create' ? styles.active : ''}`}
              onClick={() => setActiveTab('create')}
            >
              Create New Admin
            </button>
          </div>

          {activeTab === 'assign' && (
            <div className={styles.modalContent}>
              {availableAdmins.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No available admins to assign.</p>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setActiveTab('create')}
                  >
                    Create New Admin
                  </button>
                </div>
              ) : (
                <div className={styles.adminsList}>
                  <h4>Available Admins</h4>
                  {availableAdmins.map((admin) => (
                    <div key={admin._id} className={styles.adminItem}>
                      <div className={styles.adminInfo}>
                        <div className={styles.adminName}>
                          {admin.firstName} {admin.lastName}
                        </div>
                        <div className={styles.adminEmail}>{admin.email}</div>
                        <div className={styles.adminPhone}>{admin.phoneNumber}</div>
                      </div>
                      <button
                        className={`${styles.btn} ${styles.btnSuccess}`}
                        onClick={() => handleAssignAdmin(admin.id)}
                        disabled={submitting}
                      >
                        {submitting ? 'Assigning...' : 'Assign'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className={styles.modalContent}>
              <form onSubmit={handleCreateAdmin} className={styles.modalForm}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="firstName" className={styles.required}>First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={newAdminData.firstName}
                      onChange={handleInputChange}
                      placeholder="First name"
                      className={styles.formInput}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="lastName" className={styles.required}>Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={newAdminData.lastName}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      className={styles.formInput}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="username" className={styles.required}>Username</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={newAdminData.username}
                    onChange={handleInputChange}
                    placeholder="admin123 (letters, numbers, underscores only)"
                    className={styles.formInput}
                    required
                  />
                  <small style={{color: '#666', fontSize: '0.8em'}}>
                    Only letters, numbers, and underscores allowed
                  </small>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.required}>Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={newAdminData.email}
                    onChange={handleInputChange}
                    placeholder="admin@center.com"
                    className={styles.formInput}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="phoneNumber">Phone</label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    name="phoneNumber"
                    value={newAdminData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="password" className={styles.required}>Password</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={newAdminData.password}
                      onChange={handleInputChange}
                      placeholder="Password123!"
                      className={styles.formInput}
                      required
                      minLength="8"
                    />
                    <small style={{color: '#666', fontSize: '0.75em', display: 'block', marginTop: '4px'}}>
                      8+ chars, uppercase, lowercase, number, special char (@$!%*?&)
                    </small>
                  </div>
                  <div className={styles.formGroup}>
                    <label htmlFor="confirmPassword" className={styles.required}>Confirm Password</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={newAdminData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Confirm password"
                      className={styles.formInput}
                      required
                      minLength="8"
                    />
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button 
                    type="button" 
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className={styles.spinner}></span>
                        Creating Admin...
                      </>
                    ) : (
                      'Create & Assign Admin'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  const loadCenters = async (params = {}) => {
    try {
      setLoading(true);
      const response = await centersAPI.getCenters({
        search: searchTerm,
        status: statusFilter === 'all' ? undefined : statusFilter,
        ...params
      });
      // Handle PostgreSQL response format
      const centersData = response.data;
      console.log('Fetched centers:', centersData);
      
      // Process centers
      const processedCenters = (Array.isArray(centersData) ? centersData : []).map(center => ({
        ...center,
        // Center is active if it has an assigned admin and status is active
        status: center.admin && center.status === 'active' ? 'active' : 'inactive'
      }));
      
      setCenters(processedCenters);
      setError(null);
    } catch (err) {
      console.error('Error loading centers:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableAdmins = async () => {
    try {
      const response = await centersAPI.getAvailableAdmins();
      setAvailableAdmins(response.data.data);
    } catch (err) {
      console.error('Failed to load available admins:', err);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      setHasSearched(true);
      
      // Use the general users API instead of admin-specific API
      const response = await usersAPI.getUsers({
        search: userSearchTerm,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: userStatusFilter !== 'all' ? userStatusFilter : undefined,
        center: centerFilter !== 'all' ? centerFilter : undefined,
        include: 'center,status,assignments' // Include additional data
      });
      
      const usersData = response.data.data || response.data;
      // Process the users data to ensure we have all required fields
      const processedUsers = usersData.map(user => {
        const isAdmin = user.role === 'admin';
        const isSuperAdmin = user.role === 'superadmin';
        
        // Check if admin has a center assignment
        const hasCenter = isAdmin ? Boolean(user.assignments?.center) : false;
        
        return {
          ...user,
          // Keep original isActive status for non-admin users
          isActive: isSuperAdmin ? true : (isAdmin ? hasCenter : user.isActive),
          assignments: {
            ...user.assignments,
            center: user.assignments?.center || null
          }
        };
      });
      setUsers(processedUsers);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsersError(getErrorMessage(err));
    } finally {
      setUsersLoading(false);
    }
  };

  // Keep the old loadAdmins function for admin-specific operations
  const loadAdmins = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      setHasSearched(true);
      const response = await usersAPI.getAdmins({
        search: userSearchTerm,
        center: centerFilter !== 'all' ? centerFilter : undefined
      });
      setUsers(response.data.data || response.data);
    } catch (err) {
      console.error('Failed to load users:', err);
      setUsersError(getErrorMessage(err));
    } finally {
      setUsersLoading(false);
    }
  };

  const handleReassignAdmin = async (adminId, newCenterId) => {
    try {
      await usersAPI.reassignAdmin(adminId, newCenterId);
      await loadUsers();
      await loadCenters(); // Refresh centers to update admin assignments
      alert('Admin reassigned successfully!');
    } catch (err) {
      alert('Failed to reassign admin: ' + getErrorMessage(err));
    }
  };

  const handleToggleAdminStatus = async (admin) => {
    try {
      await usersAPI.toggleUserStatus(admin._id);
      await loadUsers();
      alert(`Admin ${admin.isActive ? 'deactivated' : 'activated'} successfully!`);
    } catch (err) {
      alert('Failed to update admin status: ' + getErrorMessage(err));
    }
  };

  const handleToggleUserStatus = async (user) => {
    try {
      await usersAPI.toggleUserStatus(user._id);
      await loadUsers();
      alert(`User ${user.isActive ? 'deactivated' : 'activated'} successfully!`);
    } catch (err) {
      alert('Failed to update user status: ' + getErrorMessage(err));
    }
  };

  const handleViewUser = (user) => {
    // For now, just show an alert with user details
    // In the future, this could open a modal with detailed user information
    alert(`User Details:\nName: ${user.firstName} ${user.lastName}\nRole: ${user.role}\nEmail: ${user.email}\nStatus: ${user.isActive ? 'Active' : 'Inactive'}\nLast Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}`);
  };

  const openLogoModal = (center) => {
    setSelectedCenter(center);
    setLogoUrl(center.logoUrl || '');
    setLogoError(null);
    setLogoSuccess(null);
    setShowLogoModal(true);
  };

  const closeLogoModal = () => {
    setShowLogoModal(false);
    setSelectedCenter(null);
    setLogoUrl('');
    setLogoError(null);
    setLogoSuccess(null);
  };

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleUpdateLogo = async (file) => {
    if (!file) {
      setLogoError('No file selected');
      return;
    }

    if (!selectedCenter) {
      setLogoError('No center selected');
      return;
    }

    try {
      setLogoLoading(true);
      setLogoError(null);
      setLogoSuccess(null);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/centers/${selectedCenter.id}/logo-upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            // Don't set Content-Type, let the browser handle it for multipart/form-data
          },
          body: formData
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload logo');
      }

      const data = await response.json();
      setLogoSuccess(`Logo uploaded successfully! File: ${data.data.fileName}`);
      
      // Refresh centers to show updated logo
      await loadCenters();
      
      // Close modal after success
      setTimeout(() => {
        closeLogoModal();
      }, 1500);
    } catch (err) {
      console.error('Logo upload error:', err);
      setLogoError(err.message || 'Failed to upload logo');
    } finally {
      setLogoLoading(false);
    }
  };



  const handleCreateCenter = async (formData) => {
    try {
      // Validate required fields
      const requiredFields = ['name', 'location.address', 'location.city', 'location.state', 'contact.email'];
      const missingFields = requiredFields.filter(field => {
        const value = field.includes('.') ? 
          field.split('.').reduce((obj, key) => obj?.[key], formData) : 
          formData[field];
        return !value;
      });

      if (missingFields.length > 0) {
        alert('Please fill in all required fields: ' + missingFields.join(', '));
        return;
      }

      // Transform the nested form data to match the backend model
      const centerData = {
        name: formData.name.trim(),
        address: formData.location.address.trim(),
        city: formData.location.city.trim(),
        state: formData.location.state.trim(),
        country: (formData.location.country || 'US').trim(),
        zipCode: formData.location.zipCode?.trim() || '',
        email: formData.contact.email.trim(),
        phone: formData.contact.phone?.trim() || '',
        status: 'inactive', // Start as inactive until admin is assigned
      };

      console.log('Creating center with transformed data:', centerData);
      const response = await centersAPI.createCenter(centerData);
      console.log('Center created successfully:', response.data);
      
      setShowCreateModal(false);
      await loadCenters();
      alert('Center created successfully!');
    } catch (err) {
      console.error('Center creation error:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error occurred';
      alert('Failed to create center: ' + errorMessage);
    }
  };

  const handleUpdateCenter = async (centerData) => {
    try {
      await centersAPI.updateCenter(selectedCenter._id, centerData);
      setShowEditModal(false);
      setSelectedCenter(null);
      await loadCenters();
      alert('Center updated successfully!');
    } catch (err) {
      alert('Failed to update center: ' + getErrorMessage(err));
    }
  };

  const handleCreateAdmin = async (adminData) => {
    try {
      // Transform the nested adminData structure to flat structure expected by backend
      const transformedData = {
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        email: adminData.email,
        username: adminData.username,
        password: adminData.password,
        phoneNumber: adminData.phoneNumber
      };
      
      await centersAPI.createAndAssignAdmin(selectedCenter.id, transformedData);
      setShowAdminModal(false);
      setSelectedCenter(null);
      await Promise.all([loadCenters(), loadAvailableAdmins()]);
      alert('Admin created and assigned successfully!');
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      
      // Provide user-friendly error messages for common validation issues
      if (errorMessage.includes('Password must contain')) {
        alert('Password Requirements:\n' +
              '• At least 8 characters long\n' +
              '• At least one uppercase letter (A-Z)\n' +
              '• At least one lowercase letter (a-z)\n' +
              '• At least one number (0-9)\n' +
              '• At least one special character (@$!%*?&)\n\n' +
              'Current error: ' + errorMessage);
      } else if (errorMessage.includes('Username can only contain')) {
        alert('Username Requirements:\n' +
              '• Only letters, numbers, and underscores allowed\n' +
              '• No spaces or special characters like @ # $ %\n\n' +
              'Current error: ' + errorMessage);
      } else if (errorMessage.includes('already exists')) {
        alert('Account Creation Error:\n' +
              'The email address or username you entered is already in use.\n' +
              'Please try a different email address or username.\n\n' +
              'Error: ' + errorMessage);
      } else {
        alert('Failed to create admin:\n' + errorMessage);
      }
    }
  };

  const handleAssignExistingAdmin = async (adminId) => {
    try {
      console.log('Assigning admin:', { 
        centerId: selectedCenter.id, 
        adminId,
        center: selectedCenter 
      });
      
      await centersAPI.assignAdmin(selectedCenter.id, adminId);
      setShowAdminModal(false);
      setSelectedCenter(null);
      await Promise.all([loadCenters(), loadAvailableAdmins()]);
      alert('Admin assigned successfully!');
    } catch (err) {
      console.error('Assignment error:', err);
      alert('Failed to assign admin: ' + getErrorMessage(err));
    }
  };

  const handleToggleStatus = async (center) => {
    // Use window.confirm to explicitly access the global confirm function
    if (!window.confirm(`Are you sure you want to ${center.isActive ? 'deactivate' : 'reactivate'} ${center.name}?`)) {
      return;
    }

    try {
      if (center.isActive) {
        await centersAPI.deactivateCenter(center._id);
      } else {
        await centersAPI.reactivateCenter(center._id);
      }
      await loadCenters();
    } catch (err) {
      alert('Failed to update center status: ' + getErrorMessage(err));
    }
  };

  const handleDeleteCenter = async (center) => {
    // Use window.confirm to explicitly access the global confirm function
    if (!window.confirm(`Are you sure you want to delete ${center.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('Deleting center:', center);
      await centersAPI.deleteCenter(center.id);
      await loadCenters();
      alert('Center deleted successfully!');
    } catch (err) {
      alert('Failed to delete center: ' + getErrorMessage(err));
    }
  };

  const openEditModal = (center) => {
    setSelectedCenter(center);
    setShowEditModal(true);
  };

  const openAdminModal = (center) => {
    setSelectedCenter(center);
    setShowAdminModal(true);
  };

  const filteredCenters = centers.filter(center => {
    const matchesSearch = center.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         center.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         center.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         center.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         center.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading && centers.length === 0) {
    return <LoadingSpinner fullScreen message="Loading centers..." />;
  }

  return (
    <div className={styles.centerManagement}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Management Dashboard</h2>
        {activeTab === 'centers' && (
          <button 
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setShowCreateModal(true)}
          >
            <span>➕</span>
            Create New Center
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button 
          className={`${styles.tab} ${activeTab === 'centers' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('centers')}
        >
          🏢 Centers
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'users' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 Users
        </button>
      </div>

      {/* Centers Tab Content */}
      {activeTab === 'centers' && (
        <>
          {/* Search and Filter */}
          <div className={styles.filters}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search centers by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <button 
                onClick={() => loadCenters()} 
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                🔍 Search
              </button>
            </div>
            
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Centers</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <strong>⚠️ Error:</strong> {error}
              <button 
                className={`${styles.btn} ${styles.btnSm}`} 
                onClick={() => loadCenters()}
              >
                Retry
              </button>
            </div>
          )}

      {/* Centers List */}
      <div className={styles.centersList}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
            <p>Loading centers...</p>
          </div>
        ) : filteredCenters.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🏢</div>
            <h3>No Centers Found</h3>
            <p>
              {centers.length === 0 
                ? "No centers have been created yet." 
                : "No centers match your search criteria."
              }
            </p>
            <button 
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setShowCreateModal(true)}
            >
              Create First Center
            </button>
          </div>
        ) : (
          <div className={styles.centersTable}>
            <div className={styles.tableHeader}>
              <div className={styles.headerCell}>Center Name</div>
              <div className={styles.headerCell}>Location</div>
              <div className={styles.headerCell}>Contact</div>
              <div className={styles.headerCell}>Capacity</div>
              <div className={styles.headerCell}>Admin</div>
              <div className={styles.headerCell}>Status</div>
              <div className={styles.headerCell}>Actions</div>
            </div>
            
            {filteredCenters.map((center) => (
              <div key={center.id} className={styles.tableRow}>
                <div className={styles.tableCell}>
                  <div className={styles.centerName}>{center.name}</div>
                </div>
                
                <div className={styles.tableCell}>
                  <div className={styles.location}>
                    📍 {center.city}, {center.state}
                  </div>
                  <small className={styles.address}>
                    {center.address}
                  </small>
                </div>
                
                <div className={styles.tableCell}>
                  <div className={styles.contact}>
                    📧 {center.email}
                  </div>
                  <div className={styles.phone}>
                    📞 {center.phone}
                  </div>
                </div>
                
                <div className={styles.tableCell}>
                  <div className={styles.capacity}>
                    <span>Not configured</span>
                  </div>
                </div>
                
                <div className={styles.tableCell}>
                  {center.admin ? (
                    <div className={styles.adminAssigned}>
                      👤 {center.admin.firstName} {center.admin.lastName}
                      <small className={styles.adminEmail}>
                        {center.admin.email}
                      </small>
                    </div>
                  ) : (
                    <span className={styles.noAdmin}>❌ No admin assigned</span>
                  )}
                </div>
                
                <div className={styles.tableCell}>
                  <span className={`${styles.statusBadge} ${(center.status === 'active' && center.admin) ? styles.active : styles.inactive}`}>
                    {(center.status === 'active' && center.admin) ? '✅ Active' : '🔒 Inactive'}
                  </span>
                </div>
                
                <div className={`${styles.tableCell} ${styles.actionsCell}`}>
                  <div className={styles.actionButtons}>
                    <button
                      className={`${styles.btn} ${styles.btnEdit} ${styles.btnSm}`}
                      onClick={() => openEditModal(center)}
                      title="Edit Center"
                    >
                      ✏️
                    </button>
                    
                    <button
                      className={`${styles.btn} ${styles.btnAdmin} ${styles.btnSm}`}
                      onClick={() => openAdminModal(center)}
                      title="Manage Admin"
                    >
                      👨‍💼
                    </button>

                    <button
                      className={`${styles.btn} ${styles.btnLogo} ${styles.btnSm}`}
                      onClick={() => openLogoModal(center)}
                      title="Upload Logo"
                    >
                      🎨
                    </button>

                    <button
                      className={`${styles.btn} ${center.isActive ? styles.btnWarning : styles.btnSuccess} ${styles.btnSm}`}
                      onClick={() => handleToggleStatus(center)}
                      title={center.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {center.isActive ? '🔒' : '✅'}
                    </button>

                    <button
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                      onClick={() => handleDeleteCenter(center)}
                      title="Delete Center"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {/* Users Tab Content */}
      {activeTab === 'users' && (
        <>
          {/* Users Search and Filter */}
          <div className={styles.filters}>
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search users by name, email, or username..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadUsers()}
                className={styles.searchInput}
              />
              <button 
                onClick={() => loadUsers()} 
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                🔍 Search
              </button>
              {hasSearched && (
                <button 
                  onClick={() => {
                    setUserSearchTerm('');
                    setRoleFilter('all');
                    setUserStatusFilter('all');
                    setCenterFilter('all');
                    setHasSearched(false);
                    setUsers([]);
                    setUsersError(null);
                  }} 
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  style={{ marginLeft: '8px' }}
                >
                  🗑️ Clear
                </button>
              )}
            </div>
            
            <div className={styles.filtersRow} style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
              <select 
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Roles</option>
                <option value="superadmin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="tutor">Tutor</option>
                <option value="parent">Parent</option>
                <option value="student">Student</option>
              </select>

              <select 
                value={userStatusFilter} 
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <select 
                value={centerFilter} 
                onChange={(e) => setCenterFilter(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Centers</option>
                <option value="unassigned">Unassigned</option>
                {centers.map(center => (
                  <option key={center._id} value={center._id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {usersError && (
            <div className={styles.errorAlert}>
              <strong>⚠️ Error:</strong> {usersError}
              <button 
                className={`${styles.btn} ${styles.btnSm}`} 
                onClick={() => loadUsers()}
              >
                Retry
              </button>
            </div>
          )}

          {/* Users List */}
          <div className={styles.centersList}>
            {usersLoading ? (
              <div className={styles.loadingContainer}>
                <LoadingSpinner />
                <p>Loading users...</p>
              </div>
            ) : !hasSearched ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <h3>Search Users</h3>
                <p>Use the search filters above and click "Search" to find users across all roles.</p>
              </div>
            ) : users.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <h3>No Users Found</h3>
                <p>No users match your search criteria.</p>
              </div>
            ) : (
              <div className={styles.centersTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.headerCell}>User Name</div>
                  <div className={styles.headerCell}>Role</div>
                  <div className={styles.headerCell}>Contact</div>
                  <div className={styles.headerCell}>Assignment</div>
                  <div className={styles.headerCell}>Status</div>
                  <div className={styles.headerCell}>Last Login</div>
                  <div className={styles.headerCell}>Actions</div>
                </div>
                
                {users.map((user) => (
                  <div key={user._id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <div className={styles.centerName}>
                        {user.firstName} {user.lastName}
                      </div>
                      <div className={styles.centerDescription}>
                        <small className={styles.description}>
                          @{user.username}
                        </small>
                      </div>
                    </div>
                    
                    <div className={styles.tableCell}>
                      <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                        {user.role === 'superadmin' && '👑 Super Admin'}
                        {user.role === 'admin' && '👨‍💼 Admin'}
                        {user.role === 'tutor' && '👨‍🏫 Tutor'}
                        {user.role === 'parent' && '👨‍👩‍👧‍👦 Parent'}
                        {user.role === 'student' && '🎓 Student'}
                      </span>
                    </div>
                    
                    <div className={styles.tableCell}>
                      <div className={styles.contact}>
                        📧 {user.email}
                      </div>
                      {user.phoneNumber && (
                        <div className={styles.phone}>
                          📞 {user.phoneNumber}
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.tableCell}>
                      {user.role === 'superadmin' ? (
  <span className={styles.superadminStatus}>✅ System Admin</span>
) : user.role === 'admin' ? (
  <div className={styles.adminAssigned}>
    {user.center_id ? (
      <span className={styles.assignmentStatus}>
        🏢 {user.center_name || 'Assigned Center'}
      </span>
    ) : (
      <span className={styles.noAdmin}>❌ Not assigned</span>
    )}
  </div>
) : user.role === 'tutor' || user.role === 'student' ? (
  <div className={styles.classAssignments}>
    {user.assignments?.classes?.length > 0 ? (
      <span className={styles.classCount}>
        📚 {user.assignments.classes.length} class{user.assignments.classes.length !== 1 ? 'es' : ''}
      </span>
    ) : (
      <span className={styles.noAdmin}>❌ Not assigned</span>
    )}
  </div>
) : (
  <span className={styles.noAdmin}>❌ Not assigned</span>
)}
                    </div>
                    
                    <div className={styles.tableCell}>
                      <span className={`${styles.statusBadge} ${
                        user.role === 'superadmin' || 
                        (user.role === 'admin' && user.center_id) ||
                        (user.role !== 'admin' && user.isActive)
                          ? styles.active 
                          : styles.inactive
                      }`}>
                        {user.role === 'superadmin' 
                          ? '✅ Active'
                          : user.role === 'admin'
                            ? user.center_id
                              ? '✅ Active'
                              : '🔒 Inactive'
                            : user.isActive
                              ? '✅ Active'
                              : '🔒 Inactive'
                        }
                      </span>
                    </div>
                    
                    <div className={styles.tableCell}>
                      {user.lastLogin ? (
                        <span className={styles.lastLogin}>
                          {new Date(user.lastLogin).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className={styles.noLogin}>Never</span>
                      )}
                    </div>
                    
                    <div className={`${styles.tableCell} ${styles.actionsCell}`}>
                      <div className={styles.actionButtons}>
                        <button
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                          onClick={() => handleViewUser(user)}
                          title="View Details"
                        >
                          👁️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Center Modal */}
      {showCreateModal && (
        <CreateCenterModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateCenter}
        />
      )}

      {/* Edit Center Modal */}
      {showEditModal && selectedCenter && (
        <EditCenterModal
          center={selectedCenter}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCenter(null);
          }}
          onSubmit={handleUpdateCenter}
        />
      )}

      {/* Admin Management Modal */}
      {showAdminModal && selectedCenter && (
        <AdminManagementModal
          center={selectedCenter}
          availableAdmins={availableAdmins}
          onClose={() => {
            setShowAdminModal(false);
            setSelectedCenter(null);
          }}
          onCreateAdmin={handleCreateAdmin}
          onAssignAdmin={handleAssignExistingAdmin}
        />
      )}

      {/* Logo Upload Modal */}
      {showLogoModal && selectedCenter && (
        <LogoUploadModal
          center={selectedCenter}
          logoUrl={logoUrl}
          setLogoUrl={setLogoUrl}
          onSubmit={handleUpdateLogo}
          onClose={closeLogoModal}
          loading={logoLoading}
          error={logoError}
          success={logoSuccess}
        />
      )}
    </div>
  );
};

// Modal Components

// Create Center Modal Component
const CreateCenterModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    location: {
      address: '',
      city: '',
      state: '',
      zipCode: ''
    },
    contact: {
      email: '',
      phone: '',
      website: ''
    },
    capacity: {
      maxStudents: 100,
      maxTutors: 10
    },
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.location.city || !formData.location.state || !formData.location.zipCode || !formData.contact.email || !formData.contact.phone) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>🏢 Create New Center</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.modalContent}>
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.required}>Center Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter center name"
                className={styles.formInput}
                required
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="location.city" className={styles.required}>City</label>
                <input
                  type="text"
                  id="location.city"
                  name="location.city"
                  value={formData.location.city}
                  onChange={handleChange}
                  placeholder="City"
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="location.state" className={styles.required}>State</label>
                <input
                  type="text"
                  id="location.state"
                  name="location.state"
                  value={formData.location.state}
                  onChange={handleChange}
                  placeholder="State"
                  className={styles.formInput}
                  required
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="location.zipCode" className={styles.required}>ZIP Code</label>
                <input
                  type="text"
                  id="location.zipCode"
                  name="location.zipCode"
                  value={formData.location.zipCode}
                  onChange={handleChange}
                  placeholder="12345"
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="location.address">Address</label>
                <input
                  type="text"
                  id="location.address"
                  name="location.address"
                  value={formData.location.address}
                  onChange={handleChange}
                  placeholder="Street address"
                  className={styles.formInput}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="contact.email" className={styles.required}>Email</label>
                <input
                  type="email"
                  id="contact.email"
                  name="contact.email"
                  value={formData.contact.email}
                  onChange={handleChange}
                  placeholder="contact@center.com"
                  className={styles.formInput}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="contact.phone" className={styles.required}>Phone</label>
                <input
                  type="tel"
                  id="contact.phone"
                  name="contact.phone"
                  value={formData.contact.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className={styles.formInput}
                  required
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="capacity.maxStudents">Max Students</label>
                <input
                  type="number"
                  id="capacity.maxStudents"
                  name="capacity.maxStudents"
                  value={formData.capacity.maxStudents}
                  onChange={handleChange}
                  min="1"
                  max="10000"
                  className={styles.formInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="capacity.maxTutors">Max Tutors</label>
                <input
                  type="number"
                  id="capacity.maxTutors"
                  name="capacity.maxTutors"
                  value={formData.capacity.maxTutors}
                  onChange={handleChange}
                  min="1"
                  max="1000"
                  className={styles.formInput}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of the center"
                className={styles.formTextarea}
                rows="3"
              />
            </div>

            <div className={styles.modalActions}>
              <button 
                type="button" 
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={submitting}
              >
                {submitting ? <span className={styles.spinner}></span> : <span>🏢</span>}
                {submitting ? 'Creating Center...' : 'Create Center'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Edit Center Modal Component  
const EditCenterModal = ({ center, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: center.name || '',
    location: {
      address: center.location?.address || '',
      city: center.location?.city || '',
      state: center.location?.state || '',
      zipCode: center.location?.zipCode || ''
    },
    contact: {
      email: center.contact?.email || '',
      phone: center.contact?.phone || '',
      website: center.contact?.website || ''
    },
    capacity: {
      maxStudents: center.capacity?.maxStudents || 100,
      maxTutors: center.capacity?.maxTutors || 10
    },
    description: center.description || ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.location.city || !formData.location.state || !formData.location.zipCode || !formData.contact.email || !formData.contact.phone) {
      alert('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>✏️ Edit Center: {center.name}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {/* Same form fields as CreateCenterModal */}
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.required}>Center Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter center name"
              className={styles.formInput}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="location.city" className={styles.required}>City</label>
              <input
                type="text"
                id="location.city"
                name="location.city"
                value={formData.location.city}
                onChange={handleChange}
                placeholder="City"
                className={styles.formInput}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="location.state" className={styles.required}>State</label>
              <input
                type="text"
                id="location.state"
                name="location.state"
                value={formData.location.state}
                onChange={handleChange}
                placeholder="State"
                className={styles.formInput}
                required
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="contact.email" className={styles.required}>Email</label>
            <input
              type="email"
              id="contact.email"
              name="contact.email"
              value={formData.contact.email}
              onChange={handleChange}
              placeholder="contact@center.com"
              className={styles.formInput}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="capacity.maxStudents">Max Students</label>
              <input
                type="number"
                id="capacity.maxStudents"
                name="capacity.maxStudents"
                value={formData.capacity.maxStudents}
                onChange={handleChange}
                min="1"
                max="10000"
                className={styles.formInput}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="capacity.maxTutors">Max Tutors</label>
              <input
                type="number"
                id="capacity.maxTutors"
                name="capacity.maxTutors"
                value={formData.capacity.maxTutors}
                onChange={handleChange}
                min="1"
                max="1000"
                className={styles.formInput}
              />
            </div>
          </div>

          <div className={styles.modalActions}>
            <button 
              type="button" 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={submitting}
            >
              {submitting ? <span className={styles.spinner}></span> : ''}
              {submitting ? 'Updating...' : 'Update Center'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Logo Upload Modal Component
const LogoUploadModal = ({ center, logoUrl, setLogoUrl, onSubmit, onClose, loading, error, success }) => {
  const [preview, setPreview] = useState(center?.logoUrl || null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (JPG, PNG, GIF, WebP, SVG)');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedFile) {
      onSubmit(selectedFile);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>🎨 Upload Logo for {center.name}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {preview && (
            <div className={styles.logoPreview}>
              <img src={preview} alt="Logo Preview" className={styles.previewImage} />
              <p className={styles.previewLabel}>Logo Preview</p>
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="logoFile" className={styles.required}>Select Logo File</label>
            <input
              type="file"
              id="logoFile"
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
              className={styles.formInput}
              disabled={loading}
              required
            />
            <small className={styles.hint}>
              Supported formats: JPG, PNG, GIF, WebP, SVG (Max 5MB)
            </small>
          </div>

          {selectedFile && (
            <div className={styles.fileInfo}>
              <p><strong>Selected File:</strong> {selectedFile.name}</p>
              <p><strong>File Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
            </div>
          )}

          {error && (
            <div className={styles.errorAlert}>
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {success && (
            <div className={styles.successAlert}>
              <strong>✅ Success:</strong> {success}
            </div>
          )}

          <div className={styles.instructions}>
            <h4>How it works:</h4>
            <ol>
              <li>Select an image file from your computer</li>
              <li>We'll automatically upload it to AWS S3</li>
              <li>The URL will be saved to your center</li>
              <li>Logo will display on all dashboards instantly</li>
            </ol>
          </div>

          <div className={styles.modalActions}>
            <button 
              type="button" 
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={loading || !selectedFile}
            >
              {loading ? <span className={styles.spinner}></span> : ''}
              {loading ? 'Uploading...' : 'Upload to S3'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Admin Management Modal Component
export default CenterManagement;
