const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/questions', require('./questions'));
router.use('/responses', require('./responses'));
router.use('/counties', require('./counties'));
router.use('/trends', require('./trends'));
router.use('/home', require('./home'));
router.use('/community', require('./community'));
router.use('/locations', require('./locations'));

module.exports = router;
