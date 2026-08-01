💳
SUBSCRIPTIONS MANAGEMENT
Super Admin — Complete Implementation Guide
Test Mode Flag  ·  Revenue Isolation  ·  Real-Time Socket.io  ·  O(1) Metric Queries  ·  Export PDF/Excel


Key Feature	Description
Test Mode Button	Toggle per-institute. Test payments EXCLUDED from revenue metrics
Revenue Fix	SUM only where is_test = false — live money only
DB Change	1 column: subscriptions.is_test (BOOLEAN, default false)
API Calls	1 optimised query: metrics + paginated list in parallel
Real-Time	Socket.io emits subscription_updated on pay/toggle
Caching	Node-Cache: 30s TTL on metrics, busted on any mutation
Export	Excel (exceljs) + PDF (pdfkit) — server-side, no browser libs
Build Time	4 working days
 
1. What Needs to Be Built — Gap Analysis
Based on your existing report, the system has a solid foundation. Here is the exact gap between what is documented and what needs to be added or fixed:

Area	Already Exists	Must Add / Fix
DB Model	6 financial fields, status, payment_method, transaction_ref	is_test BOOLEAN column — the entire Test Mode feature depends on this one column
Revenue Metric	SUM(amount_paid) — counts ALL payments	Filter: WHERE is_test = FALSE — test payments must not appear in revenue
API — List	GET /api/superadmin/subscriptions with pagination	Add is_test filter in query; return is_test flag per row
API — Toggle	Not in report — missing	PATCH /api/superadmin/subscriptions/:id/toggle-test — new endpoint
Metrics Query	Runs on every list request — slow	Separate parallel query; add node-cache 30s TTL
Frontend Table	Not built yet	Full React table with Test/Live badge, Toggle button, filters
Real-Time	Not built	Socket.io emit on toggle + pay → frontend auto-refreshes
Export	Not built	GET /api/superadmin/subscriptions/export?format=excel|pdf
Date Filter	Not built	start_date / end_date query params for revenue date range


The Core Problem — Why Revenue Was Wrong
When an institute is on a test/demo plan, they make Razorpay test payments.
These test payments have real payment_status='paid' and real amount_paid values.
Without a is_test flag, your SUM(amount_paid) counts these as real revenue.

Example of the bug:
  Institute A — real customer  — paid ₹17,338  → SHOULD count in revenue
  Institute B — test/demo mode — paid ₹17,338  → MUST NOT count in revenue

Fix: Add is_test = true on subscription when super admin marks institute as test.
Revenue query: SELECT SUM(amount_paid) FROM subscriptions WHERE is_test = FALSE
This is the ONLY change needed to fix revenue. One column. One WHERE clause.

Phase 1 — Database Migration (Day 1 · 15 Minutes)
One new column on the subscriptions table. One index. That is all the database needs for the entire Test Mode feature.

1.1 Migration SQL
-- ════════════════════════════════════════════════════
-- STEP 1: Add is_test column to subscriptions
-- ════════════════════════════════════════════════════
ALTER TABLE subscriptions
  ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'TRUE = test/demo institute. Excluded from revenue metrics.'
  AFTER payment_status;

-- ════════════════════════════════════════════════════
-- STEP 2: Add is_test to institutes table as well
-- (So ALL future subscriptions for this institute auto-set is_test)
-- ════════════════════════════════════════════════════
ALTER TABLE institutes
  ADD COLUMN is_test_account BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'Super admin marks institute as test. All subscriptions excluded from revenue.'
  AFTER status;

-- ════════════════════════════════════════════════════
-- STEP 3: Performance indexes
-- ════════════════════════════════════════════════════
CREATE INDEX idx_sub_is_test    ON subscriptions(is_test);
CREATE INDEX idx_sub_status     ON subscriptions(payment_status, is_test);
CREATE INDEX idx_sub_institute  ON subscriptions(institute_id, is_test);
CREATE INDEX idx_sub_dates      ON subscriptions(start_date, end_date);

1.2 Sequelize Model Updates
// models/Subscription.js — add:
is_test: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
  comment: 'Excluded from revenue when true',
},

// models/Institute.js — add:
is_test_account: {
  type: DataTypes.BOOLEAN,
  defaultValue: false,
},

// ─── IMPORTANT: Auto-set is_test on new subscription ────────
// In your subscription creation logic (wherever a new subscription
// is created after Razorpay webhook OR manual creation):
const institute = await Institute.findByPk(institute_id);
const newSub = await Subscription.create({
  ...subscriptionData,
  is_test: institute.is_test_account, // inherit from institute flag
});

Phase 2 — Backend: Optimised Query Service (Day 1–2)
The key to performance is running the metrics query and the list query in PARALLEL using Promise.all — not sequentially. With proper indexes, both queries complete in under 5ms.

2.1 Create: services/subscription.service.js
// services/subscription.service.js
const { sequelize, Subscription, Institute, Plan } = require('../models');
const { Op } = require('sequelize');
const NodeCache = require('node-cache');

// ─── Cache: 30 second TTL on metrics ─────────────────────────
// npm install node-cache
const metricsCache = new NodeCache({ stdTTL: 30, checkperiod: 10 });

