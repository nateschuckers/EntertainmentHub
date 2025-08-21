exports.handler = async function(event, context) {
  const apiKey = process.env.TMDB_API_KEY;
  const endpoint = event.queryStringParameters.endpoint;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key is not set on the server." }) };
  }
  if (!endpoint) {
    return { statusCode: 400, body: JSON.stringify({ error: "No API endpoint provided." }) };
  }
  const url = `https://api.themoviedb.org/3/${endpoint}&api_key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch data from TMDb." }) };
  }
};