// Import necessary libraries
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import schedule from 'node-schedule';
import axios from 'axios';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { google } from 'googleapis';

// Load environment variables from .env file
dotenv.config();

// --- Express App Setup ---
const app = express();
app.use(cors({
    origin: process.env.FRONTEND_URL, // We will set this in our hosting environment
    credentials: true
}));
app.use(express.json());
const PORT = process.env.PORT || 5000;

// --- Session Configuration ---
// NEW production-ready session config
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for Render/Heroku environments
    cookie: {
        secure: true, // Required for cross-site cookies
        httpOnly: true,
        sameSite: 'none', // Allow cross-site cookies
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// --- Passport Initialization ---
app.use(passport.initialize());
app.use(passport.session());

// --- Mongoose Schemas and Models ---
const userSchema = new mongoose.Schema({
    googleId: String,
    displayName: String,
    savedContests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contest' }],
    // NEW: Add fields to store Google OAuth tokens
    accessToken: String,
    refreshToken: String,
    tokenExpires: Number // We will store the expiry date as a timestamp
});
const User = mongoose.model('User', userSchema);

const contestSchema = new mongoose.Schema({
    name: String,
    platform: String,
    platformColor: String,
    duration: String,
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, default: 'Upcoming' },
    url: String,
    solutionUrl: { type: String, default: null }
});
const Contest = mongoose.model('Contest', contestSchema);


// --- Passport Google Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},
async (accessToken, refreshToken, params, profile, done) => { // 'params' contains expiry info
    try {
        const existingUser = await User.findOne({ googleId: profile.id });

        const tokenExpires = Date.now() + (params.expires_in * 1000);

        if (existingUser) {
            // If user exists, update their tokens
            existingUser.accessToken = accessToken;
            existingUser.refreshToken = refreshToken || existingUser.refreshToken; // Only update refresh token if a new one is provided
            existingUser.tokenExpires = tokenExpires;
            await existingUser.save();
            return done(null, existingUser);
        }

        // If new user, create them with their tokens
        const newUser = await User.create({
            googleId: profile.id,
            displayName: profile.displayName,
            accessToken: accessToken,
            refreshToken: refreshToken,
            tokenExpires: tokenExpires
        });
        return done(null, newUser);
    } catch (err) {
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});