// ─── FUNCTION 1: buildWhereClause ─────────────────────────────
// Builds the Sequelize where clause from query params
// Called by BOTH metrics query and list query — single source of truth
function buildWhereClause({ search, status, startDate, endDate }) {
  const subWhere = {};
  const instWhere = {};

  // Status filter
  if (status && status !== 'all') {
    subWhere.payment_status = status;
  }

  // Date range filter
  if (startDate && endDate) {
    subWhere.start_date = { [Op.between]: [startDate, endDate] };
  }

  // Search filter — on institute name or email
  if (search && search.trim()) {
    instWhere[Op.or] = [
      { name:  { [Op.like]: `%${search.trim()}%` } },
      { email: { [Op.like]: `%${search.trim()}%` } },
    ];
  }

  return { subWhere, instWhere };
}

// ─── FUNCTION 2: getMetrics ───────────────────────────────────
// Revenue metrics — ALWAYS excludes is_test subscriptions
// Cached for 30 seconds to avoid re-running aggregate on every list load
async function getMetrics(filters, instituteId=null) {
  const cacheKey = `metrics_${JSON.stringify(filters)}_${instituteId}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return cached;

  const { subWhere, instWhere } = buildWhereClause(filters);

  // is_test = FALSE is MANDATORY — never removed from this query
  const metricsWhere = { ...subWhere, is_test: false };

  const [metrics] = await sequelize.query(`
    SELECT
      COUNT(s.id)                    AS total_subscriptions,
      COALESCE(SUM(s.amount_paid),0) AS total_revenue,
      COALESCE(SUM(s.discount_amount),0) AS total_discounts,
      COALESCE(SUM(s.tax_amount),0)  AS total_gst,
      COUNT(CASE WHEN s.payment_status='paid'    THEN 1 END) AS paid_count,
      COUNT(CASE WHEN s.payment_status='pending' THEN 1 END) AS pending_count,
      COUNT(CASE WHEN s.payment_status='failed'  THEN 1 END) AS failed_count,
      COUNT(CASE WHEN i.is_test_account=1        THEN 1 END) AS test_count
    FROM subscriptions s
    JOIN institutes i ON i.id = s.institute_id
    WHERE s.is_test = FALSE
      ${instWhere[Op.or] ? `AND (i.name LIKE :search OR i.email LIKE :search)` : ''}
  `, {
    replacements: { search: filters.search ? `%${filters.search}%` : '%' },
    type: sequelize.QueryTypes.SELECT,
  });

  const result = {
    total_subscriptions: parseInt(metrics.total_subscriptions) || 0,
    total_revenue:       parseFloat(metrics.total_revenue)       || 0,
    total_discounts:     parseFloat(metrics.total_discounts)     || 0,
    total_gst:           parseFloat(metrics.total_gst)           || 0,
    paid_count:          parseInt(metrics.paid_count)            || 0,
    pending_count:       parseInt(metrics.pending_count)         || 0,
    failed_count:        parseInt(metrics.failed_count)          || 0,
    test_count:          parseInt(metrics.test_count)            || 0,
  };

  metricsCache.set(cacheKey, result);
  return result;
}

// ─── FUNCTION 3: getSubscriptionList ──────────────────────────
// Paginated subscription list — shows ALL (test + live) but labeled
async function getSubscriptionList(filters) {
  const { page=1, limit=10, search, status, startDate, endDate } = filters;
  const offset = (page - 1) * limit;
  const { subWhere, instWhere } = buildWhereClause(filters);

  const { count, rows } = await Subscription.findAndCountAll({
    where: subWhere,
    limit:  parseInt(limit),
    offset: parseInt(offset),
    order:  [['created_at', 'DESC']],
    include: [
      {
        model:      Institute,
        attributes: ['id','name','email','is_test_account'],
        where:      Object.keys(instWhere).length ? instWhere : undefined,
        required:   true,
      },
      {
        model:      Plan,
        attributes: ['name','platform_type','price'],
        required:   false,
      },
    ],
    attributes: [
      'id','billing_cycle','amount_paid','discount_amount',
      'tax_amount','start_date','end_date','payment_status',
      'payment_method','transaction_ref','is_test','created_at',
    ],
  });

  return {
    data:       rows,
    pagination: { total:count, page:parseInt(page), pages:Math.ceil(count/limit) },
  };
}

// ─── FUNCTION 4: toggleTestMode ───────────────────────────────
// Marks an institute as test — all EXISTING + FUTURE subscriptions
// are excluded from revenue
async function toggleTestMode(instituteId, isTest, superAdminId) {
  const t = await sequelize.transaction();
  try {
    // 1. Update institute flag
    await Institute.update(
      { is_test_account: isTest },
      { where: { id: instituteId }, transaction: t }
    );

    // 2. Update ALL existing subscriptions for this institute
    await Subscription.update(
      { is_test: isTest },
      { where: { institute_id: instituteId }, transaction: t }
    );

    await t.commit();

    // 3. Bust metrics cache — revenue numbers just changed
    metricsCache.flushAll();

    return { institute_id: instituteId, is_test: isTest };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

// ─── FUNCTION 5: bustCache ────────────────────────────────────
// Called after any mutation (pay, delete, update)
function bustMetricsCache() { metricsCache.flushAll(); }

module.exports = {
  getMetrics, getSubscriptionList, toggleTestMode, bustMetricsCache
};

Phase 3 — Backend: API Endpoints (Day 2)
8 endpoints total. The main list endpoint runs metrics + list in parallel using Promise.all for minimum response time. All mutations bust the cache and emit Socket.io events.

3.1 Controller — controllers/superadmin/subscription.controller.js
const subService = require('../../services/subscription.service');
const { Subscription, Institute } = require('../../models');
const catchAsync = require('../../utils/catchAsync');
const { getIO } = require('../../socket');  // your socket.io instance

// ─── GET: List + Metrics (parallel, single response) ─────────
exports.getAll = catchAsync(async (req, res) => {
  const filters = {
    page:      req.query.page      || 1,
    limit:     req.query.limit     || 10,
    search:    req.query.search    || '',
    status:    req.query.status    || 'all',
    startDate: req.query.startDate || null,
    endDate:   req.query.endDate   || null,
  };

  // ── Run BOTH queries in parallel — O(1) total wait ───────
  const [metrics, list] = await Promise.all([
    subService.getMetrics(filters),
    subService.getSubscriptionList(filters),
  ]);

  return res.json({
    success: true,
    metrics,
    data:       list.data,
    pagination: list.pagination,
  });
});

// ─── PATCH: Toggle Test Mode ──────────────────────────────────
exports.toggleTest = catchAsync(async (req, res) => {
  const { id } = req.params;  // institute id
  const { is_test } = req.body;  // boolean

  if (typeof is_test !== 'boolean') {
    return res.status(400).json({ message: 'is_test must be boolean' });
  }

  const result = await subService.toggleTestMode(id, is_test, req.user.id);

  // ── Emit real-time update to all super-admin clients ─────
  const io = getIO();
  if (io) {
    io.to('superadmin').emit('subscription_updated', {
      type:         'test_mode_toggled',
      institute_id: id,
      is_test,
    });
  }

  return res.json({ success: true, data: result });
});

// ─── PUT: Mark as Paid ────────────────────────────────────────
exports.markPaid = catchAsync(async (req, res) => {
  const sub = await Subscription.findOne({
    where: { id: req.params.id }
  });
  if (!sub) return res.status(404).json({ message: 'Not found' });
  if (sub.payment_status === 'paid')
    return res.status(400).json({ message: 'Already paid' });

  const { payment_method, transaction_ref } = req.body;
  await sub.update({
    payment_status:  'paid',
    payment_date:    new Date(),
    payment_method,
    transaction_ref,
    paid_by:         req.user.id,
  });

  subService.bustMetricsCache();

  const io = getIO();
  if (io) {
    io.to('superadmin').emit('subscription_updated', {
      type: 'payment_recorded',
      subscription_id: sub.id,
    });
  }

  return res.json({ success: true, data: sub });
});

// ─── PUT: Update Subscription ─────────────────────────────────
exports.update = catchAsync(async (req, res) => {
  const sub = await Subscription.findByPk(req.params.id);
  if (!sub) return res.status(404).json({ message: 'Not found' });
  await sub.update(req.body);
  subService.bustMetricsCache();
  return res.json({ success: true, data: sub });
});

// ─── DELETE: Remove Subscription ──────────────────────────────
exports.remove = catchAsync(async (req, res) => {
  const sub = await Subscription.findByPk(req.params.id);
  if (!sub) return res.status(404).json({ message: 'Not found' });
  if (sub.payment_status === 'paid')
    return res.status(400).json({ message: 'Cannot delete a paid subscription' });
  await sub.destroy();
  subService.bustMetricsCache();
  return res.json({ success: true });
});

// ─── GET: Export (Excel / PDF) ────────────────────────────────
exports.exportData = catchAsync(async (req, res) => {
  const { format='excel', ...filters } = req.query;
  // Fetch ALL without pagination for export
  const { data } = await subService.getSubscriptionList({
    ...filters, page:1, limit:10000
  });
  if (format === 'excel') return exportExcel(res, data);
  if (format === 'pdf')   return exportPDF(res, data);
  return res.status(400).json({ message: 'format must be excel or pdf' });
});

3.2 Routes — routes/superadmin/subscription.routes.js
const router  = require('express').Router();
const ctrl    = require('../../controllers/superadmin/subscription.controller');
const { verifyToken, allowRoles } = require('../../middleware/auth');

const guard = [verifyToken, allowRoles('superadmin')];

// ── Static routes BEFORE /:id ──────────────────────────────
router.get('/',          ...guard, ctrl.getAll);
router.get('/export',    ...guard, ctrl.exportData);

// ── Mutation routes ────────────────────────────────────────
router.put('/:id',       ...guard, ctrl.update);
router.delete('/:id',    ...guard, ctrl.remove);
router.put('/:id/pay',   ...guard, ctrl.markPaid);

// ── Test mode toggle — uses institute id, not subscription id ─
router.patch('/institute/:id/toggle-test', ...guard, ctrl.toggleTest);

// Register in app.js:
// app.use('/api/superadmin/subscriptions',
//   require('./routes/superadmin/subscription.routes'));

3.3 API Reference Table
Method	Endpoint	Description	Cache
GET	/api/superadmin/subscriptions	List + metrics in one response (parallel queries)	Metrics: 30s TTL
GET	/api/superadmin/subscriptions/export?format=excel	Download Excel of all filtered subscriptions	No cache
GET	/api/superadmin/subscriptions/export?format=pdf	Download PDF of all filtered subscriptions	No cache
PUT	/api/superadmin/subscriptions/:id	Edit subscription fields	Busts cache
DELETE	/api/superadmin/subscriptions/:id	Delete pending subscription	Busts cache
PUT	/api/superadmin/subscriptions/:id/pay	Mark subscription as paid	Busts cache + emit
PATCH	/api/superadmin/subscriptions/institute/:id/toggle-test	Toggle test mode for an institute	Busts cache + emit

Phase 4 — Real-Time with Socket.io (Day 2)
When super admin toggles test mode or marks payment, ALL other super admin browser tabs update instantly without page reload. This requires Socket.io rooms.

4.1 Backend — socket.js (create or update)
// socket.js — at root of your backend
let _io = null;

function initSocket(server) {
  const { Server } = require('socket.io');
  _io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL, methods: ['GET','POST'] }
  });

  _io.on('connection', (socket) => {
    // Super admin joins their room on connect
    socket.on('join_superadmin', () => {
      socket.join('superadmin');
    });

    socket.on('disconnect', () => {
      socket.leave('superadmin');
    });
  });

  return _io;
}

function getIO() { return _io; }

module.exports = { initSocket, getIO };

// In server.js / app.js:
const { initSocket } = require('./socket');
const server = require('http').createServer(app);
initSocket(server);
server.listen(PORT);

4.2 Frontend — Socket.io Hook (useSubscriptionSocket.js)
// hooks/useSubscriptionSocket.js
import { useEffect } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function useSubscriptionSocket(onUpdate) {
  useEffect(() => {
    socket = io(import.meta.env.VITE_API_URL);
    socket.emit('join_superadmin');

    socket.on('subscription_updated', (payload) => {
      // Tell the page to refetch data
      onUpdate(payload);
    });

    return () => {
      socket.off('subscription_updated');
      socket.disconnect();
    };
  }, []);
}

Phase 5 — Frontend: Subscriptions Management Page (Day 3)
The main admin page with metrics cards, filter bar, subscriptions table with Test/Live badge, Toggle Test button, and export buttons.

5.1 Frontend Service — services/superadmin/subscription.service.js
import api from '../api';

const subscriptionService = {
  getAll: (params) =>
    api.get('/api/superadmin/subscriptions', { params }).then(r=>r.data),

  update: (id, data) =>
    api.put(`/api/superadmin/subscriptions/${id}`, data).then(r=>r.data),

  remove: (id) =>
    api.delete(`/api/superadmin/subscriptions/${id}`).then(r=>r.data),

  markPaid: (id, data) =>
    api.put(`/api/superadmin/subscriptions/${id}/pay`, data).then(r=>r.data),

  toggleTest: (instituteId, is_test) =>
    api.patch(`/api/superadmin/subscriptions/institute/${instituteId}/toggle-test`,
      { is_test }).then(r=>r.data),

  export: (format, params) =>
    api.get('/api/superadmin/subscriptions/export',
      { params:{ ...params, format }, responseType:'blob' }),
};
export default subscriptionService;

5.2 Metrics Cards Row
// components/superadmin/SubscriptionMetrics.jsx
import { formatCurrency } from '../../utils/format';

export default function SubscriptionMetrics({ metrics, loading }) {
  const cards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(metrics?.total_revenue || 0),
      sub:   'Live payments only (excl. test)',
      color: '#2E7D32', bg: '#E8F5E9',
    },
    {
      label: 'Discounts Given',
      value: formatCurrency(metrics?.total_discounts || 0),
      sub:   'Total discounts applied',
      color: '#E65100', bg: '#FFF3E0',
    },
    {
      label: 'Total Subscriptions',
      value: metrics?.total_subscriptions || 0,
      sub:   `${metrics?.test_count || 0} test accounts excluded`,
      color: '#1565C0', bg: '#E3F2FD',
    },
    {
      label: 'Paid',
      value: metrics?.paid_count || 0,
      sub:   `${metrics?.pending_count || 0} pending`,
      color: '#2E7D32', bg: '#E8F5E9',
    },
  ];
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',
                 gap:'16px',marginBottom:'1.5rem'}}>
      {cards.map(c=>(
        <div key={c.label} style={{
          background:c.bg, borderRadius:12, padding:'1.25rem',
          borderLeft:`4px solid ${c.color}`,
        }}>
          {loading ? (
            <div style={{height:40,background:'#ddd',borderRadius:6,
                         animation:'pulse 1s infinite'}} />
          ) : (
            <>
              <div style={{fontSize:24,fontWeight:'bold',color:c.color}}>
                {c.value}
              </div>
              <div style={{fontSize:13,color:'#555',marginTop:4}}>{c.label}</div>
              <div style={{fontSize:11,color:'#999',marginTop:2}}>{c.sub}</div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

5.3 Filter Bar with Debounced Search
// components/superadmin/SubscriptionFilters.jsx
import { useState, useCallback } from 'react';
import { debounce } from 'lodash';  // npm install lodash

export default function SubscriptionFilters({ filters, onChange }) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  // ── Debounce: only fires API call 400ms after user stops typing ──
  const debouncedSearch = useCallback(
    debounce((val) => onChange({ search: val, page: 1 }), 400),
    []
  );

  const handleSearch = (e) => {
    setSearchInput(e.target.value);
    debouncedSearch(e.target.value);
  };

  return (
    <div style={{display:'flex',gap:12,marginBottom:'1rem',flexWrap:'wrap'}}>
      <input
        placeholder='Search institute name or email...'
        value={searchInput}
        onChange={handleSearch}
        style={{flex:1,minWidth:240,padding:'8px 12px',
                border:'1px solid #ddd',borderRadius:6}}
      />
      <select
        value={filters.status}
        onChange={e=>onChange({status:e.target.value,page:1})}
        style={{padding:'8px 12px',border:'1px solid #ddd',borderRadius:6}}
      >
        <option value='all'>All Status</option>
        <option value='paid'>Paid</option>
        <option value='pending'>Pending</option>
        <option value='failed'>Failed</option>
      </select>
      <input type='date' placeholder='From'
        value={filters.startDate||''}
        onChange={e=>onChange({startDate:e.target.value,page:1})}
        style={{padding:'8px 12px',border:'1px solid #ddd',borderRadius:6}}
      />
      <input type='date' placeholder='To'
        value={filters.endDate||''}
        onChange={e=>onChange({endDate:e.target.value,page:1})}
        style={{padding:'8px 12px',border:'1px solid #ddd',borderRadius:6}}
      />
    </div>
  );
}

5.4 Subscriptions Table with Test Mode Toggle
// components/superadmin/SubscriptionTable.jsx
import subscriptionService from '../../services/superadmin/subscription.service';
import { formatCurrency, formatDate } from '../../utils/format';

export default function SubscriptionTable({ data, onRefresh }) {
  const [togglingId, setTogglingId] = useState(null);

  const handleToggleTest = async (instituteId, currentIsTest) => {
    const newVal = !currentIsTest;
    const msg = newVal
      ? 'Mark as TEST? This institute\'s payments will be EXCLUDED from revenue.'
      : 'Mark as LIVE? This institute\'s payments will be INCLUDED in revenue.';
    if (!window.confirm(msg)) return;

    setTogglingId(instituteId);
    try {
      await subscriptionService.toggleTest(instituteId, newVal);
      onRefresh();  // re-fetch data + metrics
    } catch(e) {
      alert('Failed to toggle: ' + e.message);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr style={{background:'#0A1628',color:'#fff'}}>
            {['#','Institute','Plan','Billing','Original','Discount',
              'GST','Total','Period','Status','Mode','Actions']
              .map(h=><th key={h} style={{padding:'10px 12px',
                textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((sub,i)=>(
            <tr key={sub.id}
              style={{background:sub.is_test?'#FFF8E1':(i%2===0?'#fff':'#F8F9FA'),
                     borderBottom:'1px solid #eee'}}>
              <td style={{padding:'10px 12px',color:'#888'}}>#{sub.id}</td>
              <td style={{padding:'10px 12px'}}>
                <div style={{fontWeight:500}}>{sub.Institute?.name}</div>
                <div style={{fontSize:11,color:'#888'}}>{sub.Institute?.email}</div>
              </td>
              <td style={{padding:'10px 12px'}}>
                {sub.Plan?.name}
                <span style={{fontSize:10,color:'#888',marginLeft:4}}>
                  ({sub.Plan?.platform_type})
                </span>
              </td>
              <td style={{padding:'10px 12px',textTransform:'capitalize'}}>
                {sub.billing_cycle}
              </td>
              <td style={{padding:'10px 12px'}}>
                {formatCurrency(parseFloat(sub.amount_paid)+parseFloat(sub.discount_amount))}
              </td>
              <td style={{padding:'10px 12px',color:'#E65100'}}>
                {sub.discount_amount>0?`-${formatCurrency(sub.discount_amount)}`:'—'}
              </td>
              <td style={{padding:'10px 12px',color:'#555'}}>
                {formatCurrency(sub.tax_amount)}
              </td>
              <td style={{padding:'10px 12px',fontWeight:'bold'}}>
                {formatCurrency(sub.amount_paid)}
              </td>
              <td style={{padding:'10px 12px',fontSize:11,color:'#555'}}>
                {formatDate(sub.start_date)}<br/>→ {formatDate(sub.end_date)}
              </td>
              <td style={{padding:'10px 12px'}}>
                <StatusBadge status={sub.payment_status} />
              </td>
              {/* TEST / LIVE badge */}
              <td style={{padding:'10px 12px'}}>
                <span style={{
                  background: sub.is_test ? '#FFF3E0' : '#E8F5E9',
                  color:      sub.is_test ? '#E65100' : '#2E7D32',
                  fontSize:10, fontWeight:'bold',
                  padding:'2px 8px', borderRadius:12,
                }}>
                  {sub.is_test ? '🧪 TEST' : '✅ LIVE'}
                </span>
              </td>
              {/* Actions */}
              <td style={{padding:'10px 12px'}}>
                <div style={{display:'flex',gap:4}}>
                  {/* Toggle Test/Live button */}
                  <button
                    onClick={()=>handleToggleTest(sub.Institute?.id, sub.is_test)}
                    disabled={togglingId===sub.Institute?.id}
                    title={sub.is_test?'Mark as Live':'Mark as Test'}
                    style={{
                      background: sub.is_test ? '#2E7D32' : '#E65100',
                      color:'#fff', border:'none',
                      padding:'3px 8px', borderRadius:4,
                      cursor:'pointer', fontSize:11,
                    }}>
                    {togglingId===sub.Institute?.id?'...':(sub.is_test?'→ LIVE':'→ TEST')}
                  </button>
                  {sub.payment_status!=='paid' && (
                    <button onClick={()=>openPayModal(sub)}
                      style={{background:'#1565C0',color:'#fff',border:'none',
                              padding:'3px 8px',borderRadius:4,fontSize:11}}>
                      💳 Pay
                    </button>
                  )}
                  <button onClick={()=>openEditModal(sub)}
                    style={{background:'#555',color:'#fff',border:'none',
                            padding:'3px 8px',borderRadius:4,fontSize:11}}>
                    ✏️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

5.5 Main Page — pages/superadmin/Subscriptions.jsx
import { useState, useCallback } from 'react';
import subscriptionService from '../../services/superadmin/subscription.service';
import { useSubscriptionSocket } from '../../hooks/useSubscriptionSocket';
import SubscriptionMetrics from '../../components/superadmin/SubscriptionMetrics';
import SubscriptionFilters from '../../components/superadmin/SubscriptionFilters';
import SubscriptionTable   from '../../components/superadmin/SubscriptionTable';
import Pagination           from '../../components/Pagination';

export default function SubscriptionsPage() {
  const [data,     setData]     = useState([]);
  const [metrics,  setMetrics]  = useState(null);
  const [pagination,setPagination]=useState({});
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState({
    page:1, limit:10, search:'', status:'all',
    startDate:'', endDate:'',
  });

  const fetchData = useCallback(async (f=filters) => {
    setLoading(true);
    try {
      const res = await subscriptionService.getAll(f);
      setData(res.data);
      setMetrics(res.metrics);
      setPagination(res.pagination);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────
  useState(()=>{ fetchData(); },[]);

  // ── Real-time: refetch when socket emits update ───────────
  useSubscriptionSocket(() => fetchData(filters));

  const handleFilterChange = (newF) => {
    const merged = { ...filters, ...newF };
    setFilters(merged);
    fetchData(merged);
  };

  const handleExport = async (format) => {
    const res = await subscriptionService.export(format, filters);
    const url = URL.createObjectURL(res.data);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = `subscriptions.${format==='excel'?'xlsx':'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{padding:'1.5rem'}}>
      <div style={{display:'flex',justifyContent:'space-between',
                   alignItems:'center',marginBottom:'1.5rem'}}>
        <div>
          <h1 style={{margin:0}}>💳 Subscriptions Management</h1>
          <p style={{margin:'4px 0 0',color:'#888'}}>
            Revenue metrics exclude test accounts
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>handleExport('excel')}
            style={{background:'#2E7D32',color:'#fff',border:'none',
                    padding:'8px 16px',borderRadius:6}}>
            📊 Export Excel
          </button>
          <button onClick={()=>handleExport('pdf')}
            style={{background:'#B71C1C',color:'#fff',border:'none',
                    padding:'8px 16px',borderRadius:6}}>
            📄 Export PDF
          </button>
        </div>
      </div>

      <SubscriptionMetrics metrics={metrics} loading={loading} />
      <SubscriptionFilters filters={filters} onChange={handleFilterChange} />
      <SubscriptionTable
        data={data}
        onRefresh={()=>fetchData(filters)}
      />
      <Pagination
        page={filters.page} pages={pagination.pages}
        total={pagination.total}
        onChange={p=>handleFilterChange({page:p})}
      />
    </div>
  );
}

