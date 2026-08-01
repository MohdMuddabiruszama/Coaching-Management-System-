Revenue Analytics Dashboard
Architecture Report & Real-Time Upgrade Plan
This document is both an architectural report of the current Revenue Analytics feature and a complete, ready-to-implement upgrade plan covering real-time updates, query optimization, caching, and UI polish.
1. Current Architecture & Workflow
Based on the codebase (Revenue.jsx and superadmin.controller.js), here is how the Revenue Analytics section currently works.
Database & Query Logic (Backend)
•	Endpoint: /api/superadmin/analytics mapped to exports.getAnalytics.
•	Monthly Revenue Trend: uses PostgreSQL's EXTRACT(MONTH FROM created_at) inside a Sequelize.findAll() query, grouping the sums of amount_paid by month and year.
•	Plan Distribution: queries the Subscriptions table and groups by plan_id, performing a COUNT to see how many subscriptions belong to each plan.
•	Recent Transactions: hits /api/subscriptions?status=paid&limit=5, which runs through the recently optimized subscription.service.js.
Frontend Mapping (Revenue.jsx)
•	State Management: standard useState to hold analyticsData and recentPayments.
•	Data Fetching: a simple useEffect runs on component mount, calling api.get concurrently.
•	Data Visualization: maps the raw backend arrays into Chart.js data structures (labels and datasets).
◦	The Line Chart maps months (e.g., Jun, Jul, Aug) to totalRevenue.
◦	The Doughnut Chart maps plan_id counts to colorful pie segments.

Identified Flaws in Current Implementation
1.	No Test Data Isolation — the current getAnalytics query does not exclude is_test: true subscriptions, so test transactions pollute real revenue charts.
2.	Not Real-Time — when a new payment comes in, the Super Admin must manually refresh the page to see the chart update.
3.	Missing Caching — the heavy GROUP BY database queries hit the DB directly on every page load.

2. Proposed "Professional & Real-Time" Upgrade Plan
To achieve minimum time complexity, minimum API calls, and fast CRUD operations, the following architectural upgrades are proposed across four phases.
Phase 1 — Real-Time WebSockets Integration
•	Socket.io: bind the Revenue.jsx component to the join_superadmin Socket room, reusing the same room already used on the Subscriptions page.
•	Auto-Refresh: when the server emits a subscription_updated event, the charts gracefully re-render with fresh data — no page reload.
Phase 2 — Database Query Optimization & Isolation
•	Exclude Test Accounts: inject is_test: false into the monthlyRevenue and planDistribution grouping queries to guarantee financial accuracy.
•	Date Boundary Limits: scope SQL queries to the last 6–12 months instead of a full table scan across all years.
Phase 3 — Backend Caching (O(1) Time Complexity)
•	node-cache: wrap the analytics grouping queries in a memory cache with a 30-minute TTL.
•	Cache Busting: whenever a webhook or admin creates/updates a subscription, automatically bust the specific cache key so the next request recalculates and serves fresh data in O(1) time on subsequent hits.
Phase 4 — UI/UX Aesthetic Polish
•	Update the Chart.js configuration in Revenue.jsx to use smooth cubic interpolation (curved lines) and custom tooltips matching the premium visual style.
•	Ensure charts are fully responsive using relative CSS bounds so they scale cleanly on mobile, tablet, and desktop.

3. Implementation — Phase 2 & 3: Backend Controller
Below is the production-ready controller covering caching, test-data isolation, and date-bounded queries. Adjust model/field names to match your schema if they differ.
// superadmin.controller.js
const NodeCache = require('node-cache');
const { Op, Sequelize } = require('sequelize');
const { Subscription } = require('../models'); // adjust path
 
// TTL 30 min, checkperiod 60s
const analyticsCache = new NodeCache({ stdTTL: 1800, checkperiod: 60 });
const CACHE_KEY = 'superadmin:analytics';
 
exports.getAnalytics = async (req, res) => {
  try {
    const cached = analyticsCache.get(CACHE_KEY);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }
 
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);
 
    // Run both aggregate queries concurrently -- 2 queries total, not N+1
    const [monthlyRevenueRaw, planDistributionRaw] = await Promise.all([
      Subscription.findAll({
        attributes: [
          [Sequelize.fn('EXTRACT', Sequelize.literal('MONTH FROM "created_at"')), 'month'],
          [Sequelize.fn('EXTRACT', Sequelize.literal('YEAR FROM "created_at"')), 'year'],
          [Sequelize.fn('SUM', Sequelize.col('amount_paid')), 'totalRevenue'],
        ],
        where: {
          is_test: false,
          created_at: { [Op.gte]: twelveMonthsAgo },
        },
        group: [
          Sequelize.literal('EXTRACT(YEAR FROM "created_at")'),
          Sequelize.literal('EXTRACT(MONTH FROM "created_at")'),
        ],
        order: [
          [Sequelize.literal('EXTRACT(YEAR FROM "created_at")'), 'ASC'],
          [Sequelize.literal('EXTRACT(MONTH FROM "created_at")'), 'ASC'],
        ],
        raw: true,
      }),
      Subscription.findAll({
        attributes: [
          'plan_id',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        ],
        where: {
          is_test: false,
          created_at: { [Op.gte]: twelveMonthsAgo },
        },
        group: ['plan_id'],
        raw: true,
      }),
    ]);
 
    const payload = {
      monthlyRevenue: monthlyRevenueRaw,
      planDistribution: planDistributionRaw,
      generatedAt: new Date().toISOString(),
    };
 
    analyticsCache.set(CACHE_KEY, payload);
    return res.json({ ...payload, cached: false });
  } catch (err) {
    console.error('getAnalytics error:', err);
    return res.status(500).json({ message: 'Failed to load analytics' });
  }
};
 
