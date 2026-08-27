import React from 'react';
import './ForceUpdateScreen.css';

const ForceUpdateScreen = ({ 
  currentVersion, 
  targetVersion, 
  type = 'critical', 
  updateNotes = [], 
  onDismiss 
}) => {
  const handleUpdate = () => {
    window.location.href = 'https://play.google.com/store/apps/details?id=com.zenithflows.ims';
  };

  const isCritical = type === 'critical';

  return (
    <div className="force-update-container">
      <div className="force-update-card">
        <div className={`force-update-icon-wrapper ${isCritical ? 'critical' : 'normal'}`}>
          <div className="force-update-icon">🚀</div>
        </div>
        
        <h1 className="force-update-title">
          Time to Update!
        </h1>
        
        <p className="force-update-message">
          We've added new features and made significant performance improvements. Please update your ZenithFlows app to continue.
        </p>
        
        <div className="force-update-version-info">
          <div className="version-box">
            <span className="version-label">Your Version</span>
            <span className="version-number current">{currentVersion || 'Unknown'}</span>
          </div>
          <div className="version-arrow">→</div>
          <div className="version-box">
            <span className="version-label">New Version</span>
            <span className="version-number required">{targetVersion}</span>
          </div>
        </div>

        {!isCritical && updateNotes && updateNotes.length > 0 && (
          <div className="update-notes-container">
            <h3 className="update-notes-title">Version {targetVersion}</h3>
            <ul className="update-notes-list">
              {updateNotes.map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="force-update-actions">
          <button className="force-update-button primary" onClick={handleUpdate}>
            Update Now
          </button>
          
          {!isCritical && onDismiss && (
            <button className="force-update-button secondary" onClick={onDismiss}>
              Maybe Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForceUpdateScreen;
