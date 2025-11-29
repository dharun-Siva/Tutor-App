import React from 'react';
import styles from './EnhancedCard.module.css';

const EnhancedCard = ({ 
  children, 
  title, 
  subtitle,
  icon,
  variant = 'default',
  size = 'medium',
  hover = true,
  gradient = false,
  className = '',
  actions = null,
  loading = false,
  onClick
}) => {
  const cardClasses = [
    styles.enhancedCard,
    styles[variant],
    styles[size],
    hover ? styles.hoverable : '',
    gradient ? styles.gradient : '',
    onClick ? styles.clickable : '',
    loading ? styles.loading : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses} onClick={onClick}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner}></div>
        </div>
      )}
      
      {(title || subtitle || icon || actions) && (
        <div className={styles.cardHeader}>
          <div className={styles.headerContent}>
            {icon && (
              <div className={styles.cardIcon}>
                {typeof icon === 'string' ? <i className={icon}></i> : icon}
              </div>
            )}
            <div className={styles.headerText}>
              {title && <h3 className={styles.cardTitle}>{title}</h3>}
              {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}
            </div>
          </div>
          {actions && (
            <div className={styles.cardActions}>
              {actions}
            </div>
          )}
        </div>
      )}
      
      <div className={styles.cardContent}>
        {children}
      </div>
    </div>
  );
};

export default EnhancedCard;
