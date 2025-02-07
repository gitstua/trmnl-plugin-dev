const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const CDN_BASE = 'https://usetrmnl.com';
const DESIGN_SYSTEM_DIR = path.join(__dirname, '../design-system');

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
    }
};

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
        // Download main assets first
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