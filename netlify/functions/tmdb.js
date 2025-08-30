// This function acts as a secure proxy to the The Movie Database (TMDb) API.
// It uses an API key stored securely in Netlify's environment variables.

exports.handler = async function(event, context) {
  const apiKey = process.env.TMDB_API_KEY;
  const endpoint = event.queryStringParameters.endpoint;

  // Validate that the necessary API key and endpoint are present.
  if (!apiKey) {
    const errorMsg = "Configuration Error: The TMDB_API_KEY is not set in Netlify's environment variables.";
    console.error(errorMsg);
    return { statusCode: 500, body: JSON.stringify({ error: errorMsg }) };
  }
  if (!endpoint) {
    return { statusCode: 400, body: JSON.stringify({ error: "No API endpoint was provided in the request." }) };
  }

  // Correctly append the API key to the TMDb endpoint URL,
  // whether the endpoint already has query parameters or not.
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `https://api.themoviedb.org/3/${endpoint}${separator}api_key=${apiKey}`;

  // Fetch data from the TMDb API.
  try {
    const response = await fetch(url);
    const data = await response.json();
    return { statusCode: response.status, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Failed to fetch data from TMDb:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch data from the TMDb API." }) };
  }
};

