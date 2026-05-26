🌐
SUBDOMAIN MULTI-TENANT
zenithflows.in   +   institute.zenithflows.in
Complete Phase-by-Phase Implementation Guide — Namecheap + Node.js + React
Your Domain	zenithflows.in (Namecheap)
Main Website	zenithflows.in → Your SaaS marketing/landing page
Institute Portal	iitcoaching.zenithflows.in → That institute's public page
App Dashboard	app.zenithflows.in → Login + SaaS dashboard
API	api.zenithflows.in → Backend Node.js API
Total Phases	12 Implementation Phases
DNS Setup	Namecheap Wildcard DNS → Railway/Vercel
Detection Method	req.hostname subdomain extraction in Node.js
 
1. How the Subdomain System Works
The entire system is based on a single concept: Wildcard DNS. You tell Namecheap that ANY subdomain of zenithflows.in should point to your server. Your server reads the subdomain from the incoming request and serves the correct content.

Complete Request Flow — Step by Step
USER TYPES: iitcoaching.zenithflows.in

STEP 1 — DNS Resolution:
  Browser asks DNS: what is the IP of iitcoaching.zenithflows.in?
  Namecheap wildcard record (*) matches ANY subdomain → returns your server IP
  Browser connects to your server on port 443 (HTTPS)

STEP 2 — SSL Certificate:
  Your wildcard SSL certificate (*.zenithflows.in) matches the subdomain
  Connection is secured ✅

STEP 3 — Server Reads Subdomain:
  Your Node.js/React server receives the request
  It reads: req.hostname = 'iitcoaching.zenithflows.in'
  Extracts subdomain: 'iitcoaching'

STEP 4 — Database Lookup:
  Backend looks up: SELECT * FROM institutes WHERE subdomain = 'iitcoaching'
  If found → returns institute data (name, logo, colors, about, contact)
  If not found → returns 404 page

STEP 5 — Public Page Renders:
  React frontend renders the institute's public website
  Shows: institute name, logo, courses, faculty, contact, admission form
  Visitor can click 'Student Login' → redirected to login page


1.1 Domain Architecture Map
URL	What It Shows	Who Uses It
zenithflows.in	Your SaaS marketing website (landing page)	Anyone browsing the internet
www.zenithflows.in	Same as above (CNAME → zenithflows.in)	Same
app.zenithflows.in	Login page + full SaaS dashboard	Institute admins, faculty, students
api.zenithflows.in	Node.js REST API backend	Frontend apps
iitcoaching.zenithflows.in	IIT Coaching institute's public page	Students/parents browsing that institute
greenwood.zenithflows.in	Greenwood School's public page	Students/parents of that school
anyname.zenithflows.in	That institute's page (dynamic)	Public visitors

Phase 1 — Database Changes
Add subdomain and public website configuration to the institutes table. Every institute gets a unique subdomain slug and can customize their public page.

1.1 Update Institutes Table
-- Run this migration on your MySQL database
ALTER TABLE institutes
  ADD COLUMN subdomain          VARCHAR(50)  UNIQUE NULL
    COMMENT 'URL slug: iitcoaching → iitcoaching.zenithflows.in',
  ADD COLUMN tagline            VARCHAR(255) NULL
    COMMENT 'Shown on public website hero section',
  ADD COLUMN about_text         TEXT         NULL
    COMMENT 'About the institute — shown on public page',
  ADD COLUMN primary_color      VARCHAR(7)   DEFAULT '#1565C0'
    COMMENT 'Hex color for institute branding e.g. #FF5722',
  ADD COLUMN secondary_color    VARCHAR(7)   DEFAULT '#E3F2FD',
  ADD COLUMN cover_image_url    VARCHAR(500) NULL
    COMMENT 'Hero banner image for public page',
  ADD COLUMN logo_url           VARCHAR(500) NULL
    COMMENT 'Institute logo',
  ADD COLUMN address            VARCHAR(500) NULL,
  ADD COLUMN city               VARCHAR(100) NULL,
  ADD COLUMN state              VARCHAR(100) NULL,
  ADD COLUMN pincode            VARCHAR(10)  NULL,
  ADD COLUMN website_url        VARCHAR(500) NULL
    COMMENT 'Their own external website if any',
  ADD COLUMN facebook_url       VARCHAR(500) NULL,
  ADD COLUMN instagram_url      VARCHAR(500) NULL,
  ADD COLUMN youtube_url        VARCHAR(500) NULL,
  ADD COLUMN whatsapp_number    VARCHAR(20)  NULL,
  ADD COLUMN established_year   YEAR         NULL,
  ADD COLUMN total_students_display INT      DEFAULT 0
    COMMENT 'Displayed on public page (can differ from actual count)',
  ADD COLUMN public_page_enabled BOOLEAN     DEFAULT TRUE
    COMMENT 'Owner can disable public page',
  ADD COLUMN admission_open     BOOLEAN      DEFAULT FALSE
    COMMENT 'Show Admission Open banner',
  ADD COLUMN seo_title         VARCHAR(255) NULL,
  ADD COLUMN seo_description   VARCHAR(500) NULL;

