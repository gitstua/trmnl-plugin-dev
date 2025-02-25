# TRMNL Plugin Tester Specification

## Overview
A development tool for testing TRMNL plugins before deployment to the useTRMNL.com platform. The application allows previewing and testing plugins locally or in Docker containers.

## Core Requirements

### Plugin Management
- Support for single and multi-plugin modes
- Plugin discovery from filesystem
- Plugin settings via YAML configuration
- Support for custom fields and tokens in plugin settings

### Preview Features
- Preview plugins in various layouts (full, half-horizontal, half-vertical, quadrant)
- Support for static data, polling, and webhook strategies
- Live data fetching with rate limiting
- Template rendering using LiquidJS

### Image Generation
- Generate BMP images for TRMNL e-ink displays
- Use Puppeteer for screenshot capture
- Use ImageMagick for image conversion to BMP format
- Support for different display sizes and layouts
- Image specifications:
  - Resolution: 800x480 pixels (standard TRMNL display)
  - Color depth: 1-bit (black and white) for e-ink compatibility
  - Format: BMP with specific headers for e-ink displays
  - Dithering: Floyd-Steinberg algorithm for grayscale conversion
  - Support for different layouts (all returned as 800x480 images):
    - Full screen (800x480)
    - Half-horizontal (800x240)
    - Half-vertical (400x480)
    - Quadrant (400x240)
  - Viewport configuration for accurate rendering
  - Caching mechanism to reduce processing load

### API Support (BYOS Server)
- REST API for plugin management
- Support for authentication/authorization
- Rate limiting to prevent abuse
- Device management API endpoints
- BYOS (Bring Your Own Server) endpoints:
  - `/api/setup`: Device registration endpoint that accepts MAC addresses and returns configuration
  - `/api/display`: Returns plugin display configuration with image URLs
  - `/display`: Generates BMP images for e-ink displays
  - `/api/plugins`: Lists available plugins
  - `/api/plugins/:pluginId/export`: Exports plugin as ZIP file for TRMNL import
  - `/api/layout/:layout` and `/api/layout/:pluginId/:layout`: Returns layout templates
  - `/api/plugin-settings/:pluginId`: Returns plugin settings in YAML format

### Deployment
- Docker support with multi-architecture builds (x86, ARM)
- Fly.io deployment configuration
- GitHub Actions for CI/CD
- Environment variable configuration

### Data Storage
- SQLite database for device management
- Filesystem storage for plugins and cache
- Support for environment variables and .env files

## Technical Stack
- Node.js with Express
- LiquidJS for templating
- Puppeteer for browser automation
- ImageMagick for image processing
- SQLite for lightweight database
- Docker for containerization
- GitHub Actions for CI/CD

## Deployment Options
- Local development with Node.js
- Docker container deployment
- Fly.io cloud deployment 