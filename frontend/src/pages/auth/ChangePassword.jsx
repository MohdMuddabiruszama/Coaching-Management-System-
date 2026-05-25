import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import './Auth.css';

// ── Password strength helper ────────────────────────────────────────────────
const getStrength = (pw) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { score, label: 'Very Weak', color: '#ef4444' };
    if (score === 2) return { score, label: 'Weak',      color: '#f97316' };
    if (score === 3) return { score, label: 'Fair',      color: '#eab308' };
    if (score === 4) return { score, label: 'Strong',    color: '#22c55e' };
    return             { score, label: 'Very Strong',    color: '#16a34a' };
};

// ── Eye icon toggle ─────────────────────────────────────────────────────────
const EyeIcon = ({ visible }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {visible ? (
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        ) : (
            <>
                <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
            </>
        )}
    </svg>
);

const ChangePassword = () => {
    const { user, setUser } = useContext(AuthContext);
    const [passwords, setPasswords] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [show, setShow] = useState({
        oldPassword: false,
        newPassword: false,
        confirmPassword: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const strength = getStrength(passwords.newPassword);
    const passwordsMatch =
        passwords.confirmPassword.length > 0 &&
        passwords.newPassword === passwords.confirmPassword;

    const handleChange = (e) => {
        setError('');
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const toggleShow = (field) => setShow(s => ({ ...s, [field]: !s[field] }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Client-side validation
        if (!passwords.oldPassword) {
            return setError('Please enter your current temporary password.');
        }
        if (passwords.newPassword.length < 8) {
            return setError('New password must be at least 8 characters long.');
        }
        if (passwords.newPassword !== passwords.confirmPassword) {
            return setError('New passwords do not match. Please re-enter.');
        }
        if (passwords.newPassword === passwords.oldPassword) {
            return setError('New password must be different from the temporary password.');
        }

        setLoading(true);
        try {
            const res = await api.post('/auth/change-password', {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword
            });

            if (res.data.success) {
                // Update local user state — clear first-login flag
                const updatedUser = { ...user, is_first_login: false };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                sessionStorage.setItem('user', JSON.stringify(updatedUser));

                setSuccess('Password updated successfully! Redirecting to your dashboard…');
                setTimeout(() => navigate('/student/dashboard'), 1500);
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to change password. Please try again.';
            // Provide user-friendly messages for common errors
            if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('wrong') || msg.toLowerCase().includes('invalid')) {
                setError('The current temporary password you entered is incorrect. Please check and try again.');
            } else if (msg.toLowerCase().includes('validation')) {
                const details = err.response?.data?.errors;
                if (details && details.length > 0) {
                    setError(details.map(d => d.message).join(' '));
                } else {
                    setError(msg);
                }
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '0.75rem 2.75rem 0.75rem 0.875rem',
        borderRadius: '8px',
        border: '1.5px solid #cbd5e1',
        fontSize: '0.95rem',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
        background: '#f8fafc',
        color: '#1e293b',
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0fdf4 100%)',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '460px',
                padding: '2.5rem',
                background: 'white',
                borderRadius: '20px',
                boxShadow: '0 20px 60px -10px rgba(79, 70, 229, 0.15)',
                border: '1px solid rgba(79, 70, 229, 0.08)'
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem', lineHeight: 1 }}>🔒</div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem' }}>
                        Secure Your Account
                    </h1>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
                        This is your first login. Please set a new password to continue.
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{
                        padding: '0.875rem 1rem',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderLeft: '4px solid #ef4444',
                        borderRadius: '8px',
                        color: '#b91c1c',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        lineHeight: '1.5',
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start'
                    }}>
                        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.05rem' }}>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Success Banner */}
                {success && (
                    <div style={{
                        padding: '0.875rem 1rem',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderLeft: '4px solid #22c55e',
                        borderRadius: '8px',
                        color: '#15803d',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center'
                    }}>
                        <span>✅</span>
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Current Temporary Password */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>
                            Current Temporary Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={show.oldPassword ? 'text' : 'password'}
                                name="oldPassword"
                                style={inputStyle}
                                value={passwords.oldPassword}
                                onChange={handleChange}
                                required
                                placeholder="Enter the temporary password from admin"
                                autoComplete="current-password"
                            />
                            <button type="button" onClick={() => toggleShow('oldPassword')}
                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
                                <EyeIcon visible={show.oldPassword} />
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>
                            New Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={show.newPassword ? 'text' : 'password'}
                                name="newPassword"
                                style={inputStyle}
                                value={passwords.newPassword}
                                onChange={handleChange}
                                required
                                placeholder="Minimum 8 characters"
                                autoComplete="new-password"
                            />
                            <button type="button" onClick={() => toggleShow('newPassword')}
                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
                                <EyeIcon visible={show.newPassword} />
                            </button>
                        </div>

                        {/* Password Strength Meter */}
                        {passwords.newPassword.length > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '0.25rem' }}>
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} style={{
                                            flex: 1, height: '4px', borderRadius: '2px',
                                            background: i <= strength.score ? strength.color : '#e2e8f0',
                                            transition: 'background 0.3s'
                                        }} />
                                    ))}
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: strength.color, fontWeight: '600' }}>
                                    {strength.label}
                                    {strength.score < 3 && <span style={{ color: '#94a3b8', fontWeight: '400' }}> — try adding uppercase, numbers & symbols</span>}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Confirm New Password */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#334155', fontSize: '0.875rem' }}>
                            Confirm New Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={show.confirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                style={{
                                    ...inputStyle,
                                    borderColor: passwords.confirmPassword.length > 0
                                        ? (passwordsMatch ? '#22c55e' : '#ef4444')
                                        : '#cbd5e1'
                                }}
                                value={passwords.confirmPassword}
                                onChange={handleChange}
                                required
                                placeholder="Repeat new password"
                                autoComplete="new-password"
                            />
                            <button type="button" onClick={() => toggleShow('confirmPassword')}
                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', display: 'flex', alignItems: 'center' }}>
                                <EyeIcon visible={show.confirmPassword} />
                            </button>
                        </div>
                        {passwords.confirmPassword.length > 0 && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: passwordsMatch ? '#15803d' : '#dc2626', fontWeight: '600' }}>
                                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !!success}
                        style={{
                            width: '100%',
                            padding: '0.9rem',
                            borderRadius: '10px',
                            fontWeight: '700',
                            fontSize: '1rem',
                            background: loading || success ? '#a5b4fc' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                            color: 'white',
                            border: 'none',
                            cursor: loading || success ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.35)',
                            letterSpacing: '0.01em'
                        }}
                    >
                        {loading ? '⏳ Updating Password…' : success ? '✅ Done!' : '🔐 Update Password & Login'}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <button
                        onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/login'; }}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}
                    >
                        Sign out and return to login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChangePassword;
