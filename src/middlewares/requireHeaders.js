const requiredHeaders = ['app-version', 'build-number', 'platform'];

const requireHeaders = (req, res, next) => {
  const missing = requiredHeaders.filter(header => !req.headers[header]);

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required headers: ${missing.join(', ')}`
    });
  }

  next();
};

module.exports = requireHeaders;