// Export so any write path (webhook, admin create/update) can bust it
exports.bustAnalyticsCache = () => {
  analyticsCache.del(CACHE_KEY);
};
Key decisions
•	Two queries, run in parallel with Promise.all — not sequential, not N+1. This is what delivers the "minimum API calls / fast CRUD" goal.
•	is_test: false and a 12-month floor are baked into the WHERE clause of both queries, not filtered in JS afterward — filtering post-fetch defeats the purpose of the optimization.
•	Index reminder: add CREATE INDEX idx_subscriptions_created_at ON subscriptions (created_at); and consider a composite index on (is_test, created_at) as the table grows. Without an index, the Op.gte scan degrades to a full table scan regardless of caching.
•	Cache reads are O(1); on a miss, the DB round trip happens only once per 30 minutes per key — or until explicitly busted.
Cache busting — wire into every write path
Wherever subscriptions get created or updated (webhook handler, admin CRUD controller), call the buster right after the write commits:
// subscription.service.js (or wherever writes happen)
const { bustAnalyticsCache } = require('../controllers/superadmin.controller');
 
async function markSubscriptionPaid(subscriptionId, data) {
  const updated = await Subscription.update(data, { where: { id: subscriptionId } });
  bustAnalyticsCache(); // next getAnalytics call recalculates fresh
  return updated;
}
Apply this in: the payment webhook handler, the manual admin edit endpoint, and the subscription creation endpoint — anywhere amount_paid, plan_id, or is_test could change.

4. Implementation — Phase 1: Real-Time via Socket.io
Backend — emit after any subscription write
// after bustAnalyticsCache() in each write path
req.app.get('io').to('superadmin').emit('subscription_updated', {
  subscriptionId: updated.id,
  timestamp: Date.now(),
});
This assumes io is already attached to the app instance and a join_superadmin room exists, as it does on the Subscriptions page — reuse that same room rather than creating a second one.
Frontend — Revenue.jsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
 
function Revenue() {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const debounceRef = useRef(null);
 
  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, paymentsRes] = await Promise.all([
        api.get('/api/superadmin/analytics'),
        api.get('/api/subscriptions?status=paid&limit=5'),
      ]);
      setAnalyticsData(analyticsRes.data);
      setRecentPayments(paymentsRes.data);
    } catch (err) {
      console.error('Failed to load revenue analytics', err);
    } finally {
      setLoading(false);
    }
  }, []);
 
  useEffect(() => {
    fetchData();
 
    const socket = io(process.env.REACT_APP_SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;
    socket.emit('join_superadmin');
 
    socket.on('subscription_updated', () => {
      // debounce: if 10 payments land in the same second, refetch once
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fetchData, 400);
    });
 
    return () => {
      clearTimeout(debounceRef.current);
      socket.disconnect();
    };
  }, [fetchData]);
 
  // ... render charts with analyticsData
}
 
export default Revenue;
The debounce matters: without it, a burst of payments (e.g. a replayed webhook batch) triggers a refetch storm. 400ms coalesces them into a single call.

5. Implementation — Phase 4: Chart.js Polish
const lineChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  elements: {
    line: { tension: 0.4 }, // smooth cubic curves
    point: { radius: 3, hoverRadius: 6 },
  },
  plugins: {
    tooltip: {
      backgroundColor: 'rgba(17, 17, 17, 0.9)',
      padding: 12,
      cornerRadius: 8,
      titleFont: { weight: '600' },
      displayColors: false,
      callbacks: {
        label: (ctx) => `₹${Number(ctx.raw).toLocaleString()}`,
      },
    },
    legend: { display: false },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
    x: { grid: { display: false } },
  },
};
Wrap the chart in a container with a fixed height and fluid width, rather than relying on aspect ratio alone — that is what actually makes it behave correctly across mobile and desktop breakpoints.
<div style={{ position: 'relative', height: '320px', width: '100%' }}>
  <Line data={chartData} options={lineChartOptions} />
</div>

6. Rollout Checklist
•	Add CREATE INDEX on subscriptions(created_at) and consider a composite index on (is_test, created_at).
•	Install node-cache in the backend (npm install node-cache).
•	Wire bustAnalyticsCache() into every write path: webhook handler, admin edit endpoint, subscription creation.
•	Confirm the Socket.io join_superadmin room and io app-instance attachment already used on the Subscriptions page — reuse rather than duplicate.
•	Emit subscription_updated from each write path after busting the cache.
•	Update Revenue.jsx to fetch on mount, subscribe to the socket event with a 400ms debounce, and clean up the socket connection on unmount.
•	Apply the updated Chart.js options and fixed-height chart container for responsive rendering.
•	Verify test transactions (is_test: true) no longer appear in the revenue charts after deployment.
