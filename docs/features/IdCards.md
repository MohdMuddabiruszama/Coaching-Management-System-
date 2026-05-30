ID CARD SYSTEM
Approach B — Format Selector + Download + Photo
3 Student Designs  ·  3 Faculty Designs  ·  PDF + ZIP Download  ·  Photo Upload  ·  ZenithFlows SaaS


Feature	ID Card System — Approach B
Student Designs	Format 1: Classic · Format 2: Modern Dark · Format 3: Tech/Professional
Faculty Designs	Format 1: Classic Gold · Format 2: Modern Slate · Format 3: Executive Teal
PDF Download	Single card per student/faculty (html2canvas + jsPDF)
Bulk Download	All students in a class ZIP file (JSZip)
Photo Upload	Real photo in card. Placeholder if not uploaded.
Format Persistence	Admin selected format saved per institute in DB
Bug Fixed	Parent name/phone N/A fixed with LEFT JOIN query
 
1. Current State Audit & Bugs to Fix First
From your screenshots, here is exactly what exists, what is missing, and what is broken:

Area	Current State	Status
Student Card — Institute logo + name	Showing correctly	Done
Student Card — QR code	Showing correctly	Done
Student Card — Photo placeholder	Gray placeholder shown	Done (needs real photo)
Student Card — Name, Roll, Email, Class, Gender, Address	All showing	Done
Student Card — Parent name	Shows N/A	Bug — missing JOIN
Student Card — Parent phone	Shows N/A	Bug — missing JOIN
Student Card — 3 designs	Only 1 design (blue theme)	Missing
Student Card — Format selector UI	Not built	Missing
Student Card — PDF download	Not built	Missing
Student Card — Bulk class download	Not built	Missing
Faculty Card — Institute logo + name + phone	Showing	Done
Faculty Card — QR code	Showing	Done
Faculty Card — Name, Role, Emp ID, Email, Phone, Join Date	Showing	Done
Faculty Card — 3 designs	Only 1 design (green theme)	Missing
Faculty Card — Format selector UI	Not built	Missing
Faculty Card — PDF download	Not built	Missing
Faculty Card — Bulk download	Not built	Missing


BUG FIX — Parent N/A (Fix This First — 30 Minutes)
Cause: Your current ID card query does not JOIN the student_parents table.
The parent_name and parent_phone fields return NULL, displayed as N/A.

Fix in: backend/controllers/idcard.controller.js

const student = await sequelize.query(`
  SELECT s.id, s.name, s.roll_number, s.email,
    s.gender, s.address, s.photo_url,
    c.name AS class_name,
    u.name  AS parent_name,
    u.phone AS parent_phone
  FROM students s
  JOIN classes c ON c.id = s.class_id
  LEFT JOIN student_parents sp ON sp.student_id = s.id
  LEFT JOIN users u ON u.id = sp.parent_id AND u.role = 'parent'
  WHERE s.id = :id AND s.institute_id = :institute_id
  LIMIT 1
`, { replacements: { id, institute_id }, type: QueryTypes.SELECT });

Phase 1 — Database Migration 
Two new columns on institutes table to save the selected format per institute.

1.1 Migration SQL
ALTER TABLE institutes
  ADD COLUMN student_card_format TINYINT NOT NULL DEFAULT 1
    COMMENT '1=Classic, 2=Modern Dark, 3=Tech Professional',
  ADD COLUMN faculty_card_format TINYINT NOT NULL DEFAULT 1
    COMMENT '1=Classic Gold, 2=Modern Slate, 3=Executive Teal';

ALTER TABLE students
  ADD COLUMN photo_url VARCHAR(500) NULL
    COMMENT 'Relative path: /uploads/photos/student_123.jpg';

ALTER TABLE users
  ADD COLUMN photo_url VARCHAR(500) NULL
    COMMENT 'For faculty photos stored in users table';

CREATE INDEX idx_students_class ON students(class_id, institute_id);

1.2 Sequelize Model Updates
// models/Institute.js — add:
student_card_format: { type: DataTypes.TINYINT, defaultValue: 1 },
faculty_card_format:  { type: DataTypes.TINYINT, defaultValue: 1 },

// models/Student.js — add if missing:
photo_url: { type: DataTypes.STRING(500), allowNull: true },

// models/User.js — add if missing:
photo_url: { type: DataTypes.STRING(500), allowNull: true },

Phase 2 — Backend: API Endpoints 
5 new endpoints. All ID card data comes from existing tables — no new tables required.

2.1 Controller — controllers/idcard.controller.js
const { sequelize, Institute, Student, User } = require('../models');
const { QueryTypes } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const path = require('path');
const multer = require('multer');

// GET: Single Student ID Card Data
exports.getStudentCard = catchAsync(async (req, res) => {
  const { id } = req.params;
  const institute_id = req.user.institute_id;
  const [student] = await sequelize.query(`
    SELECT s.id, s.name, s.roll_number, s.email,
      s.gender, s.address, s.photo_url,
      c.name AS class_name,
      u.name AS parent_name, u.phone AS parent_phone
    FROM students s
    JOIN  classes c          ON c.id = s.class_id
    LEFT JOIN student_parents sp ON sp.student_id = s.id
    LEFT JOIN users u         ON u.id = sp.parent_id AND u.role='parent'
    WHERE s.id = :id AND s.institute_id = :institute_id LIMIT 1
  `, { replacements:{id,institute_id}, type:QueryTypes.SELECT });
  if (!student) return res.status(404).json({message:'Not found'});
  const institute = await Institute.findByPk(institute_id,
    {attributes:['name','phone','logo_url','primary_color',
                 'website','student_card_format']});
  return res.json({ success:true, data:{ student, institute } });
});

