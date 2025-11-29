import React from 'react';

const CenterInfo = ({ center }) => {
  if (!center) return null;

  // Format location string from location object
  const formatLocation = (location) => {
    if (!location) return 'Location not specified';
    if (typeof location === 'string') return location;
    
    const parts = [];
    if (location.address) parts.push(location.address);
    if (location.city) parts.push(location.city);
    if (location.state) parts.push(location.state);
    if (location.zipCode) parts.push(location.zipCode);
    
    return parts.length > 0 ? parts.join(', ') : 'Location not specified';
  };

  return (
    <div className="card center-info">
      <div className="card-body">
        <div className="center-header">
          <div className="center-details">
            <h2 className="center-name">{center.name || 'Your Center'}</h2>
            <p className="center-location">{formatLocation(center.location)}</p>
          </div>
          <div className="center-status">
            <span className="badge badge-success">Active</span>
          </div>
        </div>
        
        <div className="center-stats">
          <div className="stat-item">
            <div className="stat-label">Est. Founded</div>
            <div className="stat-value">{center.founded || '2020'}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Contact</div>
            <div className="stat-value">{center.phone || 'Not provided'}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Email</div>
            <div className="stat-value">{center.email || 'Not provided'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CenterInfo;
