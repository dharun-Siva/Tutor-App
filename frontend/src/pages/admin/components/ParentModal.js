import React, { useState, useEffect } from 'react';
import { parentsAPI } from '../../../utils/api';
import { getErrorMessage } from '../../../utils/helpers';
import styles from './ParentModal.module.css';

const ParentModal = ({ parent, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    fullName: '',
    email: '',
    username: '',
    password: '',
    confirm_password: '',
    phone_number: '',
    address: '',
    is_active: true,
    role: 'parent',
    account_status: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (parent) {
      setFormData({
        first_name: parent.first_name || '',
        last_name: parent.last_name || '',
        fullName: parent.fullName || '',
        email: parent.email || '',
        username: parent.username || '',
        password: '',
        confirm_password: '',
        phone_number: parent.phone_number || '',
        address: parent.address || '',
        is_active: parent.is_active !== undefined ? parent.is_active : (parent.isActive !== undefined ? parent.isActive : true),
        role: 'parent',
        account_status: parent.account_status || 'pending'
      });
    }
  }, [parent]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear errors when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (formData.first_name.trim().length > 24) {
      setError('First name must be less than 24 characters');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    if (formData.last_name.trim().length > 24) {
      setError('Last name must be less than 24 characters');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address (e.g., example@domain.com)');
      return false;
    }
    
    // Password validation for new parents
    if (!parent && !formData.password) {
      setError('Password is required for new parents');
      return false;
    }
    
    if (formData.password) {
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }
      
      // Strong password validation to match backend
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(formData.password)) {
        setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');
        return false;
      }
    }
    
    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Prepare data for API
      const apiData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_number: formData.phone_number?.trim() || '',
        address: formData.address?.trim() || '',
        role: 'parent',
        is_active: formData.is_active,
        account_status: formData.account_status || 'pending'
      };

      // Only include username if it's provided
      if (formData.username?.trim()) {
        apiData.username = formData.username.trim().toLowerCase();
      }

      // Only include password if it's provided
      if (formData.password) {
        apiData.password = formData.password;
      }

      await onSave(apiData);
      setSuccess(parent ? 'Parent updated successfully!' : 'Parent created successfully!');

      // Close modal after successful operation
      setTimeout(() => {
        onClose(true);
      }, 1500);

    } catch (err) {
      console.error('Error saving parent:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose(false);
  };

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>
            {parent ? '✏️ Edit Parent' : '➕ Add New Parent'}
          </h3>
          <button 
            className={styles.closeButton}
            onClick={handleClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalBody}>
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          <div className={styles.formGrid}>
            {/* Personal Information */}
            <div className={styles.formSection}>
              <h4>👤 Personal Information</h4>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="first_name">First Name *</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                    disabled={loading}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="last_name">Last Name *</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="fullName">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="Auto-filled from first and last name"
                  disabled={loading}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                    disabled={loading}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="phone_number">Phone</label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="form-control"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="form-control"
                  rows="2"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Login Information */}
            <div className={styles.formSection}>
              <h4>🔐 Login Information</h4>
              
              <div className={styles.formGroup}>
                <label htmlFor="username">Username <small className="text-muted">(auto-generated if empty)</small></label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="form-control"
                  disabled={loading}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="password">
                    Password {!parent && '*'}
                    {parent && <small className="text-muted">(leave empty to keep current)</small>}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="form-control"
                    required={!parent}
                    disabled={loading}
                    minLength="8"
                    placeholder="Min 8 chars: 1 upper, 1 lower, 1 number, 1 special (@$!%*?&)"
                  />
                  <small className="text-muted">
                    Must contain: uppercase, lowercase, number, special character (@$!%*?&)
                  </small>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="confirm_password">Confirm Password</label>
                  <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleInputChange}
                    className="form-control"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.checkboxGroup}>
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    disabled={loading}
                  />
                  <label htmlFor="is_active">Active Account</label>
                </div>
                <small className="text-muted">
                  Inactive accounts cannot log in to the system
                </small>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {parent ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                parent ? '💾 Update Parent' : '➕ Create Parent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ParentModal;
