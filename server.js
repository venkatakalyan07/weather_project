const express = require("express");
const path = require("node:path");

const app = express();
const port = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, "public");
const upstreamTimeoutMs = 10000;

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

class WeatherApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

app.get("/api/weather", async (req, res) => {
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  if (!city) {
    return res.status(400).json({ error: "Please provide a city name." });
  }

  try {
    const location = await findCity(city);
    const current = await getCurrentWeather(location.latitude, location.longitude);

    const requiredValues = [
      current.temperature_2m,
      current.relative_humidity_2m,
      current.apparent_temperature,
      current.weather_code,
      current.wind_speed_10m,
    ];
    if (!requiredValues.every(Number.isFinite) || typeof current.time !== "string") {
      throw new WeatherApiError(
        "The weather service returned incomplete conditions. Please try again.",
        502
      );
    }

    return res.json({
      city: location.name,
      country: location.country || "",
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      weatherCode: current.weather_code,
      description: weatherDescriptions[current.weather_code] || "Unknown conditions",
      isDay: current.is_day === 1,
      time: current.time,
    });
  } catch (error) {
    if (error instanceof WeatherApiError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("Unexpected weather endpoint error:", error);
    return res.status(500).json({
      error: "Unable to retrieve weather right now. Please try again later.",
    });
  }
});

app.use(express.static(publicDirectory));

async function findCity(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
  });

  const data = await fetchExternalJson(url);
  const location = data.results?.[0];
  if (!location) {
    throw new WeatherApiError(
      `We couldn't find "${city}". Check the spelling and try again.`,
      404
    );
  }

  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    throw new WeatherApiError("The location service returned invalid coordinates.", 502);
  }

  return location;
}

async function getCurrentWeather(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    timezone: "auto",
    wind_speed_unit: "kmh",
  });

  const data = await fetchExternalJson(url);
  if (!data.current) {
    throw new WeatherApiError(
      "The weather service did not return current conditions. Please try again.",
      502
    );
  }

  return data.current;
}

async function fetchExternalJson(url) {
  let response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(upstreamTimeoutMs),
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new WeatherApiError(
        "The weather service took too long to respond. Please try again.",
        504
      );
    }

    throw new WeatherApiError(
      "Unable to reach the weather service. Please try again later.",
      502
    );
  }

  if (!response.ok) {
    throw new WeatherApiError(
      "The weather service is temporarily unavailable. Please try again later.",
      502
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new WeatherApiError(
      "The weather service returned an unreadable response. Please try again later.",
      502
    );
  }

  if (data.error) {
    throw new WeatherApiError(
      "The weather service could not process this request. Please try again later.",
      502
    );
  }

  return data;
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Weather app is running at http://localhost:${port}`);
});