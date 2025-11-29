import React from 'react';
import styles from './ProgressChart.module.css';

const ProgressChart = ({ 
  title, 
  data, 
  type = 'circular', 
  size = 'medium',
  showLabel = true,
  color = 'primary' 
}) => {
  const getColorScheme = (colorName) => {
    const colors = {
      primary: {
        gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        background: 'rgba(102, 126, 234, 0.1)',
        border: 'rgba(102, 126, 234, 0.3)'
      },
      success: {
        gradient: 'linear-gradient(135deg, #48bb78, #38b2ac)',
        background: 'rgba(72, 187, 120, 0.1)',
        border: 'rgba(72, 187, 120, 0.3)'
      },
      warning: {
        gradient: 'linear-gradient(135deg, #ed8936, #dd6b20)',
        background: 'rgba(237, 137, 54, 0.1)',
        border: 'rgba(237, 137, 54, 0.3)'
      },
      info: {
        gradient: 'linear-gradient(135deg, #4299e1, #3182ce)',
        background: 'rgba(66, 153, 225, 0.1)',
        border: 'rgba(66, 153, 225, 0.3)'
      }
    };
    return colors[colorName] || colors.primary;
  };

  const colorScheme = getColorScheme(color);
  const percentage = typeof data === 'number' ? data : data?.percentage || 0;

  if (type === 'circular') {
    const radius = size === 'small' ? 30 : size === 'large' ? 50 : 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className={`${styles.progressChart} ${styles[size]}`}>
        <div className={styles.circularProgress}>
          <svg 
            className={styles.progressSvg} 
            width={radius * 2 + 20} 
            height={radius * 2 + 20}
          >
            <circle
              className={styles.progressBackground}
              cx={radius + 10}
              cy={radius + 10}
              r={radius}
              strokeWidth="4"
            />
            <circle
              className={styles.progressFill}
              cx={radius + 10}
              cy={radius + 10}
              r={radius}
              strokeWidth="4"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{
                stroke: `url(#gradient-${color}-${size})`
              }}
            />
            <defs>
              <linearGradient id={`gradient-${color}-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#667eea" />
                <stop offset="100%" stopColor="#764ba2" />
              </linearGradient>
            </defs>
          </svg>
          <div className={styles.progressLabel}>
            <span className={styles.progressValue}>{percentage}%</span>
            {showLabel && title && (
              <span className={styles.progressTitle}>{title}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'linear') {
    return (
      <div className={`${styles.progressChart} ${styles.linear}`}>
        {title && <div className={styles.progressTitle}>{title}</div>}
        <div className={styles.progressBarContainer}>
          <div 
            className={styles.progressBar}
            style={{ background: colorScheme.background }}
          >
            <div 
              className={styles.progressBarFill}
              style={{ 
                width: `${percentage}%`,
                background: colorScheme.gradient
              }}
            />
          </div>
          {showLabel && (
            <span className={styles.progressPercentage}>{percentage}%</span>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ProgressChart;
