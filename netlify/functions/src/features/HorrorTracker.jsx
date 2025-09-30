import React, { useState, useEffect, useCallback } from 'react';
import { doc, setDoc, addDoc, collection, onSnapshot, writeBatch, Timestamp, deleteDoc } from 'firebase/firestore';

// --- Helper for CSV Parsing ---
// A lightweight CSV parser to handle the import functionality without needing a new dependency.
const Papa = (() => {
    function parse(csv, config) {
        config = config || {};
        const header = config.header;
        const newline = config.newline || '\n';
        const lines = csv.trim().split(newline);
        let results = [];
        const headers = header ? lines[0].split(',') : [];

        for (let i = header ? 1 : 0; i < lines.length; i++) {
            if (!lines[i]) continue;
            let values = lines[i].split(',');
            if (header) {
                let obj = {};
                for (let j = 0; j < headers.length; j++) {
                    obj[headers[j].trim()] = values[j] ? values[j].trim() : '';
                }
                results.push(obj);
            } else {
                results.push(values.map(v => v.trim()));
            }
        }
        return { data: results };
    }
    return { parse };
})();


// --- SVG Icons ---
const FilmIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm2 2a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1H6zm5 0a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1h-2zM6 12a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1H6zm5 0a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2z" clipRule="evenodd" /></svg>;
const ListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>;
const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 110 2H3a1 1 0 01-1-1zm5 0a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1zm5 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" /><path d="M2 5a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>;
const SearchIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>;

