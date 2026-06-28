// frontend/src/components/BulkImportModal.jsx
// Full-featured preview modal for bulk import.
// Shows valid rows (green) and error rows (red) in two tabs.
// Admin can deselect individual rows before submitting.
// Submits only selected valid rows to the backend API.

import { useState } from 'react';
import api from '../services/api';

// API endpoint map per import type
const API_MAP = {
  students: '/students/bulk-import',
  parents:  '/parents/bulk-import',
  faculty:  '/faculty/bulk-import',
};

const LABEL_MAP = { students: 'Students', parents: 'Parents', faculty: 'Faculty' };

// Columns to display in the preview table per type
const COL_KEYS = {
  students: ['name', 'email', 'phone', 'roll_number', 'class_name', 'gender', 'date_of_birth'],
  parents:  ['name', 'email', 'phone', 'student_roll_number', 'relationship'],
  faculty:  ['name', 'email', 'phone', 'designation', 'address', 'join_date'],
};

export default function BulkImportModal({
  type,
  validRows,
  errorRows,
  totalRows,
  onClose,
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState('valid');
  const [selected, setSelected]   = useState(() => new Set(validRows.map((_, i) => i)));
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);

  const toggleRow = (i) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  const toggleAll = () => {
    setSelected(
      selected.size === validRows.length
        ? new Set()
        : new Set(validRows.map((_, i) => i))
    );
  };

  const handleSubmit = async () => {
    const rowsToSend = validRows.filter((_, i) => selected.has(i));
    if (!rowsToSend.length) {
      alert('No rows selected. Please select at least one row to import.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(API_MAP[type], { rows: rowsToSend });
      setResult(data);
      if (data.success && data.inserted > 0) {
        onSuccess(data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Import failed. Please try again.';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Inline styles (theme-aware using CSS variables) ──────────────────────
  const overlay = {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    backdropFilter: 'blur(4px)',
  };

  const modal = {
    background: 'var(--card-bg, #ffffff)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '960px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
    border: '1px solid var(--border-color, #e2e8f0)',
  };

  // ── Result screen (shown after successful import) ──────────────────────────
  if (result) {
    return (
      <div style={overlay}>
        <div style={{ ...modal, padding: '2.5rem', textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
            {result.failed > 0 && result.inserted === 0 ? '❌' : '✅'}
          </div>
          <h2 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary, #1f2937)' }}>
            Import Complete
          </h2>

          {result.inserted > 0 && (
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac',
              borderRadius: '10px', padding: '0.75rem 1.25rem', marginBottom: '0.75rem',
              color: '#166534', fontWeight: 600,
            }}>
              ✅ {result.inserted} {LABEL_MAP[type]} imported successfully!
            </div>
          )}

          {result.failed > 0 && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '10px', padding: '0.75rem 1.25rem', marginBottom: '0.75rem',
              color: '#991b1b', fontWeight: 600,
            }}>
              ⚠️ {result.failed} row(s) failed on the server side.
              {result.errors?.length > 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', fontWeight: 400, textAlign: 'left' }}>
                  {result.errors.slice(0, 3).map((e, i) => (
                    <div key={i}>Row {e.row}: {e.errors?.join(', ')}</div>
                  ))}
                  {result.errors.length > 3 && <div>...and {result.errors.length - 3} more</div>}
                </div>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ marginTop: '1rem', width: '100%' }}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── Main modal ─────────────────────────────────────────────────────────────
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--text-primary, #1f2937)', fontSize: '1.1rem' }}>
              📥 Bulk Import — {LABEL_MAP[type]}
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
              Total rows in file: <strong>{totalRows}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              fontSize: '1.4rem', cursor: 'pointer',
              color: 'var(--text-secondary, #6b7280)',
              lineHeight: 1, padding: '0.25rem',
              borderRadius: '50%',
            }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* ── Summary badges ─────────────────────────────────────────────── */}
        <div style={{
          padding: '0.75rem 1.5rem',
          background: 'var(--bg-secondary, #f8fafc)',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          flexShrink: 0,
        }}>
          <span style={{
            background: '#dcfce7', color: '#166534',
            padding: '0.3rem 0.9rem', borderRadius: '20px',
            fontWeight: 700, fontSize: '0.85rem',
          }}>
            ✅ {validRows.length} ready to import
          </span>
          {errorRows.length > 0 && (
            <span style={{
              background: '#fee2e2', color: '#991b1b',
              padding: '0.3rem 0.9rem', borderRadius: '20px',
              fontWeight: 700, fontSize: '0.85rem',
            }}>
              ❌ {errorRows.length} rows have errors
            </span>
          )}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          flexShrink: 0,
        }}>
          {['valid', 'errors'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 700 : 400,
                borderBottom: activeTab === tab ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: activeTab === tab ? '#2563eb' : 'var(--text-secondary, #6b7280)',
                fontSize: '0.875rem',
                transition: 'all 0.15s ease',
              }}
            >
              {tab === 'valid'
                ? `✅ Valid Rows (${validRows.length})`
                : `❌ Errors (${errorRows.length})`
              }
            </button>
          ))}
        </div>

        {/* ── Table body ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>

          {/* Valid rows tab */}
          {activeTab === 'valid' && (
            validRows.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>
                No valid rows found. Please fix the errors and re-upload.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: 'var(--bg-secondary, #f8fafc)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                      <input
                        type="checkbox"
                        checked={selected.size === validRows.length && validRows.length > 0}
                        onChange={toggleAll}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2563eb' }}
                        title="Select all"
                      />
                    </th>
                    {COL_KEYS[type].map(k => (
                      <th key={k} style={{
                        padding: '0.6rem 0.75rem',
                        textAlign: 'left',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        fontWeight: 600,
                        textTransform: 'capitalize',
                        color: 'var(--text-secondary, #6b7280)',
                        whiteSpace: 'nowrap',
                      }}>
                        {k.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: selected.has(i) ? '#f0fdf4' : 'var(--card-bg, #ffffff)',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        transition: 'background 0.1s',
                      }}
                      onClick={() => toggleRow(i)}
                    >
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleRow(i)}
                          onClick={e => e.stopPropagation()}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#2563eb' }}
                        />
                      </td>
                      {COL_KEYS[type].map(k => (
                        <td key={k} style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary, #1f2937)' }}>
                          {row[k] || <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Error rows tab */}
          {activeTab === 'errors' && (
            errorRows.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary, #6b7280)' }}>
                🎉 No errors found in your file!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#fef2f2' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #fca5a5', fontWeight: 600, color: '#991b1b' }}>Row #</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #fca5a5', fontWeight: 600, color: '#991b1b' }}>Name</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #fca5a5', fontWeight: 600, color: '#991b1b' }}>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRows.map((err, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff5f5' : '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#991b1b' }}>Row {err.rowNum}</td>
                      <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-primary, #1f2937)' }}>
                        {err.data?.name || <span style={{ color: '#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {err.errors.map((e, ei) => (
                          <span key={ei} style={{
                            display: 'inline-block',
                            background: '#fee2e2', color: '#b91c1c',
                            borderRadius: '6px', padding: '0.15rem 0.5rem',
                            marginRight: '0.25rem', marginBottom: '0.2rem',
                            fontSize: '0.75rem', fontWeight: 500,
                          }}>
                            {e}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* ── Footer / Action bar ────────────────────────────────────────── */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: '0.75rem',
          background: 'var(--bg-secondary, #f8fafc)',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)', fontWeight: 500 }}>
            {selected.size} of {validRows.length} rows selected
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={loading || selected.size === 0}
              style={{
                opacity: selected.size === 0 ? 0.5 : 1,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                minWidth: '160px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              }}
            >
              {loading ? (
                <>⏳ Importing...</>
              ) : (
                <>📥 Import {selected.size} Record{selected.size !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
