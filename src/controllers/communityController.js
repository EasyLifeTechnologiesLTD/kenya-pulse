const CommunityPost = require("../models/CommunityPost");
const { asyncHandler } = require("../utils/asyncHandler");

// GET /api/community?scope=all|county|following&county=Kisumu&page=1
// Powers the "All / My County / Following" tabs on Community Insights.
const getCommunityFeed = asyncHandler(async (req, res) => {
  const { scope = "all", county, page = 1, limit = 20 } = req.query;

  const filter = { moderationStatus: "approved" };

  if (scope === "county") {
    if (!county) {
      return res
        .status(400)
        .json({ message: "county is required for scope=county" });
    }
    filter.county = county;
  }
  // 'following' scope would filter by counties the user follows - left as a
  // hook for when user "follow county" preferences are added to the User model.

  const posts = await CommunityPost.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select("-agreedBy");

  const total = await CommunityPost.countDocuments(filter);

  res.json({
    posts,
    page: Number(page),
    totalPages: Math.ceil(total / limit),
    total,
  });
});

// POST /api/community
// "Share an Insight" button.
const createCommunityPost = asyncHandler(async (req, res) => {
  const { text, category, county, subLocation } = req.body;
  const user = req.user;

  const post = await CommunityPost.create({
    anonId: user.anonId,
    text,
    category,
    county: county || user.county,
    subLocation,
  });

  res.status(201).json(post);
});

// POST /api/community/:id/agree
// The heart / "X citizens agree" interaction.
const agreeToPost = asyncHandler(async (req, res) => {
  const post = await CommunityPost.findById(req.params.id);
  const user = req.user;

  if (!post) {
    return res.status(404).json({ message: "Post not found" });
  }

  if (post.agreedBy.includes(user.anonId)) {
    return res
      .status(409)
      .json({ message: "You already agreed to this insight." });
  }

  post.agreedBy.push(user.anonId);
  post.agreeCount += 1;
  await post.save();

  res.json({ agreeCount: post.agreeCount });
});

const list = async () => {
  // TODO: implement/delete
};
const remove = async () => {
  // TODO: implement/delete
};
const restore = async () => {
  // TODO: implement/delete
};
const feature = async () => {
  // TODO: implement/delete
};

module.exports = {
  getCommunityFeed,
  createCommunityPost,
  agreeToPost,
  list,
  remove,
  restore,
  feature,
};
