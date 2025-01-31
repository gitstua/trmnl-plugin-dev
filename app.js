const express = require('express');
const { Liquid } = require('liquidjs');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const port = 3000;

// Setup Liquid Engine
const engine = new Liquid({
    root: path.join(__dirname),
    extname: '.html'
});

app.engine('html', engine.express());
app.set('view engine', 'html');

// Set the views directory to the root directory
app.set('views', __dirname);

// Serve static files
app.use(express.static('public'));
app.use('/design-system', express.static('design-system'));

// Load sample data
async function loadSampleData() {
    const eplFixtures = JSON.parse(await fs.readFile('./epl-fixtures/sample.json', 'utf8'));
    const eplMyTeam = JSON.parse(await fs.readFile('./epl-my-team/sample.json', 'utf8'));
    return { eplFixtures, eplMyTeam };
}

// Update the getAvailablePlugins function to include an "All" option
async function getAvailablePlugins() {
    const fs = require('fs').promises;
    const path = require('path');
    const dirs = (await fs.readdir(__dirname, { withFileTypes: true }))
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => 
            !['node_modules', 'public', 'design-system', 'scripts'].includes(name) && 
            !name.startsWith('.')
        );

    // Add the "All" option as the first plugin
    const plugins = [{
        id: 'all',
        name: 'All Plugins'
    }];

    // Get plugin info for each directory
    const pluginInfos = await Promise.all(
        dirs.map(async (dir) => {
            try {
                const pluginInfo = JSON.parse(
                    await fs.readFile(path.join(__dirname, dir, 'plugin.json'), 'utf8')
                );
                return {
                    id: dir,
                    name: pluginInfo.name,
                    public_url: pluginInfo.public_url
                };
            } catch (error) {
                console.warn(`Warning: No plugin.json found for ${dir}`);
                return null;
            }
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
async function fetchLiveData(url, envVars) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching live data:', error);
        throw error;
    }
}

// Remove special handling for "all" in the preview route since we'll handle it client-side
app.get('/preview/:plugin/:layout', async (req, res) => {
    const { plugin, layout } = req.params;
    const { live } = req.query;
    
    try {
        // Existing single plugin logic
        let data;
        if (live === 'true') {
            const pluginInfo = JSON.parse(
                await fs.readFile(path.join(__dirname, plugin, 'plugin.json'), 'utf8')
            );
            data = await fetchLiveData(pluginInfo.public_url);
        } else {
            data = JSON.parse(
                await fs.readFile(`./${plugin}/sample.json`, 'utf8')
            );
        }

        const viewPath = path.join(plugin, layout);
        const templateContent = await engine.renderFile(viewPath, data);
        const cssLink = '<link rel="stylesheet" href="/design-system/styles.css">';
        const htmlContent = `<!DOCTYPE html><html><head>${cssLink}</head><body>${templateContent}</body></html>`;
        res.send(htmlContent);
    } catch (error) {
        console.error('Error rendering template:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Test app running at http://localhost:${port}`);
}); 