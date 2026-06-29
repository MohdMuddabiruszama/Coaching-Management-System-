import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const FeatureGuard = ({ featureKey, children, title, fallbackMessage }) => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Check if the feature is explicitly disabled in user.features
    if (user?.features && (user.features[featureKey] === false || user.features[featureKey] === 'none')) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', minHeight: '70vh', padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc',
                borderRadius: '16px', margin: '1rem'
            }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>💎</div>
                <h2 style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {title || "Premium Feature"}
                </h2>
                <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '320px', marginBottom: '2rem', lineHeight: '1.5' }}>
                    {fallbackMessage || "This feature is not included in your institute's current plan. Please contact your administration."}
                </p>
                <button 
                    onClick={() => navigate(-1)}
                    style={{
                        padding: '12px 28px', backgroundColor: '#6366f1', color: 'white',
                        border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)', cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Go Back
                </button>
            </div>
        );
    }

    return <>{children}</>;
};

export default FeatureGuard;
