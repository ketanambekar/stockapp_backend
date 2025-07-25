const express = require('express');
const router = express.Router();
const { getIntroScreens } = require('../intro/intro.controller');

router.get('/intro_master', getIntroScreens);

module.exports = router;
