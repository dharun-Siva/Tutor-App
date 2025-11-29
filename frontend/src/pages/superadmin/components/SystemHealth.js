import React from 'react';
import { formatMemoryUsage, formatUptime } from '../../../utils/helpers';

const SystemHealth = ({ healthData, detailed = false }) => {
  if (!healthData) {
    return (
      <div className="card">
        <div className="card-header">
          <h3>System Health</h3>
        </div>
        <div className="card-body">
          <p className="text-muted">Health data not available</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    return status === 'healthy' ? 'text-success' : 'text-danger';
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>System Health</h3>
        <span className={`badge ${healthData.status === 'healthy' ? 'badge-success' : 'badge-danger'}`}>
          {healthData.status.toUpperCase()}
        </span>
      </div>
      <div className="card-body">
        <div className="health-metrics">
          <div className="metric">
            <div className="metric-label">Status</div>
            <div className={`metric-value ${getStatusColor(healthData.status)}`}>
              {healthData.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}
            </div>
          </div>
          
          <div className="metric">
            <div className="metric-label">Uptime</div>
            <div className="metric-value">
              {formatUptime(healthData.uptime)}
            </div>
          </div>

          {detailed && healthData.memory && (
            <>
              <div className="metric">
                <div className="metric-label">Memory Usage</div>
                <div className="metric-value">
                  {formatMemoryUsage(healthData.memory.used)} / {formatMemoryUsage(healthData.memory.total)}
                </div>
              </div>

              <div className="metric">
                <div className="metric-label">RSS Memory</div>
                <div className="metric-value">
                  {formatMemoryUsage(healthData.memory.rss)}
                </div>
              </div>

              <div className="metric">
                <div className="metric-label">Heap Used</div>
                <div className="metric-value">
                  {formatMemoryUsage(healthData.memory.heapUsed)} / {formatMemoryUsage(healthData.memory.heapTotal)}
                </div>
              </div>
            </>
          )}
        </div>

        {!detailed && healthData.memory && (
          <div className="memory-summary">
            <div className="memory-info">
              <span>Memory: {formatMemoryUsage(healthData.memory.heapUsed)}</span>
            </div>
            <div className="memory-bar">
              <div 
                className="memory-fill" 
                style={{ 
                  width: `${(healthData.memory.heapUsed / healthData.memory.heapTotal) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemHealth;
