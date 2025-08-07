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
    origin: process.env.FRONTEND_URL,
    credentials: true
}));
app.use(express.json());
const PORT = process.env.PORT || 5000;

// --- Session Configuration ---
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
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
    accessToken: String,
    refreshToken: String,
    tokenExpires: Number
});
const User = mongoose.model('User', userSchema);

const contestSchema = new mongoose.Schema({
    name: String,
    platform: String,
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
async (accessToken, refreshToken, params, profile, done) => {
    try {
        const existingUser = await User.findOne({ googleId: profile.id });
        const tokenExpires = Date.now() + (params.expires_in * 1000);

        if (existingUser) {
            existingUser.accessToken = accessToken;
            existingUser.refreshToken = refreshToken || existingUser.refreshToken;
            existingUser.tokenExpires = tokenExpires;
            await existingUser.save();
            return done(null, existingUser);
        }

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

passport.serializeUser((user, done) => { done(null, user.id); });
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

// --- Helper Functions ---
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

const getAuthorizedClient = async (user) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );
    oauth2Client.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
        expiry_date: user.tokenExpires,
    });
    if (oauth2Client.isTokenExpiring()) {
        console.log('Access token expired, refreshing...');
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            oauth2Client.setCredentials(credentials);
            await User.findByIdAndUpdate(user._id, {
                accessToken: credentials.access_token,
                tokenExpires: credentials.expiry_date,
            });
            console.log('Token refreshed and saved successfully.');
        } catch (error) {
            console.error('Failed to refresh access token:', error);
            throw new Error('Could not refresh access token.');
        }
    }
    return oauth2Client;
};

// --- Data Fetching and Status Updates ---
const fetchAndStoreContests = async () => {
    console.log('Fetching new contest data from direct APIs...');
    let allUpcomingContests = [];

    try {
        const cfResponse = await axios.get('https://codeforces.com/api/contest.list');
        if (cfResponse.data.status === 'OK') {
            const cfContests = cfResponse.data.result.filter(c => c.phase === 'BEFORE').map(c => ({ name: c.name, platform: 'Codeforces', duration: formatDuration(c.durationSeconds), startTime: new Date(c.startTimeSeconds * 1000), endTime: new Date(c.startTimeSeconds * 1000 + c.durationSeconds * 1000), status: 'Upcoming', url: `https://codeforces.com/contests/${c.id}` }));
            allUpcomingContests.push(...cfContests);
        }
    } catch (e) { console.error('Failed to fetch from Codeforces:', e.message); }

    try {
        const lcResponse = await axios.post('https://leetcode.com/graphql', { query: `query { upcomingContests { title titleSlug startTime duration } }` });
        if (lcResponse.data.data.upcomingContests) {
            const lcContests = lcResponse.data.data.upcomingContests.map(c => ({ name: c.title, platform: 'LeetCode', duration: formatDuration(c.duration), startTime: new Date(c.startTime * 1000), endTime: new Date(c.startTime * 1000 + c.duration * 1000), status: 'Upcoming', url: `https://leetcode.com/contest/${c.titleSlug}` }));
            allUpcomingContests.push(...lcContests);
        }
    } catch (e) { console.error('Failed to fetch from LeetCode:', e.message); }

    try {
        const heResponse = await axios.get('https://www.hackerearth.com/chrome-extension/events/');
        if (heResponse.data.response) {
            const heContests = heResponse.data.response.filter(c => c.status === 'UPCOMING').map(c => ({ name: c.title, platform: 'HackerEarth', duration: formatDuration((new Date(c.end_utc_tz) - new Date(c.start_utc_tz)) / 1000), startTime: new Date(c.start_utc_tz), endTime: new Date(c.end_utc_tz), status: 'Upcoming', url: c.url }));
            allUpcomingContests.push(...heContests);
        }
    } catch (e) { console.error('Failed to fetch from HackerEarth:', e.message); }

    try {
        const tcResponse = await axios.get('https://api.topcoder.com/v5/challenges?status=Active&perPage=50');
        if (tcResponse.data) {
            const tcContests = tcResponse.data.filter(c => new Date(c.startDate) > new Date()).map(c => ({ name: c.name, platform: 'TopCoder', duration: formatDuration((new Date(c.endDate) - new Date(c.startDate)) / 1000), startTime: new Date(c.startDate), endTime: new Date(c.endDate), status: 'Upcoming', url: `https://www.topcoder.com/challenges/${c.id}` }));
            allUpcomingContests.push(...tcContests);
        }
    } catch (e) { console.error('Failed to fetch from TopCoder:', e.message); }

    if (allUpcomingContests.length > 0) {
        const bulkOps = allUpcomingContests.map(c => ({
            updateOne: {
                filter: { name: c.name, startTime: c.startTime },
                update: { $set: c },
                upsert: true
            }
        }));
        await Contest.bulkWrite(bulkOps);
        console.log(`Upserted ${allUpcomingContests.length} contests.`);
    }
};

