const express = require('express');
const router = express.Router();
const { getTodaysQuestions } = require('../controllers/questionController');
const { requireAnonAuth } = require('../middleware/auth');

router.get('/today', requireAnonAuth, getTodaysQuestions);

module.exports = router;
