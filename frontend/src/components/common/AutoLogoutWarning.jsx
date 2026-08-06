import React from 'react';

const AutoLogoutWarning = ({ countdown, onStayLoggedIn }) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 99999, display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--bg-color, #fff)', padding: '2rem', borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '400px', width: '90%',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '1rem', color: 'var(--text-color, #333)' }}>Are you still there?</h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary, #666)' }}>
          You have been inactive for a while. For your security, you will be automatically logged out in:
        </p>
        <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary-color, #007bff)', marginBottom: '1.5rem' }}>
          {countdown}s
        </div>
        <button 
          onClick={onStayLoggedIn}
          style={{
            background: 'var(--primary-color, #007bff)', color: '#fff',
            border: 'none', padding: '0.75rem 2rem', borderRadius: '4px',
            fontSize: '1rem', cursor: 'pointer', width: '100%'
          }}
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );
};

export default AutoLogoutWarning;
