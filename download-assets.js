const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

const CDN_BASE = 'https://usetrmnl.com';
const DESIGN_SYSTEM_DIR = path.join(__dirname, '../design-system');
const CACHE_FILE = path.join(DESIGN_SYSTEM_DIR, 'cdn-copy', '.cache');
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

const assets = {
    css: {
        'cdn-copy/plugins.css': '/css/latest/plugins.css'
    },
    js: {
        'cdn-copy/plugins.js': '/js/latest/plugins.js'
    },
    fonts: {
        'fonts/BlockKie.ttf': '/fonts/BlockKie.ttf',
        'fonts/NicoBold-Regular.ttf': '/fonts/NicoBold-Regular.ttf',
        'fonts/NicoClean-Regular.ttf': '/fonts/NicoClean-Regular.ttf',
        'fonts/NicoPups-Regular.ttf': '/fonts/NicoPups-Regular.ttf',
        'fonts/inter.css': 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap'
    },
    images: {
        // Border images
        'cdn-copy/images/borders/1.png': '/images/borders/1.png',
        'cdn-copy/images/borders/2.png': '/images/borders/2.png',
        'cdn-copy/images/borders/3.png': '/images/borders/3.png',
        'cdn-copy/images/borders/4.png': '/images/borders/4.png',
        'cdn-copy/images/borders/5.png': '/images/borders/5.png',
        'cdn-copy/images/borders/6.png': '/images/borders/6.png',
        'cdn-copy/images/borders/7.png': '/images/borders/7.png',
        // Grayscale images
        'cdn-copy/images/grayscale/gray-1.png': '/images/grayscale/gray-1.png',
        'cdn-copy/images/grayscale/gray-2.png': '/images/grayscale/gray-2.png',
        'cdn-copy/images/grayscale/gray-3.png': '/images/grayscale/gray-3.png',
        'cdn-copy/images/grayscale/gray-4.png': '/images/grayscale/gray-4.png',
        'cdn-copy/images/grayscale/gray-5.png': '/images/grayscale/gray-5.png',
        'cdn-copy/images/grayscale/gray-6.png': '/images/grayscale/gray-6.png',
        'cdn-copy/images/grayscale/gray-7.png': '/images/grayscale/gray-7.png',
        'cdn-copy/images/grayscale/gray-out.png': '/images/grayscale/gray-out.png',
        // Layout images
        'cdn-copy/images/layout/full--title_bar-v2.png': '/images/layout/full--title_bar-v2.png',
        'cdn-copy/images/layout/full--title_bar.png': '/images/layout/full--title_bar.png',
        'cdn-copy/images/layout/half_horizontal--title_bar.png': '/images/layout/half_horizontal--title_bar.png',
        'cdn-copy/images/layout/half_horizontal.png': '/images/layout/half_horizontal.png',
        'cdn-copy/images/layout/half_vertical--title_bar.png': '/images/layout/half_vertical--title_bar.png',
        'cdn-copy/images/layout/half_vertical.png': '/images/layout/half_vertical.png',
        'cdn-copy/images/layout/quadrant--title_bar.png': '/images/layout/quadrant--title_bar.png',
        'cdn-copy/images/layout/quadrant.png': '/images/layout/quadrant.png'
    }
};

async function isCacheValid() {
    try {
        const cacheContent = await readFile(CACHE_FILE, 'utf8');
        const cacheTime = parseInt(cacheContent);
        const age = Date.now() - cacheTime;
        return age <= CACHE_DURATION;
    } catch (error) {
        return false;
    }
}

async function updateCacheTimestamp() {
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, Date.now().toString());
}

async function downloadFile(url, outputPath) {
    console.log(`Downloading ${url}...`);
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }

            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                await mkdir(path.dirname(outputPath), { recursive: true });
                await writeFile(outputPath, buffer);
                console.log(`Downloaded ${url} to ${outputPath}`);
                resolve();
            });
        }).on('error', reject);
    });
}

async function extractAndDownloadImages(cssPath) {
    try {
        const cssContent = await readFile(cssPath, 'utf8');
        const urlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
        let match;

        while ((match = urlRegex.exec(cssContent)) !== null) {
            const url = match[1];
            // Skip data URLs, fonts, and already downloaded files
            if (url.startsWith('data:') || 
                url.includes('.ttf') || 
                url.includes('.woff')) {
                continue;
            }

            // Convert relative URLs to absolute
            const fullUrl = url.startsWith('http') ? url : `${CDN_BASE}${url}`;
            
            // Create relative path for the image
            const relativePath = url.startsWith('http') 
                ? new URL(url).pathname 
                : url;
            const outputPath = path.join(DESIGN_SYSTEM_DIR, 'cdn-copy', relativePath.replace(/^\//, ''));

            await downloadFile(fullUrl, outputPath);
        }
    } catch (error) {
        console.error('Error processing images from CSS:', error);
        throw error;
    }
}

async function downloadAssets() {
    try {
        // Check cache first
        if (await isCacheValid()) {
            console.log('Using cached CDN files since less than 10 minutes have passed');
            return;
        }

        console.log('Cache expired or not found, downloading assets...');
        
        // Download all assets
        for (const [type, files] of Object.entries(assets)) {
            for (const [outputFile, urlPath] of Object.entries(files)) {
                const url = urlPath.startsWith('http') ? urlPath : `${CDN_BASE}${urlPath}`;
                const outputPath = path.join(DESIGN_SYSTEM_DIR, outputFile);
                await downloadFile(url, outputPath);

                // After downloading CSS, extract and download its images
                if (outputFile.endsWith('plugins.css')) {
                    console.log('Extracting and downloading images from CSS...');
                    await extractAndDownloadImages(outputPath);
                }
            }
        }

        // Update cache timestamp after successful download
        await updateCacheTimestamp();
        console.log('All assets downloaded successfully');
    } catch (error) {
        console.error('Error downloading assets:', error);
        process.exit(1);
    }
}

module.exports = downloadAssets;

// Run directly if called from command line
if (require.main === module) {
    downloadAssets();
} 