-- Index for fast subdomain lookup (called on EVERY request)
CREATE INDEX idx_institute_subdomain ON institutes(subdomain);


1.2 New Table: institute_courses
Each institute can list the courses they offer on their public page.
CREATE TABLE institute_courses (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  institute_id INT NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  duration     VARCHAR(100)  COMMENT 'e.g. 2 Years, 6 Months',
  fee_display  VARCHAR(100)  COMMENT 'e.g. ₹15,000/year',
  image_url    VARCHAR(500),
  is_active    BOOLEAN DEFAULT TRUE,
  sort_order   INT DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  INDEX idx_courses_institute (institute_id)
);


1.3 New Table: institute_testimonials
CREATE TABLE institute_testimonials (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  institute_id   INT NOT NULL,
  student_name   VARCHAR(100) NOT NULL,
  student_photo  VARCHAR(500),
  batch_year     YEAR,
  achievement    VARCHAR(200) COMMENT 'e.g. IIT Bombay — CS 2023',
  testimonial    TEXT NOT NULL,
  rating         TINYINT DEFAULT 5,
  is_active      BOOLEAN DEFAULT TRUE,
  sort_order     INT DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE
);


1.4 New Table: admission_enquiries
Contact/admission form submissions from public pages.
CREATE TABLE admission_enquiries (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  institute_id   INT NOT NULL,
  student_name   VARCHAR(100) NOT NULL,
  parent_name    VARCHAR(100),
  phone          VARCHAR(15) NOT NULL,
  email          VARCHAR(255),
  course_interest VARCHAR(200),
  message        TEXT,
  source         VARCHAR(50) DEFAULT 'public_website',
  status         ENUM('new','contacted','enrolled','rejected') DEFAULT 'new',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  INDEX idx_enq_institute_status (institute_id, status)
);

Phase 2 — Namecheap DNS Configuration
This is the most critical setup step. You configure DNS in Namecheap so that any subdomain automatically points to your server.

2.1 Step-by-Step Namecheap Setup
1.	Go to namecheap.com → Log in → Domain List
2.	Click MANAGE next to zenithflows.in
3.	Click the ADVANCED DNS tab
4.	Delete any existing A records or CNAME records for @ and www
5.	Add the following DNS records:

Type	Host	Value	TTL	Purpose
A Record	@	<YOUR_SERVER_IP>	Automatic	zenithflows.in → your server
A Record	www	<YOUR_SERVER_IP>	Automatic	www.zenithflows.in → your server
A Record	*	<YOUR_SERVER_IP>	Automatic	WILDCARD — any subdomain → your server
A Record	api	<YOUR_SERVER_IP>	Automatic	api.zenithflows.in → backend
A Record	app	<YOUR_SERVER_IP>	Automatic	app.zenithflows.in → dashboard


CRITICAL: The Wildcard Record
The '*' A Record is the key to everything.
Host = *  (just a single asterisk)
Value = your server's IP address

This tells Namecheap: ANY subdomain of zenithflows.in that is not
explicitly defined should go to this IP address.

So:  iitcoaching.zenithflows.in → your IP
     greenwood.zenithflows.in → your IP
     anything.zenithflows.in → your IP

Your server then decides what to show based on the subdomain name.

DNS propagation takes 15 minutes to 48 hours after you save.
Test with: nslookup test123.zenithflows.in


2.2 If Hosting on Railway (No Static IP)
Railway does not give a static IP. Use CNAME records instead:

Type	Host	Value	Purpose
CNAME	@	your-app.up.railway.app	zenithflows.in → Railway
CNAME	www	your-app.up.railway.app	www → Railway
CNAME	*	your-app.up.railway.app	WILDCARD → Railway
CNAME	api	your-api.up.railway.app	API backend → Railway
CNAME	app	your-app.up.railway.app	Dashboard → Railway


After adding DNS records in Railway:
6.	Railway Dashboard → Your service → Settings → Networking
7.	Click 'Generate Domain' → then 'Add Custom Domain'
8.	Add: zenithflows.in, www.zenithflows.in, *.zenithflows.in
9.	Railway handles SSL automatically via Let's Encrypt


Phase 2 — Official Documentation
🔗 Namecheap Advanced DNS Guide
🔗 Namecheap Wildcard Subdomain
🔗 Railway Custom Domains
🔗 Vercel Custom Domains
🔗 Let's Encrypt SSL


Phase 3 — Wildcard SSL Certificate
You need a wildcard SSL certificate that covers *.zenithflows.in so that every subdomain is secured with HTTPS automatically.

