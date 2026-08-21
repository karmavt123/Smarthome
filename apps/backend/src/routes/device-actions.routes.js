const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/device-command.controller');

const router = express.Router();

router.get('/device-actions', requireAuth, controller.index);
router.get('/device-actions/:id', requireAuth, controller.show);

module.exports = router;
