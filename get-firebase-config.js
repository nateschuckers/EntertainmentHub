/**
 * Netlify Function to securely provide Firebase configuration to the front-end.
 * It reads the environment variables set in the Netlify UI and returns them as a JSON object.
 */
exports.handler = async function(event, context) {
  try {
    const firebaseConfig = {
  apiKey: "AIzaSyDd6yc1Y_0TdJjR1z3pvaYbkSJ-ToJVdWY",
  authDomain: "entertainment-hub-12e9c.firebaseapp.com",
  projectId: "entertainment-hub-12e9c",
  storageBucket: "entertainment-hub-12e9c.firebasestorage.app",
  messagingSenderId: "851340832325",
  appId: "1:851340832325:web:ca9a9b98864be89c8d3d2c"
    };

    // Validate that all required environment variables are present
    for (const key in firebaseConfig) {
      if (!firebaseConfig[key]) {
        // This will show a clear error in the function logs if a variable is missing
        console.error(`Missing environment variable for Firebase config: ${key}`);
        throw new Error(`Configuration error: Missing required environment variable ${key}.`);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firebaseConfig),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

