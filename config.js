const path = require('path');
const toml = require('toml');
const fs = require('fs').promises;
const yaml = require('js-yaml');

// Add at the top with other state variables
let globalDeviceData = {};

// Add the initialization function
async function initializeDeviceData() {
    try {
        globalDeviceData = JSON.parse(
            await fs.readFile(path.join(process.cwd(), 'device.json'), 'utf8')
        );
    } catch (err) {
        console.warn('Warning: No device.json found, using empty device data');
        globalDeviceData = {};
    }
}

// Helper function to check if a directory is a plugin directory
async function isPluginDirectory(dir) {
    try {
        const stats = await fs.stat(dir);
        if (!stats.isDirectory()) return false;

        // Check for settings.yml instead of config.toml
        const files = await fs.readdir(dir);
        return files.includes('settings.yml') && files.includes('views');
    } catch (err) {
        return false;
    }
}

// Move getPluginInfoWithTokens outside the config object
async function getPluginInfoWithTokens(pluginId) {
    const pluginInfo = await this.getPluginInfo(pluginId);
    const envVars = await this.readEnvVars(pluginId);
    
    // Deep clone the plugin settings to avoid modifying the original
    const settings = JSON.parse(JSON.stringify(pluginInfo.trmnl.plugin_settings));
    

    // Replace tokens in urls if they exist
    if (settings.polling_url) {
        settings.polling_url = await this.replaceTokensInUrl(
            settings.polling_url,
            settings,
            envVars,
            this.deviceData
        );
    }

    //write settings.polling_headers to console
    console.log('Original polling headers:', settings.polling_headers);

    // If no polling headers, return empty object
    if (!settings.polling_headers) {
        return {
            trmnl: {
                plugin_settings: {
                    ...settings,
                    headers: {}
                }
            }
        };
    }

    //polling_headers is a string, replace all {{ placeholder }} with the envVars
    const replaced_headers_string = settings.polling_headers.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, p1) => {
        const trimmedKey = p1.trim();
        return envVars[trimmedKey] || envVars[trimmedKey.toUpperCase()] || match;
    });

    console.log('Replaced headers string:', replaced_headers_string);

    //convert the string to an array of strings and filter out empty lines
    const headers_array = replaced_headers_string.split('\n').filter(line => line.trim());

    //convert the array of header strings to an object
    const headers = headers_array.reduce((acc, header) => {
        const [key, value] = header.split(':').map(part => part.trim());
        if (key && value) {
            acc[key] = value;
        }
        return acc;
    }, {});

    console.log('Final headers object:', headers);

    return {
        trmnl: {
            plugin_settings: {
                ...settings,
                headers
            }
        }
    };
}

