// File: src/api/v1/register/register.routes.js
const express = require('express');
const router = express.Router();
const registerController = require('./register.controller');
const upload = require('../../middlewares/upload');

router.post('/register/sendMobileOtp', registerController.sendMobileOtp);
router.post('/register/verifyMobileOtp', registerController.verifyMobileOtp);
router.post('/register/basicDetails', registerController.submitBasicDetails);
router.post('/register/verifyEmailOtp', registerController.verifyEmailOtp);
router.post('/register/set2FA', registerController.set2FA);
router.post('/register/setCountry', registerController.setCountry);
router.post('/register/setAccountReason', registerController.setAccountReason);
router.post('/register/setProofOfResidency', registerController.setProofOfResidency);
router.post('/register/finalizeRegistration', registerController.finalizeRegistration);
router.post('/register/uploadProfilePhoto', upload.single('profilePicture'), registerController.uploadProfilePhoto);

module.exports = router;
