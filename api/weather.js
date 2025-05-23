export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { lat, lon } = req.query;
    
    // Fetch from NOAA Weather API
    const pointResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    
    if (!pointResponse.ok) {
      throw new Error(`Weather API error: ${pointResponse.status}`);
    }
    
    const pointData = await pointResponse.json();
    const forecastResponse = await fetch(pointData.properties.forecastHourly);
    
    if (!forecastResponse.ok) {
      throw new Error(`Forecast API error: ${forecastResponse.status}`);
    }
    
    const forecastData = await forecastResponse.json();
    
    res.status(200).json({
      success: true,
      data: forecastData.properties.periods.slice(0, 72)
    });
    
  } catch (error) {
    console.error('Weather API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}