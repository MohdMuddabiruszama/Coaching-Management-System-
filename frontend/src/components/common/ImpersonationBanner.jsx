import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./ImpersonationBanner.css";

export default function ImpersonationBanner() {
    const { user, stopImpersonating } = useContext(AuthContext);
    const navigate = useNavigate();

    // Check if we are currently impersonating
    const isImpersonating = sessionStorage.getItem("original_session_token") !== null || sessionStorage.getItem("superadmin_token") !== null;

    if (!isImpersonating || !user) {
        return null;
    }

    const handleReturn = () => {
        // Read original user to determine where to go back to
        const originalUserStr = sessionStorage.getItem("original_session_user") || sessionStorage.getItem("superadmin_user");
        let returnUrl = "/";
        if (originalUserStr) {
            try {
                const origUser = JSON.parse(originalUserStr);
                if (origUser.role === 'super_admin') returnUrl = "/superadmin/users";
                else if (origUser.role === 'parent') returnUrl = "/role-selection";
            } catch (e) {}
        }
        
        stopImpersonating(returnUrl);
    };

    const isParent = sessionStorage.getItem("original_session_user")?.includes('"role":"parent"');

    return (
        <div className="impersonation-banner" style={{ background: isParent ? '#f59e0b' : '' }}>
            <div className="impersonation-info">
                <span className="impersonation-icon">{isParent ? '👨‍👩‍👧‍👦' : '🔑'}</span>
                <span>You are currently viewing as <strong>{user.name}</strong></span>
            </div>
            <button className="impersonation-btn" onClick={handleReturn}>
                {isParent ? 'Switch back to Parent' : 'Return to Super Admin'}
            </button>
        </div>
    );
}
