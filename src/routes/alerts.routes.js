const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/alerts.controller');

const router = express.Router();

router.get('/alert-rules', requireAuth, controller.rulesIndex);
router.post('/alert-rules', requireAuth, controller.rulesCreate);
router.patch('/alert-rules/:id', requireAuth, controller.rulesUpdate);
router.get('/alerts', requireAuth, controller.alertsIndex);
router.patch('/alerts/:id', requireAuth, controller.alertsUpdate);

module.exports = router;
