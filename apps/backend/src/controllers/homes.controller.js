const homesService = require('../services/homes.service');
const serialize = require('../utils/serialize');

async function index(req, res) {
  res.json(serialize(await homesService.listHomes(req.user.sub)));
}

async function create(req, res) {
  res.status(201).json(serialize(await homesService.createHome(req.user.sub, req.body)));
}

async function update(req, res) {
  res.json(serialize(await homesService.updateHome(req.user.sub, req.params.id, req.body)));
}

async function destroy(req, res) {
  const home = await homesService.deleteHome(req.user.sub, req.params.id);
  res.json(serialize(home));
}

async function destroyByHomeId(req, res) {
  const home = await homesService.deleteHome(req.user.sub, req.body.home_id);
  res.json(serialize(home));
}

module.exports = { index, create, update, destroy, destroyByHomeId };
