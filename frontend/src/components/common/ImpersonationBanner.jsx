import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./ImpersonationBanner.css";

export default function ImpersonationBanner() {
    const { user, stopImpersonating } = useContext(AuthContext);
    const navigate = useNavigate();

    // Check if we are currently impersonating
    const isImpersonating = sessionStorage.getItem("superadmin_token") !== null;

    if (!isImpersonating || !user) {
        return null;
    }

    const handleReturn = () => {
        if (stopImpersonating()) {
            window.location.href = "/superadmin/users";
        }
    };

    return (
        <div className="impersonation-banner">
            <div className="impersonation-info">
                <span className="impersonation-icon">🔑</span>
                <span>You are currently logged in as <strong>{user.name}</strong> ({user.email})</span>
            </div>
            <button className="impersonation-btn" onClick={handleReturn}>
                Return to Super Admin
            </button>
        </div>
    );
}
