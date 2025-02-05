# TRMNL Plugin Tester

A development tool for testing TRMNL plugins.

## Alternative
Whilst I started writing this just to build something for myself, I did not notice the awesome project by @schrockwell - his https://github.com/schrockwell/trmnl_preview/ came before this and so please checkout that too as it gives better results for the preview.

You can also use this project to test your plugins before you add them to the TRMNL project. 

Execute `/run-plugin.sh` to run the plugin with the TRMNL Preview Server by @schrockwell. 

## Plugins in this repo

### My Agenda
<img src="my-agenda/preview/full.png" width="600" alt="My Agenda">

- Shows upcoming events in an agenda view
- **DATA:** A custom API which converts ICAL to JSON I built and host on Cloudflare Workers.  You can choose to self-host or reach out to me for an API key. See [Source Code for API Service](https://github.com/gitstua/stu-calendar-wrangler-worker#ical-to-json-converter-worker)

### Currency Exchange
<img src="currency-exchange/preview/full.png" width="600" alt="Currency Exchange">

- Shows the current exchange rate for a currency pair
- **DATA:** API from [currencyapi.com](https://currencyapi.com/) which gets the exchange rate. Free with rate limit.

### EPL Fixtures
<img src="epl-fixtures/preview/full.png" width="600" alt="EPL Fixtures">

- Shows upcoming English Premier League fixtures
- Displays match dates, teams, and scores in a compact format
- Supports different layouts for various screen sizes
- **DATA:** Connects to a raw file in a GitHub repo. https://github.com/openfootball

### EPL My Team
<img src="epl-my-team/preview/full.png" width="600" alt="EPL My Team">

- Focused view of a specific team's EPL matches (currently only supports Manchester United FC)
- Shows recent results and upcoming fixtures
- Highlights wins with outlined team names
- **DATA:** Connects to a raw file in a GitHub repo. https://github.com/openfootball

### Random Fact
<img src="random-fact/preview/full.png" width="600" alt="Random Fact">

- Displays interesting random facts
- Simple, clean interface for easy reading
- **DATA:** https://uselessfacts.jsph.pl (Free)

### Random Joke
<img src="random-joke/preview/full.png" width="600" alt="Random Joke">

- Shows setup and punchline of random jokes
- Optimized for smaller display formats
- Great for adding humor to your dashboard
- **DATA:** https://official-joke-api.appspot.com/random_joke (Free)


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
   ./scripts/download-cached-cdn-files.sh
   ```

3. Start the development server:
   ```