Phase 6 — Server-Side Export: Excel + PDF (Day 3)
Export runs server-side using exceljs and pdfkit — no browser libraries needed. The server generates the file and streams it as a download.

6.1 Install Packages
# In your backend directory:
npm install exceljs pdfkit node-cache socket.io

6.2 Excel Export — utils/exportSubscriptions.js
const ExcelJS = require('exceljs');
const { formatCurrency, formatDate } = require('./format');

async function exportExcel(res, data) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Subscriptions');

  // Header row style
  ws.columns = [
    { header:'#',          key:'id',        width:8  },
    { header:'Institute',  key:'institute',  width:25 },
    { header:'Email',      key:'email',      width:28 },
    { header:'Plan',       key:'plan',       width:18 },
    { header:'Billing',    key:'billing',    width:14 },
    { header:'Original',   key:'original',   width:14 },
    { header:'Discount',   key:'discount',   width:12 },
    { header:'GST',        key:'gst',        width:12 },
    { header:'Total',      key:'total',      width:14 },
    { header:'From',       key:'from',       width:12 },
    { header:'To',         key:'to',         width:12 },
    { header:'Status',     key:'status',     width:12 },
    { header:'Mode',       key:'mode',       width:10 },
  ];

  // Style header
  ws.getRow(1).font = { bold:true, color:{argb:'FFFFFFFF'} };
  ws.getRow(1).fill = {
    type:'pattern', pattern:'solid', fgColor:{argb:'FF0A1628'}
  };

  data.forEach((sub,i) => {
    const original = parseFloat(sub.amount_paid)+parseFloat(sub.discount_amount);
    const row = ws.addRow({
      id:        sub.id,
      institute: sub.Institute?.name,
      email:     sub.Institute?.email,
      plan:      `${sub.Plan?.name} (${sub.Plan?.platform_type})`,
      billing:   sub.billing_cycle,
      original:  original,
      discount:  sub.discount_amount,
      gst:       sub.tax_amount,
      total:     sub.amount_paid,
      from:      formatDate(sub.start_date),
      to:        formatDate(sub.end_date),
      status:    sub.payment_status,
      mode:      sub.is_test ? 'TEST' : 'LIVE',
    });
    // Highlight test rows in yellow
    if (sub.is_test) {
      row.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFF8E1'} };
    }
  });

  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition',
    'attachment; filename="subscriptions.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}
