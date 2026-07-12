const devicesService = require('../services/devices.service');

async function index(req, res) {
  const devices = await devicesService.listDevices();
  res.json(devices);
}

async function show(req, res) {
  const id = Number(req.params.id);
  const device = await devicesService.getDeviceById(id);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }
  res.json(device);
}

async function create(req, res) {
  const { home_id, room_id, name, device_code, device_type } = req.body;
  const device = await devicesService.createDevice({ home_id, room_id, name, device_code, device_type });
  res.status(201).json(device);
}

module.exports = { index, show, create };