3.1 Option A — Railway / Vercel Handles SSL (Recommended)
If you deploy on Railway or Vercel, they automatically provision and renew SSL certificates for all custom domains including wildcards. You do nothing extra.
●	Railway: Add *.zenithflows.in as a custom domain → SSL auto-provisioned
●	Vercel: Add *.zenithflows.in → SSL auto-provisioned via Let's Encrypt
●	This is the easiest approach — zero manual SSL management


3.2 Option B — Manual Wildcard SSL with Certbot (VPS/Nginx)
If you host on a VPS (DigitalOcean, AWS EC2, etc.), use Certbot with DNS challenge:

# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get wildcard certificate (requires DNS TXT record verification)
sudo certbot certonly --manual --preferred-challenges dns \
  -d zenithflows.in -d '*.zenithflows.in'

# Certbot will ask you to add a TXT record in Namecheap:
# Host: _acme-challenge
# Value: <certbot gives you this value>
# Wait for DNS propagation, then press Enter

# Certificate location:
# /etc/letsencrypt/live/zenithflows.in/fullchain.pem
# /etc/letsencrypt/live/zenithflows.in/privkey.pem

# Auto-renew (runs every 12 hours)
sudo certbot renew --dry-run


3.3 Nginx Configuration for Wildcard SSL
# /etc/nginx/sites-available/zenithflows

# ── Main domain → React frontend ──────────────────────────────
server {
  listen 443 ssl;
  server_name zenithflows.in www.zenithflows.in;

  ssl_certificate     /etc/letsencrypt/live/zenithflows.in/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/zenithflows.in/privkey.pem;

  location / {
    root /var/www/zenithflows/public;   # React build output
    try_files $uri /index.html;
  }
}

