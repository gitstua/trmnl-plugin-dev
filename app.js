// Copyright (c) 2025 Stu Eggerton. All rights reserved.
// See LICENSE.md for license details.

const express = require('express');
const { Liquid } = require('liquidjs');
const fs = require('fs').promises;
const fsSync = require('fs');  // Add this for sync operations
const path = require('path');
const fetch = require('node-fetch');
const config = require('./config.json');
const toml = require('toml');
const downloadAssets = require('./download-assets');

const app = express();
const port = 3000;

// Add near the top of the file
const PLUGINS_PATH = process.env.PLUGINS_PATH || process.cwd();

// Function to initialize the liquid engine synchronously
function setupLiquidEngine() {
    try {
        // Synchronously check for config.toml
        fsSync.accessSync(path.join(PLUGINS_PATH, 'config.toml'));
        // Single plugin mode
        return new Liquid({
            root: PLUGINS_PATH,
            extname: '.liquid',
            lookupRoot: PLUGINS_PATH  // Add this to ensure proper template lookup
        });
    } catch {
        // Multi-plugin mode
        return new Liquid({
            root: PLUGINS_PATH,  // Change this to PLUGINS_PATH
            extname: '.liquid',
            lookupRoot: PLUGINS_PATH  // Add this to ensure proper template lookup
        });
    }
}

// Initialize engine synchronously
const engine = setupLiquidEngine();

app.engine('html', engine.express());
app.set('view engine', 'html');

// Set the views directory to the root directory
app.set('views', PLUGINS_PATH);  // Change this to use PLUGINS_PATH

// Serve static files
app.use(express.static('public'));
app.use('/design-system', express.static('design-system'));
app.use('/fonts', express.static('design-system/fonts'));  // Serve fonts at /fonts
app.use('/images', express.static(path.join(__dirname, config.designSystem.imagesPath)));

// Load sample data
async function loadSampleData() {
    const eplFixtures = JSON.parse(await fs.readFile('./epl-fixtures/sample.json', 'utf8'));
    const eplMyTeam = JSON.parse(await fs.readFile('./epl-my-team/sample.json', 'utf8'));
    return { eplFixtures, eplMyTeam };
}

// Helper function to check if a directory is a plugin directory
async function isPluginDirectory(dirPath) {
    try {
        await fs.access(path.join(dirPath, 'config.toml'));
        return true;
    } catch {
        return false;
    }
}

