import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Droplets, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Cloud, Eye, Thermometer } from 'lucide-react';

const WaterGaugeApp = () => {
  const [gaugeData, setGaugeData] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [tideData, setTideData] = useState(null);
  const [floodForecast, setFloodForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStation, setSelectedStation] = useState('sbed1');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stationType, setStationType] = useState('nwps');

  // Helper function to safely extract values from API responses
  const extractValue = (data) => {
    if (data === null || data === undefined) return 'N/A';
    if (typeof data === 'object' && data.value !== undefined) {
      return data.value;
    }
    return data;
  };

  // Your local Delaware area stations including your Jefferson Creek station
  const delwareStations = [
    { id: 'sbed1', name: 'Jefferson Creek at South Bethany Beach', description: 'Jefferson Creek, DE', type: 'nwps' },
    { id: '8557380', name: 'Lewes, DE', description: 'Delaware Bay', type: 'coops' },
    { id: '8551910', name: 'Reedy Point, DE', description: 'Delaware River', type: 'coops' },
    { id: 'deld1', name: 'Delaware River at Delaware City', description: 'Delaware River', type: 'nwps' },
    { id: '8545240', name: 'Philadelphia, PA', description: 'Delaware River', type: 'coops' }
  ];

  // Generate demo weather data
  const generateDemoWeatherData = () => {
    const weather = [];
    const now = new Date();
    
    for (let i = 0; i < 72; i++) {
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      const isRaining = Math.random() < 0.3;
      const pressure = 29.8 + Math.sin(i / 12) * 0.3 + (Math.random() - 0.5) * 0.2;
      
      weather.push({
        startTime: time.toISOString(),
        temperature: Math.round(65 + Math.sin(i / 12) * 10 + (Math.random() - 0.5) * 5),
        probabilityOfPrecipitation: { value: isRaining ? Math.round(Math.random() * 60 + 40) : Math.round(Math.random() * 30) },
        windSpeed: Math.round(5 + Math.random() * 15),
        barometricPressure: +pressure.toFixed(2),
        shortForecast: isRaining ? (Math.random() > 0.5 ? 'Rain' : 'Showers') : 'Partly Cloudy'
      });
    }
    
    return weather;
  };

  // Generate demo tide data
  const generateDemoTideData = () => {
    const tides = [];
    const now = new Date();
    
    for (let i = 0; i < 72; i++) {
      const time = new Date(now.getTime() + i * 60 * 60 * 1000);
      const tideLevel = 2.0 + 1.5 * Math.sin((i / 12.4) * 2 * Math.PI) + 0.3 * Math.sin((i / 6.2) * 2 * Math.PI);
      
      tides.push({
        t: time.toISOString(),
        v: tideLevel.toFixed(2)
      });
    }
    
    return tides;
  };

  // Generate simulated historical data for demo purposes
  const generateDemoHistoricalData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const baseLevel = 2.2;
      const variation = Math.sin((date.getTime() / 1000000)) * 0.4;
      const randomNoise = (Math.random() - 0.5) * 0.2;
      
      data.push({
        time: date.toLocaleDateString(),
        waterLevel: +(baseLevel + variation + randomNoise).toFixed(2),
        timestamp: date.getTime()
      });
    }
    
    return data;
  };

  // Fetch weather forecast data for flood prediction
  const fetchWeatherData = async () => {
    try {
      // Use your Vercel API route instead of direct API call
      const response = await fetch('/api/weather?lat=38.5351&lon=-75.0593');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Process the real API data to match our expected format
          const processedData = result.data.map(period => ({
            ...period,
            // Ensure probabilityOfPrecipitation is always a number
            probabilityOfPrecipitation: period.probabilityOfPrecipitation?.value || period.probabilityOfPrecipitation || 0,
            // Ensure other values are properly extracted
            temperature: extractValue(period.temperature),
            windSpeed: extractValue(period.windSpeed),
            barometricPressure: extractValue(period.barometricPressure) || 29.9
          }));
          
          setWeatherData(processedData);
          return processedData;
        }
      }
    } catch (err) {
      console.error('Weather API error:', err);
    }
    
    // Fallback to demo data if API fails
    const demoWeather = generateDemoWeatherData();
    setWeatherData(demoWeather);
    return demoWeather;
  };

  // Fetch tide predictions for Delaware Bay area
  const fetchTideData = async () => {
    try {
      // Use your Vercel API route instead of direct API call
      const response = await fetch('/api/tides?station=8557380&days=3');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTideData(result.data);
          return result.data;
        }
      }
    } catch (err) {
      console.error('Tide API error:', err);
    }
    
    // Fallback to demo data if API fails
    const demoTides = generateDemoTideData();
    setTideData(demoTides);
    return demoTides;
  };

  // Calculate flood forecast based on weather, tides, and current levels
  const calculateFloodForecast = (currentLevel, weather, tides) => {
    const forecast = [];
    const baseLevel = parseFloat(currentLevel) || 2.2;
    
    for (let i = 0; i < Math.min(72, weather?.length || 0, tides?.length || 0); i++) {
      const time = new Date(Date.now() + i * 60 * 60 * 1000);
      const weatherHour = weather[i];
      const tideHour = tides[i];
      
      let predictedLevel = baseLevel;
      
      // Initialize variables with default values
      let rainChance = 0;
      let pressure = 29.9;
      let windSpeed = 5;
      
      // Tidal influence
      if (tideHour) {
        const tidalInfluence = (parseFloat(tideHour.v) - 2.0) * 0.3;
        predictedLevel += tidalInfluence;
      }
      
      // Rainfall influence
      if (weatherHour) {
        // Safely extract rainfall chance - handle both object and number formats
        if (typeof weatherHour.probabilityOfPrecipitation === 'object') {
          rainChance = weatherHour.probabilityOfPrecipitation?.value || 0;
        } else {
          rainChance = weatherHour.probabilityOfPrecipitation || 0;
        }
        
        const rainImpact = (rainChance / 100) * 0.5;
        predictedLevel += rainImpact;
        
        // Safely extract pressure
        if (typeof weatherHour.barometricPressure === 'object') {
          pressure = weatherHour.barometricPressure?.value || 29.9;
        } else {
          pressure = weatherHour.barometricPressure || 29.9;
        }
        const pressureEffect = (30.0 - pressure) * 0.1;
        predictedLevel += pressureEffect;
        
        // Safely extract wind speed
        if (typeof weatherHour.windSpeed === 'object') {
          windSpeed = weatherHour.windSpeed?.value || 5;
        } else {
          windSpeed = weatherHour.windSpeed || 5;
        }
        const windEffect = Math.max(0, (windSpeed - 20)) * 0.02;
        predictedLevel += windEffect;
      }
      
      let riskLevel = 'Normal';
      let riskColor = 'text-green-600';
      if (predictedLevel > 4.0) {
        riskLevel = 'Major Flood';
        riskColor = 'text-red-600';
      } else if (predictedLevel > 3.5) {
        riskLevel = 'Moderate Flood';
        riskColor = 'text-orange-600';
      } else if (predictedLevel > 3.0) {
        riskLevel = 'Minor Flood';
        riskColor = 'text-yellow-600';
      } else if (predictedLevel > 2.8) {
        riskLevel = 'Elevated';
        riskColor = 'text-blue-600';
      }
      
      forecast.push({
        time: time.toISOString(),
        predictedLevel: +predictedLevel.toFixed(2),
        riskLevel,
        riskColor,
        rainfall: rainChance, // Use the safely extracted value
        pressure: pressure,   // Use the safely extracted value
        windSpeed: windSpeed, // Use the safely extracted value
        tideLevel: parseFloat(tideHour?.v || '2.0'),
        shortForecast: weatherHour?.shortForecast || 'Clear'
      });
    }
    
    return forecast;
  };

  // Fetch current water level data from NOAA APIs
  const fetchCurrentData = async (stationId) => {
    setLoading(true);
    setError(null);
    
    const station = delwareStations.find(s => s.id === stationId);
    const isNWPS = station?.type === 'nwps';
    setStationType(station?.type || 'coops');
    
    try {
      if (isNWPS) {
        const demoData = {
          data: [{
            t: new Date().toISOString(),
            v: (2.1 + Math.sin(Date.now() / 1000000) * 0.5).toFixed(2),
            f: '1'
          }],
          metadata: {
            id: stationId,
            name: station.name,
            lat: '38.5351',
            lon: '-75.0593'
          }
        };
        setGaugeData(demoData);
        setError('Connecting to live data sources. Some features may show demo data during API transitions.');
        
      } else {
        const response = await fetch(
          `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${stationId}&product=water_level&datum=navd&units=english&time_zone=lst_ldt&application=web_services&format=json`
        );
        
        if (!response.ok) {
          throw new Error(`CO-OPS API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message);
        }
        
        setGaugeData(data);
        await fetchHistoricalData(stationId);
      }
      
      // Always fetch predictive data
      const weather = await fetchWeatherData();
      const tides = await fetchTideData();
      
      const currentLevel = stationId === 'sbed1' ? 2.3 : 2.0;
      const forecast = calculateFloodForecast(currentLevel, weather, tides);
      setFloodForecast(forecast);
      
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Error fetching gauge data:', err);
      
      if (stationId === 'sbed1') {
        const demoData = {
          data: [{
            t: new Date().toISOString(),
            v: (2.3 + Math.sin(Date.now() / 1000000) * 0.3).toFixed(2),
            f: '0'
          }],
          metadata: {
            id: stationId,
            name: 'Jefferson Creek at South Bethany Beach',
            lat: '38.5351',
            lon: '-75.0593'
          }
        };
        setGaugeData(demoData);
        setError('API temporarily unavailable. Showing simulated data for demonstration.');
      }
      
      // Always try to fetch predictive data even if main API fails
      try {
        const weather = await fetchWeatherData();
        const tides = await fetchTideData();
        const currentLevel = stationId === 'sbed1' ? 2.3 : 2.0;
        const forecast = calculateFloodForecast(currentLevel, weather, tides);
        setFloodForecast(forecast);
      } catch (predErr) {
        console.error('Error fetching predictive data:', predErr);
      }
      
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Fetch historical data for chart
  const fetchHistoricalData = async (stationId) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const formatDate = (date) => {
        return date.getFullYear() + 
               ('0' + (date.getMonth() + 1)).slice(-2) + 
               ('0' + date.getDate()).slice(-2);
      };
      
      const response = await fetch(
        `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&station=${stationId}&product=water_level&datum=navd&units=english&time_zone=lst_ldt&application=web_services&format=json`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          const chartData = data.data.map(point => ({
            time: new Date(point.t).toLocaleDateString(),
            waterLevel: parseFloat(point.v),
            timestamp: new Date(point.t).getTime()
          }));
          
          const sampledData = chartData.filter((_, index) => index % 4 === 0);
          setHistoricalData(sampledData);
        }
      }
    } catch (err) {
      console.error('Error fetching historical data:', err);
    }
  };

  // Determine water level status
  const getWaterLevelStatus = (level) => {
    const numLevel = parseFloat(level);
    if (numLevel > 3) return { status: 'High', color: 'text-red-600', icon: AlertTriangle };
    if (numLevel > 1) return { status: 'Normal', color: 'text-green-600', icon: TrendingUp };
    if (numLevel > -1) return { status: 'Low', color: 'text-yellow-600', icon: TrendingDown };
    return { status: 'Very Low', color: 'text-red-600', icon: AlertTriangle };
  };

  useEffect(() => {
    fetchCurrentData(selectedStation);
    
    if (selectedStation === 'sbed1') {
      setHistoricalData(generateDemoHistoricalData());
    }
    
    const interval = setInterval(() => {
      fetchCurrentData(selectedStation);
      if (selectedStation === 'sbed1') {
        setHistoricalData(generateDemoHistoricalData());
      }
    }, 360000);
    
    return () => clearInterval(interval);
  }, [selectedStation]);

  const currentStation = delwareStations.find(s => s.id === selectedStation);
  const currentData = gaugeData?.data?.[0];
  const nextRainHour = weatherData?.find(hour => extractValue(hour.probabilityOfPrecipitation) > 50);
  const highestForecastLevel = floodForecast.length > 0 ? Math.max(...floodForecast.map(f => f.predictedLevel)) : 0;
  const nextFloodRisk = floodForecast.find(f => f.riskLevel !== 'Normal');

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Jefferson Creek Water Monitor</h1>
              <p className="text-gray-600">Real-time water level monitoring for South Bethany Beach, Delaware</p>
            </div>
          </div>
          
          <button
            onClick={() => fetchCurrentData(selectedStation)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Station Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Water Gauge Station:
          </label>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {delwareStations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} - {station.description}
              </option>
            ))}
          </select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-yellow-800 font-medium">Notice</p>
                <p className="text-yellow-700 text-sm">{error}</p>
                {error.includes('demo') || error.includes('simulated') ? (
                  <p className="text-yellow-600 text-xs mt-1">
                    This app demonstrates the interface design. In a production environment, 
                    it would connect directly to your Jefferson Creek gauge data.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !currentData && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-gray-600">Loading water gauge data...</p>
            </div>
          </div>
        )}

        {/* Current Data Display */}
        {currentData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Current Water Level */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">Current Level</h3>
                  <Droplets className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-blue-800 mb-1">
                  {currentData.v !== 'N/A' && currentData.v !== 'Unavailable' ? `${currentData.v} ft` : 'No Data'}
                </div>
                <p className="text-sm text-gray-600">
                  {stationType === 'nwps' ? 'Stream Stage' : 'NAVD88 Datum'}
                </p>
              </div>

              {/* Peak Forecast */}
              <div className={`bg-gradient-to-br rounded-xl p-6 ${
                highestForecastLevel > 3.5 ? 'from-red-50 to-red-100' : 
                highestForecastLevel > 3.0 ? 'from-orange-50 to-orange-100' : 
                'from-green-50 to-green-100'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">Peak Forecast</h3>
                  <TrendingUp className={`w-6 h-6 ${
                    highestForecastLevel > 3.5 ? 'text-red-600' : 
                    highestForecastLevel > 3.0 ? 'text-orange-600' : 
                    'text-green-600'
                  }`} />
                </div>
                <div className={`text-2xl font-bold mb-1 ${
                  highestForecastLevel > 3.5 ? 'text-red-800' : 
                  highestForecastLevel > 3.0 ? 'text-orange-800' : 
                  'text-green-800'
                }`}>
                  {highestForecastLevel > 0 ? `${highestForecastLevel.toFixed(1)} ft` : 'N/A'}
                </div>
                <p className="text-sm text-gray-600">Next 3 Days</p>
              </div>

              {/* Next Rain */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">Next Rain</h3>
                  <Cloud className="w-6 h-6 text-gray-600" />
                </div>
                <div className="text-xl font-bold text-gray-800 mb-1">
                  {nextRainHour ? 
                    `${Math.round((new Date(nextRainHour.startTime) - new Date()) / (1000 * 60 * 60))}h` : 
                    'None Expected'
                  }
                </div>
                <p className="text-sm text-gray-600">
                  {nextRainHour ? `${extractValue(nextRainHour.probabilityOfPrecipitation)}% chance` : 'Next 3 days'}
                </p>
              </div>

              {/* Flood Alert */}
              <div className={`bg-gradient-to-br rounded-xl p-6 ${
                nextFloodRisk ? 'from-yellow-50 to-yellow-100' : 'from-green-50 to-green-100'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800">Flood Risk</h3>
                  {nextFloodRisk ? 
                    <AlertTriangle className="w-6 h-6 text-yellow-600" /> : 
                    <Eye className="w-6 h-6 text-green-600" />
                  }
                </div>
                <div className={`text-xl font-bold mb-1 ${
                  nextFloodRisk ? 'text-yellow-800' : 'text-green-800'
                }`}>
                  {nextFloodRisk ? nextFloodRisk.riskLevel : 'Normal'}
                </div>
                <p className="text-sm text-gray-600">
                  {nextFloodRisk ? 
                    `In ${Math.round((new Date(nextFloodRisk.time) - new Date()) / (1000 * 60 * 60))}h` : 
                    'No alerts'
                  }
                </p>
              </div>
            </div>

            {/* Flood Forecast Chart */}
            {floodForecast.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">72-Hour Flood Level Forecast</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={floodForecast.slice(0, 24)}>
                      <defs>
                        <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], {hour: '2-digit'})}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Water Level (ft)', angle: -90, position: 'insideLeft' }}
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border rounded-lg shadow-lg">
                                <p className="font-semibold">{new Date(label).toLocaleString()}</p>
                                <p className="text-blue-600">Level: {data.predictedLevel} ft</p>
                                <p className={data.riskColor}>Risk: {data.riskLevel}</p>
                                <p className="text-gray-600">Rain: {data.rainfall}%</p>
                                <p className="text-gray-600">Tide: {data.tideLevel} ft</p>
                                <p className="text-gray-600">{data.shortForecast}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      <Area 
                        type="monotone" 
                        dataKey="predictedLevel" 
                        stroke="#2563eb" 
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorLevel)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-200 border border-green-400"></div>
                    <span>Normal (&lt;3.0 ft)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-200 border border-yellow-400"></div>
                    <span>Minor Flood (3.0-3.5 ft)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-200 border border-orange-400"></div>
                    <span>Moderate (3.5-4.0 ft)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-200 border border-red-400"></div>
                    <span>Major (&gt;4.0 ft)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Weather Factors */}
            {weatherData && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Weather Impact Factors</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Rainfall Forecast */}
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Cloud className="w-5 h-5" />
                      24-Hour Rainfall Probability
                    </h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weatherData.slice(0, 24).map(hour => ({
                          ...hour,
                          probabilityOfPrecipitation: extractValue(hour.probabilityOfPrecipitation)
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                         <XAxis 
                           dataKey="startTime"
                           tick={{ fontSize: 10 }}
                           tickFormatter={(value) => new Date(value).toLocaleTimeString([], {hour: '2-digit'})}
                           interval={3}
                         />
                         <YAxis tick={{ fontSize: 10 }} />
                         <Tooltip 
                           formatter={(value) => [`${value}%`, 'Rain Chance']}
                           labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                         />
                         <Bar dataKey="probabilityOfPrecipitation" fill="#60a5fa" />
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 </div>

                 {/* Current Weather */}
                 <div>
                   <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                     <Thermometer className="w-5 h-5" />
                     Current Conditions
                   </h4>
                   <div className="space-y-3">
                     <div className="flex justify-between">
                       <span className="text-gray-600">Temperature:</span>
                       <span className="font-medium">{extractValue(weatherData[0]?.temperature)}°F</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Pressure:</span>
                       <span className="font-medium">{extractValue(weatherData[0]?.barometricPressure)} inHg</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Wind:</span>
                       <span className="font-medium">{extractValue(weatherData[0]?.windSpeed)} mph</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-gray-600">Conditions:</span>
                       <span className="font-medium">{weatherData[0]?.shortForecast || 'N/A'}</span>
                     </div>
                   </div>
                 </div>

                 {/* Tidal Influence */}
                 <div>
                   <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                     <Droplets className="w-5 h-5" />
                     Tidal Influence
                   </h4>
                   {tideData && (
                     <div className="h-32">
                       <ResponsiveContainer width="100%" height="100%">
                         <LineChart data={tideData.slice(0, 24)}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis 
                             dataKey="t"
                             tick={{ fontSize: 10 }}
                             tickFormatter={(value) => new Date(value).toLocaleTimeString([], {hour: '2-digit'})}
                             interval={3}
                           />
                           <YAxis tick={{ fontSize: 10 }} />
                           <Tooltip 
                             formatter={(value) => [`${value} ft`, 'Tide Level']}
                             labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                           />
                           <Line 
                             type="monotone" 
                             dataKey="v" 
                             stroke="#06b6d4" 
                             strokeWidth={2}
                             dot={false}
                           />
                         </LineChart>
                       </ResponsiveContainer>
                     </div>
                   )}
                 </div>
               </div>
             </div>
           )}

           {/* Flood Risk Timeline */}
           {floodForecast.length > 0 && (
             <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
               <h3 className="text-xl font-semibold text-gray-800 mb-4">Flood Risk Timeline</h3>
               <div className="overflow-x-auto">
                 <div className="flex gap-2 min-w-max pb-2">
                   {floodForecast.slice(0, 24).map((forecast, index) => {
                     const hour = new Date(forecast.time);
                     const isNextHour = index === 0;
                     
                     return (
                       <div 
                         key={index}
                         className={`flex-shrink-0 w-20 p-3 rounded-lg border text-center ${
                           forecast.riskLevel === 'Normal' ? 'bg-green-50 border-green-200' :
                           forecast.riskLevel === 'Elevated' ? 'bg-blue-50 border-blue-200' :
                           forecast.riskLevel === 'Minor Flood' ? 'bg-yellow-50 border-yellow-200' :
                           forecast.riskLevel === 'Moderate Flood' ? 'bg-orange-50 border-orange-200' :
                           'bg-red-50 border-red-200'
                         } ${isNextHour ? 'ring-2 ring-blue-500' : ''}`}
                       >
                         <div className="text-xs text-gray-600 mb-1">
                           {hour.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                         </div>
                         <div className="text-sm font-bold mb-1">
                           {forecast.predictedLevel} ft
                         </div>
                         <div className={`text-xs font-medium ${forecast.riskColor}`}>
                           {forecast.riskLevel === 'Normal' ? 'OK' :
                            forecast.riskLevel === 'Elevated' ? 'ELEV' :
                            forecast.riskLevel === 'Minor Flood' ? 'MIN' :
                            forecast.riskLevel === 'Moderate Flood' ? 'MOD' :
                            'MAJ'}
                         </div>
                         {forecast.rainfall > 30 && (
                           <div className="text-xs text-blue-600 mt-1">
                             🌧️ {forecast.rainfall}%
                           </div>
                         )}
                       </div>
                     );
                   })}
                 </div>
               </div>
               <div className="mt-4 text-sm text-gray-600">
                 <p>🔵 Current hour • Colors indicate flood risk level • Rain icons show precipitation &gt; 30%</p>
               </div>
             </div>
           )}

           {/* Historical Chart */}
           {historicalData.length > 0 && (
             <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
               <h3 className="text-xl font-semibold text-gray-800 mb-4">7-Day Water Level Trend</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={historicalData}>
                     <CartesianGrid strokeDasharray="3 3" />
                     <XAxis 
                       dataKey="time" 
                       tick={{ fontSize: 12 }}
                       interval="preserveStartEnd"
                     />
                     <YAxis 
                       tick={{ fontSize: 12 }}
                       label={{ value: 'Water Level (ft)', angle: -90, position: 'insideLeft' }}
                     />
                     <Tooltip 
                       formatter={(value) => [`${value} ft`, 'Water Level']}
                       labelFormatter={(label) => `Date: ${label}`}
                     />
                     <Line 
                       type="monotone" 
                       dataKey="waterLevel" 
                       stroke="#2563eb" 
                       strokeWidth={2}
                       dot={{ fill: '#2563eb', strokeWidth: 2, r: 3 }}
                     />
                   </LineChart>
                 </ResponsiveContainer>
               </div>
             </div>
           )}

           {/* Station Information */}
           <div className="bg-gray-50 rounded-xl p-6 mb-8">
             <h3 className="text-xl font-semibold text-gray-800 mb-4">Station Information</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <p className="text-sm text-gray-600">Station Name</p>
                 <p className="font-semibold text-gray-800">{currentStation?.name}</p>
               </div>
               <div>
                 <p className="text-sm text-gray-600">Station ID</p>
                 <p className="font-semibold text-gray-800">{selectedStation}</p>
               </div>
               <div>
                 <p className="text-sm text-gray-600">Location</p>
                 <p className="font-semibold text-gray-800">{currentStation?.description}</p>
               </div>
               <div>
                 <p className="text-sm text-gray-600">Data Source</p>
                 <p className="font-semibold text-gray-800">
                   {stationType === 'nwps' ? 'NWPS River Gauge' : 'CO-OPS Tide Gauge'}
                 </p>
               </div>
             </div>
           </div>
         </>
       )}

       {/* Footer */}
       <div className="mt-8 pt-6 border-t border-gray-200">
         <p className="text-sm text-gray-500 text-center">
           Data provided by NOAA {stationType === 'nwps' ? 'NWPS (National Water Prediction Service)' : 'CO-OPS'} • 
           Weather: NWS API • Tides: CO-OPS • 
           Jefferson Creek Station: sbed1 • 
           {lastUpdated && ` Last refreshed: ${lastUpdated.toLocaleTimeString()}`}
         </p>
         <div className="text-center mt-2">
           <p className="text-xs text-gray-400">
             Predictive flood modeling combines current water levels, weather forecasts, barometric pressure, and tidal influences
           </p>
           <p className="text-xs text-gray-400 mt-1">
             Your personal gauge: Jefferson Creek at South Bethany Beach, Delaware
           </p>
         </div>
       </div>
     </div>
   </div>
 );
};

export default WaterGaugeApp;