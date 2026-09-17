const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { adminAuth } = require('../middleware/adminAuth');


router.get('/counties', locationController.listCounties);
router.get('/counties/:countyCode/constituencies', locationController.listConstituencies);
router.get('/constituencies/:constituencyCode/wards', locationController.listWards);

router.post('/', adminAuth, locationController.create);
router.post('/bulk', adminAuth, locationController.bulkUpsert);


module.exports = router;