import { useState } from 'react';

const DeleteInstituteModal = ({ institute, onConfirm, onClose, loading }) => {
  const [confirmText, setConfirmText] = useState('');
  const [forceDelete, setForceDelete] = useState(false);
  const isMatch = confirmText.trim() === institute.name.trim();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '2rem', maxWidth: 500,
        width: '100%', boxShadow: '0 25px 80px rgba(220,38,38,0.25)',
        color: '#1f2937', animation: 'fadeIn 0.2s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
            borderRadius: '50%', width: 52, height: 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <span style={{ fontSize: 24 }}>🗑️</span>
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#7F1D1D', fontSize: 20, fontWeight: 700 }}>
              Delete Institute
            </h3>
            <p style={{ margin: '2px 0 0', color: '#6B7280', fontSize: 13 }}>
              This action is <strong>permanent</strong> and cannot be undone.
            </p>
          </div>
        </div>

        {/* Institute badge */}
        <div style={{
          background: '#F9FAFB', border: '1px solid #E5E7EB',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>🏢</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{institute.name}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{institute.email} · ID: {institute.id}</div>
          </div>
        </div>

        {/* Warning box */}
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 10, padding: '12px 16px', marginBottom: 18
        }}>
          <p style={{ margin: 0, color: '#B91C1C', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            ⚠️ The following will be permanently deleted:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            {[
              '👤 All users (admin, managers, faculty, students)',
              '📚 Classes & subjects',
              '📝 Assignments & submissions',
              '📋 Attendance records',
              '💰 Fee structures & payments',
              '📊 Exam results & marks',
              '📢 Announcements',
              '💬 All chat rooms & messages',
              '📒 Notes & downloads',
              '🗓️ Timetables',
              '🔬 Biometric data',
              '🌐 Public profile page',
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 4 }}>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Confirm by typing name */}
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#374151', fontWeight: 600 }}>
          Type <span style={{ background: '#FEE2E2', padding: '0 6px', borderRadius: 4, color: '#B91C1C', fontFamily: 'monospace' }}>
            {institute.name}
          </span> to confirm:
        </label>
        <input
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          placeholder={`Type "${institute.name}" here`}
          disabled={loading}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
            border: confirmText.length > 0
              ? (isMatch ? '2px solid #DC2626' : '2px solid #F87171')
              : '1px solid #D1D5DB',
            outline: 'none', boxSizing: 'border-box',
            background: loading ? '#F9FAFB' : '#fff',
            transition: 'border-color 0.2s'
          }}
        />
        {confirmText.length > 0 && !isMatch && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#EF4444' }}>
            ✗ Name does not match. Please type exactly as shown.
          </p>
        )}
        {isMatch && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
            ✓ Name confirmed. Ready to delete.
          </p>
        )}

        {/* Force delete checkbox */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14,
          fontSize: 13, cursor: 'pointer', color: '#374151',
          background: forceDelete ? '#FEF2F2' : 'transparent',
          border: '1px solid', borderColor: forceDelete ? '#FECACA' : '#E5E7EB',
          borderRadius: 8, padding: '10px 12px', transition: 'all 0.2s'
        }}>
          <input
            type='checkbox'
            checked={forceDelete}
            onChange={e => setForceDelete(e.target.checked)}
            disabled={loading}
            style={{ marginTop: 2, accentColor: '#DC2626', flexShrink: 0 }}
          />
          <span>
            <strong>Force delete</strong> — even if an active paid subscription exists.
            <span style={{ display: 'block', fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              Use this only when you are absolutely certain you want to remove this institute permanently.
            </span>
          </span>
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1, padding: '11px', borderRadius: 8,
              border: '1px solid #D1D5DB', background: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, color: '#4b5563', fontWeight: 500,
              opacity: loading ? 0.6 : 1
            }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(forceDelete)}
            disabled={!isMatch || loading}
            style={{
              flex: 1, padding: '11px', borderRadius: 8, border: 'none',
              background: isMatch && !loading
                ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
                : '#FCA5A5',
              color: '#fff',
              cursor: (!isMatch || loading) ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 700,
              boxShadow: isMatch && !loading ? '0 4px 15px rgba(220,38,38,0.35)' : 'none',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}>
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #fff', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', display: 'inline-block'
                }} />
                Deleting...
              </>
            ) : (
              <>🗑️ Delete Institute</>
            )}
          </button>
        </div>

        <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
          All data will be permanently erased. This cannot be reversed.
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default DeleteInstituteModal;
