// Constants and DOM Elements
const cityInput = document.getElementById('city-input');
const fetchButton = document.getElementById('fetch-button');
const weatherDisplay = document.getElementById('weather-display');
const showMapButton = document.getElementById('show-map-button');
const closeMapButton = document.getElementById('close-map-button');
const mapContainer = document.getElementById('map-container');
const PROXY_SERVER_URL = 'http://localhost:4000';
const AUTH_SERVER_URL = 'http://localhost:3000';
let currentCity = cityInput.value;

// NEW: Map and Location Elements
const currentLocationWidget = document.getElementById('current-location-widget');
const locationName = document.getElementById('location-name');
const locationTemp = document.getElementById('location-temp');
const locationIcon = document.getElementById('location-icon');
const offlineIndicator = document.getElementById('offline-indicator');

// Authentication DOM Elements
const authContainer = document.getElementById('auth-container');
const weatherAppContainer = document.getElementById('weather-app-container');
const authTitle = document.getElementById('auth-title');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const toggleAuth = document.getElementById('toggle-auth');
const authStatus = document.getElementById('auth-status');
const logoutButton = document.getElementById('logout-button');
const userInfo = document.getElementById('user-info');
const userDisplay = document.getElementById('user-display');
const loginEmailInput = document.getElementById('login-email');

// State Management
let isLoggedIn = false;
let userName = '';
let userToken = null;
let weatherMap = null;
let userLocation = null;
let isOffline = false;
let lastWeatherCache = {};

// Cache keys for localStorage
const CACHE_PREFIX = 'weather_cache_';
const LOCATION_CACHE_KEY = 'user_location_cache';

// Offline Detection
window.addEventListener('online', () => {
    isOffline = false;
    offlineIndicator.classList.add('hidden');
    if (isLoggedIn && userLocation) {
        fetchCurrentLocationWeather();
    }
});

window.addEventListener('offline', () => {
    isOffline = true;
    offlineIndicator.classList.remove('hidden');
});

// Check if offline on load
if (!navigator.onLine) {
    isOffline = true;
    offlineIndicator.classList.remove('hidden');
}

// Icon Mapping
function mapIcon(iconName) {
    switch (iconName) {
        case 'sun': return '☀️';
        case 'cloud': return '☁️';
        case 'rain': return '🌧️';
        case 'snow': return '❄️';
        case 'thunderstorm': return '⛈️';
        case 'mist': return '🌫️';
        default: return '❓';
    }
}

// Cache Management
function cacheWeatherData(city, data) {
    try {
        const cacheData = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_PREFIX + city.toLowerCase(), JSON.stringify(cacheData));
    } catch (e) {
        console.error('Failed to cache weather data:', e);
    }
}

function getCachedWeatherData(city) {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + city.toLowerCase());
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        console.error('Failed to retrieve cached data:', e);
    }
    return null;
}

function estimateWeatherFromCache(city) {
    const cached = getCachedWeatherData(city);
    if (!cached) return null;
    
    const hoursSinceCache = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
    
    // Simple estimation: adjust temperature based on time of day
    const hour = new Date().getHours();
    let tempAdjustment = 0;
    
    if (hour >= 6 && hour < 12) {
        tempAdjustment = 2; // Morning warming
    } else if (hour >= 12 && hour < 18) {
        tempAdjustment = 0; // Afternoon stable
    } else if (hour >= 18 && hour < 22) {
        tempAdjustment = -2; // Evening cooling
    } else {
        tempAdjustment = -3; // Night cooling
    }
    
    // Create estimated data
    const estimated = JSON.parse(JSON.stringify(cached.data));
    estimated.current.temp += tempAdjustment;
    estimated.current.feelsLike += tempAdjustment;
    estimated.isEstimated = true;
    estimated.cacheAge = Math.round(hoursSinceCache);
    
    return estimated;
}

// UI State Management
function toggleAuthMode(isLogin) {
    if (isLogin) {
        authTitle.textContent = 'Welcome Back';
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        toggleAuth.innerHTML = `Don't have an account? <span class="font-bold text-blue-400">Sign Up</span>`;
    } else {
        authTitle.textContent = 'Create Your Account';
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        toggleAuth.innerHTML = `Already have an account? <span class="font-bold text-blue-400">Login</span>`;
    }
    authStatus.textContent = '';
}

function updateAppState() {
    if (isLoggedIn) {
        authContainer.classList.add('hidden');
        weatherAppContainer.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userDisplay.textContent = `Welcome, ${userName}!`;
        
        // Initialize location features
        initializeLocationFeatures();
        fetchWeatherData();
    } else {
        authContainer.classList.remove('hidden');
        weatherAppContainer.classList.add('hidden');
        userInfo.classList.add('hidden');
        currentLocationWidget.classList.add('hidden');
        toggleAuthMode(true);
    }
}

