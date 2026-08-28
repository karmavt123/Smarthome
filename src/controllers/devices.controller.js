const devicesService = require('../services/devices.service');
const serialize = require('../utils/serialize');

async function index(req, res) {
  const devices = await devicesService.listDevices(req.user.sub, req.query);
  res.json(serialize(devices));                    // index
}

async function show(req, res) {
  const id = Number(req.params.id);
  const device = await devicesService.getDeviceById(req.user.sub, id);
  if (!device) {
    return res.status(404).json({ message: 'Device not found' });
  }
  res.json(serialize(device));                     // show
}

async function create(req, res) {
  const { home_id, room_id, name, device_code, device_type } = req.body;
  const device = await devicesService.createDevice(req.user.sub, {
    home_id,
    room_id,
    name,
    device_code,
    device_type,
  });
  if (!device) {
    return res.status(404).json({ message: 'Home or room not found' });
  }
  res.status(201).json(serialize(device));         // create
}

async function update(req, res) {
  const { name, room_id } = req.body;
  const device = await devicesService.updateDevice(req.user.sub, req.params.id, { name, room_id });
  res.json(serialize(device));                     // update
}

async function destroy(req, res) {
  await devicesService.deleteDevice(req.user.sub, req.params.id);
  res.status(204).send();
}

module.exports = { index, show, create, update, destroy };
