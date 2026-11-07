# NetTrace - Unified CDR Intelligence & Network Forensics Platform

**NetTrace** is an end-to-end, production-grade Telecom Call Detail Record (CDR) Intelligence and Cyber Forensics Platform designed for law enforcement agencies, cyber cells, and intelligence units.

Built with **FastAPI**, **React + Tailwind CSS**, **PostgreSQL**, **Neo4j**, **Cytoscape.js**, and **Leaflet**.

---

## 🏛 System Architecture Overview

```
[ Frontend: React / Vite + Tailwind ] ──(REST API)──> [ API Gateway: FastAPI / Python ]
                                                              │
        ┌─────────────────────────────────────────────────────┼────────────────────────────────────────────────────┐
        ▼                                                     ▼                                                    ▼
[ Ingestion Engine ]                               [ Analytics & GIS Engine ]                            [ Graph Link Engine ]
(Pandas / OpenPyXL)                                (PostgreSQL / SQLite)                                 (NetworkX + Neo4j)
Heterogeneous Parser:                              • Spatial Tower Dumps                                 • Common Contacts Detection
• Bharti Airtel (CSV/XLSX/TXT)                     • Suspect Trajectory Playback                         • Degree & Betweenness Centrality
• Reliance Jio (VoLTE/5G logs)                     • 24-Hour Spikes & 12-4 AM Filters                    • Shortest Path (Dijkstra)
• Vodafone Idea (VI)                               • Hardware IMEI Hopping / Swaps                       • Multi-hop Expansion Subgraphs
```

---

## 📂 Project Directory Structure

```
NetTrace/
├── docker-compose.yml              # PostgreSQL, Neo4j, Backend & Frontend containers
├── README.md                       # Project architecture & setup documentation
├── .env.example                    # Environment credentials & fallback flags
│
├── backend/                        # Python (FastAPI Engine)
│   ├── app/
│   │   ├── main.py                 # FastAPI Application Entry point & CORS
│   │   ├── core/
│   │   │   ├── config.py           # Environment variables handler
│   │   │   └── security.py         # JWT Auth & Password Hashing
│   │   ├── db/
│   │   │   ├── postgres.py         # SQLAlchemy engine connection & SQLite fallback
│   │   │   └── neo4j.py            # Neo4j Driver initialization & schema
│   │   ├── models/
│   │   │   ├── postgres_models.py  # CDR Master, Tower Metadata, Case & User tables
│   │   │   └── pydantic_models.py  # Request/Response validation schemas
│   │   ├── services/
│   │   │   ├── ingestion/          # CDR Parsers for Airtel, Jio, VI & Auto-Detector
│   │   │   ├── analytics/          # Hourly Spikes, Tower Dumps, IMEI Tracker, PDF Report
│   │   │   └── graph/              # NetworkX & Neo4j graph algorithms
│   │   ├── api/v1/                 # Endpoints: auth, upload, analytics, gis, network
│   │   └── tests/                  # Pytest unit & integration test suite
│   ├── sample_data/                # Sample CDR files (Airtel, Jio, VI)
│   ├── requirements.txt            # Python dependencies
│   └── Dockerfile
│
└── frontend/                       # React + Vite + Tailwind CSS
    ├── src/
    │   ├── components/
    │   │   ├── common/             # Navbar, Sidebar, StatsCard, Loader
    │   │   ├── analytics/          # Recharts Timeline, Late Night Spikes, IMEI Swaps
    │   │   ├── map/                # Leaflet GeoMap, Route Playback, Tower Dump
    │   │   └── graph/              # Cytoscape Network Graph, Toolbar, Centrality Ranks
    │   ├── views/
    │   │   ├── Dashboard.jsx       # Unified Command Center
    │   │   ├── UploadModal.jsx     # Multi-format CDR Ingestion Modal
    │   │   ├── LinkAnalysis.jsx    # Fullscreen Interactive Network Graph View
    │   │   ├── GeoSpatialView.jsx  # GIS Map, Movement Scrubber & Tower Dumps
    │   │   └── ForensicsReportView.jsx # 1-Click Court PDF & Excel Export
    │   ├── services/               # Axios API Clients
    │   ├── store/                  # Zustand state stores
    │   └── styles/globals.css      # Cyber dark theme & tactical HUD styles
    ├── package.json
    ├── vite.config.js
    └── Dockerfile
```

