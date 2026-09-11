import React, { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useAutoLogout } from '../../hooks/useAutoLogout';
import AutoLogoutWarning from './AutoLogoutWarning';

const AutoLogoutWrapper = () => {
  const { user, logout } = useContext(AuthContext);
  
  const handleLogout = () => {
    logout();
    window.location.href = '/login'; // Force redirect to login
  };

  const isEnabled = Boolean(user && (user.role === 'admin' || user.role === 'super_admin'));

  const { showWarning, countdown, stayLoggedIn } = useAutoLogout(handleLogout, isEnabled);

  // Only apply auto-logout modal if enabled
  if (!isEnabled) return null;

  return (
    <>
      {showWarning && (
        <AutoLogoutWarning 
          countdown={countdown} 
          onStayLoggedIn={stayLoggedIn} 
        />
      )}
    </>
  );
};

export default AutoLogoutWrapper;
