import React, { useState } from 'react';
import { getStoredUser, getStoredToken } from '../../utils/helpers';
import styles from './CenterLogoUpload.module.css';

const CenterLogoUpload = ({ onSuccess, currentLogoUrl }) => {
  const user = getStoredUser();
  const token = getStoredToken();
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [preview, setPreview] = useState(currentLogoUrl);

  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setLogoUrl(url);
    
    // Update preview if valid URL
    if (validateUrl(url)) {
      setPreview(url);
      setError(null);
    } else if (url.length > 0) {
      setError('Please enter a valid URL');
      setPreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!logoUrl) {
      setError('Logo URL is required');
      return;
    }

    if (!validateUrl(logoUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    if (!user || !user.center_id) {
      setError('No center associated with your account');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000'}/api/centers/${user.center_id}/logo`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ logoUrl })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update logo');
      }

      const data = await response.json();
      setSuccess('Logo updated successfully!');
      
      if (onSuccess) {
        onSuccess(logoUrl);
      }

      // Optional: Show success message for a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error updating logo:', err);
      setError(err.message || 'Failed to update center logo');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return <div className={styles.notAuthorized}>Only admins can update center logo</div>;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Center Logo</h3>
      
      {preview && (
        <div className={styles.previewContainer}>
          <img src={preview} alt="Logo Preview" className={styles.preview} />
          <p className={styles.previewLabel}>Current/Preview Logo</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="logoUrl" className={styles.label}>
            S3 Logo URL
          </label>
          <input
            type="text"
            id="logoUrl"
            className={styles.input}
            placeholder="https://your-bucket.s3.amazonaws.com/logo.png"
            value={logoUrl}
            onChange={handleUrlChange}
            disabled={loading}
          />
          <small className={styles.hint}>
            Paste the S3 object URL of your center logo image
          </small>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <button
          type="submit"
          className={styles.submitBtn}
          disabled={loading || !logoUrl}
        >
          {loading ? 'Updating...' : 'Update Logo'}
        </button>
      </form>

      <div className={styles.instructions}>
        <h4>How to get your S3 URL:</h4>
        <ol>
          <li>Upload your logo image to your S3 bucket</li>
          <li>Click on the object in S3 console</li>
          <li>Copy the "Object URL" (or use Copy S3 URI)</li>
          <li>Paste it in the field above</li>
          <li>Click "Update Logo"</li>
        </ol>
      </div>
    </div>
  );
};

export default CenterLogoUpload;