# ── API subdomain → Node.js backend ───────────────────────────
server {
  listen 443 ssl;
  server_name api.zenithflows.in;

  ssl_certificate     /etc/letsencrypt/live/zenithflows.in/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/zenithflows.in/privkey.pem;

  location / {
    proxy_pass http://localhost:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}

# ── Wildcard → React app (handles institute subdomains) ────────
server {
  listen 443 ssl;
  server_name *.zenithflows.in;

  ssl_certificate     /etc/letsencrypt/live/zenithflows.in/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/zenithflows.in/privkey.pem;

  location / {
    root /var/www/zenithflows/public;
    try_files $uri /index.html;
  }
}

# ── HTTP → HTTPS redirect ─────────────────────────────────────
server {
  listen 80;
  server_name zenithflows.in *.zenithflows.in;
  return 301 https://$host$request_uri;
}

Phase 4 — Backend: Subdomain Detection & Public API
The backend reads the subdomain from the request hostname, looks up the institute in the database, and returns its public profile data. No authentication required for public pages.

4.1 Subdomain Extractor Utility — utils/subdomain.js
// utils/subdomain.js
const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'zenithflows.in';
const RESERVED_SUBDOMAINS = ['www','app','api','admin','mail','ftp','staging'];

/**
 * Extracts the institute subdomain from req.hostname
 * 'iitcoaching.zenithflows.in' → 'iitcoaching'
 * 'zenithflows.in' → null (main domain)
 * 'app.zenithflows.in' → null (reserved)
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;

  // Remove port if present (localhost:3000)
  const host = hostname.split(':')[0].toLowerCase();

  // Handle localhost development
  if (host === 'localhost' || host === '127.0.0.1') return null;

  // Remove main domain suffix
  const suffix = '.' + MAIN_DOMAIN;
  if (!host.endsWith(suffix) && host !== MAIN_DOMAIN) return null;

  const subdomain = host.replace(suffix, '');

  // No subdomain (main domain itself)
  if (!subdomain || subdomain === MAIN_DOMAIN) return null;

  // Reserved — not an institute
  if (RESERVED_SUBDOMAINS.includes(subdomain)) return null;

  // Validate format: lowercase letters, numbers, hyphens only
  if (!/^[a-z0-9-]+$/.test(subdomain)) return null;

  return subdomain;
}

module.exports = { extractSubdomain };


4.2 Public Institute API Controller — controllers/public.controller.js
// controllers/public.controller.js
// NO authentication required — these routes are publicly accessible

const { Institute, InstituteCourse, InstituteTestimonial,
        User, AdmissionEnquiry } = require('../models');
const { extractSubdomain } = require('../utils/subdomain');
const catchAsync = require('../utils/catchAsync');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ── GET /api/public/institute ──────────────────────────────────
// Called by frontend with the subdomain to get institute public data
const getInstituteBySubdomain = catchAsync(async (req, res) => {
  const subdomain = req.query.subdomain || extractSubdomain(req.hostname);

  if (!subdomain) {
    return sendError(res, 'No subdomain provided', 400);
  }

  const institute = await Institute.findOne({
    where: { subdomain, status: 'active', public_page_enabled: true },
    attributes: [
      'id','name','subdomain','tagline','about_text',
      'primary_color','secondary_color','cover_image_url','logo_url',
      'phone','email','address','city','state','pincode',
      'website_url','facebook_url','instagram_url','youtube_url',
      'whatsapp_number','established_year','total_students_display',
      'admission_open','seo_title','seo_description',
    ],
  });

  if (!institute) {
    return sendError(res, 'Institute not found', 404);
  }

  // Get courses offered
  const courses = await InstituteCourse.findAll({
    where: { institute_id: institute.id, is_active: true },
    order: [['sort_order','ASC'],['id','ASC']],
    attributes: ['id','title','description','duration','fee_display','image_url'],
  });

  // Get faculty (public profiles only)
  const faculty = await User.findAll({
    where: { institute_id: institute.id, role: 'faculty', status: 'active' },
    attributes: ['id','name'],  // Only name for privacy
    limit: 12,
  });

  // Get testimonials
  const testimonials = await InstituteTestimonial.findAll({
    where: { institute_id: institute.id, is_active: true },
    order: [['sort_order','ASC']],
    limit: 6,
  });

  return sendSuccess(res, { institute, courses, faculty, testimonials });
});

// ── POST /api/public/enquiry ────────────────────────────────────
const submitEnquiry = catchAsync(async (req, res) => {
  const { institute_id, student_name, parent_name, phone,
          email, course_interest, message } = req.body;

  // Verify the institute exists and is active
  const institute = await Institute.findOne({
    where: { id: institute_id, status: 'active' },
  });
  if (!institute) return sendError(res, 'Institute not found', 404);

  const enquiry = await AdmissionEnquiry.create({
    institute_id, student_name, parent_name, phone,
    email, course_interest, message,
  });

  // Notify the institute admin (optional — use Nodemailer)
  // await emailService.sendEnquiryNotification(institute, enquiry);

  return sendSuccess(res, { enquiry_id: enquiry.id },
    'Enquiry submitted successfully. We will contact you soon!', 201);
});

// ── GET /api/public/check-subdomain ────────────────────────────
// Used when admin sets up their subdomain — check if available
const checkSubdomainAvailability = catchAsync(async (req, res) => {
  const { subdomain } = req.query;
  if (!subdomain || !/^[a-z0-9-]{3,50}$/.test(subdomain)) {
    return sendError(res, 'Invalid subdomain format', 422);
  }
  const { extractSubdomain } = require('../utils/subdomain');
  // Check reserved words
  const RESERVED = ['www','app','api','admin','mail','support','help','blog'];
  if (RESERVED.includes(subdomain)) {
    return sendSuccess(res, { available: false, reason: 'Reserved subdomain' });
  }
  const existing = await Institute.findOne({ where: { subdomain } });
  return sendSuccess(res, { available: !existing });
});

module.exports = { getInstituteBySubdomain, submitEnquiry, checkSubdomainAvailability };


4.3 Public Routes — routes/public.routes.js
// routes/public.routes.js
// NO auth middleware on these routes
const express    = require('express');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');
const publicCtrl = require('../controllers/public.controller');

// Rate limit public routes (prevent scraping)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success:false, message:'Too many requests' }
});

router.get('/institute',          publicLimiter, publicCtrl.getInstituteBySubdomain);
router.post('/enquiry',           publicLimiter, publicCtrl.submitEnquiry);
router.get('/check-subdomain',    publicLimiter, publicCtrl.checkSubdomainAvailability);

module.exports = router;

// In app.js — mount BEFORE auth middleware:
app.use('/api/public', require('./routes/public.routes'));


4.4 Admin: Manage Subdomain — controllers/institute.controller.js
Add this endpoint so institute admins can set and update their subdomain from the dashboard.
// PATCH /api/institutes/subdomain
// Auth: owner only
const updateSubdomain = catchAsync(async (req, res) => {
  const { subdomain } = req.body;
  const institute_id  = req.user.institute_id;

  // Validate format
  if (!/^[a-z0-9-]{3,50}$/.test(subdomain)) {
    return sendError(res, 'Subdomain must be 3-50 lowercase letters, numbers, or hyphens', 422);
  }

  // Check reserved words
  const RESERVED = ['www','app','api','admin','mail','support','staging'];
  if (RESERVED.includes(subdomain)) {
    return sendError(res, 'This subdomain is reserved and cannot be used', 422);
  }

  // Check availability (excluding current institute)
  const { Op } = require('sequelize');
  const existing = await Institute.findOne({
    where: { subdomain, id: { [Op.ne]: institute_id } }
  });
  if (existing) {
    return sendError(res, 'This subdomain is already taken. Try another.', 409);
  }

  await Institute.update({ subdomain }, { where: { id: institute_id } });

  return sendSuccess(res, {
    subdomain,
    url: `https://${subdomain}.zenithflows.in`,
  }, 'Subdomain updated successfully');
});

Phase 5 — Frontend: Subdomain Detection & Routing
The React frontend reads window.location.hostname, extracts the subdomain, and decides which page to show. This all happens client-side before any API call.

5.1 Subdomain Detection Hook — hooks/useSubdomain.js
// hooks/useSubdomain.js
const MAIN_DOMAIN = import.meta.env.VITE_MAIN_DOMAIN || 'zenithflows.in';
const RESERVED    = ['www','app','api','admin','staging'];

export function useSubdomain() {
  const hostname = window.location.hostname;

  // Development: support ?institute=slug for testing
  const urlParams = new URLSearchParams(window.location.search);
  const devSubdomain = urlParams.get('institute');
  if (devSubdomain) {
    return { subdomain: devSubdomain, isInstitutePage: true, isMainDomain: false };
  }

  // Production: read from hostname
  if (hostname === MAIN_DOMAIN || hostname === `www.${MAIN_DOMAIN}`) {
    return { subdomain: null, isInstitutePage: false, isMainDomain: true };
  }

  const suffix = `.${MAIN_DOMAIN}`;
  if (hostname.endsWith(suffix)) {
    const subdomain = hostname.slice(0, -suffix.length);
    if (RESERVED.includes(subdomain)) {
      return { subdomain: null, isInstitutePage: false, isMainDomain: false };
    }
    return { subdomain, isInstitutePage: true, isMainDomain: false };
  }

  // Localhost / unknown
  return { subdomain: null, isInstitutePage: false, isMainDomain: true };
}


5.2 App Entry Point — App.jsx
// App.jsx — Route based on subdomain
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSubdomain } from './hooks/useSubdomain';
import Loader from './components/common/Loader';

// Lazy-loaded pages
const MainLandingPage    = React.lazy(() => import('./pages/public/MainLandingPage'));
const InstitutePage      = React.lazy(() => import('./pages/public/InstitutePage'));
const InstituteNotFound  = React.lazy(() => import('./pages/public/InstituteNotFound'));
const AppDashboard       = React.lazy(() => import('./pages/app/AppDashboard'));
// ... other dashboard pages

export default function App() {
  const { subdomain, isInstitutePage, isMainDomain } = useSubdomain();

  return (
    <Suspense fallback={<Loader fullPage />}>
      <BrowserRouter>
        <Routes>
          {/* ── Institute Public Page (subdomain detected) ── */}
          {isInstitutePage && (
            <>
              <Route path='/'       element={<InstitutePage subdomain={subdomain} />} />
              <Route path='/login'  element={<StudentLogin  subdomain={subdomain} />} />
              <Route path='*'       element={<InstituteNotFound />} />
            </>
          )}

          {/* ── Main SaaS Marketing Website ── */}
          {isMainDomain && (
            <>
              <Route path='/'         element={<MainLandingPage />} />
              <Route path='/pricing'  element={<PricingPage />} />
              <Route path='/features' element={<FeaturesPage />} />
              <Route path='/contact'  element={<ContactPage />} />
            </>
          )}

          {/* ── Dashboard (app.zenithflows.in) ── */}
          {!isInstitutePage && !isMainDomain && (
            <Route path='/*' element={<AppDashboard />} />
          )}
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}

