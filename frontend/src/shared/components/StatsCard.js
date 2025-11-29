import React from 'react';
import './StatsCard.module.css';

const StatsCard = ({ 
  title, 
  value, 
  icon, 
  color = 'primary', 
  subtitle, 
  trend,
  change,
  changeType,
  onClick,
  loading = false 
}) => {
  const cardClass = `stats-card ${color} ${onClick ? 'clickable' : ''}`;

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="stats-card-content">
        <div className="stats-card-info">
          <h3 className="stats-title">{title}</h3>
          {loading ? (
            <div className="stats-value">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              <div className="stats-value">{value}</div>
              {subtitle && <div className="stats-subtitle">{subtitle}</div>}
              {trend && (
                <div className={`stats-trend ${trend.type}`}>
                  {trend.type === 'up' ? '↗' : trend.type === 'down' ? '↘' : '→'} 
                  {trend.value}
                </div>
              )}
              {change && (
                <div className={`stats-change ${changeType}`}>
                  {changeType === 'positive' ? '↗' : changeType === 'negative' ? '↘' : '→'} 
                  {change}
                </div>
              )}
            </>
          )}
        </div>
        {icon && (
          <div className="stats-icon">
            {typeof icon === 'string' ? <i className={icon}></i> : icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