// --- Helper Function to Format Duration ---
const formatDuration = (durationSeconds) => {
    if (!durationSeconds || durationSeconds <= 0) return '';
    const totalHours = durationSeconds / 3600;
    if (totalHours >= 24) {
        const days = Math.floor(totalHours / 24);
        const hours = Math.round(totalHours % 24);
        return `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
    } else {
        const hours = Math.floor(totalHours);
        const minutes = Math.round((durationSeconds % 3600) / 60);
        return `${hours > 0 ? `${hours}h` : ''}${minutes > 0 ? ` ${minutes}m` : ''}`.trim();
    }
};

// NEW: Helper function to get an authorized OAuth2 client
const getAuthorizedClient = async (user) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );

    // Set the initial credentials from the user's DB record
    oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
        expiry_date: user.tokenExpires,
    });

    // Check if the token is expired or about to expire
    if (oauth2Client.isTokenExpiring()) {
        console.log('Access token expired, refreshing...');
        try {
            // Get a new access token using the refresh token
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // Update the client with the new token
            oauth2Client.setCredentials(credentials);
            
            // Update the user's record in the database with the new token info
            await User.findByIdAndUpdate(user._id, {
                accessToken: credentials.access_token,
                tokenExpires: credentials.expiry_date,
            });
            console.log('Token refreshed and saved successfully.');

        } catch (error) {
            console.error('Failed to refresh access token:', error);
            throw new Error('Could not refresh access token. User may need to re-authenticate.');
        }
    }

    return oauth2Client;
};

// --- Live Data Fetching Function ---
const fetchAndStoreContests = async () => {
    console.log('Fetching new contest data from direct APIs...');
    let allUpcomingContests = [];

    try {
        const cfResponse = await axios.get('https://codeforces.com/api/contest.list');
        if (cfResponse.data.status === 'OK') {
            const cfContests = cfResponse.data.result.filter(c => c.phase === 'BEFORE').map(c => ({ name: c.name, platform: 'Codeforces', platformColor: 'bg-rose-500', duration: formatDuration(c.durationSeconds), startTime: new Date(c.startTimeSeconds * 1000), endTime: new Date(c.startTimeSeconds * 1000 + c.durationSeconds * 1000), status: 'Upcoming', url: `https://codeforces.com/contests/${c.id}` }));
            allUpcomingContests.push(...cfContests);
            console.log(`Fetched ${cfContests.length} from Codeforces.`);
        }
    } catch (e) { console.error('Failed to fetch from Codeforces:', e.message); }

    try {
        const lcResponse = await axios.post('https://leetcode.com/graphql', { query: `query { upcomingContests { title titleSlug startTime duration } }` });
        if (lcResponse.data.data.upcomingContests) {
            const lcContests = lcResponse.data.data.upcomingContests.map(c => ({ name: c.title, platform: 'LeetCode', platformColor: 'bg-amber-500', duration: formatDuration(c.duration), startTime: new Date(c.startTime * 1000), endTime: new Date(c.startTime * 1000 + c.duration * 1000), status: 'Upcoming', url: `https://leetcode.com/contest/${c.titleSlug}` }));
            allUpcomingContests.push(...lcContests);
            console.log(`Fetched ${lcContests.length} from LeetCode.`);
        }
    } catch (e) { console.error('Failed to fetch from LeetCode:', e.message); }

    try {
        const heResponse = await axios.get('https://www.hackerearth.com/chrome-extension/events/');
        if (heResponse.data.response) {
            const heContests = heResponse.data.response.filter(c => c.status === 'UPCOMING').map(c => ({ name: c.title, platform: 'HackerEarth', platformColor: 'bg-blue-500', duration: formatDuration((new Date(c.end_utc_tz) - new Date(c.start_utc_tz)) / 1000), startTime: new Date(c.start_utc_tz), endTime: new Date(c.end_utc_tz), status: 'Upcoming', url: c.url }));
            allUpcomingContests.push(...heContests);
            console.log(`Fetched ${heContests.length} from HackerEarth.`);
        }
    } catch (e) { console.error('Failed to fetch from HackerEarth:', e.message); }

    try {
        const tcResponse = await axios.get('https://api.topcoder.com/v5/challenges?status=Active&perPage=50');
        if (tcResponse.data) {
            const tcContests = tcResponse.data.filter(c => new Date(c.startDate) > new Date()).map(c => ({ name: c.name, platform: 'TopCoder', platformColor: 'bg-indigo-500', duration: formatDuration((new Date(c.endDate) - new Date(c.startDate)) / 1000), startTime: new Date(c.startDate), endTime: new Date(c.endDate), status: 'Upcoming', url: `https://www.topcoder.com/challenges/${c.id}` }));
            allUpcomingContests.push(...tcContests);
            console.log(`Fetched ${tcContests.length} from TopCoder.`);
        }
    } catch (e) { console.error('Failed to fetch from TopCoder:', e.message); }

    if (allUpcomingContests.length > 0) {
        const bulkOps = allUpcomingContests.map(c => ({ updateOne: { filter: { name: c.name }, update: { $set: c }, upsert: true } }));
        await Contest.bulkWrite(bulkOps);
        console.log(`Upserted ${allUpcomingContests.length} contests.`);
    }
};

// This function calls the YouTube Data API to find a solution video
const findYouTubeSolution = async (contestName, contestEndTime) => {
    // We create a specific search query for better results
    const searchQuery = `"${contestName}" solution editorial`;
    const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

    console.log(`Searching YouTube for: ${searchQuery}`);

    try {
        const response = await axios.get(YOUTUBE_API_URL, {
            params: {
                part: 'snippet',
                q: searchQuery,
                key: process.env.YOUTUBE_API_KEY,
                maxResults: 1,
                type: 'video',
                order: 'date', // NEW: Prioritize the most recent videos
                publishedAfter: new Date(contestEndTime).toISOString() // NEW: Only find videos published AFTER the contest ended
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;
            console.log(`Found relevant videoId: ${videoId} for "${contestName}"`);
            return videoId;
        } else {
            console.log(`No solution uploaded after the contest ended for "${contestName}" yet.`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching from YouTube API:', error.response ? error.response.data.error.message : error.message);
        return null;
    }
};


// This function finds contests that have ended and searches for their solutions
const updateContestStatuses = async () => {
    console.log('Running scheduled job: Updating contest statuses...');
    const now = new Date();

    try {
        // Find all contests that are not yet marked as 'Past'
        const contestsToCheck = await Contest.find({ status: { $ne: 'Past' } });

        if (contestsToCheck.length === 0) {
            console.log('No contests to update.');
            return;
        }

        for (const contest of contestsToCheck) {
            let newStatus = contest.status;

            if (now >= contest.endTime) {
                newStatus = 'Past';
            } else if (now >= contest.startTime && now < contest.endTime) {
                newStatus = 'On-going';
            } else {
                newStatus = 'Upcoming';
            }

            // If the status has changed, update it in the database
            if (newStatus !== contest.status) {
                contest.status = newStatus;
                await contest.save();
                console.log(`Updated status for "${contest.name}" to ${newStatus}.`);
            }
            
            // If a contest is now 'Past' and has no solution, search for one
            if (newStatus === 'Past' && !contest.solutionUrl) {
                const videoId = await findYouTubeSolution(contest.name, contest.endTime);
                if (videoId) {
                    contest.solutionUrl = videoId;
                    await contest.save();
                    console.log(`Found and saved solution for "${contest.name}".`);
                }
            }
        }
    } catch (error) {
        console.error('Error in updateContestStatuses job:', error);
    }
};


// --- Authentication Routes ---

// Find this line and add accessType and prompt
app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'https://www.googleapis.com/auth/calendar.events'],
    accessType: 'offline', // Important: requests a refresh token
    prompt: 'consent'      // Important: ensures the user is prompted for offline access
}));

