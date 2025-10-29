const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.cookie('admin-session', 'placeholder', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 5 * 60 * 1000
  });

  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
