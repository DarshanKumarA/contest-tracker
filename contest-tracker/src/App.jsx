import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, Bookmark, ExternalLink, Sun, Moon, Trophy, List, LoaderCircle, ChevronDown, CheckCircle, XCircle, Heart, Youtube, LogIn, LogOut, Search } from 'lucide-react';

// Use the environment variable for the API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- Components ---

// Notification Component: Displays success or error messages
const Notification = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 3000); // Increased time to 3 seconds for better readability
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const Icon = type === 'success' ? CheckCircle : XCircle;

    return (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 p-4 rounded-lg text-white shadow-lg animate-fade-in-down ${bgColor}`}>
            <Icon size={20} />
            <p className="text-sm font-medium">{message}</p>
        </div>
    );
};

// AddToCalendarButton Component: Handles adding events to Google Calendar
const AddToCalendarButton = ({ contest, user, showNotification, onAddSuccess, isAdded }) => {
    const [isAdding, setIsAdding] = useState(false);

    const handleCalendarClick = async () => {
        if (!user) {
            showNotification('Please log in to use this feature.', 'error');
            return;
        }

        setIsAdding(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/calendar-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contest }),
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to create event.');
            }
            
            showNotification(result.message || 'Event added to calendar!', 'success');
            // Notify the parent component of the success
            onAddSuccess(contest._id);

        } catch (error) {
            console.error('Error adding to calendar:', error);
            showNotification(error.message || 'Could not add event to calendar.', 'error');
        } finally {
            setIsAdding(false);
        }
    };

    return (
        <button
            onClick={handleCalendarClick}
            disabled={isAdding || isAdded} // Disable if adding or already added
            className={`flex items-center gap-2 text-sm font-medium disabled:opacity-60 transition-colors ${
                isAdded 
                ? 'text-green-600 dark:text-green-400 cursor-default' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
        >
            {isAdded ? <CheckCircle size={16} /> : <Calendar size={16} />}
            {isAdding ? 'Adding...' : isAdded ? 'Added' : 'Add to Google Calendar'}
        </button>
    );
};

