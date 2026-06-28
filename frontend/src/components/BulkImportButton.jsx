// frontend/src/components/BulkImportButton.jsx
// Reusable button component used on ManageStudents, ManageParents, ManageFaculty pages.
// Handles: menu open → template download OR file selection → SheetJS parse → header check → validation → opens preview modal.
// type: 'students' | 'parents' | 'faculty'
// onSuccess: called with { inserted, failed } after a successful import

import * as XLSX from 'xlsx';
import { useRef, useState } from 'react';
import BulkImportModal from './BulkImportModal';
import { validateRows } from '../utils/bulkValidation';

// Required columns per type — used to detect missing header columns
const REQUIRED_HEADERS = {
  students: ['name', 'email', 'phone', 'roll_number', 'class_name', 'section', 'gender', 'date_of_birth', 'admission_date', 'address', 'is_full_course', 'subjects'],
  parents:  ['name', 'email', 'phone', 'student_roll_number', 'relationship'],
  faculty:  ['name', 'email', 'phone'],
};

const LABEL_MAP = { students: 'Students', parents: 'Parents', faculty: 'Faculty' };

export default function BulkImportButton({ type, onSuccess, customButton, label, className, style }) {
  const fileRef  = useRef();
  const [showMenu, setShowMenu] = useState(false);
  const [modalData, setModalData] = useState(null);

  const handleDownloadTemplate = () => {
    // Generate dummy row for guidance
    let dummyRow = {};
    if (type === 'students') {
      dummyRow = { name: 'John Doe', email: 'john@example.com', phone: '9876543210', roll_number: '101', class_name: 'Class 10', section: 'A', gender: 'male', date_of_birth: '15/08/2005', admission_date: '02/05/2026', address: '123 Main Street', is_full_course: 'Yes', subjects: 'Math, Science' };
    } else if (type === 'parents') {
      dummyRow = { name: 'Jane Doe', email: 'jane@example.com', phone: '9876543210', student_roll_number: '101', relationship: 'mother' };
    } else if (type === 'faculty') {
      dummyRow = { name: 'Dr. Smith', email: 'smith@example.com', phone: '9876543210', designation: 'Math Teacher', address: 'New York, USA', join_date: '01/04/2023' };
    }

    const headers = REQUIRED_HEADERS[type];
    const ws = XLSX.utils.json_to_sheet([dummyRow], { header: headers });
    
    // Auto-size columns slightly for better visibility
    const colWidths = headers.map(h => ({ wch: Math.max(h.length, 15) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    XLSX.writeFile(wb, `${LABEL_MAP[type]}_Import_Template.xlsx`);
  };

  const triggerFileInput = () => {
    setShowMenu(false);
    fileRef.current.click();
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;

    if (!file.name.match(/\.(xlsx|csv)$/i)) {
      alert('Only .xlsx or .csv files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be under 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb   = XLSX.read(evt.target.result, { type: 'binary', cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'DD/MM/YYYY', defval: '' });

        if (!raw.length) {
          alert('The file has no data rows. Please fill in the template and try again.');
          return;
        }
        if (raw.length > 500) {
          alert('Maximum 500 rows per import. Please split your file into smaller batches.');
          return;
        }

        const fileHeaders = Object.keys(raw[0]).map(k => k.toLowerCase().trim());
        const missing     = REQUIRED_HEADERS[type].filter(h => !fileHeaders.includes(h));
        if (missing.length) {
          alert(`Missing required column(s): ${missing.join(', ')}\n\nPlease download and use the correct template.`);
          return;
        }

        const rows = raw.map(r => {
          const out = {};
          Object.entries(r).forEach(([k, v]) => {
            out[k.toLowerCase().trim()] = (v ?? '').toString().trim();
          });
          return out;
        });

        const { validRows, errorRows } = validateRows(rows, type);
        setModalData({ validRows, errorRows, totalRows: rows.length });

      } catch (parseErr) {
        console.error('Parse error:', parseErr);
        alert('Failed to read the file. Make sure it is a valid Excel (.xlsx) or CSV file.');
      }
    };
    reader.onerror = () => alert('Failed to read the file. Please try again.');
    reader.readAsBinaryString(file);
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      {customButton ? (
        <div onClick={() => setShowMenu(true)} style={{ display: 'inline-block' }}>
          {customButton}
        </div>
      ) : (
        <button
          onClick={() => setShowMenu(true)}
          className={className || "btn btn-sm"}
          style={style || {
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.875rem',
            boxShadow: '0 2px 6px rgba(37,99,235,0.35)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={!style ? (e => e.currentTarget.style.transform = 'translateY(-1px)') : undefined}
          onMouseLeave={!style ? (e => e.currentTarget.style.transform = 'translateY(0)') : undefined}
          title={`Bulk import ${LABEL_MAP[type]}`}
        >
          {label || '⬆ Bulk Import'}
        </button>
      )}

      {/* ── Pre-Import Menu Modal ────────────────────────────────────────── */}
      {showMenu && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)',
        }} onClick={() => setShowMenu(false)}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            padding: '2rem',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}>📄</div>
            <h2 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary, #1f2937)' }}>
              Import {LABEL_MAP[type]}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6b7280)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
              To ensure a successful import, please download our template, fill in your data, and upload the completed file.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={handleDownloadTemplate}
                style={{
                  background: 'var(--bg-secondary, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-primary, #1f2937)',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
              >
                ⬇️ Download Template
              </button>

              <button
                onClick={triggerFileInput}
                style={{
                  background: '#2563eb',
                  border: 'none',
                  color: '#fff',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 10px rgba(37,99,235,0.3)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
              >
                ⬆️ Upload Completed File
              </button>
            </div>

            <button
              onClick={() => setShowMenu(false)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-secondary, #6b7280)',
                marginTop: '1.25rem', cursor: 'pointer', fontSize: '0.85rem',
                textDecoration: 'underline',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Preview/Review Modal ─────────────────────────────────────────── */}
      {modalData && (
        <BulkImportModal
          type={type}
          validRows={modalData.validRows}
          errorRows={modalData.errorRows}
          totalRows={modalData.totalRows}
          onClose={() => setModalData(null)}
          onSuccess={(result) => {
            setModalData(null);
            onSuccess(result);
          }}
        />
      )}
    </>
  );
}
