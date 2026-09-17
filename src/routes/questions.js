const express = require('express');
const router = express.Router();
const { getTodaysQuestions } = require('../controllers/questionController');

router.get('/today', getTodaysQuestions);

module.exports = router;
