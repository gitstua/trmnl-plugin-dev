# TRMNL Plugin Tester

A development tool for testing TRMNL plugins.

## Features

- Shows a list of plugins in this repo
- Allows you to preview each plugin with full, half-horizontal, half-vertical layouts and quadrant layouts
- supports working against local `plugin.json` files or calling your API
- allows copying the layouts and any API url to the clipboard for easy pasting into the [useTRMNL.com](https://usetrmnl.com) plugin dashboard

![TRMNL Plugin Tester preview image](preview.png)

### Usage

If you want to use this project to test your plugins before you add them to the TRMNL project, then jump to the [Getting Started](#getting-started) section.

### Example online
I am deploying the Docker version of this project to [trmnl-plugins.fly.dev](https://trmnl-plugins.fly.dev/) so you can try it out without having to install anything. This version is limited to the plugins in this repo. Any API which needs an API key will not work in the online version so use the Load Preview button to see the plugin in action with sample data.

To develop a plugin, you need to run this locally either by building the Docker image or running the Node.js server.

## Sample plugins in this repo

### Home Assistant TRMNL Plugin
<img src="home-assistant-trmnl/preview/full.png" width="600" alt="Home Assistant TRMNL">

- Display your Home Assistant sensor data in TRMNL
- Shows temperature and other sensors in a clean, organized interface
- **DATA:** Home Assistant API
- **SOURCE:** [_plugins/home-assistant-trmnl](_plugins/home-assistant-trmnl)

See [Home Assistant TRMNL Plugin](home-assistant-trmnl/README.md) for full details.

### My Agenda
<img src="my-agenda/preview/full.png" width="600" alt="My Agenda">

- Shows upcoming events in an agenda view
- **DATA:** A custom API which converts ICAL to JSON I built and host on Cloudflare Workers. You can choose to self-host or reach out to me for an API key. See [Source Code for API Service](https://github.com/gitstua/stu-calendar-wrangler-worker#ical-to-json-converter-worker)
- **SOURCE:** [_plugins/my-agenda](_plugins/my-agenda)

### Currency Exchange
<img src="currency-exchange/preview/full.png" width="600" alt="Currency Exchange">

- Shows the current exchange rate for a currency pair
- **DATA:** API from [currencyapi.com](https://currencyapi.com/) which gets the exchange rate. Free with rate limit.
- **SOURCE:** [_plugins/currency-exchange](_plugins/currency-exchange)

### EPL Fixtures
<img src="epl-fixtures/preview/full.png" width="600" alt="EPL Fixtures">

- Shows upcoming English Premier League fixtures
- Displays match dates, teams, and scores in a compact format
- Supports different layouts for various screen sizes
- **DATA:** Connects to a raw file in a GitHub repo. https://github.com/openfootball
- **SOURCE:** [_plugins/epl-fixtures](_plugins/epl-fixtures)

### EPL My Team
<img src="epl-my-team/preview/full.png" width="600" alt="EPL My Team">

- Focused view of a specific team's EPL matches (currently only supports Manchester United FC)
- Shows recent results and upcoming fixtures
- Highlights wins with outlined team names
- **DATA:** Connects to a raw file in a GitHub repo. https://github.com/openfootball
- **SOURCE:** [_plugins/epl-my-team](_plugins/epl-my-team)

### Random Fact
<img src="random-fact/preview/full.png" width="600" alt="Random Fact">

- Displays interesting random facts
- Simple, clean interface for easy reading
- **DATA:** https://uselessfacts.jsph.pl (Free)
- **SOURCE:** [_plugins/random-fact](_plugins/random-fact)

### Random Joke
<img src="random-joke/preview/full.png" width="600" alt="Random Joke">

- Shows setup and punchline of random jokes
- Optimized for smaller display formats
- Great for adding humor to your dashboard
- **DATA:** https://official-joke-api.appspot.com/random_joke (Free)
- **SOURCE:** [_plugins/random-joke](_plugins/random-joke)

### Wind Speed & Direction
<img src="wind-speed-direction/preview/full.png" width="600" alt="Wind Speed & Direction">

- Displays hourly wind speed, direction, and gusts data
- Shows forecast for configurable location
- Supports different layouts with varying detail levels
- **DATA:** Open-Meteo API (Free, no API key required)
- **SOURCE:** [_plugins/wind-speed-direction](_plugins/wind-speed-direction)

## Alternative
Whilst I started writing this just to build something for myself, I did not notice the awesome project by @schrockwell - his https://github.com/schrockwell/trmnl_preview/ came before this and so please checkout that too as it gives better results for the preview.

You can also use this project to test your plugins before you add them to the TRMNL project using the script `./scripts/serve-plugin.sh`. 

Execute `./scripts/serve-plugin.sh` to run the plugin with the TRMNL Preview Server by @schrockwell. 

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

2. Start the development server:
```bash
./scripts/run.sh
```

This will start the server and provide the URL to open preview in your browser.

## Docker Support

You can run the TRMNL Plugin Tester using Docker:

### Using Docker Hub Image

To build and run the image, use the following command:
```bash
./scripts/run-docker.sh
```

I have not pushed the image to Docker Hub yet, so you need to build it locally.

   
