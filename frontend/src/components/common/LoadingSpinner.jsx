/**
 * Loading Spinner Component
 * Beautiful customized loading indicator for async operations
 */

import { Capacitor } from '@capacitor/core';
import "./LoadingSpinner.css";

/**
 * LoadingSpinner component
 * @param {Object} props - Component props
 * @param {string} props.size - Size of spinner (small, medium, large, full)
 * @param {string} props.message - Optional loading message (h2)
 * @param {string} props.subMessage - Optional sub message (p)
 * @param {boolean} props.fullScreen - Whether it should cover the whole screen
 * @returns {React.ReactElement} Loading spinner
 */
function LoadingSpinner({ 
    size = "medium", 
    message = "", 
    subMessage = "", 
    fullScreen = false 
}) {
    const sizeClass = fullScreen ? 'loading-spinner-full' : `loading-spinner-${size}`;
    const isMobileApp = Capacitor.isNativePlatform();

    return (
        <div className={`loading-spinner-container ${fullScreen ? 'page-loader' : ''} ${sizeClass}`}>
            <div className="loader">
                <div className="spinner"></div>
                {!isMobileApp && (
                    <div className="logo">
                        <img src="/logo.png" alt="Logo" />
                    </div>
                )}
            </div>
            {message && <h2>{message}</h2>}
            {subMessage && <p>{subMessage}</p>}
            {(message || subMessage) && (
                <div className="dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            )}
        </div>
    );
}

export default LoadingSpinner;