// Update the getAvailablePlugins function
async function getAvailablePlugins() {
    // First check if PLUGINS_PATH itself is a plugin directory
    if (await isPluginDirectory(PLUGINS_PATH)) {
        // Single plugin mode
        const pluginName = path.basename(PLUGINS_PATH);
        try {
            const configContent = await fs.readFile(path.join(PLUGINS_PATH, 'config.toml'), 'utf8');
            const pluginInfo = toml.parse(configContent);
            return [{
                id: '.',  // Use '.' to indicate current directory
                name: pluginInfo.name || pluginName,
                public_url: pluginInfo.url
            }];
        } catch (error) {
            console.warn(`Warning: Error reading config.toml in ${PLUGINS_PATH}`);
            return [];
        }
    }

    // Multiple plugins mode
    const dirs = (await fs.readdir(PLUGINS_PATH, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => 
            !['node_modules', 'public', 'design-system', 'scripts'].includes(name) && 
            !name.startsWith('.')
        );

    // Add the "All" option as the first plugin only if we have multiple plugins
    const plugins = dirs.length > 1 ? [{
        id: 'all',
        name: 'All Plugins'
    }] : [];

    // Get plugin info for each directory
    const pluginInfos = await Promise.all(
        dirs.map(async (dir) => {
            if (await isPluginDirectory(path.join(PLUGINS_PATH, dir))) {
                try {
                    const configContent = await fs.readFile(path.join(PLUGINS_PATH, dir, 'config.toml'), 'utf8');
                    const pluginInfo = toml.parse(configContent);
                    return {
                        id: dir,
                        name: pluginInfo.name || dir,
                        public_url: pluginInfo.url
                    };
                } catch (error) {
                    console.warn(`Warning: Error reading config.toml in ${dir}`);
                    return null;
                }
            }
            return null;
        })
    );

    // Add the valid plugins after the "All" option
    plugins.push(...pluginInfos.filter(plugin => plugin !== null));
    return plugins;
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

// Simplify the fetchLiveData function
async function fetchLiveData(url, headers) {
    let parsedHeaders = {};
    try {
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
        return await response.json();
    } catch (error) {
        console.error(`Error fetching live data from ${url}:`, error);
        console.error('Headers:', parsedHeaders);
        throw error;
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
        const pluginId = plugin || (await isPluginDirectory(PLUGINS_PATH) ? '.' : null);
        
        if (!pluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin before loading preview'
            });
        }

        let data;
        if (live === 'true') {
            // Handle '.' plugin ID for single plugin mode
            const pluginPath = pluginId === '.' ? PLUGINS_PATH : path.join(PLUGINS_PATH, pluginId);
            const configContent = await fs.readFile(path.join(pluginPath, 'config.toml'), 'utf8');
            const pluginInfo = toml.parse(configContent);

            // Check if plugin requires auth headers but no .env file exists
            if (pluginInfo.requires_auth_headers === true) {
                try {
                    await fs.access(path.join(pluginPath, '.env'));
                } catch (err) {
                    return res.status(400).json({
                        error: 'Authentication Required',
                        message: 'This plugin requires authentication headers. Please create a .env file with the required credentials.',
                        pluginName: pluginInfo.name
                    });
                }
            }

            let envVars = {};
            try {
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

            // Replace any {placeholder} in the URL with environment variables
            let publicUrl = pluginInfo.url;
            Object.entries(envVars).forEach(([key, value]) => {
                const placeholder = `{${key}}`;
                if (publicUrl.includes(placeholder)) {
                    publicUrl = publicUrl.replace(placeholder, value);
                }
            });

            // Add any additional query parameters
            if (envVars.additional_query_string_params) {
                publicUrl += `&${envVars.additional_query_string_params}`;
            }

            // Combine polling headers from config with any headers from .env
            let headers = { ...pluginInfo.polling_headers };
            
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

            data = await fetchLiveData(publicUrl, headers);
        } else {
            const pluginPath = pluginId === '.' ? PLUGINS_PATH : path.join(PLUGINS_PATH, pluginId);
            data = JSON.parse(
                await fs.readFile(path.join(pluginPath, 'sample.json'), 'utf8')
            );
        }

        // Update the view path to use pluginPath
        const pluginPath = pluginId === '.' ? PLUGINS_PATH : path.join(PLUGINS_PATH, pluginId);
        const viewPath = pluginId === '.' 
            ? path.join('views', `${layout}.liquid`)
            : path.join(pluginId, 'views', `${layout}.liquid`);
            
        const templateContent = await engine.renderFile(viewPath, data);
        
        const fontFaces = `
            @font-face {
                font-family: 'NicoClean';
                src: url('${config.designSystem.fonts.path}/NicoClean-Regular.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: 'NicoBold';
                src: url('${config.designSystem.fonts.path}/NicoBold-Regular.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: 'NicoPups';
                src: url('${config.designSystem.fonts.path}/NicoPups-Regular.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            @font-face {
                font-family: 'BlockKie';
                src: url('${config.designSystem.fonts.path}/BlockKie.ttf') format('truetype');
                font-weight: normal;
                font-style: normal;
                font-display: swap;
            }
            /* Include Inter font */
            @import url('${config.designSystem.fonts.path}/inter.css');
        `;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>${fontFaces}</style>
                <link rel="stylesheet" href="${config.designSystem.cssPath}">
                <link rel="stylesheet" href="/custom.css">
            </head>
            <body class="trmnl view-only" style="padding:0;margin:0;background:white;">
                ${templateContent}
                <script src="${config.designSystem.jsPath}"></script>
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
        res.status(500).json({ error: error.message });
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
        const effectivePluginId = pluginId || (await isPluginDirectory(PLUGINS_PATH) ? '.' : null);
        
        if (!effectivePluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin before loading layout'
            });
        }

        const pluginPath = effectivePluginId === '.' ? PLUGINS_PATH : path.join(PLUGINS_PATH, effectivePluginId);
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
        const pluginId = req.params.pluginId || (await isPluginDirectory(PLUGINS_PATH) ? '.' : null);
        
        if (!pluginId) {
            return res.status(400).json({ 
                error: 'Plugin ID required',
                message: 'Please select a plugin to view its configuration'
            });
        }

        const configPath = pluginId === '.' 
            ? path.join(PLUGINS_PATH, 'config.toml')
            : path.join(PLUGINS_PATH, pluginId, 'config.toml');
            
        const configContent = await fs.readFile(configPath, 'utf8');
        // Send the raw TOML content with text/plain content type
        res.type('text/plain').send(configContent);
    } catch (error) {
        console.error(`Error reading config.toml for plugin ${req.params.pluginId || 'unknown'}:`, error);
        res.status(404).json({ error: 'Plugin configuration not found' });
    }
});

async function startServer() {
    try {
        // Download required assets
        await downloadAssets();
        
        // Start the server
        app.listen(port, () => {
            console.log(`Test app running at http://localhost:${port}`);
        });
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer(); 