Phase 6 — Institute Public Page Component
This is the complete institute public website page. It dynamically loads the institute's data, applies their branding colors, and shows all sections.

6.1 InstitutePage.jsx — Complete Structure
// pages/public/InstitutePage.jsx
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';  // npm install react-helmet-async
import instituteService from '../../services/institute.public.service';

export default function InstitutePage({ subdomain }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    instituteService.getBySubdomain(subdomain)
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [subdomain]);

  if (loading) return <FullPageLoader />;
  if (error)   return <InstituteNotFound subdomain={subdomain} />;

  const { institute, courses, faculty, testimonials } = data;

  // Apply institute branding colors as CSS variables
  const brandStyle = {
    '--primary':   institute.primary_color   || '#1565C0',
    '--secondary': institute.secondary_color || '#E3F2FD',
  };

  return (
    <div style={brandStyle}>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{institute.seo_title || `${institute.name} — ZenithFlows`}</title>
        <meta name='description' content={institute.seo_description || institute.tagline} />
        <meta property='og:title'       content={institute.name} />
        <meta property='og:description' content={institute.tagline} />
        <meta property='og:image'       content={institute.cover_image_url} />
      </Helmet>

      <InstituteNavbar institute={institute} />
      <HeroSection     institute={institute} />
      <AboutSection    institute={institute} />
      <CoursesSection  courses={courses} />
      <FacultySection  faculty={faculty} />
      <TestimonialsSection testimonials={testimonials} />
      <AdmissionForm   institute={institute} />
      <ContactSection  institute={institute} />
      <InstituteFooter institute={institute} />
    </div>
  );
}


6.2 Key Page Sections

