import React from 'react';
import './ForceUpdateScreen.css';

const ForceUpdateScreen = ({ currentVersion, minVersion }) => {
  const handleUpdate = () => {
    // In a real app, this would open the Play Store or App Store link
    window.open('https://play.google.com/store/apps/details?id=com.zenithflows.app', '_blank');
  };

  return (
    <div className="force-update-container">
      <div className="force-update-card">
        <div className="force-update-icon-wrapper">
          <div className="force-update-icon">🚀</div>
        </div>
        <h1 className="force-update-title">Time to Update!</h1>
        <p className="force-update-message">
          We've added new features and made significant performance improvements. 
          Please update your ZenithFlows app to continue.
        </p>
        
        <div className="force-update-version-info">
          <div className="version-box">
            <span className="version-label">Your Version</span>
            <span className="version-number current">{currentVersion || 'Unknown'}</span>
          </div>
          <div className="version-arrow">→</div>
          <div className="version-box">
            <span className="version-label">New Version</span>
            <span className="version-number required">{minVersion}</span>
          </div>
        </div>

        <button className="force-update-button" onClick={handleUpdate}>
          Update Now
        </button>
      </div>
    </div>
  );
};

export default ForceUpdateScreen;