// Header Component: Main navigation and controls
const Header = ({ theme, setTheme, isScrolled, setPage, page, user }) => {
    const login = () => { window.location.href = `${API_BASE_URL}/auth/google`; };
    const logout = () => { window.location.href = `${API_BASE_URL}/auth/logout`; };

    return (
      <header className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/60 dark:bg-[#121212]/60 backdrop-blur-2xl border-b border-gray-300/20 dark:border-gray-800/50' : 'bg-white dark:bg-[#121212]'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <div className="flex justify-between items-center h-16">
                <div className="flex items-center gap-8">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 cursor-pointer" onClick={() => setPage('home')}>
                        <Trophy size={24} /> Contest Tracker
                    </h1>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-300">
                        <a href="#" onClick={(e) => { e.preventDefault(); setPage('home'); }} className={`hover:text-gray-900 dark:hover:text-white ${page === 'home' ? 'text-purple-600 dark:text-purple-400' : ''}`}>Home</a>
                        <a href="#" onClick={(e) => { e.preventDefault(); setPage('today'); }} className={`flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white ${page === 'today' ? 'text-purple-600 dark:text-purple-400' : ''}`}><Calendar size={14}/> Today</a>
                        {user && <a href="#" onClick={(e) => { e.preventDefault(); setPage('bookmarks'); }} className={`hover:text-gray-900 dark:hover:text-white ${page === 'bookmarks' ? 'text-purple-600 dark:text-purple-400' : ''}`}>Bookmarks</a>}
                    </nav>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    {user ? (
                        <>
                            <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300">Welcome, {user.displayName.split(' ')[0]}</span>
                            <button onClick={logout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300" title="Logout"><LogOut size={18} /></button>
                        </>
                    ) : (
                        <button onClick={login} className="hidden sm:flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium"><LogIn size={16} /> Login with Google</button>
                    )}
                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </div>
        </div>
      </header>
    );
};

// ContestCard Component: Displays individual contest information
const ContestCard = ({ contest, onSave, user, showNotification, onAddToCalendar, isAddedToCalendar }) => {
  const platformColorMap = {
    'Codeforces': 'bg-rose-500', 'LeetCode': 'bg-amber-500', 'HackerEarth': 'bg-blue-500', 'TopCoder': 'bg-indigo-500',
  };
  const platformColor = platformColorMap[contest.platform] || 'bg-gray-400';

  return (
    <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 rounded-lg p-5 flex flex-col justify-between hover:border-purple-500 transition-all duration-300 shadow-sm dark:shadow-none">
      <div>
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white pr-2">{contest.name}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-xs px-2 py-1 rounded-full text-white font-medium shadow-md ${platformColor}`}>{contest.platform}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 font-medium shadow-md shadow-purple-500/20">{contest.duration}</span>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{contest.displayStartTime}</p>
      </div>
      <div className="flex justify-between items-center mt-auto">
        <div className="flex items-center gap-4 flex-wrap">
            {contest.status === 'Past' && contest.solutionUrl && (<a href={`https://www.youtube.com/watch?v=${contest.solutionUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 font-medium"><Youtube size={16} /> Solution</a>)}
            {contest.status === 'Upcoming' && <AddToCalendarButton contest={contest} user={user} showNotification={showNotification} onAddSuccess={onAddToCalendar} isAdded={isAddedToCalendar} />}
            <a href={contest.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium"><ExternalLink size={16} /> Visit</a>
        </div>
        {user && (<button onClick={() => onSave(contest._id, !contest.saved)} className={`flex items-center gap-2 text-sm px-4 py-2 rounded-md transition-colors font-semibold ${ contest.saved ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'}`}><Bookmark size={16} /> {contest.saved ? 'Saved' : 'Save'}</button>)}
      </div>
    </div>
  );
};

// CustomSelect Component: Dropdown for platform filtering
const CustomSelect = ({ options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => { if (selectRef.current && !selectRef.current.contains(event.target)) { setIsOpen(false); } };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (option) => { onChange(option); setIsOpen(false); };
    const selectedOption = options.find(opt => opt.value === selected);

    return (
        <div className="relative w-full sm:w-48" ref={selectRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white text-sm rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5 text-left flex justify-between items-center">
                <span className={selectedOption?.color || ''}>{selectedOption?.label}</span>
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    {options.map(option => (
                        <div key={option.value} onClick={() => handleSelect(option)} className={`p-2.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 ${option.color || ''}`}>
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Footer Component: Site footer
const Footer = () => (
    <footer className="w-full py-6 mt-10 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p className="flex items-center justify-center gap-1.5">Contest Tracker © 2025 | Made with <Heart size={14} className="text-red-500" /> by Darshan</p>
        </div>
    </footer>
);

// Main App Component: The root of the application
export default function App() {
  const [theme, setTheme] = useState('dark');
  const [page, setPage] = useState('home');
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [selectedPlatform, setSelectedPlatform] = useState('All Platforms');
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allContests, setAllContests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [user, setUser] = useState(null);
  // New state to track contests added to the calendar in the current session
  const [addedToCalendarIds, setAddedToCalendarIds] = useState(new Set());

  const platformOptions = [
    { value: 'All Platforms', label: 'All Platforms', color: 'text-gray-800 dark:text-white' },
    { value: 'Codeforces', label: 'Codeforces', color: 'text-rose-500' },
    { value: 'HackerEarth', label: 'HackerEarth', color: 'text-blue-500' },
    { value: 'LeetCode', label: 'LeetCode', color: 'text-amber-500' },
    { value: 'TopCoder', label: 'TopCoder', color: 'text-indigo-500' }
  ];

  useEffect(() => {
    if (theme === 'dark') { document.documentElement.classList.add('dark'); } 
    else { document.documentElement.classList.remove('dark'); }
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const userRes = await fetch(`${API_BASE_URL}/api/user`, { credentials: 'include' });
            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData);
            }
            const contestsRes = await fetch(`${API_BASE_URL}/api/contests`, { credentials: 'include' });
            if (!contestsRes.ok) throw new Error('Failed to fetch');
            const contestData = await contestsRes.json();
            setAllContests(contestData);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  const showNotification = (message, type = 'success') => { setNotification({ message, type }); };
  
  const handleToggleSave = async (contestId, newSavedStatus) => {
    if (!user) { showNotification('Please log in to save contests.', 'error'); return; }
    const originalContests = [...allContests];
    try {
        setAllContests(allContests.map(c => c._id === contestId ? { ...c, saved: newSavedStatus } : c));
        showNotification(newSavedStatus ? 'Contest saved!' : 'Removed from bookmarks.', 'success');
        await fetch(`${API_BASE_URL}/api/contests/${contestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saved: newSavedStatus }),
            credentials: 'include'
        });
    } catch (error) {
        console.error('Failed to update contest:', error);
        setAllContests(originalContests);
        showNotification('Failed to update bookmark.', 'error');
    }
  };

  // New handler to update the set of added calendar events
  const handleContestAddedToCalendar = (contestId) => {
    setAddedToCalendarIds(prevIds => new Set(prevIds).add(contestId));
  };
  
  const filteredContests = useMemo(() => {
    let contests = allContests;
    
    if (page === 'bookmarks') {
      contests = contests.filter(c => c.saved);
    } else if (page === 'today') {
      const today = new Date();
      contests = allContests.filter(c => {
        const contestDate = new Date(c.startTime);
        return contestDate.getDate() === today.getDate() &&
               contestDate.getMonth() === today.getMonth() &&
               contestDate.getFullYear() === today.getFullYear();
      });
    }
    
    if (searchQuery) {
        contests = contests.filter(contest => 
            contest.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    return contests.filter(contest => {
      const statusMatch = (page === 'today' || page === 'bookmarks') ? true : contest.status === activeTab;
      const platformMatch = selectedPlatform === 'All Platforms' || contest.platform === selectedPlatform;
      return statusMatch && platformMatch;
    });
  }, [page, activeTab, selectedPlatform, allContests, searchQuery]);

  const getPageTitle = () => {
    if (page === 'bookmarks') return 'My Bookmarks';
    if (page === 'today') return "Today's Contests";
    return 'Coding Contest Tracker';
  };

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-[#121212] text-gray-800 dark:text-gray-200 font-sans">
      {notification && <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification(null)} />}
      <Header theme={theme} setTheme={setTheme} isScrolled={isScrolled} setPage={setPage} page={page} user={user} />
      <main className="flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">{getPageTitle()}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl mx-auto">
              { page === 'bookmarks' ? 'Your saved contests for quick access.' : page === 'today' ? 'All coding challenges scheduled for today.' : 'Stay updated with upcoming and past coding contests from popular platforms' }
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            {page === 'home' ? (
                <div className="flex bg-gray-100 dark:bg-[#1e1e1e] p-1 rounded-lg">
                    <button onClick={() => setActiveTab('Upcoming')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${activeTab === 'Upcoming' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Upcoming</button>
                    <button onClick={() => setActiveTab('On-going')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${activeTab === 'On-going' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>On-going</button>
                    <button onClick={() => setActiveTab('Past')} className={`px-4 py-1.5 text-sm rounded-md font-medium ${activeTab === 'Past' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Past</button>
                </div>
            ) : <div />}
            <div className="relative w-full sm:w-auto flex-grow sm:flex-grow-0 flex items-center gap-4">
                <div className="relative w-full">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Search size={16} className="text-gray-400" /></div>
                    <input type="text" placeholder="Search contests..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white text-sm rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block w-full pl-10 p-2.5"/>
                </div>
                {page === 'home' && (<CustomSelect options={platformOptions} selected={selectedPlatform} onChange={(option) => setSelectedPlatform(option.value)}/>)}
            </div>
          </div>
          {isLoading ? ( <div className="flex justify-center items-center py-20"><LoaderCircle className="animate-spin text-purple-500" size={48} /></div> ) 
          : error ? ( <p className="text-red-500 text-center py-10">Error: {error}</p> ) 
          : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContests.length > 0 ? (
                filteredContests.map((contest) => (
                    <ContestCard 
                        key={contest._id} 
                        contest={contest} 
                        onSave={handleToggleSave} 
                        user={user} 
                        showNotification={showNotification}
                        onAddToCalendar={handleContestAddedToCalendar}
                        isAddedToCalendar={addedToCalendarIds.has(contest._id)}
                    />
                ))
              ) : ( <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-10">No contests found for the selected filters.</p> )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
