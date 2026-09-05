# OpsGraph AI

OpsGraph AI is an incident intelligence application for classifying operational incidents, estimating severity, and finding similar historical incidents.

The system combines automated incident classification with human correction, allowing classifications to be reviewed and corrected while preserving incident history.

## Features

- Automatic incident classification
- Category confidence scoring
- Severity prediction
- Prediction breakdown across incident categories
- Historical incident similarity analysis
- Human correction of AI-generated categories
- Incident history
- Category and severity filtering
- Incident search
- Sorting by date and severity
- Paginated incident history
- System statistics and category distribution

## Incident Categories

OpsGraph AI currently classifies incidents into:

- Database
- Network
- Deployment
- Authentication
- Storage
- Performance

## Tech Stack

### Backend

- Python
- FastAPI
- SQLAlchemy
- SQLite

### Frontend

- React
- Vite
- JavaScript
- CSS

## Project Structure

```text
opsgraph-ai/
├── backend/
│   └── app/
│       ├── main.py
│       ├── database.py
│       └── models.py
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   └── package.json
│
├── .gitignore
└── README.md
```

## Running the Project

### Backend

From the project root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy
uvicorn app.main:app --reload --port 8001
```

The backend API will run at:

```text
http://127.0.0.1:8001
```

### Frontend

Open another terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at:

```text
http://localhost:5173
```

Keep both the backend and frontend terminals running while using the application.