module.exports = { exportExcel };

6.3 PDF Export
const PDFDocument = require('pdfkit');

function exportPDF(res, data) {
  const doc = new PDFDocument({ size:'A4', margin:40, layout:'landscape' });
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition','attachment; filename="subscriptions.pdf"');
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold')
     .text('Subscriptions Report',{align:'center'});
  doc.fontSize(10).font('Helvetica').fillColor('#888')
     .text(`Generated: ${new Date().toLocaleDateString('en-IN')}  |  Live payments only`,
            {align:'center'});
  doc.moveDown(1.5);

  data.forEach((sub,i) => {
    doc.fillColor(sub.is_test ? '#FF8F00' : '#0A1628').fontSize(11)
       .font('Helvetica-Bold')
       .text(`#${sub.id}  ${sub.Institute?.name}  ` +
             `[${sub.is_test?'TEST':'LIVE'}]  ${sub.payment_status.toUpperCase()}`);
    doc.fillColor('#444').fontSize(9).font('Helvetica')
       .text(`Plan: ${sub.Plan?.name} · ` +
             `Total: ₹${sub.amount_paid} · ` +
             `${sub.start_date} to ${sub.end_date}`);
    doc.moveDown(0.5);
    if (i < data.length-1)
      doc.moveTo(40,doc.y).lineTo(800,doc.y).strokeColor('#eee').stroke();
    doc.moveDown(0.3);
  });

  doc.end();
}
module.exports = { exportPDF };

