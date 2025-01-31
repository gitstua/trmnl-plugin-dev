### Usage
1. Open `http://localhost:3000` in your browser
2. Select a plugin from the dropdown
3. Choose a layout configuration:
   - Full (800x480)
   - Half Horizontal (800x240)
   - Half Vertical (400x480)
   - Quadrant (400x240)

## Adding a New Plugin

1. Create a new directory in the project root with your plugin name (e.g. `my-plugin/`)
2. Create HTML files for each supported layout:
   - `full.html` - Full layout template
   - `half-horizontal.html` - Horizontal split layout
   - `half-vertical.html` - Vertical split layout
   - `quadrant-quarter.html` - Quarter screen layout
3. Create a `sample.json` file with test data for your plugin
4. (Optional) Create a `.env` file with:
   - `SOURCE_URL` - API endpoint for data
   - `HEADERS` - Any required headers for the API
5. Use the kind of TRMNL Design System styles from `design-system/styles.css` - refer to https://usetrmnl.com/framework/ for the correct examples and documentation
6. Your plugin will automatically appear in the plugin dropdown

## Design System Guidelines

When creating plugin templates:
- Use the styles as per the examples in the `design-system/` directory
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
  - .env

  ## Deploying a plugin to TRMNL
  - create a new private plugin in the TRMNL dashboard
  - choose `polling`
  - enter the `url` from the `.env` file
  - select `Edit Markup` and paste the contents of the `full.html`, `half-horizontal.html`, `half-vertical.html`, `quadrant-quarter.html` files
  - you may need to force refresh the data