const express = require('express');
const axios = require('axios');

require('dotenv').config();

const app = express();
const PORT = 4000;

const OPENWEATHER_API_KEY = "558718855e44490ebdf7268849113f09";
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/';

app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

function mapIcon(description) {
    if (description.includes('sun') || description.includes('clear')) return 'sun';
    if (description.includes('rain') || description.includes('drizzle')) return 'rain';
    if (description.includes('snow') || description.includes('sleet')) return 'snow';
    return 'cloud';
}

// Original weather endpoint by city name
app.get('/api/weather', async (req, res) => {
    const city = req.query.city;

    if (!city) {
        return res.status(400).json({ success: false, message: 'City parameter is required.' });
    }
    if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_KEY_HERE") {
        return res.status(500).json({ success: false, message: "Server configuration error: OpenWeatherMap API key is missing." });
    }

    try {
        const currentUrl = `${OPENWEATHER_BASE_URL}weather?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`;
        const currentResponse = await axios.get(currentUrl);
        const currentData = currentResponse.data;

        const forecastUrl = `${OPENWEATHER_BASE_URL}forecast?q=${city}&units=metric&appid=${OPENWEATHER_API_KEY}`;
        const forecastResponse = await axios.get(forecastUrl);
        const forecastData = forecastResponse.data;

        const dailyForecast = forecastData.list
            .filter(item => item.dt_txt.includes("12:00:00"))
            .slice(0, 5)
            .map(item => ({
                day: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
                icon: mapIcon(item.weather[0].description.toLowerCase()),
                max: Math.round(item.main.temp_max),
                min: Math.round(item.main.temp_min)
            }));

        const finalResponse = {
            city: `${currentData.name}, ${currentData.sys.country}`,
            current: {
                temp: Math.round(currentData.main.temp),
                description: currentData.weather[0].main,
                icon: mapIcon(currentData.weather[0].description.toLowerCase()),
                humidity: currentData.main.humidity,
                windSpeed: Math.round(currentData.wind.speed * 3.6),
                feelsLike: Math.round(currentData.main.feels_like),
            },
            forecast: dailyForecast
        };

        res.json(finalResponse);

    } catch (error) {
        console.error(`Error fetching weather data for ${city}:`, error.message);

        let errorMessage = 'External API call failed.';
        if (error.response && error.response.status === 404) {
            errorMessage = `City '${city}' not found.`;
        }
        res.status(500).json({ success: false, message: errorMessage });
    }
});

// NEW: Weather endpoint by coordinates (for current location)
app.get('/api/weather-coords', async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
        return res.status(400).json({ success: false, message: 'Latitude and longitude parameters are required.' });
    }
    if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === "YOUR_KEY_HERE") {
        return res.status(500).json({ success: false, message: "Server configuration error: OpenWeatherMap API key is missing." });
    }

    try {
        const currentUrl = `${OPENWEATHER_BASE_URL}weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
        const currentResponse = await axios.get(currentUrl);
        const currentData = currentResponse.data;

        const forecastUrl = `${OPENWEATHER_BASE_URL}forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`;
        const forecastResponse = await axios.get(forecastUrl);
        const forecastData = forecastResponse.data;

        const dailyForecast = forecastData.list
            .filter(item => item.dt_txt.includes("12:00:00"))
            .slice(0, 5)
            .map(item => ({
                day: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
                icon: mapIcon(item.weather[0].description.toLowerCase()),
                max: Math.round(item.main.temp_max),
                min: Math.round(item.main.temp_min)
            }));

        const finalResponse = {
            city: `${currentData.name}, ${currentData.sys.country}`,
            coordinates: {
                lat: currentData.coord.lat,
                lon: currentData.coord.lon
            },
            current: {
                temp: Math.round(currentData.main.temp),
                description: currentData.weather[0].main,
                icon: mapIcon(currentData.weather[0].description.toLowerCase()),
                humidity: currentData.main.humidity,
                windSpeed: Math.round(currentData.wind.speed * 3.6),
                feelsLike: Math.round(currentData.main.feels_like),
            },
            forecast: dailyForecast
        };

        res.json(finalResponse);

    } catch (error) {
        console.error(`Error fetching weather data for coordinates (${lat}, ${lon}):`, error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch weather data for location.' });
    }
});

// NEW: Coordinates endpoint (for map display)
app.get('/api/coordinates', async (req, res) => {
    const city = req.query.city;

    if (!city) {
        return res.status(400).json({ success: false, message: 'City parameter is required.' });
    }

    try {
        const url = `${OPENWEATHER_BASE_URL}weather?q=${city}&appid=${OPENWEATHER_API_KEY}`;
        const response = await axios.get(url);
        const data = response.data;

        res.json({
            city: `${data.name}, ${data.sys.country}`,
            lat: data.coord.lat,
            lon: data.coord.lon
        });

    } catch (error) {
        console.error(`Error fetching coordinates for ${city}:`, error.message);
        
        let errorMessage = 'Failed to get city coordinates.';
        if (error.response && error.response.status === 404) {
            errorMessage = `City '${city}' not found.`;
        }
        res.status(500).json({ success: false, message: errorMessage });
    }
});

app.listen(PORT, () => {
    console.log(`My Climate Proxy Server running on http://localhost:${PORT}`);
    console.log("Key successfully configured.");
});