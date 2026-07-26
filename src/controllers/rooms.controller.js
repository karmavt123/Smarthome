const roomsService = require('../services/rooms.service');
const serialize = require('../utils/serialize');

async function index(req, res) {
  res.json(serialize(await roomsService.listRooms(req.user.sub, req.query.home_id)));
}

async function create(req, res) {
  res.status(201).json(serialize(await roomsService.createRoom(req.user.sub, req.body)));
}

async function update(req, res) {
  res.json(serialize(await roomsService.updateRoom(req.user.sub, req.params.id, req.body)));
}

async function destroy(req, res) {
  await roomsService.deleteRoom(req.user.sub, req.params.id);
  res.status(204).send();
}

module.exports = { index, create, update, destroy };