HeroSection — Full-screen banner
function HeroSection({ institute }) {
  return (
    <section style={{
      backgroundImage: `linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),
                        url(${institute.cover_image_url})`,
      backgroundSize: 'cover', backgroundPosition: 'center',
      minHeight: '100vh', display: 'flex', alignItems: 'center',
    }}>
      <div style={{ color:'#fff', textAlign:'center', padding:'2rem' }}>
        <img src={institute.logo_url} alt='logo' style={{height:'80px'}} />
        <h1 style={{fontSize:'3rem',fontWeight:'bold'}}>{institute.name}</h1>
        <p  style={{fontSize:'1.3rem'}}>{institute.tagline}</p>
        {institute.admission_open && (
          <div style={{background:'#FF5722',padding:'0.5rem 1.5rem',
            borderRadius:'25px',display:'inline-block',marginTop:'1rem'}}>
            🎓 Admission Open 2025-26
          </div>
        )}
        <div style={{marginTop:'2rem'}}>
          <a href='#admission' style={{background:'var(--primary)',
            color:'#fff',padding:'1rem 2rem',borderRadius:'8px',
            textDecoration:'none',fontSize:'1.1rem',margin:'0.5rem'}}>
            Apply Now
          </a>
          <a href='/login' style={{background:'transparent',color:'#fff',
            border:'2px solid #fff',padding:'1rem 2rem',borderRadius:'8px',
            textDecoration:'none',fontSize:'1.1rem',margin:'0.5rem'}}>
            Student Login
          </a>
        </div>
      </div>
    </section>
  );
}


AdmissionForm — Contact/Enquiry form
function AdmissionForm({ institute }) {
  const [form, setForm]   = useState({ student_name:'', phone:'', email:'',
                                        course_interest:'', message:'' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await instituteService.submitEnquiry({
        ...form, institute_id: institute.id
      });
      setSent(true);
    } finally { setLoading(false); }
  };

  if (sent) return (
    <section id='admission' style={{padding:'4rem',textAlign:'center'}}>
      <h2>✅ Thank you! We will contact you within 24 hours.</h2>
    </section>
  );

  return (
    <section id='admission' style={{background:'var(--secondary)',padding:'4rem 2rem'}}>
      <h2 style={{textAlign:'center',color:'var(--primary)'}}>
        {institute.admission_open ? '🎓 Apply for Admission' : 'Enquire Now'}
      </h2>
      <form onSubmit={handleSubmit} style={{maxWidth:'600px',margin:'0 auto'}}>
        <input required placeholder='Student Name *' value={form.student_name}
          onChange={e=>setForm({...form,student_name:e.target.value})} />
        <input required placeholder='Phone Number *' value={form.phone}
          onChange={e=>setForm({...form,phone:e.target.value})} />
        <input placeholder='Email (optional)' value={form.email}
          onChange={e=>setForm({...form,email:e.target.value})} />
        <input placeholder='Course Interested In' value={form.course_interest}
          onChange={e=>setForm({...form,course_interest:e.target.value})} />
        <textarea placeholder='Message (optional)' value={form.message}
          onChange={e=>setForm({...form,message:e.target.value})} />
        <button type='submit' disabled={loading}
          style={{background:'var(--primary)',color:'#fff',padding:'1rem 2rem',
                  border:'none',borderRadius:'8px',cursor:'pointer',width:'100%'}}>
          {loading ? 'Submitting...' : 'Submit Enquiry'}
        </button>
      </form>
    </section>
  );
}

Phase 7 — zenithflows.in Main Landing Page
The main domain shows your SaaS marketing website. This is where institutes discover your product, see pricing, and sign up.

7.1 MainLandingPage.jsx — Sections
// pages/public/MainLandingPage.jsx
export default function MainLandingPage() {
  return (
    <div>
      <LandingNavbar />      {/* Logo + Nav links + Login button */}
      <HeroSection />        {/* 'The #1 ERP for Coaching Institutes' */}
      <StatsSection />       {/* 500+ institutes, 1L+ students, etc. */}
      <FeaturesSection />    {/* Attendance, Fees, Assignments, etc. */}
      <HowItWorksSection />  {/* 3 steps: Register → Setup → Grow */}
      <PricingSection />     {/* Basic / Pro / Premium plan cards */}
      <TestimonialsSection />{/* Institute owners testimonials */}
      <CTASection />         {/* Start Free Trial button */}
      <FooterSection />      {/* Links + contact + social */}
    </div>
  );
}


7.2 Key Landing Page Sections

