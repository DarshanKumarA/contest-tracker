# ⚖️ Nyay AI (न्याय AI)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-blue?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react&logoColor=white)](https://reactjs.org/)

An AI-powered intelligence engine designed to accelerate justice in the Indian legal system by transforming unstructured case files into interactive, intelligent briefs.

---

## 📋 About The Project

Nyay AI addresses a critical challenge in the Indian judicial system: the overwhelming backlog of over 47 million pending cases, largely due to a manual, paper-based process. This application serves as a secure intelligence engine for legal professionals, ingesting thousands of pages of legal documents and converting them into a single, dynamic, and interactive "Intelligent Brief."

Inspired by the vision of the Hon'ble Justice D.Y. Chandrachud, Chief Justice of India, this project aims to use modern AI to bring unprecedented speed and clarity to case analysis, ultimately helping to reduce delays and restore faith in the justice system.

## ✨ Key Features

* ✅ **Intelligent Brief Generation**: Automatically generates multi-layered summaries, key arguments, and involved parties from uploaded case files (PDF or TXT).
* ✅ **Real-time Precedent Analysis**: Finds the most relevant historical cases from a personal vector database using advanced semantic search.
* ✅ **Evidentiary Cross-Verification**: Flags potential contradictions in evidence across multiple documents for human review.
* ✅ **Interactive Chat Assistant**: A conversational AI that can answer follow-up questions about the analyzed case document.
* ✅ **AI Personalization**: Allows users to provide feedback to fine-tune a personalized model, improving future search results over time.
* ✅ **Secure User Authentication**: A complete user management system with secure JWT-based authentication and password hashing.
* ✅ **Fully Responsive UI**: The user interface is designed to work seamlessly across different devices.

## 🛠️ Tech Stack

This project was built using a modern, full-stack architecture.

* **Frontend:**
    * [React](https://reactjs.org/) (with Vite)
    * React Router for navigation
    * React Context for state management
    * Axios for API Communication

* **Backend:**
    * [FastAPI](https://fastapi.tiangolo.com/) (with Uvicorn)
    * [SQLAlchemy](https://www.sqlalchemy.org/) ORM
    * [Pydantic](https://pydantic-docs.helpmanual.io/) for data validation
    * JWT (python-jose) & passlib for authentication

* **Database:**
    * [PostgreSQL](https://www.postgresql.org/) (Production-ready)
    * [SQLite](https://www.sqlite.org/index.html) (for local development)

* **AI & Machine Learning:**
    * [Google Gemini API](https://ai.google.dev/) for generative tasks
    * [Sentence-Transformers](https://www.sbert.net/) for text embeddings
    * [ChromaDB](https://www.trychroma.com/) for vector storage and similarity search
    * [LangChain](https://www.langchain.com/) for text splitting
    * [Spacy](https://spacy.io/) for NLP tasks

## 🚀 Getting Started (Local Setup)

To get a local copy up and running, follow these simple steps.

### Prerequisites

* Node.js (v18 or later)
* Python (v3.9 or later)
* npm & pip
* Git

### Installation

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/DarshanKumarA/nyay-ai.git](https://github.com/DarshanKumarA/nyay-ai.git)
    cd nyay-ai
    ```

2.  **Setup the Backend (`/backend`):**
    * Navigate to the backend directory:
        ```sh
        cd backend
        ```
    * Create and activate a Python virtual environment:
        ```sh
        # On Windows
        python -m venv venv
        .\venv\Scripts\activate

        # On macOS / Linux
        python3 -m venv venv
        source venv/bin/activate
        ```
    * Install Python packages:
        ```sh
        pip install -r requirements.txt
        ```
    * Create a `.env` file in the `/backend` directory and add the required environment variables (see below).
    * Start the server:
        ```sh
        uvicorn main:app --reload
        ```
    > The backend will be running at `http://127.0.0.1:8000`.

3.  **Setup the Frontend (`/frontend`):**
    * Open a **new terminal** and navigate to the frontend directory:
        ```sh
        cd frontend
        ```
    * Install NPM packages:
        ```sh
        npm install
        ```
    * Start the client:
        ```sh
        npm run dev
        ```
    > The frontend will be running at `http://localhost:5173`.

## 🔑 Environment Variables

You will need to create one `.env` file for this project to run locally.

**Backend (`/backend/.env`):**
```sh
# A strong, random string used for signing JWTs
SECRET_KEY="your_super_secret_key_here"

# Your API key from Google AI Studio
GEMINI_API_KEY="your_gemini_api_key_here"

