import React from 'react';
import './LogoutConfirmModal.css';

const LogoutConfirmModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="logout-confirm-overlay" onClick={onClose}>
            <div className="logout-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="logout-confirm-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </div>
                <h3>Log Out</h3>
                <p>Are you sure you want to log out of your account?</p>
                <div className="logout-confirm-actions">
                    <button className="logout-cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="logout-confirm-btn" onClick={onConfirm}>Log Out</button>
                </div>
            </div>
        </div>
    );
};

export default LogoutConfirmModal;