HeroSection — Main value proposition
function HeroSection() {
  return (
    <section style={{minHeight:'100vh',display:'flex',alignItems:'center',
      background:'linear-gradient(135deg,#0A1628 0%,#1565C0 100%)'}}>
      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'2rem',color:'#fff'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4rem'}}>
          <div>
            <h1 style={{fontSize:'3.5rem',fontWeight:'900',lineHeight:1.2}}>
              The Smart ERP for<br/>
              <span style={{color:'#64B5F6'}}>Coaching Institutes</span>
            </h1>
            <p style={{fontSize:'1.2rem',marginTop:'1.5rem',opacity:0.9}}>
              Manage students, attendance, fees, assignments and more.
              Your institute gets its own website at
              <strong> yourname.zenithflows.in</strong>
            </p>
            <div style={{marginTop:'2rem'}}>
              <a href='/register' style={{background:'#64B5F6',color:'#0A1628',
                padding:'1rem 2.5rem',borderRadius:'8px',fontWeight:'bold',
                textDecoration:'none',fontSize:'1.1rem'}}>
                Start Free Trial
              </a>
            </div>
          </div>
          <div>
            <img src='/dashboard-preview.png' alt='Dashboard'
              style={{width:'100%',borderRadius:'12px',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} />
          </div>
        </div>
      </div>
    </section>
  );
}

Phase 8 — Admin Dashboard: Public Website Settings
Institute admins manage their public page from inside the dashboard. They set their subdomain, upload branding assets, manage courses, and see enquiries.

8.1 Pages to Create in Admin Dashboard
Page File	Route	Description
pages/admin/WebsiteSettings.jsx	/admin/website	Subdomain setup, colors, tagline, logo, about
pages/admin/WebsiteCourses.jsx	/admin/website/courses	Add/edit/delete courses shown on public page
pages/admin/WebsiteTestimonials.jsx	/admin/website/testimonials	Manage student testimonials
pages/admin/AdmissionEnquiries.jsx	/admin/enquiries	View and manage form submissions from public page


8.2 WebsiteSettings.jsx — Key Features
●	Subdomain input with real-time availability check
●	Preview button: opens institute.zenithflows.in in new tab
●	Primary color picker (hex input + color swatch)
●	Cover image upload (goes to uploads/institutes/covers/)
●	Logo upload
●	Tagline text input
●	About section rich text editor
●	Social links (Facebook, Instagram, YouTube, WhatsApp)
●	Toggle: 'Public page enabled / disabled'
●	Toggle: 'Admission Open' banner

// Subdomain availability checker (React component)
const [subdomain, setSubdomain] = useState('');
const [available, setAvailable] = useState(null);

const checkAvailability = useDebounce(async (value) => {
  if (value.length < 3) return;
  const res = await api.get(`/api/public/check-subdomain?subdomain=${value}`);
  setAvailable(res.data.available);
}, 500);

// In JSX:
<input
  value={subdomain}
  onChange={e => { setSubdomain(e.target.value); checkAvailability(e.target.value); }}
  placeholder='yourinstitutenname'
/>
<span>{subdomain}.zenithflows.in</span>
{available === true  && <span style={{color:'green'}}>✅ Available</span>}
{available === false && <span style={{color:'red'}}>❌ Already taken</span>}


8.3 AdmissionEnquiries.jsx — Admin View
●	Table showing all enquiry form submissions
●	Columns: Date, Student Name, Phone, Email, Course, Status, Actions
●	Status filter: New / Contacted / Enrolled / Rejected
●	Click 'Mark as Contacted' → updates status
●	Export to Excel button for lead management
●	Total enquiries count card on main admin dashboard

Phase 9 — Frontend Service File

// services/institute.public.service.js
import api from './api';

const institutePublicService = {
  // Get institute public data by subdomain
  async getBySubdomain(subdomain) {
    const res = await api.get('/api/public/institute', {
      params: { subdomain },
    });
    return res.data.data;
  },

  // Submit admission enquiry
  async submitEnquiry(formData) {
    const res = await api.post('/api/public/enquiry', formData);
    return res.data;
  },

  // Check subdomain availability
  async checkSubdomain(subdomain) {
    const res = await api.get('/api/public/check-subdomain', {
      params: { subdomain },
    });
    return res.data.data.available;
  },

  // Admin: update website settings
  async updateSettings(data) {
    const res = await api.patch('/api/institutes/website-settings', data);
    return res.data;
  },

  // Admin: get all enquiries
  async getEnquiries(params) {
    const res = await api.get('/api/institutes/enquiries', { params });
    return res.data;
  },
};

export default institutePublicService;

Phase 10 — Vite & Environment Configuration

10.1 frontend/.env files
# frontend/.env.development
VITE_API_BASE_URL=http://localhost:5000
VITE_MAIN_DOMAIN=localhost
VITE_APP_URL=http://localhost:5173

# frontend/.env.production
VITE_API_BASE_URL=https://api.zenithflows.in
VITE_MAIN_DOMAIN=zenithflows.in
VITE_APP_URL=https://app.zenithflows.in
VITE_SENTRY_DSN=https://xxxx@sentry.io/yyyy


10.2 Vite Config for Subdomain Local Testing
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // For local testing, use query param: ?institute=iitcoaching
    // The useSubdomain hook handles this automatically
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react','react-dom','react-router-dom'],
          charts: ['chart.js','react-chartjs-2'],
        }
      }
    }
  }
});


10.3 Local Development Testing
Since subdomains don't work on localhost, test institute pages with the query parameter:
# Open in browser:
http://localhost:5173?institute=iitcoaching

