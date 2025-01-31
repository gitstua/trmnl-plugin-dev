const express = require('express');
const { Liquid } = require('liquidjs');
const fs = require('fs').promises;
const path = require('path');

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

// Add this function to scan for plugins
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

    // Get plugin info for each directory
    const plugins = await Promise.all(
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

    // Filter out any null entries from failed reads
    return plugins.filter(plugin => plugin !== null);
}

// Add this new endpoint
app.get('/api/plugins', async (req, res) => {
    const plugins = await getAvailablePlugins();
    res.json(plugins);
});

// Remove the headers from the root route
app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/preview/:plugin/:layout', async (req, res) => {
    const { plugin, layout } = req.params;
    
    try {
        // Load the plugin's sample data
        const sampleData = JSON.parse(
            await fs.readFile(`./${plugin}/sample.json`, 'utf8')
        );

        // Construct the view path
        const viewPath = path.join(plugin, layout);
        const templateContent = await engine.renderFile(viewPath, sampleData);
        const cssLink = '<link rel="stylesheet" href="/design-system/styles.css">';
        const htmlContent = `<!DOCTYPE html><html><head>${cssLink}</head><body>${templateContent}</body></html>`;
        res.send(htmlContent);
    } catch (error) {
        console.error('Error rendering template:', error);
        res.status(500).send('Error rendering template');
    }
});

app.listen(port, () => {
    console.log(`Test app running at http://localhost:${port}`);
}); 