// GET: All Students in a Class (bulk download)
exports.getClassStudents = catchAsync(async (req, res) => {
  const { classId } = req.params;
  const institute_id = req.user.institute_id;
  const students = await sequelize.query(`
    SELECT s.id, s.name, s.roll_number, s.email,
      s.gender, s.address, s.photo_url, c.name AS class_name,
      u.name AS parent_name, u.phone AS parent_phone
    FROM students s
    JOIN  classes c          ON c.id = s.class_id
    LEFT JOIN student_parents sp ON sp.student_id = s.id
    LEFT JOIN users u         ON u.id = sp.parent_id AND u.role='parent'
    WHERE s.class_id = :classId AND s.institute_id = :institute_id
      AND s.status = 'active'
    ORDER BY s.roll_number ASC
  `, { replacements:{classId,institute_id}, type:QueryTypes.SELECT });
  const institute = await Institute.findByPk(institute_id,
    {attributes:['name','phone','logo_url','primary_color',
                 'website','student_card_format']});
  return res.json({ success:true, data:{ students, institute } });
});

// GET/PATCH: Format Settings
exports.getSettings = catchAsync(async (req, res) => {
  const inst = await Institute.findByPk(req.user.institute_id,
    {attributes:['student_card_format','faculty_card_format']});
  return res.json({ success:true, data:inst });
});
exports.saveSettings = catchAsync(async (req, res) => {
  const { student_card_format, faculty_card_format } = req.body;
  await Institute.update(
    { student_card_format, faculty_card_format },
    { where:{ id:req.user.institute_id } }
  );
  return res.json({ success:true, message:'Format saved' });
});

// POST: Upload Photo (multer)
const storage = multer.diskStorage({
  destination: 'uploads/photos/',
  filename: (req,file,cb) => {
    cb(null, `${req.params.type}_${req.params.id}_${Date.now()}`
       + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req,file,cb) => {
    const ok = ['image/jpeg','image/png','image/webp'];
    cb(null, ok.includes(file.mimetype));
  },
}).single('photo');
exports.uploadPhoto = (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({message: err.message});
    const photoUrl = `/uploads/photos/${req.file.filename}`;
    const { type, id } = req.params;
    if (type === 'student') {
      await Student.update({photo_url:photoUrl},{where:{id}});
    } else {
      await User.update({photo_url:photoUrl},{where:{id}});
    }
    return res.json({ success:true, data:{photo_url:photoUrl} });
  });
};

2.2 Routes — routes/idcard.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/idcard.controller');
const { verifyToken, allowRoles } = require('../middleware/auth');

router.get('/settings',  verifyToken, allowRoles('admin','manager'), ctrl.getSettings);
router.patch('/settings', verifyToken, allowRoles('admin','manager'), ctrl.saveSettings);
router.get('/student/:id', verifyToken, allowRoles('admin','manager'), ctrl.getStudentCard);
router.get('/class/:classId', verifyToken, allowRoles('admin','manager'), ctrl.getClassStudents);
router.get('/faculty/:id', verifyToken, allowRoles('admin','manager'), ctrl.getFacultyCard);
router.post('/upload-photo/:type/:id', verifyToken, allowRoles('admin','manager'), ctrl.uploadPhoto);

// Register in app.js:
// app.use('/api/idcard', require('./routes/idcard.routes'));

2.3 API Reference
Method	Endpoint	Role	Description
GET	/api/idcard/settings	admin, manager	Get saved format preference
PATCH	/api/idcard/settings	admin, manager	Save selected format for institute
GET	/api/idcard/student/:id	admin, manager	Student card data with parent info (N/A bug fixed)
GET	/api/idcard/class/:classId	admin, manager	All active students in class for bulk download
GET	/api/idcard/faculty/:id	admin, manager	Faculty card data with employee details
POST	/api/idcard/upload-photo/:type/:id	admin, manager	Upload student/faculty photo (2MB max, JPEG/PNG)

Phase 3 — Shared Utilities: QR Code + PDF Download  
Install required packages, then build shared utilities that all 6 card components will use.

3.1 Install Packages
# In your frontend directory:
npm install html2canvas jspdf jszip
npm install qrcode   # if not already installed

3.2 QRCodeCanvas.jsx — components/idcards/QRCodeCanvas.jsx
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeCanvas({ value, size=80 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size, margin: 1,
      color: { dark:'#000000', light:'#ffffff' },
    });
  }, [value, size]);
  return <canvas ref={canvasRef} style={{display:'block'}} />;
}

3.3 CardPhoto.jsx — components/idcards/CardPhoto.jsx
export default function CardPhoto({ url, width=64, height=80, radius=4, bg='#E0E8FF' }) {
  if (url) return (
    <img src={url} crossOrigin='anonymous'
      style={{ width, height, objectFit:'cover', borderRadius:radius, display:'block' }} />
  );
  return (
    <div style={{ width, height, background:bg, borderRadius:radius,
                  display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center',
                  fontSize:10, color:'#888', gap:4 }}>
      <span style={{fontSize:20}}>👤</span>
      <span>PHOTO</span>
    </div>
  );
}

3.4 downloadIdCard.js — utils/downloadIdCard.js
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function downloadCardAsPDF(elementId, filename) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, {
    scale: 3, useCORS: true, backgroundColor: null, logging: false,
  });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait', unit: 'mm', format: [54, 85.6],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, 54, 85.6);
  pdf.save(`${filename}.pdf`);
}

