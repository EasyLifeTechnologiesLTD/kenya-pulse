// src/services/communityAdminService.js
const CommunityPost = require('../models/CommunityPost');

async function listPosts({ page = 1, limit = 25, sort = 'createdAt', order = 'desc', status, county, featured, search }) {
  const filter = {};

  if (status) filter.status = status;
  if (county) filter.county = county;
  if (featured !== undefined) filter.featured = featured === 'true' || featured === true;
  if (search) filter.text = new RegExp(escapeRegex(search), 'i');

  const sortSpec = { [sort]: order === 'asc' ? 1 : -1 };
  const skip = (Math.max(1, page) - 1) * limit;

  const [data, total] = await Promise.all([
    CommunityPost.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName'),
    CommunityPost.countDocuments(filter),
  ]);

  return { data, total };
}

async function removePost(id, adminId, reason) {
  return CommunityPost.findByIdAndUpdate(
    id,
    {
      $set: {
        status: 'REMOVED',
        removedByAdmin: adminId,
        removedAt: new Date(),
        removalReason: reason,
      },
    },
    { new: true },
  );
}

async function restorePost(id) {
  return CommunityPost.findByIdAndUpdate(
    id,
    {
      $set: { status: 'VISIBLE', removedByAdmin: null, removedAt: null, removalReason: null },
    },
    { new: true },
  );
}

async function setFeatured(id, featured) {
  return CommunityPost.findByIdAndUpdate(id, { $set: { featured: !!featured } }, { new: true });
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { listPosts, removePost, restorePost, setFeatured };
