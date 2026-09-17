const Location = require('../models/Location');
const { ApiError } = require('../utils/ApiError');

const mongoose = require('mongoose');

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
  if (!code || !name || !type) throw new ApiError(400, 'code, name, and type are required');
  if (!['county', 'constituency', 'ward'].includes(type)) throw new ApiError(400, `invalid type "${type}"`);

  await validateParent(type, parentCode ?? null);

  // scoped by (type, code), not code alone — a ward and a county can share "001"
  const existing = await Location.findOne({ code, type });
  if (existing) throw new ApiError(409, `location with code "${code}" and type "${type}" already exists`);

  return Location.create({ code, name, type, parentCode: parentCode ?? null });
};

const bulkUpsertLocations = async (records) => {
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'records must be a non-empty array');
  }


  const collection = mongoose.connection.collection('locations');

  const indexes = await collection.indexes();
  const hasOldIndex = indexes.some((i) => i.name === 'code_1');

  if (hasOldIndex) {
    await collection.dropIndex('code_1');
    console.log('Dropped stale index: code_1');
  } else {
    console.log('code_1 index not found — nothing to drop');
  }

  // recreate correctly scoped by type
  await collection.createIndex({ type: 1, code: 1 }, { unique: true });

  const seenKeys = new Set(); // keyed by type+code, not code alone
  const errors = [];

  records.forEach((r, i) => {
    if (!r.code || !r.name || !r.type) {
      errors.push({ index: i, code: r.code, error: 'code, name, and type are required' });
      return;
    }
    if (!['county', 'constituency', 'ward'].includes(r.type)) {
      errors.push({ index: i, code: r.code, error: `invalid type "${r.type}"` });
      return;
    }
    const key = `${r.type}:${r.code}`;
    if (seenKeys.has(key)) {
      errors.push({ index: i, code: r.code, error: `duplicate (type="${r.type}", code="${r.code}") within this request payload` });
      return;
    }
    seenKeys.add(key);
  });

  if (errors.length > 0) throw new ApiError(400, 'validation failed', { errors });

  // parent references also scoped by (type, code) — "codesInBatch" needs the same key shape
  const keysInBatch = new Set(records.map((r) => `${r.type}:${r.code}`));
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
    if (keysInBatch.has(`${expectedParentType}:${parentCode}`)) continue; // satisfied within batch

    const parentExists = await Location.exists({ code: parentCode, type: expectedParentType });
    if (!parentExists) {
      parentValidationErrors.push({ index: i, code, error: `parentCode "${parentCode}" (${expectedParentType}) not found in DB or batch` });
    }
  }

  if (parentValidationErrors.length > 0) {
    throw new ApiError(400, 'parent validation failed', { errors: parentValidationErrors });
  }

  // upsert filter must include type — otherwise updateOne({ code: '001' })
  // could match the county row when you meant the constituency row
  const bulkOps = records.map((r) => ({
    updateOne: {
      filter: { code: r.code, type: r.type },
      update: { $set: { name: r.name, parentCode: r.parentCode ?? null } },
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

module.exports = { getCounties, getConstituencies, getWards, createLocation, bulkUpsertLocations };