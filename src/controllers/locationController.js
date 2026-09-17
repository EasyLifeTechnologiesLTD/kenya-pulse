const { asyncHandler } = require('../utils/asyncHandler');
const locationService = require('../services/locationService');

const listCounties = asyncHandler(async (req, res) => {
  const counties = await locationService.getCounties();
  res.json(counties);
});

const listConstituencies = asyncHandler(async (req, res) => {
  const constituencies = await locationService.getConstituencies(req.params.countyCode);
  res.json(constituencies);
});

const listWards = asyncHandler(async (req, res) => {
  const wards = await locationService.getWards(req.params.constituencyCode);
  res.json(wards);
});

const create = asyncHandler(async (req, res) => {
  const location = await locationService.createLocation(req.body);
  res.status(201).json(location);
});

const bulkUpsert = asyncHandler(async (req, res) => {
  const { records } = req.body;
  const result = await locationService.bulkUpsertLocations(records);
  res.status(200).json(result);
});

module.exports = {
  listCounties,
  listConstituencies,
  listWards,
  create,
  bulkUpsert,
};