// --- Reusable Movie Card Component ---
const MovieCard = ({ movie, onAction, actionText, actionIcon }) => (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col">
        <img 
            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/500x750/1f2937/9ca3af?text=No+Image'} 
            alt={`Poster for ${movie.title}`} 
            className="w-full h-auto object-cover"
            onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/500x750/1f2937/9ca3af?text=No+Image'; }}
        />
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="font-bold text-lg text-white mb-2 truncate">{movie.title}</h3>
            <p className="text-gray-400 text-sm mb-2">{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</p>
            <p className="text-gray-300 text-xs flex-grow overflow-y-auto max-h-20">{movie.overview}</p>
            {onAction && (
                <button
                    onClick={() => onAction(movie)}
                    className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors"
                >
                    {actionIcon}
                    {actionText}
                </button>
            )}
        </div>
    </div>
);

// --- Main Horror Tracker Component ---
// This component expects `db` (Firestore instance) and `userId` as props.
export default function HorrorTracker({ db, userId }) {
    const [activeTab, setActiveTab] = useState('watched');
    const [watchedMovies, setWatchedMovies] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (!userId || !db) {
            setLoading(false);
            return;
        };

        setLoading(true);

        const unsubWatched = onSnapshot(collection(db, `users/${userId}/watched`), (snapshot) => {
            const movies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWatchedMovies(movies);
        }, err => {
            console.error("Error fetching watched movies:", err);
            setError("Could not fetch watched movies.");
        });

        const unsubWatchlist = onSnapshot(collection(db, `users/${userId}/watchlist`), (snapshot) => {
            const movies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setWatchlist(movies);
        }, err => {
            console.error("Error fetching watchlist:", err);
            setError("Could not fetch watchlist.");
        });
        
        setLoading(false);

        return () => {
            unsubWatched();
            unsubWatchlist();
        };
    }, [userId, db]);
    
    // --- Firestore & API Handlers ---
    const handleAddToWatchlist = async (movie) => {
        if (!userId || !db) return;
        if (watchlist.some(m => m.tmdb_id === movie.id)) {
             alert(`${movie.title} is already on your watchlist.`);
             return;
        }
        await addDoc(collection(db, `users/${userId}/watchlist`), {
            tmdb_id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            overview: movie.overview,
            added_at: Timestamp.now()
        });
    };

    const handleMoveToWatched = async (movieFromWatchlist) => {
        if (!userId || !db) return;
        const watchDateStr = prompt("When did you watch this? (YYYY-MM-DD)", new Date().toISOString().split('T')[0]);
        if (!watchDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(watchDateStr)) {
            alert("Invalid date format. Please use YYYY-MM-DD.");
            return;
        }
        const watchDate = new Date(watchDateStr);
        
        const batch = writeBatch(db);
        batch.set(doc(collection(db, `users/${userId}/watched`)), {
            // copy all fields except the firestore ID
            tmdb_id: movieFromWatchlist.tmdb_id,
            title: movieFromWatchlist.title,
            poster_path: movieFromWatchlist.poster_path,
            release_date: movieFromWatchlist.release_date,
            overview: movieFromWatchlist.overview,
            watchedDate: Timestamp.fromDate(watchDate),
        });
        batch.delete(doc(db, `users/${userId}/watchlist`, movieFromWatchlist.id));
        await batch.commit();
    };

    const handleImportCsv = async (file) => {
        if (!file || !userId || !db) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const parsed = Papa.parse(event.target.result, { header: true, skipEmptyLines: true });
            if (!parsed.data.length || !parsed.data[0].tmdb_id || !parsed.data[0].watchedDate) {
                 setError("Invalid CSV. Required headers: 'tmdb_id', 'title', 'watchedDate' (YYYY-MM-DD).");
                 return;
            }
            const batch = writeBatch(db);
            parsed.data.forEach(row => {
                if (row.tmdb_id && row.title && row.watchedDate) {
                    batch.set(doc(collection(db, `users/${userId}/watched`)), {
                        tmdb_id: parseInt(row.tmdb_id, 10),
                        title: row.title,
                        watchedDate: Timestamp.fromDate(new Date(row.watchedDate)),
                        poster_path: row.poster_path || null,
                        release_date: row.release_date || null,
                        overview: row.overview || '',
                    });
                }
            });
            await batch.commit();
            alert(`${parsed.data.length} movies imported successfully!`);
        };
        reader.readAsText(file);
    };

    // --- Tab-Specific Components ---
    const WatchedTab = () => {
        const octoberMovies = watchedMovies.filter(m => m.watchedDate.toDate().getMonth() === 9); // October is month 9
        const progress = Math.min((octoberMovies.length / 31) * 100, 100);
        const groupedByDay = octoberMovies.reduce((acc, movie) => {
            const dateStr = movie.watchedDate.toDate().toISOString().split('T')[0];
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(movie);
            return acc;
        }, {});
        const sortedDays = Object.keys(groupedByDay).sort((a,b) => new Date(b) - new Date(a));

        return (
            <div>
                <div className="bg-gray-800 p-4 rounded-lg mb-6 shadow-md">
                    <h2 className="text-xl font-bold text-white mb-2">October Progress</h2>
                    <p className="text-gray-300 mb-4">{octoberMovies.length} of 31 movies watched</p>
                    <div className="w-full bg-gray-700 rounded-full h-4"><div className="bg-red-600 h-4 rounded-full" style={{ width: `${progress}%` }}></div></div>
                </div>
                {sortedDays.map(date => (
                    <div key={date} className="mb-8">
                        <h3 className="text-2xl font-semibold text-red-500 mb-4 border-b-2 border-gray-700 pb-2">
                           Watched on: {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {groupedByDay[date].map(movie => <MovieCard key={movie.id} movie={movie} />)}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const WatchlistTab = () => {
        const [searchTerm, setSearchTerm] = useState('');
        const [searchResults, setSearchResults] = useState([]);
        const [isSearching, setIsSearching] = useState(false);

        const handleSearch = async (e) => {
            e.preventDefault();
            if (!searchTerm) return;
            setIsSearching(true);
            try {
                // This now calls your existing Netlify function
                const response = await fetch(`/.netlify/functions/tmdb?query=${encodeURIComponent(searchTerm)}`);
                if (!response.ok) throw new Error('Search request failed in the network');
                const data = await response.json();
                 if (data.error) throw new Error(data.error);
                setSearchResults(data.results || []);
            } catch (err) {
                console.error("Search Error:", err);
                setError(`Could not perform search: ${err.message}`);
            } finally {
                setIsSearching(false);
            }
        };

        return (
            <div>
                <form onSubmit={handleSearch} className="mb-8 flex">
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search for a horror movie..." className="flex-grow bg-gray-700 text-white p-3 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-red-500"/>
                    <button type="submit" className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-r-lg" disabled={isSearching}>{isSearching ? '...' : <SearchIcon />}</button>
                </form>

                {searchResults.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-2xl font-semibold text-red-500 mb-4">Search Results</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                           {searchResults.map(movie => (<MovieCard key={movie.id} movie={movie} onAction={handleAddToWatchlist} actionText="Add to Watchlist" actionIcon={<ListIcon/>}/>))}
                        </div>
                    </div>
                )}
                
                <h3 className="text-2xl font-semibold text-red-500 mb-4 mt-8 border-t-2 border-gray-700 pt-4">My Watchlist</h3>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {watchlist.map(movie => (<MovieCard key={movie.id} movie={movie} onAction={handleMoveToWatched} actionText="I Watched This!" actionIcon={<FilmIcon />}/>))}
                </div>
            </div>
        );
    };
    
    const MetricsTab = () => {
        const watchCounts = watchedMovies.reduce((acc, movie) => {
            acc[movie.tmdb_id] = (acc[movie.tmdb_id] || 0) + 1;
            return acc;
        }, {});
        const moviesWithCounts = Object.entries(watchCounts).map(([tmdb_id, count]) => {
            return { ...watchedMovies.find(m => m.tmdb_id == tmdb_id), count };
        }).sort((a, b) => b.count - a.count);

        return (
            <div>
                 <h2 className="text-2xl font-semibold text-red-500 mb-4">All-Time Watch Metrics</h2>
                 <div className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <table className="min-w-full">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="text-left py-3 px-4 font-semibold text-white">Movie Title</th>
                                <th className="text-left py-3 px-4 font-semibold text-white">Release Year</th>
                                <th className="text-left py-3 px-4 font-semibold text-white">Total Watches</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {moviesWithCounts.map((movie, index) => (
                                <tr key={movie.tmdb_id} className={`border-t border-gray-700 ${index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-900'}`}>
                                    <td className="py-3 px-4">{movie.title}</td>
                                    <td className="py-3 px-4">{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</td>
                                    <td className="py-3 px-4 text-center font-bold text-red-500">{movie.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        );
    };

    const ImportTab = () => {
        const [file, setFile] = useState(null);
        return (
             <div className="bg-gray-800 p-6 rounded-lg shadow-md">
                 <h2 className="text-xl font-bold text-white mb-4">Import Previous Years</h2>
                 <p className="text-gray-400 mb-4">Upload a CSV file from a Google Sheet. Required columns: <strong>tmdb_id, title, watchedDate (YYYY-MM-DD)</strong>. Optional: poster_path, release_date, overview.</p>
                 <div className="flex items-center space-x-4">
                     <label className="w-full flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-red-700 hover:text-white">
                        <UploadIcon />
                        <span className="ml-2 text-base leading-normal">{file ? file.name : "Select a CSV file"}</span>
                        <input type='file' accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files[0])}/>
                    </label>
                    <button onClick={() => file && handleImportCsv(file)} disabled={!file} className="bg-red-600 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-red-700 transition-colors">Import</button>
                 </div>
            </div>
        )
    }

    // --- Main Render Logic ---
    if (!userId || !db) return <div className="text-center text-gray-400 p-8">Please log in to use the Horror Movie Tracker.</div>;
    if (loading) return <div className="text-center text-gray-300 p-8">Loading movie history...</div>;
    if (error) return <div className="bg-red-900 text-white p-4 rounded-lg text-center">{error}</div>;

    return (
        <div className="bg-black text-white font-sans w-full">
            <header className="bg-gray-900 shadow-lg p-4">
                <div className="container mx-auto">
                    <h1 className="text-3xl font-bold text-red-600 tracking-wider">31 Nights of Horror</h1>
                </div>
            </header>
            
            <nav className="bg-gray-800">
                <div className="container mx-auto flex justify-center items-center space-x-2 md:space-x-4 p-2 text-sm md:text-base">
                    <button onClick={() => setActiveTab('watched')} className={`flex items-center px-4 py-2 rounded-lg transition-colors ${activeTab === 'watched' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><FilmIcon /> Watched</button>
                    <button onClick={() => setActiveTab('watchlist')} className={`flex items-center px-4 py-2 rounded-lg transition-colors ${activeTab === 'watchlist' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><ListIcon /> Watchlist</button>
                    <button onClick={() => setActiveTab('metrics')} className={`flex items-center px-4 py-2 rounded-lg transition-colors ${activeTab === 'metrics' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><ChartIcon /> Metrics</button>
                    <button onClick={() => setActiveTab('import')} className={`flex items-center px-4 py-2 rounded-lg transition-colors ${activeTab === 'import' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><UploadIcon/> Import</button>
                </div>
            </nav>

            <main className="container mx-auto p-4 md:p-6">
                {activeTab === 'watched' && <WatchedTab />}
                {activeTab === 'watchlist' && <WatchlistTab />}
                {activeTab === 'metrics' && <MetricsTab />}
                {activeTab === 'import' && <ImportTab />}
            </main>
        </div>
    );
}
