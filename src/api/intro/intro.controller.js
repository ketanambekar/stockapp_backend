const db = require('../../config/db');

const getIntroScreens = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, title, subtitle FROM intro_master');
    res.status(200).json({ isSuccess: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = { getIntroScreens };