// Environment-based configuration
const config = {
    // Paths
    PLUGINS_PATH: process.env.PLUGINS_PATH || path.join(process.cwd(), '_plugins'),
    CACHE_PATH: process.env.CACHE_PATH || path.join(process.cwd(), 'cache'),
    
    // Feature flags
    ENABLE_IMAGE_GENERATION: process.env.ENABLE_IMAGE_GENERATION !== 'false', // Default to false
    DEBUG_MODE: process.env.DEBUG_MODE === 'true',
    USE_CACHE: process.env.USE_CACHE === 'true' || false,
    ADMIN_MODE: process.env.ADMIN_MODE === 'true' || false,

    // Rate limiting
    MAX_REQUESTS_PER_5_MIN: parseInt(process.env.MAX_REQUESTS_PER_5_MIN || '400', 10),
    
    // Server config
    PORT: parseInt(process.env.PORT || '3000', 10),
    
    // Browser config
    BROWSER_LAUNCH_CONFIG: {
        puppeteer: {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',  // Docker specific
                '--disable-gpu'             // Optional: helps in certain environments
            ]
        }
    },
    
    // Derived paths
    get FONTS_PATH() {
        return path.join(this.CDN_PATH, '/fonts');
    },
    get CSS_PATH() {
        return path.join(this.CDN_PATH, '/css/latest');
    },
    get JS_PATH() {
        return path.join(this.CDN_PATH, '/js/latest');
    },

    // CDN_PATH is used to proxy to the CDN if USE_CACHE is false 
    // it is used to set a relative path if USE_CACHE is true
    get CDN_PATH() {
        if (this.USE_CACHE) {
            return 'https://usetrmnl.com';
        } else {
            return "";
        }
    },

    // Helper function to get plugin path
    getPluginPath(pluginId) {
        return pluginId === '.' ? this.PLUGINS_PATH : path.join(this.PLUGINS_PATH, pluginId);
    },
    
    // Display settings
    DISPLAY: {
        width: 800,
        height: 480,
        delay: 1000  // delay in ms before taking screenshot
    },

    // Image generation options
    //IMAGE_MAGICK_SWICTHES: '-dither FloydSteinberg -remap pattern:gray50 -depth 1 -strip',
    //exec(`convert ${tempPng} -dither FloydSteinberg -monochrome -depth 1 -strip -define bmp:format=bmp3 ${tempBmp2}`);
    //exec(`convert ${tempPng} -dither FloydSteinberg -monochrome -depth 1 -strip -compress RLE -define bmp:format=bmp3 ${tempBmp3}`);
    IMAGE_MAGICK_SWICTHES: '-dither FloydSteinberg -monochrome -depth 1 -strip -compress RLE -define bmp:format=bmp3',


    // ImageMagick binary path - defaults to convert
    IMAGE_MAGICK_BIN: process.env.IMAGE_MAGICK_BIN || 'convert',
    
    get PLUGINS() {
        return getAvailablePlugins();
    },

    // this method is used to get the plugin info from the settings.yml file
    async getPluginInfo(pluginId) {
        const pluginPath = this.getPluginPath(pluginId);
        const configContent = await fs.readFile(path.join(pluginPath, 'settings.yml'), 'utf8');
        const settings = yaml.load(configContent);

        return {
            trmnl: {
                plugin_settings: {
                    ...settings,
                    custom_fields_values: settings.custom_fields_values || {}
                }
            }
        };
    },

    // Add this method to the config object
    getSamplePath(pluginId) {
        return pluginId === '.' 
            ? path.join(this.PLUGINS_PATH, 'sample.json')
            : path.join(this.PLUGINS_PATH, pluginId, 'sample.json');
    },

    get deviceData() {
        return globalDeviceData;
    },

    async initialize() {
        await initializeDeviceData();
    }
};

async function getAvailablePlugins() {
    try {
        const pluginsPath = config.PLUGINS_PATH;
        const entries = await fs.readdir(pluginsPath, { withFileTypes: true });
        
        // Filter for directories that contain a settings.yml file
        const plugins = [];
        
        // Skip special directories
        const skipDirs = ['node_modules', 'public', 'design-system', 'scripts'];
        
        for (const entry of entries) {
            if (entry.isDirectory() && !skipDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                const pluginPath = path.join(pluginsPath, entry.name);
                const settingsPath = path.join(pluginPath, 'settings.yml');
                
                try {
                    // Check if settings.yml exists
                    await fs.access(settingsPath);
                    
                    // Read and parse settings.yml
                    const settingsContent = await fs.readFile(settingsPath, 'utf8');
                    const settings = yaml.load(settingsContent);
                    
                    plugins.push({
                        id: entry.name,
                        name: settings.name || entry.name,
                        description: settings.description || ''
                    });
                } catch (err) {
                    console.warn(`Skipping ${entry.name}: No valid settings.yml found`);
                }
            }
        }

        console.log(`Found ${plugins.length} plugins:`, plugins.map(p => p.name).join(', ')); // Debug log

        // Add "All Plugins" option if there are multiple plugins
        if (plugins.length > 1) {
            plugins.unshift({
                id: 'all',
                name: 'All Plugins',
                description: 'Show all available plugins'
            });
        }
        
        return plugins;
    } catch (error) {
        console.error('Error getting available plugins:', error);
        return [];
    }
}

config.getAvailablePlugins = getAvailablePlugins;
config.isPluginDirectory = isPluginDirectory;
config.getPluginInfo = config.getPluginInfo;

