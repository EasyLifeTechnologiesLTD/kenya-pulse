// src/routes/adminRoutes.js
const express = require('express');
const { adminAuth } = require('../middleware/adminAuth');
const { requireRole } = require('../middleware/requireRole');

const adminAuthRoutes = require('./adminAuthRoutes');
const meController = require('../controllers/meController');
const dashboardController = require('../controllers/dashboardController');
const userController = require('../controllers/userController');
const reportController = require('../controllers/reportController');
const questionController = require('../controllers/questionController');
const communityController = require('../controllers/communityController');

const router = express.Router();

// ── Public ──────────────────────────────────────────────────────────────
router.use('/auth', adminAuthRoutes);

// ── Everything below requires a valid access token ──────────────────────
router.use(adminAuth);

router.get('/health', meController.health);
router.get('/me', meController.me);

router.get('/dashboard/stats', requireRole('SUPER_ADMIN', 'MODERATOR', 'SUPPORT'), dashboardController.stats);

router.get('/users', requireRole('SUPER_ADMIN', 'MODERATOR'), userController.list);
router.get('/users/:id', requireRole('SUPER_ADMIN', 'MODERATOR'), userController.getOne);
router.patch('/users/:id/status', requireRole('SUPER_ADMIN', 'MODERATOR'), userController.updateStatus);

router.get('/reports', requireRole('SUPER_ADMIN', 'MODERATOR'), reportController.list);
router.patch('/reports/:id/resolve', requireRole('SUPER_ADMIN', 'MODERATOR'), reportController.resolve);

router.get('/questions', requireRole('SUPER_ADMIN', 'MODERATOR'), questionController.list);
router.get('/questions/:id', requireRole('SUPER_ADMIN', 'MODERATOR'), questionController.getOne);
router.get('/questions/:id/stats', requireRole('SUPER_ADMIN', 'MODERATOR', 'SUPPORT'), questionController.stats);
router.post('/questions', requireRole('SUPER_ADMIN', 'MODERATOR'), questionController.create);
router.patch('/questions/:id', requireRole('SUPER_ADMIN', 'MODERATOR'), questionController.update);
router.delete('/questions/:id', requireRole('SUPER_ADMIN', 'MODERATOR'), questionController.remove);

router.get('/community', requireRole('SUPER_ADMIN', 'MODERATOR'), communityController.list);
router.patch('/community/:id/remove', requireRole('SUPER_ADMIN', 'MODERATOR'), communityController.remove);
router.patch('/community/:id/restore', requireRole('SUPER_ADMIN', 'MODERATOR'), communityController.restore);
router.patch('/community/:id/feature', requireRole('SUPER_ADMIN', 'MODERATOR'), communityController.feature);

module.exports = router;
