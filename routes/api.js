const express = require('express');
const router = express.Router();

// Import required dependencies
const path = require('path');
const { version } = require('../package.json');
const config = require('../config');
const { getAvailablePlugins } = require('../config');
const fs = require('fs').promises;
const JSZip = require('jszip');
const yaml = require('js-yaml');
const dotenv = require('dotenv');
const toml = require('toml');

/**
 * Mock display API endpoint
 * Returns a random plugin display configuration
 */
router.get('/display', async (req, res) => {
    // generate a random plugin id from the list of plugins
    console.log("Display request received");
    
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
        reset_firmware: false,
        special_function: 'sleep'
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
 * TODO: use the device id to get the device from the databasexs
 */
router.get('/setup', (req, res) => {
    // Get MAC address from headers
    const deviceId = req.headers['id'];

    console.log("Setup request received for device: ", deviceId);

    // Mock validation - consider XX:XX:XX:XX:XX as valid MAC address
    if (true || deviceId === 'XX:XX:XX:XX:XX') {
        res.json({
            status: 200,
            api_key: "8n--JkLmRtWxYzVqNpd3Q", //NOT A REAL API KEY
            friendly_id: "1A2B3C", 
            image_url: "https://usetrmnl.com/images/setup/setup-logo.bmp",
            filename: "empty_state",
            message: "Welcome to TRMNL BYOS by Stu"
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

// Define routes
router.get('/plugins', async (req, res) => {
    // ... route handler code ...
});

/**
 * Export endpoint
 * This endpoint will generate a zip file containing:
 *  - A settings.yml file generated from config.toml (with substitutions from .env)
 *  - All Liquid template files in the plugin's "views" directory
 *
 * The endpoint is available at:
 *   POST /api/plugins/:pluginId/export
 */
router.post('/plugins/:pluginId/export', async (req, res) => {
    try {
        const { pluginId } = req.params;
        // Determine the correct plugin path
        const pluginPath = pluginId === '.' ? config.PLUGINS_PATH : path.join(config.PLUGINS_PATH, pluginId);

        // Load .env file if it exists; otherwise, envConfig remains an empty object
        let envConfig = {};
        try {
            const envPath = path.join(pluginPath, '.env');
            envConfig = dotenv.parse(await fs.readFile(envPath));
        } catch (err) {
            console.warn(`No .env file found for plugin ${pluginId}`);
        }

        // Load the plugin configuration file (config.toml)
        const tomlPath = path.join(pluginPath, 'config.toml');
        const tomlConfig = toml.parse(await fs.readFile(tomlPath, 'utf-8'));

        // Build the settings object with substitutions from .env
        const settings = {
            strategy: tomlConfig.strategy || '',
            no_screen_padding: 'no',
            dark_mode: 'no',
            static_data: '',
            polling_verb: tomlConfig.polling_verb || 'get',
            polling_url: tomlConfig.url,
            polling_headers: '',
            name: tomlConfig.name || 'Plugin',
            refresh_interval: tomlConfig.refresh_interval || 720
        };

        console.log("Settings object:", settings);

        // Create a new JSZip instance
        const zip = new JSZip();
        
        // Add settings.yml to the zip by dumping the settings object to YAML format
        zip.file('settings.yml', yaml.dump(settings));
        
        // Get the views folder contents and add all .liquid files to the zip
        const viewsDir = path.join(pluginPath, 'views');
        const files = await fs.readdir(viewsDir);
        for (const file of files) {
            if (file.endsWith('.liquid')) {
                const content = await fs.readFile(path.join(viewsDir, file), 'utf-8');
                zip.file(`${file}`, content);
            }
        }

        // Generate the zip as a nodebuffer
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const epochTime = Date.now();
        const filename = `${pluginId}-plugin-${epochTime}.zip`;

        console.log(`Exported plugin ${pluginId} to ${filename}`);

        // Set headers to trigger a download, then send the zip content
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(zipBuffer);
    } catch (err) {
        console.error('Export failed:', err);
        res.status(500).json({ error: 'Export failed', details: err.message });
    }
});

// Export the router
module.exports = router; 