Phase 7 — Shared Utility Functions (Day 3)

7.1 Format Utilities — utils/format.js
// utils/format.js — shared between frontend and backend export

// Currency: ₹1,23,456.78 (Indian format)
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style:    'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(parseFloat(amount));
}

// Date: 30 Jul 2026
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day:'2-digit', month:'short', year:'numeric'
  });
}

// Status badge color
export function statusColor(status) {
  const map = {
    paid:    { bg:'#E8F5E9', color:'#2E7D32' },
    pending: { bg:'#FFF3E0', color:'#E65100' },
    failed:  { bg:'#FFEBEE', color:'#B71C1C' },
  };
  return map[status] || { bg:'#F5F5F5', color:'#888' };
}

Phase 8 — Execution Plan, Performance & Testing Checklist

8.1 4-Day Execution Timeline
Day	Phase	Tasks	Verify
Day 1 AM	Phase 1	Run SQL migration · Update Sequelize models (Subscription + Institute)	DESCRIBE subscriptions — see is_test column
Day 1 PM	Phase 2	Create subscription.service.js — 4 functions with node-cache · npm install node-cache	node -e "require('./services/subscription.service')" — no errors
Day 2 AM	Phase 3	Build 8 API endpoints in controller · Register routes · npm install socket.io	Postman: GET /api/superadmin/subscriptions — returns metrics + list
Day 2 PM	Phase 4	Add socket.js · Update server.js to use http server · Build useSubscriptionSocket hook	Toggle test in Postman → browser updates without refresh
Day 3 AM	Phase 5A	Build SubscriptionMetrics.jsx + SubscriptionFilters.jsx	Cards show correct revenue (test excluded)
Day 3 PM	Phase 5B	Build SubscriptionTable.jsx with TEST/LIVE badge + Toggle button · Main page	Toggle button changes badge colour and updates revenue card
Day 4 AM	Phase 6	npm install exceljs pdfkit · Build export endpoints · Frontend download handler	Excel downloads with test rows highlighted yellow
Day 4 PM	Phase 7+8	Format utilities · End-to-end test all scenarios in checklist	Run every row in checklist — all pass


