const db = require('../../config/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const saltRounds = 10;
// Helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP to mobile number
const sendMobileOtp = async (req, res) => {
  const { mobileNumber } = req.body;

  if (!mobileNumber) {
    return res.status(400).json({ isSuccess: false, message: 'Mobile number is required' });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60000); // 5 mins from now

  try {
    // Store OTP in DB
    await db.query(
      `INSERT INTO otp_verification (user_id, type, otp, expires_at)
       VALUES ((SELECT id FROM users WHERE mobile_number = ? LIMIT 1), 'MOBILE', ?, ?)`,
      [mobileNumber, otp, expiresAt]
    );

    // Optionally send SMS here (placeholder)
    console.log(`OTP for ${mobileNumber}: ${otp}`);

    return res.status(200).json({ isSuccess: true, message: 'OTP sent to mobile' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};

const verifyMobileOtp = async (req, res) => {
  const { mobileNumber, otp } = req.body;

  if (!mobileNumber || !otp) {
    return res.status(400).json({ isSuccess: false, message: 'Mobile number and OTP are required' });
  }

  try {
    const [row] = await db.query(
      `SELECT ov.id, ov.otp, ov.expires_at, u.id as user_id, u.register_status
       FROM otp_verification ov
       LEFT JOIN users u ON u.mobile_number = ?
       WHERE ov.type = 'MOBILE' AND ov.otp = ? AND ov.is_verified = FALSE
       ORDER BY ov.created_at DESC LIMIT 1`,
      [mobileNumber, otp]
    );

    if (!row.length) {
      return res.status(400).json({ isSuccess: false, message: 'Invalid or expired OTP' });
    }

    const otpData = row[0];
    if (new Date() > new Date(otpData.expires_at)) {
      return res.status(400).json({ isSuccess: false, message: 'OTP expired' });
    }

    // Mark OTP as verified
    await db.query(`UPDATE otp_verification SET is_verified = TRUE WHERE id = ?`, [otpData.id]);

    let userId = otpData.user_id;
    let registerStatus = otpData.register_status;

    // Create user if not exists
    if (!userId) {
      const [insertResult] = await db.query(
        `INSERT INTO users (mobile_number, register_status) VALUES (?, 'STEP_1')`,
        [mobileNumber]
      );

      userId = insertResult.insertId;
      registerStatus = 'STEP_1';
    }

    return res.status(200).json({
      isSuccess: true,
      message: 'Mobile number verified',
      data: {
        userId,
        step: registerStatus
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};



const submitBasicDetails = async (req, res) => {
  const { mobileNumber, fullName, email, password } = req.body;

  if (!mobileNumber || !fullName || !email || !password) {
    return res.status(400).json({ isSuccess: false, message: 'All fields are required' });
  }

  try {
    const [existing] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing.length > 0) {
      return res.status(400).json({ isSuccess: false, message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await db.query(`
      UPDATE users
      SET full_name = ?, email = ?, password_hash = ?, register_status = 'STEP_2'
      WHERE mobile_number = ?
    `, [fullName, email, hashedPassword, mobileNumber]);

    // Generate and store email OTP
    const emailOtp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

    const [[user]] = await db.query(`SELECT id FROM users WHERE mobile_number = ?`, [mobileNumber]);

    await db.query(`
      INSERT INTO otp_verification (user_id, type, otp, expires_at)
      VALUES (?, 'EMAIL', ?, ?)
    `, [user.id, emailOtp, expiresAt]);

    // Placeholder for sending email
    console.log(`Email OTP for ${email}: ${emailOtp}`);

    return res.status(200).json({ isSuccess: true, message: 'Basic details saved and email OTP sent' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};

const verifyEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ isSuccess: false, message: 'Email and OTP are required' });
  }

  try {
    // Find user and OTP
    const [[user]] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(400).json({ isSuccess: false, message: 'User not found' });
    }

    const [otpRow] = await db.query(
      `SELECT * FROM otp_verification
       WHERE user_id = ? AND type = 'EMAIL' AND otp = ? AND is_verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, otp]
    );

    if (!otpRow.length) {
      return res.status(400).json({ isSuccess: false, message: 'Invalid or expired OTP' });
    }

    const otpData = otpRow[0];
    if (new Date() > new Date(otpData.expires_at)) {
      return res.status(400).json({ isSuccess: false, message: 'OTP expired' });
    }

    // Mark OTP verified and update user status
    await db.query(`UPDATE otp_verification SET is_verified = TRUE WHERE id = ?`, [otpData.id]);
    await db.query(`UPDATE users SET register_status = 'STEP_3' WHERE id = ?`, [user.id]);

    return res.status(200).json({ isSuccess: true, message: 'Email verified isSuccessfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


const set2FA = async (req, res) => {
  const { email, is2FAEnabled } = req.body;

  if (!email || typeof is2FAEnabled !== 'boolean') {
    return res.status(400).json({ isSuccess: false, message: 'Email and 2FA status are required' });
  }

  try {
    const [[user]] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(400).json({ isSuccess: false, message: 'User not found' });
    }

    await db.query(`
      UPDATE users
      SET is_2fa_enabled = ?, register_status = 'STEP_4'
      WHERE id = ?
    `, [is2FAEnabled, user.id]);

    return res.status(200).json({ isSuccess: true, message: '2FA preference saved' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


const setCountry = async (req, res) => {
  const { email, country } = req.body;

  if (!email || !country) {
    return res.status(400).json({ isSuccess: false, message: 'Email and country are required' });
  }

  try {
    const [[user]] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(400).json({ isSuccess: false, message: 'User not found' });
    }

    await db.query(`
      UPDATE users
      SET country = ?, register_status = 'STEP_5'
      WHERE id = ?
    `, [country, user.id]);

    return res.status(200).json({ isSuccess: true, message: 'Country saved isSuccessfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


const setAccountReason = async (req, res) => {
  const { email, reasonId } = req.body;

  if (!email || !reasonId) {
    return res.status(400).json({ isSuccess: false, message: 'Email and reasonId are required' });
  }

  try {
    const [[user]] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(400).json({ isSuccess: false, message: 'User not found' });
    }

    // Optional: Validate if reasonId exists in account_reasons table
    const [reason] = await db.query(`SELECT id FROM account_reasons WHERE id = ?`, [reasonId]);
    if (!reason.length) {
      return res.status(400).json({ isSuccess: false, message: 'Invalid account reason ID' });
    }

    await db.query(`
      UPDATE users
      SET account_opening_reason = ?, register_status = 'STEP_6'
      WHERE id = ?
    `, [reasonId, user.id]);

    return res.status(200).json({ isSuccess: true, message: 'Account reason saved isSuccessfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


const setProofOfResidency = async (req, res) => {
  const { email, proofId, documentPath } = req.body;

  if (!email || !proofId || !documentPath) {
    return res.status(400).json({ isSuccess: false, message: 'Email, proof ID, and document path are required' });
  }

  try {
    const [[user]] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(400).json({ isSuccess: false, message: 'User not found' });
    }

    // Optional: Validate if proofId exists in residency_proofs table
    const [proof] = await db.query(`SELECT id FROM proof_types WHERE id = ?`, [proofId]);
    if (!proof.length) {
      return res.status(400).json({ isSuccess: false, message: 'Invalid proof of residency ID' });
    }

    await db.query(`
      UPDATE users
      SET proof_of_residency_id = ?, proof_of_residency_document_path = ?, register_status = 'STEP_7'
      WHERE id = ?
    `, [proofId, documentPath, user.id]);

    return res.status(200).json({ isSuccess: true, message: 'Proof of residency saved isSuccessfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


const uploadProfilePhoto = async (req, res) => {
  const { email } = req.body;
  const filePath = req.file?.path;

  if (!email || !filePath) {
    return res.status(400).json({ isSuccess: false, message: 'Email and profile picture are required' });
  }

  try {
    const [[user]] = await db.query(`SELECT id FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(400).json({ isSuccess: false, message: 'User not found' });
    }

    await db.query(`
      UPDATE users
      SET profile_picture_path = ?, register_status = 'STEP_8'
      WHERE id = ?
    `, [filePath, user.id]);

    return res.status(200).json({ isSuccess: true, message: 'Profile photo uploaded isSuccessfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


const finalizeRegistration = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ isSuccess: false, message: 'Email is required' });
  }

  try {
    const [[user]] = await db.query(`SELECT id, register_status FROM users WHERE email = ?`, [email]);
    if (!user) {
      return res.status(404).json({ isSuccess: false, message: 'User not found' });
    }

    if (user.register_status !== 'STEP_8') {
      return res.status(400).json({ isSuccess: false, message: 'Registration is not yet complete' });
    }

    await db.query(`
      UPDATE users
      SET register_status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [user.id]);

    return res.status(200).json({ isSuccess: true, message: 'Account registration completed isSuccessfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};


module.exports = {
  sendMobileOtp,
  verifyMobileOtp,
  submitBasicDetails,
  verifyEmailOtp,
  set2FA,
  setCountry,
  setAccountReason,
  setProofOfResidency,
  uploadProfilePhoto,
  finalizeRegistration
};
