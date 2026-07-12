const express = require('express');
const devicesController = require('../controllers/devices.controller');

const router = express.Router();

router.get('/devices', devicesController.index);
router.get('/devices/:id', devicesController.show);
router.post('/devices', devicesController.create);

module.exports = router;
