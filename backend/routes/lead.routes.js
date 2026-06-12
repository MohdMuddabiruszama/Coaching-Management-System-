const express = require('express');
const router = express.Router();
const leadController = require('../controllers/lead.controller');
const verifyToken = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');

router.post('/', leadController.submitLead);
router.post('/page-view', leadController.trackPageView);
router.get('/', verifyToken, allowRoles('super_admin'), leadController.getLeads);
router.post('/clear-unread', verifyToken, allowRoles('super_admin'), leadController.clearUnreadLeads);
router.put('/:id/status', verifyToken, allowRoles('super_admin'), leadController.updateLeadStatus);

module.exports = router;
