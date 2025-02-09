const express = require('express');
const router = express.Router();

// Import required dependencies
const path = require('path');
const { version } = require('../package.json');
const config = require('../config');

/**
 * Mock display API endpoint
 * Returns a random plugin display configuration
 */
router.get('/display', (req, res) => {
    // generate a random plugin id from the list of plugins
    const pluginId = PLUGINS[Math.floor(Math.random() * PLUGINS.length)];
    const layout = 'full';
    const hostname = req.hostname;

    res.json({
        status: 0,
        image_url: `http://${hostname}/display?plugin=${pluginId}&layout=${layout}`,
        filename: 'trmnl-display.bmp',
        update_firmware: false,
        firmware_url: 'https://trmnl.s3.us-east-2.amazonaws.com/path-to-firmware.bin',
        refresh_rate: '1800',
        reset_firmware: false
    });
});

/**
 * Version endpoint
 * Returns version and feature flags
 */
router.get('/version', (req, res) => {
    res.json({ 
        version,
        imageGenerationEnabled: config.ENABLE_IMAGE_GENERATION 
    });
});

module.exports = router; 