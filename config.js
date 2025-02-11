const path = require('path');
const toml = require('toml');
const fs = require('fs').promises;

// Helper function to check if a directory is a plugin directory
async function isPluginDirectory(dirPath) {
    try {
        await fs.access(path.join(dirPath, 'config.toml'));
        return true;
    } catch {
        return false;
    }
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
    }
};

async function getAvailablePlugins() {
    // First check if PLUGINS_PATH itself is a plugin directory
    if (await isPluginDirectory(config.PLUGINS_PATH)) {
        const pluginName = path.basename(config.PLUGINS_PATH);
        try {
            const configContent = await fs.readFile(path.join(config.PLUGINS_PATH, 'config.toml'), 'utf8');
            const rawPluginInfo = toml.parse(configContent);

            // Nest everything under trmnl.plugin_settings
            const pluginInfo = {
                trmnl: {
                    plugin_settings: {
                        ...rawPluginInfo,
                        // Correctly reference the custom_fields_values from the TOML
                        custom_fields_values: rawPluginInfo.custom_fields_values || {}
                    }
                }
            };

            return [{
                id: '.', // Use '.' to indicate current directory
                name: pluginInfo.trmnl.plugin_settings.name || pluginName,
                public_url: pluginInfo.trmnl.plugin_settings.url
            }];
        } catch (error) {
            console.warn(`Warning: Error reading config.toml in ${config.PLUGINS_PATH}`);
            return [];
        }
    }

    // Multiple plugins mode
    const dirs = (await fs.readdir(config.PLUGINS_PATH, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !['node_modules', 'public', 'design-system', 'scripts'].includes(name) &&
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
            if (await isPluginDirectory(path.join(config.PLUGINS_PATH, dir))) {
                try {
                    const configContent = await fs.readFile(path.join(config.PLUGINS_PATH, dir, 'config.toml'), 'utf8');
                    const rawPluginInfo = toml.parse(configContent);

                    // Nest everything under trmnl.plugin_settings
                    const pluginInfo = {
                        trmnl: {
                            plugin_settings: {
                                ...rawPluginInfo,
                                // Correctly reference the custom_fields_values from the TOML
                                custom_fields_values: rawPluginInfo.custom_fields_values || {}
                            }
                        }
                    };

                    return {
                        id: dir,
                        name: pluginInfo.trmnl.plugin_settings.name || dir,
                        public_url: pluginInfo.trmnl.plugin_settings.url
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

config.getAvailablePlugins = getAvailablePlugins;
config.isPluginDirectory = isPluginDirectory;
module.exports = config;
 