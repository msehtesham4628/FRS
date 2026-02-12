# 🎥 Video Survey Platform with Face Detection

A privacy-first video survey platform where users complete a 5-question survey while real-time face detection ensures data integrity. 

## 🏆 Assignment Compliance
- **Real-time Face Detection**: Using `face-api.js` for single/multiple/no-face detection.
- **Granular Submission API**: Refactored to `/start`, `/answers`, `/media`, and `/complete` steps.
- **ZIP Export**: Downloadable archive containing `metadata.json`, full video, and face snapshots.
- **Metadata Detection**: Native browser/OS/device detection via User-Agent.
- **System Stability**: Automatic DB migrations and production-ready configuration.

---

## 🚀 Quick Start (Recommended)

The easiest way to run the entire stack is using the provided shell script or Docker:

### Option A: Manual Script (Windows/Bash)
```bash
./start_dev.sh
```
*This handles port cleanup, DB migrations, and environment setup automatically.*

### Option B: Docker Compose
```bash
docker-compose up --build
```
*Note: Use `localhost` for testing in Docker.*

---

## 🏛 Architecture Overview

### Frontend (Next.js)
- **State Machine UI**: Handles the 5-step survey flow with real-time feedback.
- **Client-Side Intelligence**: Utilizes `face-api.js` (SSD Mobilenet v1) for pre-submission validation.
- **Media Handling**: Uses `MediaRecorder API` for full-session video and `Canvas API` for answer-specific snapshots.

### Backend (FastAPI)
- **Stateless Design**: All session data is persisted in the DB (PostgreSQL/SQLite).
- **Asynchronous Processing**: FastAPI handles concurrent uploads and ZIP generation efficiently.
- **Storage**: Media files are stored on the server filesystem, with relative paths stored in the DB.

---

## ⚖️ Trade-offs & Decisions

### 1. Client-Side vs Server-Side Face Detection
- **Decision**: Client-Side (`face-api.js`).
- **Reasoning**: This provides **immediate user feedback**. If the user's face isn't visible, they are blocked before they waste time completing a survey. It also reduces server CPU load significantly compared to processing video streams on the backend.

### 2. Granular API Steps
- **Decision**: Separate `/start` and `/complete` endpoints.
- **Reasoning**: Ensures "Session Integrity." By creating the submission record first, we can track abandoned surveys and ensure that media is correctly linked even if the browser crashes halfway through.

### 3. ZIP Generation on Request
- **Decision**: Generate ZIP archives dynamically.
- **Reasoning**: Keeps storage lean by not storing duplicate ZIP files. For higher scale, we would implement a caching layer for these exports.

---

## 🚧 Known Limitations

1. **Browser Permissions**: `getUserMedia` requires an HTTPS context or `localhost`.
2. **Video Format**: High-quality WebM compression is used; some legacy Safari versions may require polyfills for playback.
3. **Face API Models**: Models are loaded on-the-fly (~5MB). First-time survey loads may take 1-2 seconds longer.
4. **GeoIP**: Location detection is currently set to "Local/Unknown" as reliable GeoIP usually requires external paid API keys.

---

---

## � Deep Dive Logic Breakdown (Line-by-Line)

### 1. AI Face Detection (`frontend/src/components/FaceDetectionCamera.tsx`)
- **Initialization**: Loads `ssdMobilenetv1` models on mounting.
- **Real-time Loop**: Uses `requestAnimationFrame` to run detection 10+ times per second.
- **Accuracy Logic**: Uses `faceapi.detectAllFaces` to verify:
    - **No Face**: Blocks submission and shows "Face Required" error.
    - **Multiple Faces**: Blocks submission for security (prevents spoofing/multiple people).
    - **Single Face**: Extracts a `score` (0-1) and enables the "YES/No" interaction.
- **Snapshots**: Utilizes an internal `Canvas` to crop and capture a 1:1 image blob without interrupting the live feed.

### 2. Multi-Step Survey State (`frontend/src/app/survey/[id]/page.tsx`)
- **Step 0**: The "Security Check" screen. On clicking "Start," it triggers the `POST /start` API to lock in a session ID.
- **State Machine**: Tracks a `step` variable (0 to 5). As the user clicks, it pushes response data into an `answers` array.
- **Media Sync**: 
    - Continually aggregates `MediaRecorder` chunks into a single video blob.
    - On the final click (Step 5), it executes a sequential submission:
        1. **Answers**: Submits text/bool answers first.
        2. **Media**: Submits the large video file + all 5 snapshots.
        3. **Complete**: Signals the backend to calculate final scores and close the session.

### 3. Backend Granular API (`backend/main.py`)
- **Metadata Extraction**:
    - `get_client_metadata`: Uses case-insensitive string parsing on the `User-Agent` header to extract the OS (Windows/Mac/iOS), Browser (Chrome/Safari), and Device (Mobile/Desktop).
- **Transactional Logic**:
    - Uses SQLAlchemy `Session` to ensure that partial submissions (e.g., just answers but no video) are captured but marked as incomplete until the `/complete` signal.
- **ZIP Export Engine**:
    - Creates a temporary directory.
    - Injects a `metadata.json` populated with the raw DB query data.
    - Copies filesystem images and videos into the folder.
    - Uses `shutil.make_archive` to package everything into a single transportable file for the reviewer.

### 4. Database Schema Compliance (`backend/models.py`)
- **Normalized Tables**:
    - `Survey`: Stores the metadata for the survey template.
    - `SurveySubmission`: Stores the per-session unique data (timestamps, IP, Browser, Overall Score).
    - `QuestionResponse`: The atomic data for each answer, including the path to the specific face snapshot taken at that moment.

### 5. Deployment Orchestration (`docker-compose.yml` & `start_dev.sh`)
- **Environment Parity**: The `start_dev.sh` script automates local Windows/Linux setup by handling port cleanup (fixing `EADDRINUSE`) and ensuring `migrate_db.py` runs before the API starts.
- **Containers**: Dockerizes the environment using multi-stage builds (`python:3.12-slim` and `node:22-alpine`) to ensure the reviewer sees the exact same behavior as the developer.

