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

  const { showWarning, countdown, stayLoggedIn } = useAutoLogout(handleLogout);

  // Only apply auto-logout if the user is authenticated and is an admin or super admin
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) return null;

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