// Authentication Functions
async function handleLogin(e) {
    e.preventDefault();
    const email = loginEmailInput.value.trim();
    const password = document.getElementById('login-password').value.trim();

    authStatus.textContent = 'Logging in...';

    try {
        const response = await fetch(`${AUTH_SERVER_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            userName = data.user.name || email.split('@')[0];
            userToken = data.token;
            isLoggedIn = true;
            authStatus.textContent = 'Login successful!';
            updateAppState();
        } else {
            authStatus.textContent = data.message || 'Login failed. Please check your credentials.';
        }
    } catch (error) {
        console.error("Login Fetch Error:", error);
        authStatus.textContent = 'Login failed. Could not connect to the authentication server (check port 3000).';
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    
    authStatus.textContent = 'Creating account...';

    try {
        const response = await fetch(`${AUTH_SERVER_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
            authStatus.textContent = `Success! Account created for ${name}. Please log in.`;
            loginEmailInput.value = email;
            toggleAuthMode(true);
        } else {
            authStatus.textContent = data.message || 'Account creation failed.';
        }
    } catch (error) {
        console.error("Signup Fetch Error:", error);
        authStatus.textContent = 'Account creation failed. Could not connect to the authentication server.';
    }
}

function handleLogout() {
    isLoggedIn = false;
    userName = '';
    userToken = null;
    updateAppState();
    authStatus.textContent = 'Logged out successfully.';
    weatherDisplay.innerHTML = '';
    if (weatherMap) {
        weatherMap.remove();
        weatherMap = null;
    }
    mapContainer.classList.add('hidden');
}

// Location Features
function initializeLocationFeatures() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                fetchCurrentLocationWeather();
            },
            (error) => {
                console.error('Geolocation error:', error);
                locationName.textContent = 'Location unavailable';
                currentLocationWidget.classList.remove('hidden');
            }
        );
    } else {
        locationName.textContent = 'Location not supported';
        currentLocationWidget.classList.remove('hidden');
    }
}

async function fetchCurrentLocationWeather() {
    if (!userLocation) return;
    
    currentLocationWidget.classList.remove('hidden');
    locationName.textContent = 'Loading...';
    
    try {
        const url = `${PROXY_SERVER_URL}/api/weather-coords?lat=${userLocation.lat}&lon=${userLocation.lon}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch location weather');
        }
        
        const data = await response.json();
        locationName.textContent = data.city.split(',')[0];
        locationTemp.textContent = `${data.current.temp}°C`;
        locationIcon.textContent = mapIcon(data.current.icon);
        
        // Cache location weather
        localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
        
    } catch (error) {
        console.error('Location weather error:', error);
        
        // Try to load from cache
        try {
            const cached = localStorage.getItem(LOCATION_CACHE_KEY);
            if (cached) {
                const cacheData = JSON.parse(cached);
                locationName.textContent = cacheData.data.city.split(',')[0] + ' (cached)';
                locationTemp.textContent = `${cacheData.data.current.temp}°C`;
                locationIcon.textContent = mapIcon(cacheData.data.current.icon);
            } else {
                locationName.textContent = 'Location weather unavailable';
            }
        } catch (e) {
            locationName.textContent = 'Location weather unavailable';
        }
    }
}

// Click handler for location widget
currentLocationWidget.addEventListener('click', () => {
    if (userLocation) {
        fetchCurrentLocationWeather();
    }
});

// Weather Map Functions
function initializeWeatherMap(lat, lon, cityName) {
    if (weatherMap) {
        weatherMap.remove();
    }
    
    weatherMap = L.map('weather-map').setView([lat, lon], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(weatherMap);
    
    // Add weather overlay from OpenWeatherMap
    const apiKey = '558718855e44490ebdf7268849113f09';
    L.tileLayer(`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
        attribution: 'Weather data © OpenWeatherMap',
        opacity: 0.6
    }).addTo(weatherMap);
    
    // Add marker for the city
    const marker = L.marker([lat, lon]).addTo(weatherMap);
    marker.bindPopup(`<b>${cityName}</b>`).openPopup();
    
    // Add clouds layer
    L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
        attribution: 'Weather data © OpenWeatherMap',
        opacity: 0.4
    }).addTo(weatherMap);
    
    // Add precipitation layer
    L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`, {
        attribution: 'Weather data © OpenWeatherMap',
        opacity: 0.5
    }).addTo(weatherMap);
}

async function showWeatherMap() {
    const city = currentCity || cityInput.value.trim();
    
    if (!city) {
        alert('Please enter a city name first');
        return;
    }
    
    try {
        // Fetch coordinates for the city
        const url = `${PROXY_SERVER_URL}/api/weather?city=${city}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch city data');
        }
        
        const data = await response.json();
        
        // Get coordinates from the response
        const coordsUrl = `${PROXY_SERVER_URL}/api/coordinates?city=${city}`;
        const coordsResponse = await fetch(coordsUrl);
        const coordsData = await coordsResponse.json();
        
        mapContainer.classList.remove('hidden');
        
        setTimeout(() => {
            initializeWeatherMap(coordsData.lat, coordsData.lon, data.city);
        }, 100);
        
    } catch (error) {
        console.error('Map error:', error);
        alert('Failed to load map. Please try again.');
    }
}

