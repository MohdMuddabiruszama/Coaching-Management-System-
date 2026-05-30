import React from 'react';
import './AdvancedStatCard.css';

function AdvancedStatCard({ icon, colorClass, label, value, subLabel, progress, badgeText, badgeType }) {
    // If progress is 0, we still want to show the bar and 0%. If it's undefined or null, we don't show the bar.
    const showProgress = progress !== undefined && progress !== null;

    return (
        <div className={`advanced-stat-card ${colorClass}`}>
            <div className="asc-top">
                <div className="asc-icon-wrapper">{icon}</div>
                <div className="asc-info">
                    <p className="asc-label">{label}</p>
                    <h3 className="asc-value">{value}</h3>
                </div>
            </div>
            {(showProgress || subLabel || badgeText) && (
                <div className="asc-bottom">
                    {showProgress ? (
                        <>
                            <div className="asc-progress-text">
                                <span>{subLabel}</span>
                                <span className="asc-progress-value">{progress}%</span>
                            </div>
                            <div className="asc-progress-bar">
                                <div className="asc-progress-fill" style={{ width: `${Math.min(100, Math.max(0, parseFloat(progress) || 0))}%` }}></div>
                            </div>
                        </>
                    ) : (
                        <div className="asc-bottom-flex">
                            <span className="asc-sublabel">{subLabel}</span>
                            {badgeText && (
                                <span className={`asc-badge asc-badge-${badgeType}`}>
                                    {badgeType === 'success' && <span className="asc-badge-dot"></span>}
                                    {badgeText}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AdvancedStatCard;
