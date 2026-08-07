import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { BrandingContext } from "../../context/BrandingContext";
import api from "../../services/api";
import "./RoleSelection.css";

function RoleSelection() {
  const navigate = useNavigate();
  const { user, impersonate, logout } = useContext(AuthContext);
  const branding = useContext(BrandingContext);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // If parent has multiple students, show a selection modal
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  useEffect(() => {
    // If not a parent and not impersonating a student, redirect to home
    if (!user || (user.role !== "parent" && !sessionStorage.getItem("original_session_token"))) {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) return null;

  const linkedStudents = user.linked_students || [];

  const handleParentSelect = () => {
    navigate("/parent/dashboard");
  };

  const handleStudentSelect = () => {
    if (linkedStudents.length === 0) {
      setError("No students are linked to your account. Please contact the administration.");
      return;
    }
    
    if (linkedStudents.length === 1) {
      impersonateChild(linkedStudents[0].id);
    } else {
      setShowStudentPicker(true);
    }
  };

  const impersonateChild = async (studentId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/parents/impersonate-child/${studentId}`);
      if (response.data && response.data.success) {
        impersonate(response.data, "/student/dashboard");
      } else {
        setError("Failed to switch to student account.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "An error occurred while switching accounts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="role-selection-page">
      <div className="role-selection-bg-orb orb-1"></div>
      <div className="role-selection-bg-orb orb-2"></div>
      
      <div className="role-selection-container">
        
        {/* Header */}
        <div className="role-selection-header">
          {branding.logo && (
            <img 
              src={branding.logo} 
              alt={branding.name} 
              className="role-selection-logo" 
            />
          )}
          <h2>Welcome, {user.name}</h2>
          <p>How would you like to use the app today?</p>
        </div>

        {error && (
          <div className="role-selection-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Role Cards */}
        {!showStudentPicker ? (
          <div className="role-cards-wrapper">
            <div 
              className="role-card parent-card" 
              onClick={handleParentSelect}
              style={{ '--brand-color': branding.color || '#6366f1' }}
            >
              <div className="role-card-icon">👨‍👩‍👧‍👦</div>
              <div className="role-card-content">
                <h3>Parent Portal</h3>
                <p>View fee statuses, attendance summaries, and institute announcements.</p>
              </div>
              <div className="role-card-arrow">➔</div>
            </div>

            <div 
              className="role-card student-card" 
              onClick={handleStudentSelect}
              style={{ '--brand-color': branding.color || '#6366f1' }}
            >
              <div className="role-card-icon">🎓</div>
              <div className="role-card-content">
                <h3>Student Portal</h3>
                <p>Access study materials, assignments, timetable, and performance.</p>
              </div>
              <div className="role-card-arrow">➔</div>
            </div>
          </div>
        ) : (
          <div className="student-picker-wrapper">
            <h3>Select a Student</h3>
            <p>Choose which profile you want to view</p>
            <div className="student-list">
              {linkedStudents.map(student => (
                <div 
                  key={student.id} 
                  className="student-list-item"
                  onClick={() => impersonateChild(student.id)}
                >
                  <div className="student-avatar">{student.name.charAt(0).toUpperCase()}</div>
                  <div className="student-details">
                    <h4>{student.name}</h4>
                  </div>
                  <div className="student-arrow">➔</div>
                </div>
              ))}
            </div>
            <button 
              className="btn-cancel" 
              onClick={() => setShowStudentPicker(false)}
              disabled={loading}
            >
              Back
            </button>
          </div>
        )}

        {loading && (
          <div className="role-selection-loader">
            <div className="spinner"></div>
            <p>Switching profile...</p>
          </div>
        )}

        <div className="role-selection-footer">
          <button className="btn-logout" onClick={logout}>Sign Out</button>
        </div>
        
      </div>
    </div>
  );
}

export default RoleSelection;
