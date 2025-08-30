// Netlify serverless function to securely fetch data from the TMDB API

exports.handler = async function(event, context) {
  // Access the API key from environment variables for security
  const apiKey = process.env.TMDB_API_KEY;
  const endpoint = event.queryStringParameters.endpoint;

  // Check if the API key is configured on the server
  if (!apiKey) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "API key is not set on the server." }) 
    };
  }

  // Check if an endpoint was provided in the request
  if (!endpoint) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: "No API endpoint provided." }) 
    };
  }

  // BUG FIX: Correctly determine if the URL needs a '?' or '&'
  // Some endpoints passed in might already have query params, others might not.
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `https://api.themoviedb.org/3/${endpoint}${separator}api_key=${apiKey}`;

  try {
    // Fetch data from the TMDB API
    // Note: 'fetch' is available globally in Netlify functions
    const response = await fetch(url);
    const data = await response.json();
    
    // Return the fetched data successfully
    return { 
      statusCode: 200, 
      body: JSON.stringify(data) 
    };
  } catch (error) {
    // Handle any errors during the fetch operation
    console.error("Failed to fetch data from TMDb:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Failed to fetch data from TMDb." }) 
    };
  }
};