// UPDATED: Now accepts platform to allow for targeted searches
const findYouTubeSolution = async (contestName, contestEndTime, platform) => {
    const searchQuery = `"${contestName}" solution editorial`;
    const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';
    const TLE_ELIMINATORS_CHANNEL_ID = 'UCfaJ6P3Q60-wGzE0sS1j_ew';

    // Base parameters for the YouTube API search
    const params = {
        part: 'snippet',
        q: searchQuery,
        key: process.env.YOUTUBE_API_KEY,
        maxResults: 1,
        type: 'video',
        order: 'date',
        publishedAfter: new Date(contestEndTime).toISOString()
    };

    // If the contest is from Codeforces or LeetCode, search a specific channel
    if (platform === 'Codeforces' || platform === 'LeetCode') {
        params.channelId = TLE_ELIMINATORS_CHANNEL_ID;
        console.log(`Searching within TLE_Eliminators channel for ${platform} contest: ${contestName}`);
    } else {
        console.log(`Searching all of YouTube for: ${searchQuery}`);
    }

    try {
        const response = await axios.get(YOUTUBE_API_URL, { params });

        if (response.data.items && response.data.items.length > 0) {
            const videoId = response.data.items[0].id.videoId;
            console.log(`Found relevant videoId: ${videoId} for "${contestName}"`);
            return videoId;
        } else {
            console.log(`No solution found for "${contestName}" yet.`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching from YouTube API:', error.response ? error.response.data.error.message : error.message);
        return null;
    }
};

const updateContestStatuses = async () => {
    console.log('Running scheduled job: Updating contest statuses...');
    const now = new Date();
    try {
        const contestsToCheck = await Contest.find({ status: { $ne: 'Past' } });
        if (contestsToCheck.length === 0) {
            return;
        }
        for (const contest of contestsToCheck) {
            let newStatus = contest.status;
            if (now >= new Date(contest.endTime)) {
                newStatus = 'Past';
            } else if (now >= new Date(contest.startTime) && now < new Date(contest.endTime)) {
                newStatus = 'On-going';
            } else {
                newStatus = 'Upcoming';
            }
            if (newStatus !== contest.status) {
                contest.status = newStatus;
                await contest.save();
                console.log(`Updated status for "${contest.name}" to ${newStatus}.`);
            }
            if (newStatus === 'Past' && !contest.solutionUrl) {
                // UPDATED: Pass the platform to the search function
                const videoId = await findYouTubeSolution(contest.name, contest.endTime, contest.platform);
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

const backfillMissingSolutions = async () => {
    console.log('Running one-time job: Backfilling missing YouTube solutions...');
    try {
        // Find all past Codeforces & LeetCode contests that are missing a solution link
        const contestsToBackfill = await Contest.find({
            platform: { $in: ['Codeforces', 'LeetCode'] },
            status: 'Past',
            solutionUrl: null 
        });

        if (contestsToBackfill.length === 0) {
            console.log('No past contests are missing solutions. All good!');
            return;
        }
        
        console.log(`Found ${contestsToBackfill.length} past contests to check for solutions.`);

        for (const contest of contestsToBackfill) {
            const videoId = await findYouTubeSolution(contest.name, contest.endTime, contest.platform);
            if (videoId) {
                contest.solutionUrl = videoId;
                await contest.save();
                console.log(`Backfilled solution for: "${contest.name}"`);
            }
        }
        console.log('Finished backfilling solutions.');
    } catch (error) {
        console.error('Error during solution backfill:', error);
    }
};

// --- Authentication Routes ---
app.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'https://www.googleapis.com/auth/calendar.events'],
    accessType: 'offline',
    prompt: 'consent'
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
app.get('/api/contests', async (req, res) => {
    try {
        const contests = await Contest.find({}).lean(); 
        const savedContestIds = req.user ? new Set(req.user.savedContests.map(id => id.toString())) : new Set();
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

app.post('/api/calendar-event', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }
    try {
        const { contest } = req.body;
        const authorizedClient = await getAuthorizedClient(req.user);
        const calendar = google.calendar({ version: 'v3', auth: authorizedClient });
        const event = {
            summary: contest.name,
            description: `A new coding contest is here! Visit the contest page: ${contest.url}`,
            start: { dateTime: new Date(contest.startTime).toISOString() },
            end: { dateTime: new Date(contest.endTime).toISOString() },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', 'minutes': 60 },
                    { method: 'popup', 'minutes': 1440 },
                ],
            },
        };
        const createdEvent = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
        });
        res.status(200).json({ message: 'Event created successfully!', url: createdEvent.data.htmlLink });
    } catch (error) {
        console.error('Error creating calendar event:', error);
        res.status(500).json({ message: 'Failed to create calendar event.' });
    }
});


// --- Database Connection and Server Start ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      fetchAndStoreContests();
      updateContestStatuses();
      backfillMissingSolutions();
      schedule.scheduleJob('0 * * * *', fetchAndStoreContests);
      schedule.scheduleJob('*/5 * * * *', updateContestStatuses);
      console.log('Scheduled jobs for fetching and updating contests.');
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB Atlas:', error.message);
    process.exit(1);
  });
