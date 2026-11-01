const form = document.querySelector("#weather-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const loadingMessage = document.querySelector("#loading-message");
const errorMessage = document.querySelector("#error-message");
const weatherResults = document.querySelector("#weather-results");

const weatherFields = {
  city: document.querySelector("#weather-city"),
  country: document.querySelector("#weather-country"),
  temperature: document.querySelector("#temperature"),
  condition: document.querySelector("#weather-condition"),
  humidity: document.querySelector("#humidity"),
  windSpeed: document.querySelector("#wind-speed"),
  feelsLike: document.querySelector("#feels-like"),
  icon: document.querySelector("#weather-icon"),
};

form.addEventListener("submit", handleSearch);

async function handleSearch(event) {
  event.preventDefault();

  const city = cityInput.value.trim();
  if (!city) {
    weatherResults.hidden = true;
    showError("Please enter a city name.");
    cityInput.focus();
    return;
  }

  setLoading(true);
  clearMessages();
  weatherResults.hidden = true;

  try {
    const weather = await getWeather(city);
    displayWeather(weather);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

async function getWeather(city) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(
      `/api/weather?city=${encodeURIComponent(city)}`,
      { signal: controller.signal }
    );

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response. Please try again.");
    }

    if (!response.ok) {
      throw new Error(data.error || getStatusMessage(response.status));
    }

    return data;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The request took too long. Please try again.");
    }
    if (error instanceof TypeError) {
      throw new Error("Unable to reach the server. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getStatusMessage(status) {
  if (status === 400) {
    return "Please enter a valid city name.";
  }
  if (status === 404) {
    return "We couldn't find that city. Check the spelling and try again.";
  }
  if (status === 500) {
    return "The server couldn't retrieve the weather. Please try again later.";
  }
  if (status === 502 || status === 504) {
    return "The weather service is temporarily unavailable. Please try again later.";
  }
  return "Something went wrong while getting the weather. Please try again.";
}

function displayWeather(data) {
  const values = [
    data.temperature,
    data.feelsLike,
    data.humidity,
    data.windSpeed,
    data.weatherCode,
  ];
  if (
    typeof data.city !== "string" ||
    !values.every(Number.isFinite) ||
    typeof data.description !== "string"
  ) {
    throw new Error("The server returned incomplete weather data. Please try again.");
  }

  weatherFields.city.textContent = data.city;
  weatherFields.country.textContent = data.country || "";
  weatherFields.temperature.textContent = data.temperature.toFixed(1);
  weatherFields.condition.textContent = data.description;
  weatherFields.humidity.textContent = String(data.humidity);
  weatherFields.windSpeed.textContent = data.windSpeed.toFixed(1);
  weatherFields.feelsLike.textContent = data.feelsLike.toFixed(1);
  weatherFields.icon.textContent = getWeatherIcon(data.weatherCode, data.isDay);
  weatherResults.hidden = false;
}

function getWeatherIcon(code, isDay) {
  if (code === 0) {
    return isDay ? "☀️" : "🌙";
  }
  if ([1, 2].includes(code)) {
    return isDay ? "🌤️" : "☁️";
  }
  if ([3, 45, 48].includes(code)) {
    return "☁️";
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "❄️";
  }
  if ([95, 96, 99].includes(code)) {
    return "⛈️";
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "🌧️";
  }
  return "🌦️";
}

function setLoading(isLoading) {
  loadingMessage.hidden = !isLoading;
  searchButton.disabled = isLoading;
  cityInput.disabled = isLoading;
  searchButton.textContent = isLoading ? "Searching…" : "Search Weather";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearMessages() {
  errorMessage.textContent = "";
  errorMessage.hidden = true;
}
