const state = {
    userName: null,
    theme: 'default',
    activeTab: 'dashboard',
    movieFavoritesView: 'grid',
    tvFavoritesView: 'grid',
    scheduleView: 'agenda',
    dashboardScheduleFilter: 'today',
    isManagingMovies: false,
    isManagingTvs: false,
    currentDate: new Date(),
    subscriptions: [],
    favorites: [],
    scheduledEpisodes: [],
    streamingServices: [
        { id: 528, name: 'AMC+', logo: 'l4g1BT502p1H42a3j1s2lG9nK.jpg' },
        { id: 9, name: 'Amazon Prime', logo: '68MNdJkIZ1hqhGPY3e4L2MSuD1I.jpg' },
        { id: 2, name: 'Apple TV+', logo: '3oTfWy5TAmY5822b53eKwL1xS2z.jpg' },
        { id: 26, name: 'Criterion Channel', logo: 'hFCiMC5st22wV3weHl15qj7N0v1.jpg' },
        { id: 337, name: 'Disney+', logo: '7rwgEs15tFwyR9NPQ5vpzxTj1Ae.jpg' },
        { id: 257, name: 'FuboTV', logo: 'fVjXoJkU1H_2p7iN1b1g2p1fOUl.jpg' },
        { id: 15, name: 'Hulu', logo: 'uJ2w33J32O2h05Iu1CjC7mGn4T.jpg' },
        { id: 1899, name: 'Max', logo: '2a0aJqjuiD5ytdcZz2uISeidU8C.jpg' },
        { id: 8, name: 'Netflix', logo: 'ar4pMQERJSYppG3Qfo9ltM4S2sM.jpg' },
        { id: 531, name: 'Paramount+', logo: 'zBv2r2k2sV3E9s08i0lBq4vIZy.jpg' },
        { id: 387, name: 'Peacock', logo: 'pZGE52Lz17c38gNT7P7y0B0iC4.jpg' },
        { id: 37, name: 'Showtime', logo: 'oF4enqrXXsFRU3aG2I32vpsbQv.jpg' },
        { id: 43, name: 'Starz', logo: 'crFbxgG3JSddT2DAorfOqdfE5s9.jpg' }
    ]
};

function loadDataFromFirestore(data) {
    state.userName = data.userName || null;
    state.subscriptions = data.subscriptions || [];
    state.favorites = data.favorites || [];
    state.theme = data.theme || 'default';
    state.dashboardScheduleFilter = data.dashboardScheduleFilter || 'today';
    if (document.getElementById('userNameInput') && state.userName) {
        document.getElementById('userNameInput').value = state.userName;
    }
}

export { state, loadDataFromFirestore };

