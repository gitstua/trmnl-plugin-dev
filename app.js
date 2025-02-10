// Copyright (c) 2025 Stu Eggerton. All rights reserved.
// See LICENSE.md for license details.

const express = require('express');
const { Liquid } = require('liquidjs');
const fs = require('fs').promises;
exports.fs = fs;
const fsSync = require('fs');  // Add this for sync operations
const path = require('path');
const fetch = require('node-fetch');
const config = require('./config');
const toml = require('toml');
const downloadAssets = require('./download-assets');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const puppeteer = require('puppeteer');
require('dotenv').config();
const { version } = require('./package.json');
const apiRoutes = require('./routes/api');
const { getAvailablePlugins } = require('./config');
const adminRouter = require('./admin');
const { authMiddleware } = require('./middleware/auth');


const app = express();

// All configuration values are now imported via config.js
let requestCount = 0;
let lastResetTime = Date.now();

// Create required directories synchronously at startup
//if (!fsSync.existsSync(config.CACHE_PATH)) {
//    fsSync.mkdirSync(config.CACHE_PATH, { recursive: true });
//}
//if (!fsSync.existsSync(config.FONTS_PATH)) {
//    fsSync.mkdirSync(config.FONTS_PATH, { recursive: true });
//}

// Add near the top with other global constants
let globalDeviceData = {};

// Function to initialize the liquid engine synchronously
function setupLiquidEngine() {
    try {
        // Synchronously check for config.toml in the plugins directory
        fsSync.accessSync(path.join(config.PLUGINS_PATH, 'config.toml'));
        // Single plugin mode
        return new Liquid({
            root: config.PLUGINS_PATH,
            extname: '.liquid',
            lookupRoot: config.PLUGINS_PATH
        });
    } catch {
        // Multi-plugin mode
        return new Liquid({
            root: config.PLUGINS_PATH,
            extname: '.liquid',
            lookupRoot: config.PLUGINS_PATH
        });
    }
}

// Initialize engine synchronously
const engine = setupLiquidEngine();

app.engine('html', engine.express());
app.set('view engine', 'html');

// Set the views directory to the root directory
app.set('views', config.PLUGINS_PATH);  // Change this to use PLUGINS_PATH