# The useSubdomain hook reads ?institute=iitcoaching
# and behaves exactly as if visiting iitcoaching.zenithflows.in

# Main domain behaviour — just open:
http://localhost:5173
# (no ?institute param → shows MainLandingPage)

Phase 11 — Institute Registration & Subdomain Setup Flow
When a new institute registers on your platform, they go through an onboarding flow that sets up their subdomain and public page.

11.1 Registration Flow (Step by Step)
10.	Institute owner goes to zenithflows.in → clicks 'Start Free Trial'
11.	Fills registration form: Institute Name, Email, Phone, Password
12.	Backend creates Institute record + Owner user (subdomain = null initially)
13.	Email verification sent
14.	Owner logs in to app.zenithflows.in
15.	Onboarding wizard appears:
○	Step 1: Choose your subdomain → check availability → confirm
○	Step 2: Upload logo and cover image
○	Step 3: Add tagline and about text
○	Step 4: Choose primary brand color
○	Step 5: Add courses offered
○	Step 6: Preview and publish
16.	Owner clicks 'Publish' → public_page_enabled = true
17.	Institute page is now live at subdomain.zenithflows.in
18.	Owner can share this URL with students and parents


11.2 Subdomain Rules to Enforce
Rule	Implementation	Error Message
Min 3 characters	Joi: min(3)	Subdomain must be at least 3 characters
Max 50 characters	Joi: max(50)	Subdomain too long
Lowercase only	Joi: lowercase()	Use only lowercase letters
Letters, numbers, hyphens	Regex: /^[a-z0-9-]+$/	Only letters, numbers, and hyphens allowed
Cannot start/end with hyphen	Regex: /^[a-z0-9]/	Cannot start or end with hyphen
Must be unique	DB: UNIQUE constraint	This subdomain is already taken
Cannot be reserved word	Array check	This subdomain is reserved
Cannot change more than 3 times	Track change_count in DB	Subdomain change limit reached

Phase 12 — Deployment & Final Checklist

12.1 Complete Deployment Steps
19.	Namecheap DNS: Add A records (@, www, *) pointing to server IP
20.	Wait for DNS propagation (15 min to 48 hours)
21.	Test DNS: nslookup test.zenithflows.in → should return your IP
22.	Railway: Add custom domains — zenithflows.in, *.zenithflows.in, api.zenithflows.in
23.	Railway generates SSL automatically — verify HTTPS works
24.	Backend .env: Add MAIN_DOMAIN=zenithflows.in
25.	Frontend .env.production: VITE_MAIN_DOMAIN=zenithflows.in
26.	Deploy backend and frontend
27.	Visit zenithflows.in → should show your landing page
28.	Create a test institute with subdomain 'demo' in the database
29.	Visit demo.zenithflows.in → should show that institute's public page


12.2 Final Architecture Summary
URL	Tech	Shows	Backend API
zenithflows.in	React (static)	SaaS Marketing Page	None — static HTML
app.zenithflows.in	React + Auth	Login + Full Dashboard	/api/* (authenticated)
api.zenithflows.in	Node.js Express	REST API	N/A — IS the backend
*.zenithflows.in	React (dynamic)	Institute Public Page	/api/public/institute?subdomain=*


Complete Implementation Checklist
✅  Database: institutes table has subdomain, branding, SEO columns
✅  Database: institute_courses, institute_testimonials, admission_enquiries tables
✅  Namecheap: Wildcard A/CNAME record (*) pointing to server
✅  SSL: Wildcard certificate covers *.zenithflows.in
✅  Backend: utils/subdomain.js extracts subdomain from req.hostname
✅  Backend: GET /api/public/institute returns institute data (no auth)
✅  Backend: POST /api/public/enquiry saves admission form submissions
✅  Backend: GET /api/public/check-subdomain checks availability
✅  Backend: PATCH /api/institutes/subdomain — owner sets their subdomain
✅  Frontend: useSubdomain() hook detects subdomain from window.location
✅  Frontend: App.jsx routes to InstitutePage or MainLandingPage based on subdomain
✅  Frontend: InstitutePage loads and displays institute's full public website
✅  Frontend: AdmissionForm sends enquiry to backend
✅  Frontend: Admin WebsiteSettings page for full customization
✅  Frontend: Admin AdmissionEnquiries page to manage leads
✅  Local testing: ?institute=slug query param works in development
✅  SEO: react-helmet-async adds per-institute meta tags
✅  Branding: CSS variables (--primary, --secondary) apply institute colors

Result: Every institute gets their own branded public website
at subdomain.zenithflows.in — fully automatic, zero extra cost


Phase 12 — Official Documentation Links
🔗 Namecheap DNS Management
🔗 Railway Custom Domains
🔗 Vercel Wildcard Domains
🔗 Let's Encrypt Wildcard Certs
🔗 Certbot Documentation
🔗 react-helmet-async
🔗 Nginx Wildcard Server Name
🔗 DNS Propagation Checker