export async function bulkDownloadAsZip(students, renderFn, format) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
  document.body.appendChild(container);
  for (const student of students) {
    const cardEl = await renderFn(student, format, container);
    const canvas = await html2canvas(cardEl, {scale:2,useCORS:true});
    const blob = await new Promise(res => canvas.toBlob(res,'image/png'));
    zip.file(`${student.roll_number}_id_card.png`, blob);
  }
  document.body.removeChild(container);
  const content = await zip.generateAsync({ type:'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = 'id_cards_class.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}

Phase 4 — Student ID Card Components  
Build all 3 student card designs exactly as shown in the uploaded images. Each component receives the same props interface.

Props Interface — Same for All 6 Card Components
const cardProps = {
  id: 'card-preview',
  institute: {
    name: 'IT HUB', phone: '7988658963',
    logo_url: '/uploads/logo.png',
    primary_color: '#1565C0',
    website: 'www.ithub.com',
  },
  student: {
    name: 'SAMEER REDDY', roll_number: 'RN336',
    email: 'sameerreddy33@gmail.com',
    class_name: 'Class 10 - A', gender: 'Male',
    address: 'Hyderabad, India',
    photo_url: null,
    parent_name: 'Meena Khan',
    parent_phone: '9876543210',
  },
  qrValue: 'https://zenithflows.in/verify/RN336',
  validTill: '31 Mar 2024',
  batch: '2023-24',
};


4.1 Student Card Format 1 — Classic (Blue/Teal Theme)
Portrait card. Blue-to-teal gradient header. White body with photo left, QR code right. Info in 2-column grid. Website and phone in footer.

// components/idcards/StudentCard1.jsx
import CardPhoto from './CardPhoto';
import QRCodeCanvas from './QRCodeCanvas';

export default function StudentCard1({ id='card-preview', institute, student, qrValue, validTill }) {
  const accent = institute?.primary_color || '#1565C0';
  return (
    <div id={id} style={{
      width:320, minHeight:490, borderRadius:14,
      boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
      overflow:'hidden', fontFamily:'Arial,sans-serif', background:'#fff',
    }}>
      {/* Header — gradient */}
      <div style={{
        background:`linear-gradient(135deg, ${accent}, #00BCD4)`,
        padding:'16px 14px', display:'flex',
        alignItems:'center', gap:10, position:'relative',
      }}>
        <div style={{width:42,height:42,borderRadius:'50%',
          background:'rgba(255,255,255,0.2)',
          display:'flex',alignItems:'center',justifyContent:'center',
          color:'#fff',fontWeight:'bold',fontSize:14}}>
          {institute?.logo_url
            ? <img src={institute.logo_url} style={{width:38,height:38,borderRadius:'50%'}} />
            : (institute?.name||'').slice(0,2).toUpperCase()}
        </div>
        <div>
          <div style={{color:'#fff',fontWeight:'bold',fontSize:15}}>{institute?.name}</div>
          <div style={{color:'rgba(255,255,255,0.85)',fontSize:10}}>COACHING CENTER</div>
        </div>
        <div style={{position:'absolute',right:14,top:14,
          background:'rgba(255,255,255,0.25)',color:'#fff',
          fontSize:9,fontWeight:'bold',padding:'3px 10px',borderRadius:4}}>
          STUDENT ID
        </div>
      </div>
      {/* Body */}
      <div style={{padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',
                     alignItems:'flex-start',marginBottom:12}}>
          <div style={{border:'2px solid #E0E0E0',borderRadius:6,padding:2}}>
            <CardPhoto url={student?.photo_url} width={72} height={90} />
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:9,color:'#888',marginBottom:4}}>QR CODE</div>
            <QRCodeCanvas value={qrValue} size={72} />
          </div>
        </div>
        <div style={{fontWeight:'bold',fontSize:18,color:'#0D1B2A',marginBottom:2}}>
          {student?.name?.toUpperCase()}
        </div>
        <div style={{fontSize:10,color:'#888',letterSpacing:2,marginBottom:10}}>
          STUDENT IDENTITY CARD
        </div>
        <hr style={{border:'none',borderTop:'1px solid #eee',margin:'0 0 10px'}} />
        {[
          ['ROLL NO.',student?.roll_number, 'CLASS',  student?.class_name],
          ['EMAIL',   student?.email,       'GENDER', student?.gender],
          ['ADDRESS', student?.address,     'COURSE', student?.class_name],
        ].map(([l1,v1,l2,v2],i) => (
          <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr',
                              gap:4,marginBottom:8}}>
            <div>
              <div style={{fontSize:8,color:'#999',letterSpacing:1}}>{l1}</div>
              <div style={{fontSize:11,color:'#222',fontWeight:500}}>{v1}</div>
            </div>
            <div>
              <div style={{fontSize:8,color:'#999',letterSpacing:1}}>{l2}</div>
              <div style={{fontSize:11,color:'#222',fontWeight:500}}>{v2}</div>
            </div>
          </div>
        ))}
        <hr style={{border:'none',borderTop:'1px solid #eee',margin:'8px 0'}} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:10,color:accent}}>
            🌐 {institute?.website}<br/>📞 {institute?.phone}
          </div>
          <div style={{textAlign:'right',fontSize:9,color:'#888'}}>
            Valid Till
            <div style={{fontSize:11,fontWeight:'bold',color:'#222'}}>{validTill}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


4.2 Student Card Format 2 — Modern Dark (Navy Theme)
Dark navy background. Purple-to-pink gradient top strip. Large name on right of photo. Bullet-point info list. QR and website in dark footer bar.

