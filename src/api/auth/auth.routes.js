const express = require('express');
const router = express.Router();
const { validateUser } = require('./auth.controller');

router.post('/auth/validateUser', validateUser);

module.exports = router;
