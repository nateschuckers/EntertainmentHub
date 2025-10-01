async function apiFetch(endpoint) {
    const url = `/.netlify/functions/tmdb?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
    }
    return response.json();
}

export { apiFetch };