app.get('/auth/google/callback', passport.authenticate('google', {
    successRedirect: process.env.FRONTEND_URL, 
    failureRedirect: process.env.FRONTEND_URL  
}));

app.get('/api/user', (req, res) => {
    if (req.user) {
        res.json(req.user);
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

app.get('/auth/logout', (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        res.redirect(process.env.FRONTEND_URL);
    });
});


// --- API Routes ---
// --- API Routes ---
app.get('/api/contests', async (req, res) => {
  try {
    const contests = await Contest.find({}).lean(); 
    
    const savedContestIds = req.user ? new Set(req.user.savedContests.map(id => id.toString())) : new Set();

    // The key change is here: we add a new 'displayStartTime' field for the UI
    // and keep the original 'startTime' for filtering.
    const formattedContests = contests
        .map(c => ({
            ...c,
            saved: savedContestIds.has(c._id.toString()),
            displayStartTime: new Date(c.startTime).toLocaleString('en-IN', {
                weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Kolkata'
            })
        }))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    res.json(formattedContests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contests', error });
  }
});

// UPDATED Bookmark route
app.patch('/api/contests/:id', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'You must be logged in to save contests.' });
    }
    try {
        const { id } = req.params;
        const { saved } = req.body;
        const user = await User.findById(req.user.id);

        if (saved) {
            user.savedContests.addToSet(id);
        } else {
            user.savedContests.pull(id);
        }
        await user.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Error updating bookmarks', error });
    }
});

// NEW: API route to add an event to Google Calendar
app.post('/api/calendar-event', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }

    try {
        const { contest } = req.body;
        // Get a fully authorized client, with a refreshed token if necessary
        const authorizedClient = await getAuthorizedClient(req.user);

        const calendar = google.calendar({ version: 'v3', auth: authorizedClient });

        const event = {
            summary: contest.name,
            description: `A new coding contest is here! Visit the contest page: ${contest.url}`,
            start: { dateTime: new Date(contest.startTime).toISOString() },
            end: { dateTime: new Date(contest.endTime).toISOString() },
            // Optional: Add a reminder
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', 'minutes': 60 },
                    { method: 'popup', 'minutes': 1440 }, // 1 day
                ],
            },
        };

        const createdEvent = await calendar.events.insert({
            calendarId: 'primary', // 'primary' refers to the user's main calendar
            resource: event,
        });

        res.status(200).json({ message: 'Event created successfully!', url: createdEvent.data.htmlLink });

    } catch (error) {
        console.error('Error creating calendar event:', error);
        res.status(500).json({ message: 'Failed to create calendar event.' });
    }
});

// --- Database Connection and Server Start ---
// --- Database Connection and Server Start ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      fetchAndStoreContests();
      updateContestStatuses(); // Run once on start
      schedule.scheduleJob('0 * * * *', fetchAndStoreContests);
      // UPDATED: Call the new function every 5 minutes
      schedule.scheduleJob('*/5 * * * *', updateContestStatuses);
      console.log('Scheduled jobs for fetching and updating contests.');
    });
  })
  //...
  .catch((error) => {
    console.error('Error connecting to MongoDB Atlas:', error.message);
    process.exit(1);
  });
