const express = require('express');
const router = express.Router();
const Role = require('../models/Role');

// POST /api/seed/roles  - seeds default roles (idempotent)
router.post('/roles', async (req, res) => {
  try {
    const roles = [
      'Reader/Student',
      'Librarian',
      'Content Manager',
      'Author',
      'System Administrator'
    ];

    // Upsert roles so this endpoint is safe to call multiple times
    const ops = roles.map(r => ({ updateOne: { filter: { role_name: r }, update: { $set: { role_name: r } }, upsert: true } }));
    await Role.bulkWrite(ops);

    const docs = await Role.find({ role_name: { $in: roles } }).sort('role_name');
    res.json({ insertedOrUpdated: docs.length, roles: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error seeding roles' });
  }
});

module.exports = router;
