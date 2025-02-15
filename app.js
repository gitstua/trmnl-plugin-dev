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
    let layout = req.params.layout;
    const plugin = req.params.plugin;
    const { live } = req.query;
    
    try {
        // Get plugin ID and info
        const pluginId = plugin || (await config.isPluginDirectory(config.PLUGINS_PATH) ? '.' : null);
        if (!pluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin before loading preview'
            });
        }

        const pluginInfo = await config.getPluginInfo(pluginId);
        let data;

        // Load data based on strategy
        if (pluginInfo.trmnl.plugin_settings.strategy === 'static' || 
            pluginInfo.trmnl.plugin_settings.strategy === 'webhook') {
            data = JSON.parse(await fs.readFile(config.getSamplePath(pluginId), 'utf8'));
        } else if (live === 'true') {
            try {
                // Get live data configuration
                const { publicUrl, headers } = await config.getLiveData(pluginId, pluginInfo, globalDeviceData);
                
                // Fetch and process data
                data = await fetchLiveData(publicUrl, headers);
                if (Array.isArray(data)) {
                    data = { data };
                }

                // Save to tmp directory
                const pluginPath = config.getPluginPath(pluginId);
                const tmpDir = path.join(pluginPath, 'tmp');
                await fs.mkdir(tmpDir, { recursive: true });
                await fs.writeFile(
                    path.join(tmpDir, 'data.json'), 
                    JSON.stringify(data, null, 2)
                );
            } catch (error) {
                if (error.error === 'Authentication Required') {
                    return res.status(400).json(error);
                }
                throw error;
            }
        } else {
            data = JSON.parse(await fs.readFile(config.getSamplePath(pluginId), 'utf8'));
        }

        // Merge data with plugin settings
        data = {
            ...data,
            trmnl: {
                ...pluginInfo.trmnl,
                ...globalDeviceData
            }
        };

        // Render template
        const viewPath = pluginId === '.' 
            ? path.join('views', `${layout}.liquid`)
            : path.join(pluginId, 'views', `${layout}.liquid`);
            
        const templateContent = await engine.renderFile(viewPath, data);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
                <script src="https://usetrmnl.com/js/latest/plugins.js"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;350;375;400;450;600;700&display=swap" rel="stylesheet">
            </head>
            <body class="environment trmnl">
                <div class="screen">
                    <div class="view view--${layout}">
                        ${templateContent}
                    </div>
                </div>
            </body>
            </html>
        `);
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

        const pluginPath = config.getPluginPath(effectivePluginId);
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
        const pluginId = req.params.pluginId || (await config.isPluginDirectory(config.PLUGINS_PATH) ? '.' : null);
        
        if (!pluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin to view its configuration'
            });
        }

        // Get the raw TOML content instead of the parsed object
        const configPath = config.getPluginPath(pluginId);
        const rawToml = await fs.readFile(path.join(configPath, 'config.toml'), 'utf8');
        res.type('text/plain').send(rawToml);
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
        exec(`${config.IMAGE_MAGICK_BIN} --version`, (err, stdout, stderr) => {
            console.log('ImageMagick version:', stdout);
        });

        console.log('🎨🎨🎨 ImageMagick switches:', config.IMAGE_MAGICK_SWICTHES);

        // Convert to BMP using ImageMagick - thanks to https://github.com/schrockwell/
        await new Promise((resolve, reject) => {
            exec(`${config.IMAGE_MAGICK_BIN} ${tempPng} ${config.IMAGE_MAGICK_SWICTHES} ${tempBmp}`, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        //add 2 more output files to the tmp directory
        //1 = -dither FloydSteinberg -monochrome -depth 1 -strip -define bmp:format=bmp3
        // 2 = -dither FloydSteinberg -monochrome -depth 1 -strip -compress RLE -define bmp:format=bmp3


        //examine the BMP file using magick identify -verbose output.bmp
        // REQUIRES IMAGE MAGICK 7+
        //exec(`magick identify -verbose ${tempBmp}`, (err, stdout, stderr) => {
        //    console.log('BMP file information:', stdout);
        //});
        
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