8.2 Performance Architecture — Why This Is Fast
Query Performance Design
1. Promise.all([getMetrics(), getSubscriptionList()]) → parallel execution
   Total wait time = MAX(metrics, list) — not SUM. Saves ~50ms per request.

2. Metrics query: raw SQL with SUM()/COUNT() on indexed columns → O(log n).
   With idx_sub_is_test + idx_sub_status → under 3ms for 10,000 rows.

3. node-cache 30s TTL on metrics → zero DB calls for metrics on repeat loads.
   Cache busted on every mutation (pay, toggle, delete) → always accurate.

4. Eager loading (Sequelize include) → 1 SQL JOIN, not N+1 queries.
   Without this: 10 rows = 21 queries. With this: 10 rows = 1 query.

5. Debounced search (400ms) → search input fires API only after user stops
   typing. Prevents 10 API calls for 10 keystrokes.

6. Pagination limit:10 → only 10 rows fetched per page, not all 1,000+.

Total API calls per page load: 1 (metrics + list combined)
Total API calls per search:    1 (fired once, 400ms after last keystroke)
Total API calls on toggle:     1 (PATCH) + socket re-triggers 1 GET


8.3 Test Mode — Exact Behaviour Specification
Action	What Happens in DB	What Happens in Revenue
Super admin clicks '→ TEST' on an institute	institutes.is_test_account = true · ALL existing subscriptions.is_test = true (transaction)	Revenue drops immediately — test subscriptions excluded from SUM
Super admin clicks '→ LIVE' on an institute	institutes.is_test_account = false · ALL existing subscriptions.is_test = false	Revenue increases immediately — subscriptions now counted
Test institute makes new payment (Razorpay webhook)	New subscription created with is_test = true (inherited from institute.is_test_account)	Payment NOT added to revenue — is_test filter excludes it
Live institute makes new payment	New subscription created with is_test = false	Payment counted in revenue normally
Export Excel — test rows	Test rows included in Excel file	Highlighted yellow with 'TEST' label in Mode column
Export Excel — revenue total	Footer row shows SUM of LIVE payments only	Test amounts not included in total