// Serve static files
app.use(express.static('public', {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Serve cached CDN files
app.use('/fonts', express.static(path.join(config.CACHE_PATH, 'fonts'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));
app.use('/images', express.static(path.join(config.CACHE_PATH, 'images'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

const CDN_BASE = 'https://usetrmnl.com';

// Serve static files based on USE_CACHE setting
if (config.USE_CACHE === 'true') {
    // Serve from cache
    app.use('/css/latest', express.static(path.join(config.CACHE_PATH, 'css/latest')));
    app.use('/js/latest', express.static(path.join(config.CACHE_PATH, 'js/latest')));
    app.use('/fonts', express.static(path.join(config.CACHE_PATH, 'fonts')));
    app.use('/images', express.static(path.join(config.CACHE_PATH, 'images')));
} else {
    // Proxy to CDN - maintain exact same paths
    app.use(['/css/latest', '/js/latest', '/fonts', '/images'], async (req, res) => {
        try {
            const response = await fetch(`${CDN_BASE}${req.originalUrl}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.buffer();
            res.type(response.headers.get('content-type'));
            res.send(data);
        } catch (error) {
            console.error('Proxy error:', error);
            res.status(500).send('Error proxying to CDN');
        }
    });
}


// Add this new endpoint
app.get('/api/plugins', async (req, res) => {
    const plugins = await getAvailablePlugins();
    res.json(plugins);
});

// Update the root route to handle rendering all plugins
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simplify rate limit check to track all requests
function checkRateLimit() {
    const now = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    
    // Reset counter if 5 minutes have passed
    if (now - lastResetTime > fiveMinutesMs) {
        requestCount = 0;
        lastResetTime = now;
    }
    
    // Increment and check
    requestCount++;
    return requestCount <= config.MAX_REQUESTS_PER_5_MIN;
}

// Update the fetchLiveData function
async function fetchLiveData(url, headers) {
    let parsedHeaders = {};
    try {
        // Check global rate limit before making request
        if (!checkRateLimit()) {
            const error = new Error('Too Many Requests');
            error.status = 429;
            error.retryAfter = Math.ceil((lastResetTime + 5 * 60 * 1000 - Date.now()) / 1000);
            throw error;
        }

        if (headers) {
            try {
                parsedHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers;
            } catch (error) {
                console.error('Error parsing headers:', error);
            }
        }

        const response = await fetch(url, { headers: parsedHeaders });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        if (!text.trim()) {
            return {};
        }
        return JSON.parse(text);
    } catch (error) {
        console.error(`Error fetching live data from ${url}:`, error);
        if (error.status === 429) {
            throw {
                status: 429,
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: error.retryAfter
            };
        }
        throw error;
    }
}

// Add after the other startup initialization code
async function initializeDeviceData() {
    try {
        globalDeviceData = JSON.parse(
            await fs.readFile(path.join(process.cwd(), 'device.json'), 'utf8')
        );
    } catch (err) {
        console.warn('Warning: No device.json found, using empty device data');
    }
}

// Update the preview route to handle both single and multi-plugin modes
app.get(['/preview/:layout', '/preview/:plugin/:layout'], async (req, res) => {
    // Extract layout and plugin parameters correctly
    let layout, plugin;
    
    if (req.params.plugin && req.params.layout) {
        // Route: /preview/:plugin/:layout
        plugin = req.params.plugin;
        layout = req.params.layout;
    } else {
        // Route: /preview/:layout
        layout = req.params.layout;
        plugin = undefined;
    }

    const { live } = req.query;
    
    try {
        // If no plugin specified and in single plugin mode, use '.'
        const pluginId = plugin || (await config.isPluginDirectory(config.PLUGINS_PATH) ? '.' : null);
        
        if (!pluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin before loading preview'
            });
        }

        let data;
        let pluginInfo;

        // Read and parse the plugin config first
        const pluginPath = pluginId === '.' ? config.PLUGINS_PATH : path.join(config.PLUGINS_PATH, pluginId);
        const configContent = await fs.readFile(path.join(pluginPath, 'config.toml'), 'utf8');
        const rawPluginInfo = toml.parse(configContent);

        // Structure the plugin info
        pluginInfo = {
            trmnl: {
                plugin_settings: {
                    ...rawPluginInfo
                }
            }
        };

        // Check if strategy is static or webhook - always load from sample.json
        if (pluginInfo.trmnl.plugin_settings.strategy === 'static' || 
            pluginInfo.trmnl.plugin_settings.strategy === 'webhook') {
            // Always load from sample.json for static and webhook strategies
            const samplePath = pluginId === '.' 
                ? path.join(config.PLUGINS_PATH, 'sample.json')
                : path.join(config.PLUGINS_PATH, pluginId, 'sample.json');
                
            data = JSON.parse(
                await fs.readFile(samplePath, 'utf8')
            );
        } else if (live === 'true') {
            // Handle live data fetching for polling strategy only
            let publicUrl = pluginInfo.trmnl.plugin_settings.url;

            // Check if plugin requires auth headers but no .env file exists
            if (pluginInfo.trmnl.plugin_settings.requires_auth_headers === true) {
                try {
                    await fs.access(path.join(pluginPath, '.env'));
                } catch (err) {
                    return res.status(400).json({
                        error: 'Authentication Required',
                        message: 'This plugin requires authentication headers. Please create a .env file with the required credentials.',
                        pluginName: pluginInfo.trmnl.plugin_settings.name
                    });
                }
            }

            // Read the .env file for the plugin
            let envVars = {};
            try {
                const pluginPath = pluginId === '.' ? config.PLUGINS_PATH : path.join(config.PLUGINS_PATH, pluginId);
                console.log('Reading .env file for plugin', plugin);
                console.log('Plugin path', pluginPath);
                const env = await fs.readFile(path.join(pluginPath, '.env'), 'utf8');
                envVars = env.split('\n').reduce((acc, line) => {
                    if (!line.trim() || line.startsWith('#')) return acc;
                    const [key, value] = line.split('=');
                    if (key && value) {
                        // Store env vars in both original and uppercase for case-insensitive matching
                        const trimmedKey = key.trim();
                        const trimmedValue = value.trim();
                        acc[trimmedKey] = trimmedValue;
                        acc[trimmedKey.toUpperCase()] = trimmedValue;
                    }
                    return acc;
                }, {});
            } catch (err) {
                console.warn(`Warning: No .env file found for plugin ${plugin}`);
            }

            // Replace any {placeholder} in the URL with environment variables first
            Object.entries(envVars).forEach(([key, value]) => {
                const placeholder = `{${key}}`;
                if (publicUrl.includes(placeholder)) {
                    publicUrl = publicUrl.replace(placeholder, value);
                }
            });

            // Function to get nested value from an object using dot notation
            const getNestedValue = (obj, path) => {
                return path.split('.').reduce((current, key) => {
                    return current && current[key];
                }, obj);
            };

            // Replace tokens with fully qualified paths
            const tokenRegex = /{([^}]+)}/g;
            publicUrl = publicUrl.replace(tokenRegex, (match, path) => {
                // Check env vars first (already done above, this handles any remaining tokens)
                if (envVars[path]) return envVars[path];
                
                // Try to get value from plugin settings or device data
                const data = {
                    trmnl: {
                        plugin_settings: {
                            ...rawPluginInfo,
                            custom_fields_values: rawPluginInfo.custom_fields_values || {}
                        },
                        ...globalDeviceData
                    }
                };

                const value = getNestedValue(data, path);
                return value !== undefined ? value : match; // Keep original token if path not found
            });

            // Add any additional query parameters
            if (envVars.additional_query_string_params) {
                publicUrl += `&${envVars.additional_query_string_params}`;
            }

            // Combine polling headers from config with any headers from .env
            let headers = { ...pluginInfo.trmnl.plugin_settings.polling_headers };
            
            // Replace any {placeholder} in header values
            Object.entries(headers).forEach(([headerKey, headerValue]) => {
                if (typeof headerValue === 'string' && headerValue.startsWith('{') && headerValue.endsWith('}')) {
                    const envKey = headerValue.slice(1, -1); // Remove { }
                    headers[headerKey] = envVars[envKey] || envVars[envKey.toUpperCase()] || headerValue;
                }
            });

            // Add any additional headers from .env
            if (envVars.HEADERS) {
                headers = { ...headers, ...JSON.parse(envVars.HEADERS) };
            }

            // Fetch live data using the polling URL
            data = await fetchLiveData(publicUrl, headers);
            
            // if live data is an array with no root key, add a root key called "data"
            if (Array.isArray(data) && data.length > 0) {
                data = { data: data };
            }

            // Determine the plugin path
            const pluginPath = pluginId === '.' 
                ? config.PLUGINS_PATH 
                : path.join(config.PLUGINS_PATH, pluginId);
            
            // Define the temporary directory and file path
            const tmpDir = path.join(pluginPath, 'tmp');
            const dataFile = path.join(tmpDir, 'data.json');
            
            // Create the tmp directory if it doesn't exist
            await fs.mkdir(tmpDir, { recursive: true });
            
            // Write the fetched live data to data.json in the tmp folder
            await fs.writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8');
        } else {
            // Load from sample.json for preview
            const samplePath = pluginId === '.' 
                ? path.join(config.PLUGINS_PATH, 'sample.json')
                : path.join(config.PLUGINS_PATH, pluginId, 'sample.json');
                
            data = JSON.parse(
                await fs.readFile(samplePath, 'utf8')
            );
        }

        // Merge the plugin settings with the data
        data = {
            ...data,
            trmnl: {
                ...pluginInfo.trmnl,
                ...globalDeviceData
            }
        };

        // Update the view path to use pluginPath
        const viewPath = pluginId === '.' 
            ? path.join('views', `${layout}.liquid`)
            : path.join(pluginId, 'views', `${layout}.liquid`);
            
        const templateContent = await engine.renderFile(viewPath, data);
        
        const fontFaces = `
            @font-face {
                font-family: 'NicoClean';
                src: url('${config.FONTS_PATH}/NicoClean-Regular.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: 'NicoBold';
                src: url('${config.FONTS_PATH}/NicoBold-Regular.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: 'NicoPups';
                src: url('${config.FONTS_PATH}/NicoPups-Regular.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: 'BlockKie';
                src: url('${config.FONTS_PATH}/BlockKie.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            /* Include Inter font */
            @import url('${config.FONTS_PATH}/inter.css');
        `;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>${fontFaces}</style>
                <link rel="stylesheet" href="${config.CDN_PATH}/css/latest/plugins.css">
                <link rel="stylesheet" href="/custom.css">
            </head>
            <body class="trmnl view-only" style="padding:0;margin:0;background:white;">
                ${templateContent}
                <script src="${config.CDN_PATH}/js/latest/plugins.js"></script>
                <script>
                    window.addEventListener('load', function() {
                        if (typeof terminalize === 'function') {
                            terminalize();
                        }
                    });
                </script>
            </body>
            </html>
        `;
        res.send(htmlContent);
    } catch (error) {
        console.error('Error:', error);
        if (error.status === 429) {
            res.status(429)
                .set('Retry-After', error.retryAfter)
                .json({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: error.retryAfter
                });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Update the layout endpoint
app.get(['/api/layout/:layout', '/api/layout/:pluginId/:layout'], async (req, res) => {
    try {
        let layoutName, pluginId;
        
        if (req.params.pluginId && req.params.layout) {
            // Route: /api/layout/:pluginId/:layout
            pluginId = req.params.pluginId;
            layoutName = req.params.layout;
        } else {
            // Route: /api/layout/:layout
            layoutName = req.params.layout;
            pluginId = undefined;
        }

        layoutName = layoutName.replace('.html', '').replace('-', '_');
        
        // If no plugin specified and in single plugin mode, use '.'
        const effectivePluginId = pluginId || (await config.isPluginDirectory(config.PLUGINS_PATH) ? '.' : null);
        
        if (!effectivePluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin before loading layout'
            });
        }

        const pluginPath = effectivePluginId === '.' ? config.PLUGINS_PATH : path.join(config.PLUGINS_PATH, effectivePluginId);
        const layoutContent = await fs.readFile(
            path.join(pluginPath, 'views', `${layoutName}.liquid`),
            'utf8'
        );
        res.send(layoutContent);
    } catch (error) {
        console.error('Error reading layout template:', error);
        res.status(404).json({ error: 'Layout template not found' });
    }
});

// Update the endpoint to serve the raw config.toml content
app.get(['/api/plugin-toml', '/api/plugin-toml/:pluginId'], async (req, res) => {
    try {
        // If no pluginId provided, check if we're in single plugin mode
        const pluginId = req.params.pluginId || (await config.isPluginDirectory(config.PLUGINS_PATH) ? '.' : null);
        
        if (!pluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin to view its configuration'
            });
        }

        const configPath = pluginId === '.' 
            ? path.join(config.PLUGINS_PATH, 'config.toml')
            : path.join(config.PLUGINS_PATH, pluginId, 'config.toml');
            
        const configContent = await fs.readFile(configPath, 'utf8');
        // Send the raw TOML content with text/plain content type
        res.type('text/plain').send(configContent);
    } catch (error) {
        console.error(`Error reading config.toml for plugin ${req.params.pluginId || 'unknown'}:`, error);
        res.status(404).json({ error: 'Plugin configuration not found' });
    }
});

// Update the debug endpoint to be more secure
app.get('/debug', async (req, res) => {
    // Only allow debug endpoint in development
    if (config.DEBUG_MODE !== 'true') {
        return res.status(403).json({
            error: 'Debug endpoint disabled',
            message: 'Debug endpoint is only available in development mode with DEBUG_MODE=true'
        });
    }

    try {
        const debug = {
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                CACHE_PATH: process.env.CACHE_PATH,
                PLUGINS_PATH: process.env.PLUGINS_PATH,
                DEBUG_MODE: process.env.DEBUG_MODE,
                NODE_ENV: process.env.NODE_ENV,
                // Add other relevant env vars but exclude sensitive ones
            },
            docker: {
                isDocker: false,
                mounts: []
            },
            filesystem: {
                cache: {},
                app: {}
            }
        };

        // Check if running in Docker
        try {
            await fs.access('/.dockerenv');
            debug.docker.isDocker = true;
            
            // Get Docker mounts
            const { stdout: dfOutput } = await exec('df -h');
            debug.docker.mounts = dfOutput
                .split('\n')
                .filter(line => line.includes('/data/cache'))
                .map(line => {
                    const parts = line.split(/\s+/);
                    return {
                        filesystem: parts[0],
                        size: parts[1],
                        used: parts[2],
                        available: parts[3],
                        mountpoint: parts[5]
                    };
                });
        } catch (e) {
            // Not running in Docker
        }

        // Function to get directory structure with file sizes
        async function getDirectoryStructure(dir) {
            const structure = {};
            try {
                const items = await fs.readdir(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stats = await fs.stat(fullPath);
                    if (stats.isDirectory()) {
                        structure[item] = await getDirectoryStructure(fullPath);
                    } else {
                        structure[item] = {
                            size: stats.size,
                            sizeHuman: `${(stats.size / 1024).toFixed(2)} KB`,
                            modified: stats.mtime
                        };
                    }
                }
            } catch (error) {
                structure['error'] = error.message;
            }
            return structure;
        }

        // Get file system structure
        debug.filesystem.cache = await getDirectoryStructure(config.CACHE_PATH);
        debug.filesystem.app = await getDirectoryStructure(process.cwd());

        res.json(debug);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to get debug information',
            details: error.message
        });
    }
});

// Add helper function for delay
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Add display endpoint with feature flag check
const handleDisplay = async (req, res) => {
    if (!config.ENABLE_IMAGE_GENERATION) {
        return res.status(403).json({
            error: 'Image generation disabled',
            message: 'Image generation is disabled in this environment'
        });
    }
    try {
        const engine = req.query.engine || 'puppeteer';
        const pluginId = req.query.plugin;
        const layout = req.query.layout || 'full';
        
        if (!pluginId) {
            return res.status(400).send('Plugin ID is required');
        }

        // Determine plugin path and create tmp directory using the helper function
        const pluginPath = config.getPluginPath(pluginId);
        const pluginTmpDir = path.join(pluginPath, 'tmp');
        const pluginPreviewDir = path.join(pluginPath, 'Preview');
        
        // Create plugin's tmp and preview directory if it doesn't exist
        await fs.mkdir(pluginTmpDir, { recursive: true });
        await fs.mkdir(pluginPreviewDir, { recursive: true });

        const pluginUrl = `http://localhost:${config.PORT}/preview/${pluginId}/${layout}`;
        let screenshotBuffer;

        try {
            const browser = await puppeteer.launch(config.BROWSER_LAUNCH_CONFIG.puppeteer);
            const page = await browser.newPage();
            await page.goto(pluginUrl, { waitUntil: 'networkidle0' });
            await page.setViewport({ width: config.DISPLAY.width, height: config.DISPLAY.height });
            
            // Write out the version number of puppeteer
            console.log('Puppeteer version:', require('puppeteer/package.json').version);

            // Wait for the configured screenshot delay
            await delay(config.DISPLAY.delay);
            
            screenshotBuffer = await page.screenshot();
            await browser.close();
        } catch (error) {
            console.error('Puppeteer error:', error);
            if (config.DEBUG_MODE === 'true') {
                throw error;
            }
            throw new Error('Failed to launch Puppeteer browser. See logs for more details.');
        }

        // Use plugin's tmp directory for temporary files
        const tempPng = path.join(pluginPreviewDir, `${layout}.png`);
        const tempBmp = path.join(pluginTmpDir, `${layout}.bmp`);

        // Save screenshot to temp file
        await fs.writeFile(tempPng, screenshotBuffer);
        
        //Output the version number of ImageMagick
        console.log('🎨🎨🎨 ImageMagick wrapper version:', require('imagemagick/package.json').version);
        
        //Output the version number of ImageMagick using convert --version
        exec('convert --version', (err, stdout, stderr) => {
            console.log('ImageMagick version:', stdout);
        });

        console.log('🎨🎨🎨 ImageMagick switches:', config.IMAGE_MAGICK_SWICTHES);

        // Convert to BMP using ImageMagick - thanks to https://github.com/schrockwell/
        await new Promise((resolve, reject) => {
            exec(`convert ${tempPng} ${config.IMAGE_MAGICK_SWICTHES} ${tempBmp}`, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        
        // Read the BMP file
        const bmpBuffer = await fs.readFile(tempBmp);
        
        
        res.setHeader('Content-Type', 'image/bmp');
        // Update Content-Disposition to include both plugin ID and layout
        const downloadFilename = `${pluginId === '.' ? 'plugin' : pluginId}-${layout}.bmp`;
        res.setHeader('Content-Disposition', `attachment; filename=${downloadFilename}`);
        res.send(bmpBuffer);

        // Leaving the ImageMagick temporary BMP file intact in the tmp directory.
        
    } catch (error) {
        console.error('Error generating display:', error);
        res.status(500).send('Error generating display: ' + error.message);
    }
};

// Mount API routes
app.use('/api', authMiddleware, apiRoutes);

// Mount the admin routes
app.use('/admin', authMiddleware, adminRouter);

// Keep existing display endpoint for BMP generation
app.get('/display', handleDisplay);

async function startServer() {
    try {
        console.log('🚦 Rate limit set to:', config.MAX_REQUESTS_PER_5_MIN, 'requests per 5 minutes');
        
        // Add plugin mode detection and logging
        const isSinglePluginMode = await config.isPluginDirectory(config.PLUGINS_PATH);
        if (isSinglePluginMode) {
            console.log('🔌 Running in single plugin mode since config.toml file was found in the folder');
            console.log(`📂 Plugin folder: ${path.basename(config.PLUGINS_PATH)}`);
        } else {
            console.log('🔌 Running in multi-plugin mode since no config.toml file was found in the folder');
            console.log(`📂 Plugins directory: ${config.PLUGINS_PATH}`);
        }
        console.log('💾 Cache directory set to:', config.CACHE_PATH);

        await downloadAssets();
        await initializeDeviceData();
        
        app.listen(config.PORT, () => {
            console.log(`Test app running at http://localhost:${config.PORT}`);
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 