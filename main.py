import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE = Path(__file__).parent
DB_FILE = BASE / "jobs.db"
Status = Literal["wishlist", "applied", "interview", "offer", "rejected"]


class JobIn(BaseModel):
    company: str
    role: str
    status: Status = "applied"
    location: str = ""
    link: str = ""
    notes: str = ""
    applied_on: Optional[str] = None


@contextmanager
def db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with db() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS jobs(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company TEXT NOT NULL, role TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'applied',
            location TEXT DEFAULT '', link TEXT DEFAULT '', notes TEXT DEFAULT '',
            applied_on TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"""
        )
        if not c.execute("SELECT 1 FROM jobs").fetchone():  # sample data so the 3D scene isn't empty
            c.executemany(
                "INSERT INTO jobs(company,role,status,location) VALUES(?,?,?,?)",
                [
                    ("Stripe", "Backend Engineer", "interview", "Remote"),
                    ("Notion", "Full-stack Developer", "applied", "Remote"),
                    ("Figma", "Product Engineer", "wishlist", "London"),
                    ("Vercel", "Frontend Engineer", "applied", "Remote"),
                    ("Linear", "Software Engineer", "offer", "Remote"),
                    ("Acme Corp", "Python Developer", "rejected", "Delhi"),
                ],
            )


init_db()
app = FastAPI(title="Orbit job tracker")


@app.get("/api/jobs")
def list_jobs():
    with db() as c:
        return [dict(r) for r in c.execute("SELECT * FROM jobs ORDER BY id")]


@app.post("/api/jobs", status_code=201)
def create_job(job: JobIn):
    with db() as c:
        cur = c.execute(
            "INSERT INTO jobs(company,role,status,location,link,notes,applied_on) VALUES(?,?,?,?,?,?,?)",
            (job.company, job.role, job.status, job.location, job.link, job.notes, job.applied_on),
        )
        return dict(c.execute("SELECT * FROM jobs WHERE id=?", (cur.lastrowid,)).fetchone())


@app.post("/api/capture")
def capture(job: JobIn):
    """Used by the browser extension: saves a job once and skips duplicates."""
    company, role = job.company.strip(), job.role.strip()
    with db() as c:
        row = c.execute(
            "SELECT * FROM jobs WHERE lower(company)=lower(?) AND lower(role)=lower(?)", (company, role)
        ).fetchone()
        if row:
            return {"created": False, "job": dict(row)}
        cur = c.execute(
            "INSERT INTO jobs(company,role,status,location,link,notes,applied_on) VALUES(?,?,?,?,?,?,?)",
            (company, role, job.status, job.location, job.link, job.notes, job.applied_on or date.today().isoformat()),
        )
        return {"created": True, "job": dict(c.execute("SELECT * FROM jobs WHERE id=?", (cur.lastrowid,)).fetchone())}


@app.put("/api/jobs/{job_id}")
def update_job(job_id: int, job: JobIn):
    with db() as c:
        cur = c.execute(
            "UPDATE jobs SET company=?,role=?,status=?,location=?,link=?,notes=?,applied_on=? WHERE id=?",
            (job.company, job.role, job.status, job.location, job.link, job.notes, job.applied_on, job_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Application not found")
        return dict(c.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone())


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: int):
    with db() as c:
        if c.execute("DELETE FROM jobs WHERE id=?", (job_id,)).rowcount == 0:
            raise HTTPException(404, "Application not found")
    return Response(status_code=204)


app.mount("/", StaticFiles(directory=BASE / "static", html=True), name="static")
