import React, { useState, useEffect } from 'react';
import { getStoredUser } from '../../../utils/helpers';
import './SessionCreator.css';

const SessionCreator = ({ onClose, onSessionCreated, classId = null }) => {
  const [formData, setFormData] = useState({
    classId: classId || '',
    sessionDate: '',
    startTime: '',
    duration: 60,
    notes: '',
    meetingPlatform: 'agora',
    isRecurring: false,
    recurringPattern: 'weekly',
    recurringEnd: ''
  });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const user = getStoredUser();

  useEffect(() => {
    loadTutorClasses();
  }, []);

  const loadTutorClasses = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`/api/classes/tutor/${user.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClasses(data.data || []);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          classId: formData.classId,
          meetingPlatform: formData.meetingPlatform
        })
      });

      const result = await response.json();

      if (response.ok) {
        if (onSessionCreated) {
          onSessionCreated(result.data);
        }
        if (onClose) {
          onClose();
        }
      } else {
        setError(result.error || 'Failed to create session');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getMinDateTime = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 16);
  };

  return (
    <div className="session-creator-overlay">
      <div className="session-creator-modal">
        <div className="modal-header">
          <h3>
            <i className="fas fa-calendar-plus mr-2"></i>
            Schedule New Session
          </h3>
          <button 
            className="close-button" 
            onClick={onClose}
            type="button"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="session-form">
          <div className="form-body">
            {error && (
              <div className="alert alert-danger">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                {error}
              </div>
            )}

            {/* Class Selection */}
            <div className="form-group">
              <label htmlFor="classId" className="form-label">
                <i className="fas fa-chalkboard mr-2"></i>
                Select Class *
              </label>
              <select
                id="classId"
                name="classId"
                value={formData.classId}
                onChange={handleChange}
                className="form-control"
                required
              >
                <option value="">Choose a class...</option>
                {classes.map(cls => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name} - {cls.subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Date and Time */}
            <div className="form-row">
              <div className="form-group col-md-6">
                <label htmlFor="sessionDate" className="form-label">
                  <i className="fas fa-calendar mr-2"></i>
                  Session Date *
                </label>
                <input
                  type="date"
                  id="sessionDate"
                  name="sessionDate"
                  value={formData.sessionDate}
                  onChange={handleChange}
                  className="form-control"
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="form-group col-md-6">
                <label htmlFor="startTime" className="form-label">
                  <i className="fas fa-clock mr-2"></i>
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  className="form-control"
                  required
                />
              </div>
            </div>

            {/* Duration and Platform */}
            <div className="form-row">
              <div className="form-group col-md-6">
                <label htmlFor="duration" className="form-label">
                  <i className="fas fa-hourglass-half mr-2"></i>
                  Duration (minutes) *
                </label>
                <select
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <div className="form-group col-md-6">
                <label htmlFor="meetingPlatform" className="form-label">
                  <i className="fas fa-video mr-2"></i>
                  Meeting Platform
                </label>
                <select
                  id="meetingPlatform"
                  name="meetingPlatform"
                  value={formData.meetingPlatform}
                  onChange={handleChange}
                  className="form-control"
                >
                  <option value="agora">Agora (Recommended)</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="meet">Google Meet</option>
                  <option value="webex">Cisco Webex</option>
                </select>
              </div>
            </div>

            {/* Recurring Options */}
            <div className="form-group">
              <div className="form-check">
                <input
                  type="checkbox"
                  id="isRecurring"
                  name="isRecurring"
                  checked={formData.isRecurring}
                  onChange={handleChange}
                  className="form-check-input"
                />
                <label htmlFor="isRecurring" className="form-check-label">
                  <i className="fas fa-repeat mr-2"></i>
                  Create recurring sessions
                </label>
              </div>
            </div>

            {formData.isRecurring && (
              <div className="recurring-options">
                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label htmlFor="recurringPattern" className="form-label">
                      Repeat Pattern
                    </label>
                    <select
                      id="recurringPattern"
                      name="recurringPattern"
                      value={formData.recurringPattern}
                      onChange={handleChange}
                      className="form-control"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="form-group col-md-6">
                    <label htmlFor="recurringEnd" className="form-label">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="recurringEnd"
                      name="recurringEnd"
                      value={formData.recurringEnd}
                      onChange={handleChange}
                      className="form-control"
                      min={formData.sessionDate}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Session Notes */}
            <div className="form-group">
              <label htmlFor="notes" className="form-label">
                <i className="fas fa-sticky-note mr-2"></i>
                Session Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="form-control"
                rows="4"
                placeholder="Add any notes about this session, topics to cover, materials needed, etc."
              />
            </div>

            {/* Session Preview */}
            {formData.classId && formData.sessionDate && formData.startTime && (
              <div className="session-preview">
                <h5>
                  <i className="fas fa-eye mr-2"></i>
                  Session Preview
                </h5>
                <div className="preview-content">
                  <div className="preview-item">
                    <strong>Class:</strong> {classes.find(c => c._id === formData.classId)?.name}
                  </div>
                  <div className="preview-item">
                    <strong>Date & Time:</strong> {
                      new Date(`${formData.sessionDate}T${formData.startTime}`).toLocaleString()
                    }
                  </div>
                  <div className="preview-item">
                    <strong>Duration:</strong> {formData.duration} minutes
                  </div>
                  <div className="preview-item">
                    <strong>Platform:</strong> {formData.meetingPlatform}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !formData.classId || !formData.sessionDate || !formData.startTime}
            >
              {loading ? (
                <>
                  <div className="spinner-border spinner-border-sm mr-2" role="status">
                    <span className="sr-only">Loading...</span>
                  </div>
                  Creating...
                </>
              ) : (
                <>
                  <i className="fas fa-calendar-check mr-2"></i>
                  Create Session
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionCreator;
