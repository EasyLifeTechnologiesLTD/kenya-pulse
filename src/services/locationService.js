const Location = require('../models/Location');
const { ApiError } = require('../utils/ApiError');

const getCounties = async () => {
  return Location.find({ type: 'county' }).sort({ name: 1 }).select('code name -_id');
};

const getConstituencies = async (countyCode) => {
  const county = await Location.findOne({ code: countyCode, type: 'county' });
  if (!county) throw new ApiError(404, `County not found: ${countyCode}`);

  return Location.find({ type: 'constituency', parentCode: countyCode })
    .sort({ name: 1 })
    .select('code name -_id');
};

const getWards = async (constituencyCode) => {
  const constituency = await Location.findOne({ code: constituencyCode, type: 'constituency' });
  if (!constituency) throw new ApiError(404, `Constituency not found: ${constituencyCode}`);

  return Location.find({ type: 'ward', parentCode: constituencyCode })
    .sort({ name: 1 })
    .select('code name -_id');
};

const PARENT_TYPE = {
  county: null,
  constituency: 'county',
  ward: 'constituency',
};

const validateParent = async (type, parentCode) => {
  const expectedParentType = PARENT_TYPE[type];

  if (!expectedParentType) {
    if (parentCode) throw new ApiError(400, `type "county" must not have a parentCode`);
    return;
  }

  if (!parentCode) {
    throw new ApiError(400, `type "${type}" requires a parentCode (${expectedParentType} code)`);
  }

  const parent = await Location.findOne({ code: parentCode, type: expectedParentType });
  if (!parent) {
    throw new ApiError(400, `parentCode "${parentCode}" does not reference an existing ${expectedParentType}`);
  }
};

const createLocation = async ({ code, name, type, parentCode }) => {
  if (!code || !name || !type) {
    throw new ApiError(400, 'code, name, and type are required');
  }
  if (!['county', 'constituency', 'ward'].includes(type)) {
    throw new ApiError(400, `invalid type "${type}"`);
  }

  await validateParent(type, parentCode ?? null);

  const existing = await Location.findOne({ code });
  if (existing) throw new ApiError(409, `location with code "${code}" already exists`);

  return Location.create({ code, name, type, parentCode: parentCode ?? null });
};

// Bulk upsert — this is the realistic path for loading 47 counties / 290
// constituencies / 1450+ wards, and for re-running corrections against the
// same source file without creating duplicates.
const bulkUpsertLocations = async (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'records must be a non-empty array');
  }

  const seenCodes = new Set();
  const errors = [];

  // Validate structurally first — before touching the DB — so a bad row
  // fails the whole batch instead of leaving a half-applied import.
  records.forEach((r, i) => {
    if (!r.code || !r.name || !r.type) {
      errors.push({ index: i, code: r.code, error: 'code, name, and type are required' });
      return;
    }
    if (!['county', 'constituency', 'ward'].includes(r.type)) {
      errors.push({ index: i, code: r.code, error: `invalid type "${r.type}"` });
      return;
    }
    if (seenCodes.has(r.code)) {
      errors.push({ index: i, code: r.code, error: 'duplicate code within this request payload' });
      return;
    }
    seenCodes.add(r.code);
  });

  if (errors.length > 0) {
    throw new ApiError(400, 'validation failed', { errors });
  }

  // Parent-reference validation: allow a batch to include parents and their
  // children in the same request (e.g. seeding constituencies + wards
  // together), so a parentCode is valid if it exists in the DB OR earlier
  // in this same batch.
  const codesInBatch = new Set(records.map((r) => r.code));
  const parentValidationErrors = [];

  for (let i = 0; i < records.length; i++) {
    const { type, parentCode, code } = records[i];
    const expectedParentType = PARENT_TYPE[type];

    if (!expectedParentType) {
      if (parentCode) parentValidationErrors.push({ index: i, code, error: 'county must not have a parentCode' });
      continue;
    }
    if (!parentCode) {
      parentValidationErrors.push({ index: i, code, error: `${type} requires a parentCode` });
      continue;
    }
    if (codesInBatch.has(parentCode)) continue; // satisfied within this batch

    const parentExists = await Location.exists({ code: parentCode, type: expectedParentType });
    if (!parentExists) {
      parentValidationErrors.push({ index: i, code, error: `parentCode "${parentCode}" not found in DB or batch` });
    }
  }

  if (parentValidationErrors.length > 0) {
    throw new ApiError(400, 'parent validation failed', { errors: parentValidationErrors });
  }

  const bulkOps = records.map((r) => ({
    updateOne: {
      filter: { code: r.code },
      update: { $set: { name: r.name, type: r.type, parentCode: r.parentCode ?? null } },
      upsert: true,
    },
  }));

  const result = await Location.bulkWrite(bulkOps, { ordered: true });

  return {
    matched: result.matchedCount,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
    total: records.length,
  };
};

module.exports = {
  getCounties,
  getConstituencies,
  getWards,
  createLocation,
  bulkUpsertLocations,
};