// Weather Fetch Functions
function fetchWeatherData() {
    if (!isLoggedIn) {
        renderError("You must be logged in to view the forecast.");
        return;
    }

    currentCity = cityInput.value.trim();
    if (!currentCity) {
        renderError("Please enter a city name.");
        return;
    }

    fetchButton.disabled = true;
    fetchButton.textContent = 'Loading...';
    renderLoading();

    // Check if offline
    if (isOffline) {
        const estimated = estimateWeatherFromCache(currentCity);
        if (estimated) {
            renderWeather(estimated);
            fetchButton.disabled = false;
            fetchButton.textContent = 'Get Forecast';
            return;
        } else {
            renderError("No cached data available for offline mode.");
            fetchButton.disabled = false;
            fetchButton.textContent = 'Get Forecast';
            return;
        }
    }

    const proxyApiUrl = `${PROXY_SERVER_URL}/api/weather?city=${currentCity}`;

    fetch(proxyApiUrl)
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || `Proxy server status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            cacheWeatherData(currentCity, data);
            renderWeather(data);
        })
        .catch(error => {
            console.error("Weather Fetch Error:", error);
            
            // Try to use cached/estimated data
            const estimated = estimateWeatherFromCache(currentCity);
            if (estimated) {
                renderWeather(estimated);
            } else {
                renderError(`Failed to fetch weather data. Reason: ${error.message}.`);
            }
        })
        .finally(() => {
            fetchButton.disabled = false;
            fetchButton.textContent = 'Get Forecast';
        });
}

function renderLoading() {
    weatherDisplay.innerHTML = `
        <div class="text-center py-12 text-gray-400">
            <svg class="animate-spin h-8 w-8 text-blue-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="mt-4">Fetching forecast...</p>
        </div>
    `;
}

function renderError(message) {
    weatherDisplay.innerHTML = `
        <div class="weather-card p-6 rounded-xl text-center border-l-4 border-red-500 bg-red-50 text-red-300">
            <p class="font-bold">Error Retrieving Data</p>
            <p class="text-sm mt-2">${message}</p>
        </div>
    `;
    fetchButton.disabled = false;
    fetchButton.textContent = 'Get Forecast';
}

function renderWeather(data) {
    const current = data.current;
    const forecast = data.forecast;
    
    const estimatedBadge = data.isEstimated 
        ? `<span class="text-xs bg-yellow-600 text-white px-2 py-1 rounded">Estimated (${data.cacheAge}h old)</span>` 
        : '';

    const currentHtml = `
        <div class="weather-card rounded-xl p-8 mb-8 text-white border-l-8 border-blue-500">
            <div class="flex justify-between items-start mb-2">
                <h2 class="text-3xl font-bold">${data.city}</h2>
                ${estimatedBadge}
            </div>
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center">
                    <span class="text-6xl mr-4">${mapIcon(current.icon)}</span>
                    <div>
                        <p class="text-6xl font-extrabold">${current.temp}°</p>
                        <p class="text-xl text-gray-400">${current.description}</p>
                    </div>
                </div>
                <div class="text-right text-gray-300 space-y-1">
                    <p>Feels like: <span class="font-semibold">${current.feelsLike}°C</span></p>
                    <p>Humidity: <span class="font-semibold">${current.humidity}%</span></p>
                    <p>Wind: <span class="font-semibold">${current.windSpeed} km/h</span></p>
                </div>
            </div>
        </div>
    `;

    const forecastHtml = `
        <div class="weather-card rounded-xl p-6">
            <h3 class="text-xl font-semibold text-white mb-4 border-b border-gray-700 pb-2">5-Day Forecast</h3>
            <div class="grid grid-cols-5 gap-4">
                ${forecast.map(day => `
                    <div class="text-center p-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors">
                        <p class="text-sm font-semibold text-gray-200 mb-2">${day.day}</p>
                        <span class="text-3xl block mb-2">${mapIcon(day.icon)}</span>
                        <p class="text-sm font-bold text-white">${day.max}°</p>
                        <p class="text-xs text-gray-400">${day.min}°</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    weatherDisplay.innerHTML = currentHtml + forecastHtml;
}

// Event Listeners
loginForm.addEventListener('submit', handleLogin);
signupForm.addEventListener('submit', handleSignup);
logoutButton.addEventListener('click', handleLogout);
toggleAuth.addEventListener('click', () => {
    const isLoginVisible = !loginForm.classList.contains('hidden');
    toggleAuthMode(!isLoginVisible);
});

fetchButton.addEventListener('click', fetchWeatherData);
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchWeatherData();
    }
});

showMapButton.addEventListener('click', showWeatherMap);
closeMapButton.addEventListener('click', () => {
    mapContainer.classList.add('hidden');
});

// Initialize
updateAppState();