// components/idcards/StudentCard2.jsx
export default function StudentCard2({ id='card-preview', institute, student, qrValue, validTill, batch }) {
  return (
    <div id={id} style={{
      width:320, minHeight:480, borderRadius:14,
      background:'#0D1B3E', overflow:'hidden',
      fontFamily:'Arial,sans-serif', color:'#fff',
      boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{height:5,background:'linear-gradient(90deg,#7B2FF7,#FF6B9D)'}} />
      <div style={{padding:'12px 14px',display:'flex',
                   justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{width:36,height:36,borderRadius:8,background:'#7B2FF7',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#fff',fontWeight:'bold',fontSize:13}}>
            {(institute?.name||'').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{fontWeight:'bold',fontSize:14}}>{institute?.name}</div>
            <div style={{fontSize:9,color:'#8899BB',letterSpacing:1}}>COACHING CENTER</div>
          </div>
        </div>
        <div style={{background:'rgba(255,255,255,0.12)',fontSize:9,fontWeight:'bold',
          padding:'4px 10px',borderRadius:20,letterSpacing:1}}>STUDENT ID</div>
      </div>
      <div style={{padding:'0 14px 14px',display:'flex',gap:12}}>
        <div style={{flexShrink:0}}>
          <div style={{border:'2px solid #2A3A5E',borderRadius:8,overflow:'hidden'}}>
            <CardPhoto url={student?.photo_url} width={80} height={100} bg='#1A2A4E' />
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:'bold',fontSize:17,marginBottom:8}}>
            {student?.name?.toUpperCase()}
          </div>
          <div style={{background:'#2A3A5E',borderRadius:4,
            padding:'2px 8px',fontSize:11,marginBottom:10,display:'inline-block'}}>
            Roll No: {student?.roll_number}
          </div>
          {[['CLASS',student?.class_name],['EMAIL',student?.email],
            ['GENDER',student?.gender],['ADDRESS',student?.address]],
          ].map(([label,val])=>(
            <div key={label} style={{display:'grid',gridTemplateColumns:'70px 1fr',
              gap:4,marginBottom:4,fontSize:11}}>
              <span style={{color:'#8899BB',fontSize:9}}>● {label}</span>
              <span style={{color:'#E0E8FF'}}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#08102A',padding:'10px 14px',
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <QRCodeCanvas value={qrValue} size={48} />
          <div>
            <div style={{fontSize:8,color:'#8899BB',letterSpacing:1}}>QR CODE</div>
            <div style={{fontSize:10,color:'#7B2FF7'}}>{institute?.website}</div>
            <div style={{fontSize:9,color:'#8899BB'}}>Valid: {validTill}</div>
          </div>
        </div>
        <div style={{textAlign:'right',fontSize:9,color:'#8899BB'}}>
          📞 {institute?.phone}<br/>Batch: {batch}
        </div>
      </div>
    </div>
  );
}


4.3 Student Card Format 3 — Tech/Professional (Teal Theme)
Teal header with decorative circle watermark. Info in 2-col grid left. Photo and QR stacked on right. Teal footer with batch info and barcode decoration.

// components/idcards/StudentCard3.jsx
export default function StudentCard3({ id='card-preview', institute, student, qrValue, validTill, batch }) {
  return (
    <div id={id} style={{width:320,minHeight:510,borderRadius:14,
      overflow:'hidden',fontFamily:'Arial,sans-serif',
      boxShadow:'0 4px 24px rgba(0,0,0,0.18)'}}>
      {/* Teal header */}
      <div style={{background:'#00695C',padding:'14px 16px',
        position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',right:-30,top:-30,
          width:120,height:120,borderRadius:'50%',
          background:'rgba(255,255,255,0.08)'}} />
        <div style={{display:'flex',gap:10,alignItems:'center',position:'relative'}}>
          <div style={{width:36,height:36,borderRadius:8,
            background:'rgba(255,255,255,0.2)',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#fff',fontWeight:'bold',fontSize:13}}>
            {(institute?.name||'').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{color:'#fff',fontWeight:'bold',fontSize:16}}>{institute?.name}</div>
            <div style={{color:'rgba(255,255,255,0.8)',fontSize:9}}>COACHING CENTER</div>
          </div>
          <div style={{marginLeft:'auto',background:'rgba(255,255,255,0.2)',
            padding:'3px 8px',borderRadius:4,fontSize:10,color:'#fff'}}>
            📞 {institute?.phone}
          </div>
        </div>
      </div>
      {/* Body */}
      <div style={{background:'#fff',padding:'16px'}}>
        <div style={{fontWeight:'bold',fontSize:20,color:'#00695C',marginBottom:2}}>
          {student?.name?.toUpperCase()}
        </div>
        <div style={{fontSize:11,color:'#00897B',letterSpacing:2,marginBottom:12}}>
          STUDENT IDENTITY CARD
        </div>
        <div style={{display:'flex',gap:10}}>
          <div style={{flex:1}}>
            {[['ROLL NO',student?.roll_number],['GENDER',student?.gender],
              ['CLASS',student?.class_name],['EMAIL',student?.email],
              ['ADDRESS',student?.address],['VALID TILL',validTill],
            ].map(([l,v])=>(
              <div key={l} style={{marginBottom:7}}>
                <div style={{fontSize:8,color:'#999',letterSpacing:1,fontWeight:'bold'}}>{l}</div>
                <div style={{fontSize:11,color:'#111',fontWeight:500}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
            <div>
              <div style={{fontSize:8,color:'#999',textAlign:'center',marginBottom:4}}>PHOTO</div>
              <div style={{border:'2px solid #B2DFDB',borderRadius:6}}>
                <CardPhoto url={student?.photo_url} width={72} height={88} bg='#E0F2F1' />
              </div>
            </div>
            <div>
              <div style={{fontSize:8,color:'#999',textAlign:'center',marginBottom:4}}>QR CODE</div>
              <div style={{border:'2px solid #B2DFDB',borderRadius:4,padding:2}}>
                <QRCodeCanvas value={qrValue} size={64} />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Teal footer */}
      <div style={{background:'#00695C',padding:'8px 16px',
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{color:'#fff',fontSize:10}}>🌐 {institute?.website}</div>
        <div style={{background:'rgba(255,255,255,0.2)',color:'#fff',
          fontSize:9,padding:'2px 8px',borderRadius:4,fontWeight:'bold'}}>
          BATCH {batch}
        </div>
        <div style={{display:'flex',gap:2}}>
          {[3,5,2,4,3,5,2,3,4,2].map((h,i)=>(
            <div key={i} style={{width:2,height:h*3,
              background:'rgba(255,255,255,0.5)',borderRadius:1}}/>
          ))}
        </div>
      </div>
    </div>
  );
}

Phase 5 — Faculty ID Card Components 
Build all 3 faculty card designs exactly as shown in the uploaded faculty images. Same shared utilities as student cards.

Faculty Props Interface
const facultyCardProps = {
  id: 'faculty-card-preview',
  institute: { name:'IT HUB', phone:'7988658963',
    logo_url:null, primary_color:'#1565C0', website:'www.ithub.com' },
  faculty: {
    name: 'Faizan Ahmed',
    role: 'Political Science Teacher',
    employee_id: 'EMP-19',
    department: 'Science',
    phone: '9876543218',
    email: 'faizan@example.com',
    join_date: '25 Apr 2023',
    photo_url: null,
    status: 'Active',
  },
  qrValue: 'https://zenithflows.in/verify/EMP-19',
};


5.1 Faculty Card Format 1 — Classic Gold
Black header with gold accent border. Faculty name and gold role badge. Info rows with gold labels. QR code bottom-left. Footer with website and employee info.

// components/idcards/FacultyCard1.jsx
export default function FacultyCard1({ id='faculty-card', institute, faculty, qrValue }) {
  return (
    <div id={id} style={{width:320,minHeight:480,borderRadius:14,
      overflow:'hidden',fontFamily:'Arial,sans-serif',
      boxShadow:'0 4px 24px rgba(0,0,0,0.25)'}}>
      <div style={{background:'#1A1A1A',padding:'16px 14px',
        borderBottom:'3px solid #F9A825'}}>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{width:44,height:44,borderRadius:'50%',background:'#F9A825',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'#1A1A1A',fontWeight:'bold',fontSize:16}}>
            {(institute?.name||'').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{color:'#F9A825',fontWeight:'bold',fontSize:16,letterSpacing:1}}>
              {institute?.name}
            </div>
            <div style={{color:'#999',fontSize:9,letterSpacing:2}}>COACHING CENTER</div>
            <div style={{color:'#888',fontSize:9,marginTop:2}}>Ph: {institute?.phone}</div>
          </div>
          <div style={{marginLeft:'auto',background:'#F9A825',color:'#1A1A1A',
            fontSize:9,fontWeight:'bold',padding:'4px 10px',borderRadius:4}}>FACULTY</div>
        </div>
      </div>
      <div style={{background:'#fff',padding:'14px 16px'}}>
        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <div>
            <CardPhoto url={faculty?.photo_url} width={72} height={90} bg='#FFF8E1' />
            <div style={{fontSize:8,color:'#999',textAlign:'center',marginTop:3}}>PHOTO</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:'bold',fontSize:16,color:'#1A1A1A',marginBottom:4}}>
              {faculty?.name}
            </div>
            <div style={{background:'#F9A825',color:'#1A1A1A',fontSize:10,
              fontWeight:'bold',padding:'3px 8px',borderRadius:3,
              display:'inline-block',marginBottom:8}}>
              {faculty?.role?.toUpperCase()}
            </div>
            {[['EMP ID',faculty?.employee_id],['DEPT',faculty?.department],
              ['PHONE',faculty?.phone],['EMAIL',faculty?.email],
              ['JOINED',faculty?.join_date]].map(([l,v])=>(
              <div key={l} style={{display:'flex',gap:6,marginBottom:4,fontSize:11}}>
                <span style={{color:'#F9A825',fontWeight:'bold',minWidth:50,fontSize:10}}>{l}</span>
                <span style={{color:'#333'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{borderTop:'1px solid #eee',paddingTop:10,
          display:'flex',gap:10,alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:8,color:'#999',marginBottom:3}}>QR CODE</div>
            <QRCodeCanvas value={qrValue} size={64} />
          </div>
          <div style={{flex:1,textAlign:'right',fontSize:10}}>
            <div style={{color:'#F9A825',fontWeight:'bold'}}>{institute?.website}</div>
            <div style={{color:'#888',fontSize:9}}>{faculty?.employee_id} / {faculty?.department} Dept.</div>
            <div style={{color:'#888',fontSize:9}}>Joined: {faculty?.join_date}</div>
          </div>
        </div>
      </div>
    </div>
  );
}


5.2 Faculty Card Format 2 — Modern Slate
Dark slate background. Blue left sidebar with vertical institute name. Right panel with photo, role badge, info rows. Blue bottom bar with QR code.

// components/idcards/FacultyCard2.jsx
export default function FacultyCard2({ id='faculty-card', institute, faculty, qrValue }) {
  return (
    <div id={id} style={{width:320,minHeight:480,borderRadius:14,
      background:'#1A2035',overflow:'hidden',fontFamily:'Arial,sans-serif',
      color:'#fff',boxShadow:'0 4px 24px rgba(0,0,0,0.4)',display:'flex'}}>
      {/* Blue left sidebar */}
      <div style={{width:52,background:'#1565C0',flexShrink:0,
        display:'flex',flexDirection:'column',alignItems:'center',padding:'12px 0'}}>
        <div style={{width:36,height:36,borderRadius:8,
          background:'rgba(255,255,255,0.2)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontWeight:'bold',fontSize:13,marginBottom:12}}>
          {(institute?.name||'').slice(0,2).toUpperCase()}
        </div>
        <div style={{writingMode:'vertical-rl',transform:'rotate(180deg)',
          fontSize:11,fontWeight:'bold',letterSpacing:2,
          color:'rgba(255,255,255,0.8)',flex:1,
          display:'flex',alignItems:'center'}}>
          {institute?.name}
        </div>
        <div style={{writingMode:'vertical-rl',transform:'rotate(180deg)',
          fontSize:8,color:'rgba(255,255,255,0.5)',marginBottom:8}}>
          Coaching Center
        </div>
      </div>
      {/* Main content */}
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 14px 10px'}}>
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{border:'2px solid #2A3A5E',borderRadius:8,overflow:'hidden'}}>
              <CardPhoto url={faculty?.photo_url} width={72} height={90} bg='#141F35' />
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:'bold',fontSize:15,marginBottom:4}}>{faculty?.name}</div>
              <div style={{background:'rgba(21,101,192,0.3)',
                border:'1px solid #1565C0',borderRadius:12,
                padding:'2px 10px',fontSize:10,display:'inline-flex',
                alignItems:'center',gap:4,marginBottom:10}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#1565C0'}} />
                {faculty?.role}
              </div>
            </div>
          </div>
          {[['EMP ID',faculty?.employee_id],['DEPT',faculty?.department],
            ['EMAIL',faculty?.email],['PHONE',faculty?.phone],
            ['JOINED',faculty?.join_date]].map(([l,v])=>(
            <div key={l} style={{display:'grid',gridTemplateColumns:'70px 1fr',
              gap:6,marginBottom:5,fontSize:11,alignItems:'center'}}>
              <span style={{color:'#556080',fontSize:9,letterSpacing:1}}>☐ {l}</span>
              <span style={{color:'#C8D4F0'}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:'auto',background:'#0D1525',padding:'10px 14px',
          display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <QRCodeCanvas value={qrValue} size={44} />
            <div>
              <div style={{fontSize:8,color:'#556080',letterSpacing:1}}>QR CODE</div>
              <div style={{fontSize:10,color:'#1565C0'}}>{institute?.website}</div>
            </div>
          </div>
          <div style={{background:'#1565C0',color:'#fff',fontSize:9,
            fontWeight:'bold',padding:'4px 8px',borderRadius:4}}>FACULTY</div>
        </div>
      </div>
    </div>
  );
}


5.3 Faculty Card Format 3 — Executive Teal
Teal header with institute info AND photo side by side. White body with name, role, EMP ID badge. Info 2-column grid. Teal footer with QR code and website.

// components/idcards/FacultyCard3.jsx
export default function FacultyCard3({ id='faculty-card', institute, faculty, qrValue }) {
  return (
    <div id={id} style={{width:320,minHeight:490,borderRadius:14,
      overflow:'hidden',fontFamily:'Arial,sans-serif',
      boxShadow:'0 4px 24px rgba(0,0,0,0.2)'}}>
      <div style={{background:'#00695C',padding:'14px 16px',
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
            <div style={{width:34,height:34,borderRadius:8,
              background:'rgba(255,255,255,0.2)',
              display:'flex',alignItems:'center',justifyContent:'center',
              color:'#fff',fontWeight:'bold',fontSize:13}}>
              {(institute?.name||'').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{color:'#fff',fontWeight:'bold',fontSize:15}}>{institute?.name}</div>
              <div style={{color:'rgba(255,255,255,0.8)',fontSize:9}}>COACHING CENTER</div>
            </div>
          </div>
          <div style={{fontSize:9,color:'rgba(255,255,255,0.85)',display:'flex',gap:12}}>
            <span>☐ {institute?.phone}</span>
            <span>☐ {institute?.website}</span>
          </div>
        </div>
        <div style={{border:'2px solid rgba(255,255,255,0.4)',
          borderRadius:8,overflow:'hidden'}}>
          <CardPhoto url={faculty?.photo_url} width={60} height={72} bg='#004D40' />
          <div style={{fontSize:8,color:'rgba(255,255,255,0.7)',textAlign:'center',
            padding:'2px',background:'rgba(0,0,0,0.1)'}}>PHOTO</div>
        </div>
      </div>
      <div style={{background:'#fff',padding:'14px 16px'}}>
        <div style={{marginBottom:10}}>
          <div style={{fontWeight:'bold',fontSize:18,color:'#1A1A1A',marginBottom:2}}>
            {faculty?.name}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:12,color:'#00695C',fontWeight:500}}>{faculty?.role}</div>
            <span style={{color:'#ccc'}}>•</span>
            <div style={{background:'#E0F2F1',color:'#00695C',
              fontSize:10,fontWeight:'bold',padding:'2px 8px',borderRadius:4}}>
              {faculty?.employee_id}
            </div>
          </div>
        </div>
        <hr style={{border:'none',borderTop:'1px solid #E0F2F1',margin:'0 0 12px'}} />
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px'}}>
          {[['DEPARTMENT',faculty?.department],['PHONE',faculty?.phone],
            ['EMAIL',faculty?.email],['JOIN DATE',faculty?.join_date],
            ['STATUS',faculty?.status||'Active'],
          ].map(([l,v])=>(
            <div key={l}>
              <div style={{fontSize:8,color:'#999',letterSpacing:1,fontWeight:'bold'}}>{l}</div>
              <div style={{fontSize:11,
                color:l==='STATUS'?'#00695C':'#222',
                fontWeight:l==='STATUS'?'bold':'normal'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:'#00695C',padding:'10px 16px',
        display:'flex',alignItems:'center',gap:10}}>
        <QRCodeCanvas value={qrValue} size={44} />
        <div style={{color:'rgba(255,255,255,0.9)',fontSize:10}}>
          🌐 {institute?.website}
        </div>
      </div>
    </div>
  );
}

Phase 6 — Admin ID Cards Page 
Main admin page: two tabs (Students / Faculty), format selector with 3 thumbnails, live preview panel, and download buttons.

6.1 pages/admin/IdCards.jsx — Main Page
import { useState, useEffect } from 'react';
import StudentCard1 from '../../components/idcards/StudentCard1';
import StudentCard2 from '../../components/idcards/StudentCard2';
import StudentCard3 from '../../components/idcards/StudentCard3';
import FacultyCard1  from '../../components/idcards/FacultyCard1';
import FacultyCard2  from '../../components/idcards/FacultyCard2';
import FacultyCard3  from '../../components/idcards/FacultyCard3';
import { downloadCardAsPDF, bulkDownloadAsZip } from '../../utils/downloadIdCard';
import idCardService from '../../services/idcard.service';

const STUDENT_FORMATS = [
  { id:1, name:'Classic',     desc:'Portrait - Blue/Teal header' },
  { id:2, name:'Modern Dark', desc:'Portrait - Navy background'  },
  { id:3, name:'Tech Pro',    desc:'Portrait - Green accent'     },
];
const FACULTY_FORMATS = [
  { id:1, name:'Classic Gold', desc:'Portrait - Black & Gold' },
  { id:2, name:'Modern Slate', desc:'Portrait - Dark sidebar' },
  { id:3, name:'Exec. Teal',   desc:'Portrait - Teal executive' },
];
const STUDENT_CARDS = { 1:StudentCard1, 2:StudentCard2, 3:StudentCard3 };
const FACULTY_CARDS = { 1:FacultyCard1, 2:FacultyCard2, 3:FacultyCard3 };

export default function IdCards() {
  const [tab,           setTab]          = useState('student');
  const [studentFormat, setStudentFormat] = useState(1);
  const [facultyFormat, setFacultyFormat] = useState(1);
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [institute,     setInstitute]     = useState(null);
  const [classes,       setClasses]       = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students,      setStudents]      = useState([]);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    idCardService.getSettings().then(s => {
      setStudentFormat(s.student_card_format || 1);
      setFacultyFormat(s.faculty_card_format || 1);
    });
  }, []);

  const handleSaveFormat = async () => {
    setSaving(true);
    await idCardService.saveSettings({
      student_card_format: studentFormat,
      faculty_card_format: facultyFormat,
    });
    setSaving(false);
    alert('Format saved as default!');
  };

  const StudentCardComp = STUDENT_CARDS[studentFormat];
  const FacultyCardComp = FACULTY_CARDS[facultyFormat];

  return (
    <div style={{padding:'1.5rem'}}>
      <h1>ID Cards</h1>
      {/* Tabs + Save button */}
      <div style={{display:'flex',gap:8,marginBottom:'1.5rem'}}>
        {['student','faculty'].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{background:tab===t?'#1565C0':'#f5f5f5',
              color:tab===t?'#fff':'#333',
              border:'none',padding:'8px 20px',borderRadius:6,cursor:'pointer'}}>
            {t==='student'?'Students':'Faculty'}
          </button>
        ))}
        <button onClick={handleSaveFormat} disabled={saving}
          style={{marginLeft:'auto',background:'#2E7D32',color:'#fff',
                  border:'none',padding:'8px 16px',borderRadius:6}}>
          {saving?'Saving...':'Save as Default Format'}
        </button>
      </div>

      {/* 3-column layout */}
      <div style={{display:'grid',gridTemplateColumns:'200px 1fr 360px',gap:'1.5rem'}}>
        {/* Format selector */}
        <div>
          <h3 style={{marginBottom:'1rem',fontSize:14}}>Choose Format</h3>
          {(tab==='student'?STUDENT_FORMATS:FACULTY_FORMATS).map(f=>(
            <div key={f.id}
              onClick={()=>tab==='student'?setStudentFormat(f.id):setFacultyFormat(f.id)}
              style={{
                border:(tab==='student'?studentFormat:facultyFormat)===f.id
                  ?'2px solid #1565C0':'1px solid #E0E0E0',
                borderRadius:8,padding:8,marginBottom:8,cursor:'pointer',
                background:(tab==='student'?studentFormat:facultyFormat)===f.id
                  ?'#E3F2FD':'#fff',
              }}>
              <div style={{height:100,background:'#f5f5f5',borderRadius:4,
                marginBottom:6,display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:11,color:'#888'}}>
                Format {f.id}
              </div>
              <div style={{fontSize:12,fontWeight:500}}>{f.name}</div>
              <div style={{fontSize:11,color:'#888'}}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* List panel — swap StudentListPanel / FacultyListPanel here */}
        <div>
          {/* Implement StudentListPanel and FacultyListPanel as separate components */}
          {/* They call idCardService to load data and call onSelect when a row is clicked */}
        </div>

        {/* Live preview */}
        <div>
          <h3 style={{marginBottom:'1rem',fontSize:14}}>Live Preview</h3>
          {selectedItem ? (
            <>
              {tab==='student'
                ? <StudentCardComp id='card-preview' institute={institute}
                    student={selectedItem}
                    qrValue={`https://zenithflows.in/verify/${selectedItem.roll_number}`}
                    validTill='31 Mar 2025' batch='2024-25' />
                : <FacultyCardComp id='card-preview' institute={institute}
                    faculty={selectedItem}
                    qrValue={`https://zenithflows.in/verify/${selectedItem.employee_id}`} />
              }
              <div style={{marginTop:'1rem',display:'flex',gap:8}}>
                <button
                  onClick={()=>downloadCardAsPDF('card-preview',
                    `${selectedItem.name}_id_card`)}
                  style={{flex:1,background:'#1565C0',color:'#fff',
                    border:'none',padding:'10px',borderRadius:6}}>
                  Download PDF
                </button>
              </div>
              {tab==='student' && selectedClass && (
                <button style={{width:'100%',marginTop:8,background:'#2E7D32',
                  color:'#fff',border:'none',padding:'10px',borderRadius:6}}>
                  Bulk Download Class ZIP
                </button>
              )}
            </>
          ) : (
            <div style={{textAlign:'center',color:'#888',padding:'3rem 1rem'}}>
              Select a student or faculty to preview their ID card
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Phase 7 — Frontend Service & Photo Upload 

7.1 services/idcard.service.js
import api from './api';

const idCardService = {
  getSettings:    ()    => api.get('/api/idcard/settings').then(r=>r.data.data),
  saveSettings:   (d)   => api.patch('/api/idcard/settings',d).then(r=>r.data),
  getStudent:     (id)  => api.get(`/api/idcard/student/${id}`).then(r=>r.data.data),
  getClassStudents:(cid)=> api.get(`/api/idcard/class/${cid}`).then(r=>r.data.data),
  getFaculty:     (id)  => api.get(`/api/idcard/faculty/${id}`).then(r=>r.data.data),
  uploadPhoto: (type, id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post(`/api/idcard/upload-photo/${type}/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data.data);
  },
};
export default idCardService;

7.2 Photo Upload Button Component
function PhotoUploadButton({ type, id, onUploaded }) {
  const inputRef = useRef(null);
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2*1024*1024) { alert('Max 2MB'); return; }
    const result = await idCardService.uploadPhoto(type, id, file);
    onUploaded(result.photo_url);
  };
  return (
    <>
      <input ref={inputRef} type='file' accept='image/*'
        style={{display:'none'}} onChange={handleFile} />
      <button onClick={()=>inputRef.current.click()}
        style={{fontSize:11,padding:'2px 8px',borderRadius:4,
                border:'1px solid #ddd',cursor:'pointer'}}>
        Upload Photo
      </button>
    </>
  );
}

Phase 8 — Execution Timeline & Testing Checklist

8.1  Execution Plan
Phase	Tasks	Verify
Bug Fix + DB	Fix N/A bug in backend query · Run SQL migration · Update Sequelize models	SELECT FROM institutes - see new columns
Phase 2	5 API endpoints in idcard.controller.js · Register routes in app.js	Postman: GET /api/idcard/student/:id - parent_name shows correctly
Phase 3	npm install html2canvas jspdf jszip · Build QRCodeCanvas.jsx · CardPhoto.jsx · downloadIdCard.js	QR code renders correctly in browser
Phase 4A	Build StudentCard1.jsx (Classic Blue)	Card renders with real institute data
Phase 4B	Build StudentCard2.jsx (Modern Dark) + StudentCard3.jsx (Tech Pro)	All 3 student formats render correctly
Phase 5	Build FacultyCard1.jsx (Classic Gold) + FacultyCard2.jsx (Slate) + FacultyCard3.jsx (Teal)	All 3 faculty formats render correctly
Phase 6	Build pages/admin/IdCards.jsx with format selector + list + preview + download	Admin can switch formats, see live preview, download PDF
Phase 7+8	Frontend service · Photo upload · Bulk ZIP · Save format preference · End-to-end test	Bulk ZIP downloads correctly for 10-student class


8.2 Final Testing Checklist
	Test Scenario	Expected Result	Role
[ ]	Student card shows parent_name and parent_phone	Shows real name and phone, not N/A	Admin
[ ]	Switch to Format 2 (Modern Dark) - preview updates	Dark navy card shows instantly	Admin
[ ]	Switch to Format 3 (Tech Pro) - preview updates	Teal card shows instantly	Admin
[ ]	Download single student card as PDF	PDF at 85.6mm x 54mm with high resolution	Admin
[ ]	Upload student photo - shows in card preview	Photo appears in card instead of placeholder	Admin
[ ]	Save as Default Format - reload page	Same format pre-selected on next load	Admin
[ ]	Select class then Bulk Download ZIP	ZIP with all active students' card images	Admin
[ ]	Switch to Faculty tab - 3 faculty formats visible	Format selector shows gold/slate/teal options	Admin
[ ]	Faculty Card 1 (Classic Gold) download PDF	Gold-themed card downloads as PDF	Admin
[ ]	Faculty Card 2 (Modern Slate) sidebar shows	Vertical institute name in blue sidebar	Admin
[ ]	Faculty Card 3 (Executive Teal) photo in header	Photo appears in teal header section	Admin
[ ]	Institute logo shows in cards	Logo image loads with useCORS:true	Admin
[ ]	QR code renders in downloaded PDF	QR code is scannable in PDF output	Admin


8.3 Files Changed Summary
File	Action	Phase
backend/scripts/idcard_migration.sql	New - run once	1
backend/models/Institute.js	Modify - 2 format columns	1
backend/models/Student.js	Modify - photo_url column	1
backend/models/User.js	Modify - photo_url column	1
backend/controllers/idcard.controller.js	New - 6 handlers	2
backend/routes/idcard.routes.js	New - 6 routes	2
backend/app.js	Modify - register idcard routes	2
frontend/src/components/idcards/QRCodeCanvas.jsx	New	3
frontend/src/components/idcards/CardPhoto.jsx	New	3
frontend/src/utils/downloadIdCard.js	New - PDF + ZIP	3
frontend/src/components/idcards/StudentCard1.jsx	New - Classic	4
frontend/src/components/idcards/StudentCard2.jsx	New - Modern Dark	4
frontend/src/components/idcards/StudentCard3.jsx	New - Tech Pro	4
frontend/src/components/idcards/FacultyCard1.jsx	New - Classic Gold	5
frontend/src/components/idcards/FacultyCard2.jsx	New - Modern Slate	5
frontend/src/components/idcards/FacultyCard3.jsx	New - Executive Teal	5
frontend/src/pages/admin/IdCards.jsx	New - main admin page	6
frontend/src/services/idcard.service.js	New	7


Performance & Technical Notes
html2canvas scale:3 produces 3x resolution - crisp at print quality for 85.6mm cards.
useCORS:true in html2canvas is required if institute logo is hosted on a different domain.
QRCode.toCanvas() - zero server calls, renders entirely in browser from qrcode npm package.
Bulk ZIP renders cards sequentially in a hidden off-screen div. 30-student class takes ~15s.
Format persistence: single PATCH /api/idcard/settings call saves to institutes table.
Photo upload: multer limits to 2MB JPEG/PNG/WebP, stored in uploads/photos/ folder.
PDF format: jsPDF format:[54,85.6] is standard credit card size (ISO/IEC 7810 ID-1).
All 6 card components are pure React - no external CSS files - self-contained for html2canvas.

