import React from 'react';
import './LoadingSpinner.module.css';

const LoadingSpinner = ({ size = 'md', message = 'Loading...', fullScreen = false }) => {
  const sizeClass = {
    sm: 'spinner-sm',
    md: 'spinner-md',
    lg: 'spinner-lg'
  }[size];

  const spinnerContent = (
    <div className={`loading-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className={`spinner ${sizeClass}`}></div>
      {message && <div className="loading-message">{message}</div>}
    </div>
  );

  return spinnerContent;
};

export default LoadingSpinner;