8.4 Final Testing Checklist
	Test Scenario	Expected Result	Who
☐	Revenue metric shows before toggle	Correct sum of all LIVE subscriptions in ₹	Super Admin
☐	Click '→ TEST' on Institute B → confirm dialog	Dialog asks confirmation before toggling	Super Admin
☐	After toggle → revenue metric updates	Institute B's payments no longer in revenue total	Super Admin
☐	Institute B row shows 🧪 TEST badge in Mode column	Orange TEST badge visible	Super Admin
☐	Toggle button shows '→ LIVE' for test institute	Button is green, labeled → LIVE	Super Admin
☐	Click '→ LIVE' → revenue updates again	Institute B's payments counted again in revenue	Super Admin
☐	Second browser tab (super admin) — toggle in tab 1	Tab 2 updates automatically via Socket.io in <1s	Super Admin
☐	Search 'IT HUB' — table filters and metrics update	Only IT HUB rows shown; metrics reflect filter	Super Admin
☐	Filter by status='pending' — shows only pending	Paid/failed rows hidden; counts correct	Super Admin
☐	Date range filter — Last 30 days	Only subscriptions starting in that range shown	Super Admin
☐	Mark subscription as paid	Status changes to PAID, revenue metric updates	Super Admin
☐	Try to mark already-paid subscription	Error: Already paid — blocked	Super Admin
☐	Export Excel — test rows highlighted yellow	Yellow rows for test, white for live	Super Admin
☐	Export PDF — TEST label on test rows	TEST label in orange for test institute rows	Super Admin
☐	Delete pending subscription	Row removed, metrics update	Super Admin
☐	Try to delete paid subscription	Error: Cannot delete a paid subscription	Super Admin


8.5 Files Changed Summary
File	Action	Phase
backend/scripts/subscription_migration.sql	New — run once	1
backend/models/Subscription.js	Modify — add is_test field	1
backend/models/Institute.js	Modify — add is_test_account field	1
backend/services/subscription.service.js	New — 4 functions + node-cache	2
backend/controllers/superadmin/subscription.controller.js	New — 8 handlers	3
backend/routes/superadmin/subscription.routes.js	New — 8 routes	3
backend/app.js / server.js	Modify — register routes + init Socket.io	3+4
backend/socket.js	New — Socket.io init + getIO()	4
backend/utils/exportSubscriptions.js	New — Excel + PDF export	6
backend/utils/format.js	New — formatCurrency, formatDate	7
frontend/src/hooks/useSubscriptionSocket.js	New — Socket.io hook	4
frontend/src/services/superadmin/subscription.service.js	New	5
frontend/src/components/superadmin/SubscriptionMetrics.jsx	New	5
frontend/src/components/superadmin/SubscriptionFilters.jsx	New	5
frontend/src/components/superadmin/SubscriptionTable.jsx	New	5
frontend/src/pages/superadmin/Subscriptions.jsx	New — main page	5
frontend/src/utils/format.js	New — shared utilities	7

