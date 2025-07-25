const db = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const validateUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ isSuccess: false, message: 'Email and password are required' });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(404).json({ isSuccess: false, message: 'User not found' });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ isSuccess: false, message: 'User registered with third-party login' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ isSuccess: false, message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      isSuccess: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        registerStatus: user.register_status,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ isSuccess: false, message: 'Server error' });
  }
};

module.exports = { validateUser };
