# TRMNL Plugin Tester

A development tool for testing TRMNL plugins.

## Getting Started

### Prerequisites
- Ensure you have [Node.js](https://nodejs.org/) installed
- Git installed on your machine

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/gitstua/trmnl-plugin-dev.git
   cd trmnl-plugin-dev
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   ./scripts/run.sh
   ```
   This convenience script will start the server on port 3000.

## Usage
1. Open `http://localhost:3000` in your browser
2. Select a plugin from the dropdown
3. Choose a layout configuration:
   - Full (800x480)
   - Half Horizontal (800x240)
   - Half Vertical (400x480)
   - Quadrant (400x240)


### Creating Your Plugin
You can either:
1. Copy the `random-joke` folder as a starting point and modify it for your needs
2. Create a new plugin from scratch following the structure below


## Adding a New Plugin - detailed steps

1. Create a new directory in the project root with your plugin name (e.g. `my-plugin/`)
2. Create HTML files for each supported layout:
   - `full.html` - Full layout template
   - `half-horizontal.html` - Horizontal split layout
   - `half-vertical.html` - Vertical split layout
   - `quadrant-quarter.html` - Quarter screen layout
3. Create a `sample.json` file with test data for your plugin
4. Create a `plugin.json` file containing:
   ```json
   {
     "name": "Your Plugin Name",
     "public_url": "https://your-api-endpoint.com/data",
     "description": "What your plugin does"
   }
   ```
5. Use the kind of TRMNL Design System styles from `design-system/styles.css` - refer to https://usetrmnl.com/framework/ for the correct examples and documentation
6. Your plugin will automatically appear in the plugin dropdown

## Design System Guidelines

When creating plugin templates:
- Use the styles as per the examples in the `design-system/` directory refer to https://usetrmnl.com/framework/ for the correct examples and documentation
- Do not include `<head>` tags in your plugin templates
- Include any necessary styles in the body, but prefer using the design system styles where possible
- Use Liquid syntax for data representation

## Example Plugin Structure
plugin-name/
  - full.html
  - half-horizontal.html
  - half-vertical.html
  - quadrant-quarter.html
  - sample.json
  - plugin.json
  - .env

## Deploying a plugin to TRMNL
- create a new private plugin in the TRMNL dashboard
- choose `polling`
- enter the `public_url` from the `plugin.json` file - you can copy this from the UI
- select `Edit Markup` and paste the contents of the `full.html`, `half-horizontal.html`, `half-vertical.html`, `quadrant-quarter.html` files using the buttons in the UI
- you may need to force refresh the data

## Acknowledgments

This project would not be possible without the following:

### Core Dependencies
- [Express](https://expressjs.com/) - Web framework
- [LiquidJS](https://liquidjs.com/) - Template engine
- [node-fetch](https://github.com/node-fetch/node-fetch) - Fetch API for Node.js

### Design & Assets
- [Icons8](https://icons8.com) - Providing the plugin favicon
- [TRMNL](https://usetrmnl.com/) - The e-ink device and design system for which this tool is built

### Development Tools
- AI Code Assistants - Making code refactoring and development more efficient

## License

See [LICENSE.md](LICENSE.md) for details.

Copyright (c) 2025 Stu Eggerton. All rights reserved.