---

## 🗄 Relational Database Schema (PostgreSQL)

```sql
CREATE TABLE cdr_records (
    id BIGSERIAL PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL,
    caller_number VARCHAR(20) NOT NULL,
    receiver_number VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    duration_seconds INT NOT NULL,
    call_type VARCHAR(15), -- VOICE, SMS, DATA, ROAMING
    imei VARCHAR(30),
    imsi VARCHAR(30),
    cell_tower_id VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    azimuth INT,
    operator VARCHAR(50),
    raw_source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_caller_receiver ON cdr_records(caller_number, receiver_number);
CREATE INDEX idx_timestamp_case ON cdr_records(timestamp, case_id);
CREATE INDEX idx_imei_caller ON cdr_records(imei, caller_number);
```

---

## 🌐 Graph Intelligence Schema (Neo4j & NetworkX)

- **Nodes**: `(:PhoneNumber {number, case_id, totalCalls, totalDuration, lateNightCalls, operator})`
- **Edges**: `(:PhoneNumber)-[:COMMUNICATED {weight, callCount, smsCount, totalDuration, firstCall, lastCall}]->(:PhoneNumber)`

### Core Network Algorithms:
1. **Degree Centrality**: Hub detection identifying high-frequency contact nodes.
2. **Betweenness Centrality**: Broker/bridge detection uncovering intermediaries linking distinct crime syndicates.
3. **Common Contact Detection**: Mutual contacts intersection between 2 or more target suspects.
4. **Shortest Path Analysis**: Dijkstra shortest path tracing communication chain hops between two targets.
5. **Multi-Hop Subgraph Expansion**: BFS expansion tracing $N$ degrees of separation from a seed suspect.

---

## 🚀 Quickstart Guide

### Option 1: Docker Compose (All-In-One Production Deployment)

```bash
# Clone and enter workspace
git clone <repo-url>
cd NetTrace

# Start PostgreSQL, Neo4j, FastAPI, and React Frontend
docker-compose up --build
```
- Frontend UI: `http://localhost:3000`
- FastAPI Interactive Swagger Docs: `http://localhost:8000/api/v1/docs`
- Neo4j Browser Console: `http://localhost:7474`

---

### Option 2: Local Development Setup

#### 1. Backend Setup:
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt

# Start backend server (runs on SQLite fallback automatically if Postgres is offline)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 2. Frontend Setup:
```bash
cd ../frontend
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser.

---

## 🧪 Ingestion & Sample Forensic Data

Click **"Load Sample Case"** on the top navigation bar to populate the realistic demonstration case:
- **Case Reference**: `CASE-DL-2026-904` (*Inter-State Cyber Fraud & Hawala Syndicate*)
- Heterogeneous mix of **Airtel, Jio, and Vodafone Idea (VI)** records.
- Delhi-NCR Cell Towers (Connaught Place, Karol Bagh, Rohini, Noida Sec 62, Gurgaon Cyber City).
- Simulated criminal behaviors:
  - **Late-Night Spikes**: 12:00 AM – 4:00 AM communication cluster.
  - **Handset IMEI Swaps**: Hardware IMEI `864920048192831` shared across multiple money mules.
  - **High-Centrality Hubs**: Kingpin (`9811012345`) and field lieutenants.
  - **Hawala Broker Bridge**: Node `9822334455` linking separate subnets.

Or upload test files from `backend/sample_data/`:
- `sample_airtel.csv`
- `sample_jio.csv`
- `sample_vi.csv`

---

## ⚖️ Indian Evidence Act § 65B Compliant Reporting
Click **"Court PDF"** or **"Forensic Evidence"** view to generate a certified evidentiary PDF dossier summarizing:
1. Executive case and certifying officer details.
2. 24-hour transaction distributions and midnight activity volume.
3. Ranked high-centrality target nodes with roles (Hub, Bridge, Affiliate).
4. Detected hardware IMEI swaps and suspicion risk index.
