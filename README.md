# 🏆 Contest Tracker



[![Live Site](https://img.shields.io/badge/Live%20Site-online-green)](https://contest-tracker-darsh.vercel.app)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)



A full-stack MERN-based web application to track upcoming and past coding contests from multiple platforms, featuring Google Calendar integration and secure user authentication.



**[➡️ View the Live Application](https://contest-tracker-darshu.vercel.app)**



---



## 📋 About The Project



Contest Tracker solves a common problem for competitive programmers: keeping track of coding contests spread across multiple websites. This application aggregates contest data from Codeforces, LeetCode, HackerEarth, and TopCoder into a single, clean interface. Users can log in with their Google account to save contests, add events directly to their Google Calendar, and find YouTube solutions for past contests automatically.



## ✨ Key Features



* ✅ **Multi-Platform Aggregation:** View contests from Codeforces, LeetCode, HackerEarth, and TopCoder.

* ✅ **Secure Google OAuth 2.0:** Users can sign up and log in securely with their Google account.

* ✅ **Google Calendar Integration:** Add any upcoming contest to your personal Google Calendar with a single click.

* ✅ **Bookmark Contests:** Save contests for later and view them in a dedicated bookmarks page.

* ✅ **Automated Solution Finder:** The backend automatically searches for YouTube video solutions for past contests.

* ✅ **"Today's Contests" View:** Quickly see all contests happening on the current day.

* ✅ **Search & Filter:** Easily search for contests by name and filter by platform.

* ✅ **Dark/Light Mode:** A sleek, modern UI with theme-switching capability.

* ✅ **Fully Responsive:** Designed to work beautifully on all devices, from desktops to mobile phones.



## 🛠️ Tech Stack



This project was built using a modern MERN-stack architecture within a monorepo.



* **Frontend:**

    * [React](https://reactjs.org/) (with Vite)

    * [Tailwind CSS](https://tailwindcss.com/)

    * React Hooks for State Management

    * Axios for API Calls



* **Backend:**

    * [Node.js](https://nodejs.org/)

    * [Express.js](https://expressjs.com/)

    * [MongoDB](https://www.mongodb.com/) (with Mongoose)

    * [Passport.js](http://www.passportjs.org/) for Google OAuth 2.0

    * `express-session` for Session Management



* **APIs:**

    * Google Calendar API

    * YouTube Data API



* **Deployment:**

    * Frontend: **Vercel**

    * Backend: **Render**

    * CI/CD pipeline managed from a single GitHub monorepo.



## 🚀 Getting Started (Local Setup)



To get a local copy up and running, follow these simple steps.



### Prerequisites



* Node.js (v18 or later)

* npm

* Git



### Installation



1.  **Clone the repository:**

    ```sh

    git clone [https://github.com/your-username/contest-tracker.git](https://github.com/your-username/contest-tracker.git)

    cd contest-tracker

    ```



2.  **Setup the Backend (`/server`):**

    * Navigate to the server directory:

        ```sh

        cd server

        ```

    * Install NPM packages:

        ```sh

        npm install

        ```

    * Create a `.env` file in the `/server` directory and add the required environment variables (see below).

    * Start the server:

        ```sh

        node index.js

        ```



3.  **Setup the Frontend (`/contest-tracker`):**

    * From the root directory, navigate to the frontend directory:

        ```sh

        cd contest-tracker

        ```

    * Install NPM packages:

        ```sh

        npm install

        ```

    * Create a `.env` file in the `/contest-tracker` directory and add `VITE_API_BASE_URL`.

    * Start the client:

        ```sh

        npm run dev

        ```



## 🔑 Environment Variables



You will need to create two `.env` files for this project to run locally.



**1. Backend (`/server/.env`):**

```sh

MONGO_URI=your_mongodb_connection_string

SESSION_SECRET=a_super_secret_random_string

GOOGLE_CLIENT_ID=your_google_client_id

GOOGLE_CLIENT_SECRET=your_google_client_secret

YOUTUBE_API_KEY=your_youtube_api_key

FRONTEND_URL=http://localhost:5173

GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

```
