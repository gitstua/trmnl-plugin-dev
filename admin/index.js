const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();
const path = require('path');
const config = require('../config');

// Add middleware to parse JSON bodies
router.use(express.json());

if (!config.ADMIN_MODE) {
    console.log('Admin mode is not enabled');
    module.exports = router;  // Export empty router if admin mode disabled
    return;
}

// Initialize and open the SQLite database (creates the file if it doesn't exist)
const db = new sqlite3.Database('./devices.db', (err) => {
    console.log('📀 Connecting to SQLite database at full path:', path.join(__dirname, '../devices.db'));
    if (err) {
        console.error('📀 Could not connect to SQLite database', err);
    } else {
        console.log('📀 Connected to SQLite database.');
    }

    console.log('📀 Database path:', db.filename);
});

// Create the devices table if it doesn't exist already.
db.run(
    `CREATE TABLE IF NOT EXISTS devices (
        mac TEXT PRIMARY KEY,
        api_key TEXT,
        description TEXT
    )`,
    (err) => {
        if (err) {
            console.error('Could not create table', err);
        } else {
            console.log('Table "devices" is ready.');
        }
    }
);

// GET /api/admin/devices
router.get('/devices', (req, res) => {
    db.all('SELECT * FROM devices', (err, rows) => {
        if (err) {
            console.error('Error retrieving devices', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json({ devices: rows });
    });
});

// POST /api/admin/devices
router.post('/devices', (req, res) => {
    const { mac, api_key, description } = req.body;
    
    if (!mac || !api_key || !description) {
        return res.status(400).json({ error: 'Missing required fields: mac, api_key, description' });
    }
    
    const stmt = `INSERT INTO devices (mac, api_key, description) VALUES (?, ?, ?)`;
    db.run(stmt, [mac, api_key, description], function(err) {
        if (err) {
            console.error('Error adding device', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.status(201).json({
            message: 'Device added successfully',
            device: { mac, api_key, description }
        });
    });
});

// PUT /api/admin/devices/:mac
router.put('/devices/:mac', (req, res) => {
    const { mac } = req.params;
    const { api_key, description } = req.body;
    
    if (!api_key || !description) {
        return res.status(400).json({ error: 'Missing required fields: api_key, description' });
    }
    
    const stmt = `UPDATE devices SET api_key = ?, description = ? WHERE mac = ?`;
    db.run(stmt, [api_key, description, mac], function(err) {
        if (err) {
            console.error('Error updating device', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({
            message: 'Device updated successfully',
            device: { mac, api_key, description }
        });
    });
});

// DELETE /api/admin/devices/:mac
router.delete('/devices/:mac', (req, res) => {
    const { mac } = req.params;
    const stmt = `DELETE FROM devices WHERE mac = ?`;
    db.run(stmt, [mac], function(err) {
        if (err) {
            console.error('Error deleting device', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Device not found' });
        }
        res.json({ message: 'Device deleted successfully' });
    });
});

// Admin UI route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Export the router
module.exports = router; 