// Add these methods to the config object
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key];
    }, obj);
}

// Update replaceTokensInUrl to use settings directly
async function replaceTokensInUrl(url, settings, envVars, deviceData) {
    if (!url) return url;

    // Replace any {{placeholder}} in the URL with environment variables first
    Object.entries(envVars || {}).forEach(([key, value]) => {
        const placeholder = `{{ ${key} }}`;
        if (url.includes(placeholder)) {
            url = url.replace(placeholder, value);
        }
    });

    //replace any remaining tokens such as {{ days }} with the value from the custom_fields_values object
    Object.entries(settings.custom_fields_values || {}).forEach(([key, value]) => {
        const placeholder = `{{ ${key} }}`;
        if (url.includes(placeholder)) {
            url = url.replace(placeholder, value);
        }
    });

    // Replace tokens with fully qualified paths
    const tokenRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    url = url.replace(tokenRegex, (match, path) => {
        // Check env vars first
        if (envVars && envVars[path.trim()]) return envVars[path.trim()];
        
        // Try to get value from plugin settings or device data
        const data = {
            trmnl: {
                plugin_settings: {
                    ...settings,
                    custom_fields_values: settings.custom_fields_values || {}
                },
                ...deviceData
            }
        };

        const value = getNestedValue(data, path.trim());
        return value !== undefined ? value : match; // Keep original token if path not found
    });

    return url;
}

// Make sure these are properly added to the config object
config.getNestedValue = getNestedValue;
config.replaceTokensInUrl = replaceTokensInUrl;

// Update readEnvVars to properly clean header values
async function readEnvVars(pluginId) {
    const pluginPath = this.getPluginPath(pluginId);
    let envVars = {};
    
    try {
        const env = await fs.readFile(path.join(pluginPath, '.env'), 'utf8');
        envVars = env.split('\n').reduce((acc, line) => {
            line = line.trim();
            if (!line || line.startsWith('#')) return acc;
            
            // Split only on the first '=' to handle values that contain '='
            const splitIndex = line.indexOf('=');
            if (splitIndex === -1) return acc;
            
            const key = line.slice(0, splitIndex).trim();
            const value = line.slice(splitIndex + 1).trim();
            
            if (key && value) {
                // Handle multi-line headers by joining with commas
                if (key === 'HEADERS') {
                    try {
                        // Parse and stringify to validate and clean the JSON
                        acc[key] = JSON.stringify(JSON.parse(value));
                    } catch (e) {
                        console.warn(`Warning: Invalid JSON in HEADERS env var for plugin ${pluginId}`);
                    }
                } else {
                    acc[key] = value;
                    acc[key.toUpperCase()] = value;
                }
            }
            return acc;
        }, {});
    } catch (err) {
        console.warn(`Warning: No .env file found for plugin ${pluginId}`);
    }
    
    return envVars;
}

// Add readEnvVars to the config object
config.readEnvVars = readEnvVars;

// Add all functions to config object first
config.getPluginInfoWithTokens = getPluginInfoWithTokens;
config.getNestedValue = getNestedValue;
config.replaceTokensInUrl = replaceTokensInUrl;
config.readEnvVars = readEnvVars;
config.isPluginDirectory = isPluginDirectory;
config.getAvailablePlugins = getAvailablePlugins;

// Then bind all methods to config
config.getPluginInfoWithTokens = config.getPluginInfoWithTokens.bind(config);
config.getNestedValue = config.getNestedValue.bind(config);
config.replaceTokensInUrl = config.replaceTokensInUrl.bind(config);
config.readEnvVars = config.readEnvVars.bind(config);
config.getPluginInfo = config.getPluginInfo.bind(config);
config.getPluginPath = config.getPluginPath.bind(config);
config.isPluginDirectory = config.isPluginDirectory.bind(config);
config.getAvailablePlugins = config.getAvailablePlugins.bind(config);

// Call initialize when the module loads
config.initialize().catch(err => {
    console.error('Error initializing config:', err);
});

module.exports = config;
 
 