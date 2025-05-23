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
    const { station, days = 3 } = req.query;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(days));
    const startDate = new Date();
    
    const formatDate = (date) => {
      return date.getFullYear() + 
             ('0' + (date.getMonth() + 1)).slice(-2) + 
             ('0' + date.getDate()).slice(-2);
    };
    
    const response = await fetch(
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&station=${station}&product=predictions&datum=navd&units=english&time_zone=lst_ldt&application=web_services&format=json`
    );
    
    if (!response.ok) {
      throw new Error(`Tides API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    res.status(200).json({
      success: true,
      data: data.predictions || []
    });
    
  } catch (error) {
    console.error('Tides API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}