const express = require('express');
const router = express.Router();

// Import required dependencies
const path = require('path');
const { version } = require('../package.json');
const config = require('../config');
const { getAvailablePlugins } = require('../config');

/**
 * Mock display API endpoint
 * Returns a random plugin display configuration
 */
router.get('/display', async (req, res) => {
    // generate a random plugin id from the list of plugins

    // call getAvailablePlugins
    const plugins = await getAvailablePlugins();
    const pluginId = plugins[Math.floor(Math.random() * plugins.length)].id;
    const layout = 'full';
    const hostname = req.hostname;

    const image_url = `http://${hostname}:${config.PORT}/display?plugin=${pluginId}&layout=${layout}`;

    res.json({
        status: 0,
        image_url: image_url,
        filename: 'trmnl-display.bmp',
        update_firmware: false,
        firmware_url: 'https://trmnl.s3.us-east-2.amazonaws.com/path-to-firmware.bin',
        refresh_rate: '30',
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

/**
 * Setup endpoint
 * Handles device setup requests and returns configuration
 */
router.get('/setup', (req, res) => {
    // Get MAC address from headers
    const deviceId = req.headers['id'];

    // Mock validation - consider XX:XX:XX:XX:XX as valid MAC address
    if (true || deviceId === 'XX:XX:XX:XX:XX') {
        res.json({
            status: 200,
            api_key: "8n--JkLmRtWxYzVqNpd3Q", //NOT A REAL API KEY
            friendly_id: "1A2B3C", 
            image_url: "https://usetrmnl.com/images/setup/setup-logo.bmp",
            filename: "empty_state"
        });
    } else {
        res.json({
            status: 404,
            api_key: null,
            friendly_id: null,
            image_url: null,
            filename: null
        });
    }
});


module.exports = router; 