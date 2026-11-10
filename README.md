# Orbit: Job Application Tracker

A full-stack job application tracker with an interactive 3D interface and a browser extension that saves jobs automatically when you apply.

Every application floats as a 3D shape above a ring for its status (Wishlist, Applied, Interview, Offer, Rejected). Click a shape to edit it, and change its status to watch it glide to the new ring.

## Features

- Interactive 3D board built with Three.js: hover for details, click to edit, animated fly-in, mouse parallax
- Browser extension (Chrome and Edge, Manifest V3) that detects when you apply on job sites and saves the company, role, location and link
- Works across multi-page apply flows, for example when the final submit happens on a different page from the job listing
- Reads jobs from site-specific selectors, JSON-LD `JobPosting` data, the clicked job card on list pages, and the page title as a fallback
- Skips duplicate applications and queues jobs offline when the server is not running, then syncs them later
- Desktop notifications when a status changes and a follow-up reminder 7 days after applying with no update
- REST API with FastAPI and SQLite
- Respects reduced-motion settings and includes a keyboard-friendly list view

## Tech stack

Python, FastAPI, SQLite, Pydantic, JavaScript, Three.js, HTML/CSS, Chrome Extension APIs (Manifest V3)

## Project structure

```
main.py             FastAPI app and SQLite database layer
static/index.html   3D frontend (Three.js)
extension/          Browser extension (content script, service worker, popup)
requirements.txt
```

## Run locally

```bash
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Open http://127.0.0.1:8000. API docs are at http://127.0.0.1:8000/docs.

## Install the extension

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension` folder.
3. Keep the server running, open a job page and click **Apply**. A green toast confirms the job was saved.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/jobs` | List applications |
| POST | `/api/jobs` | Create an application |
| PUT | `/api/jobs/{id}` | Update an application |
| DELETE | `/api/jobs/{id}` | Delete an application |
| POST | `/api/capture` | Used by the extension; saves a job and skips duplicates |

## Limitations and roadmap

- Single user and local only: there is no login yet, and the extension talks to `127.0.0.1:8000`
- Job sites change their page layout often, so some selectors may need updating. The extension popup works as a manual fallback on any site
- Planned: user accounts, PostgreSQL, a hosted deployment, detecting employer replies from email, drag-and-drop between rings
