from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import os
import uuid
import json
import sys

# Ensure the current directory is in the path for standalone execution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import models
import schemas
import database
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Survey Platform API")
api_router = APIRouter(prefix="/api")

@api_router.get("/health")
def health_check():
    return {"status": "healthy"}



# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

import zipfile
import shutil
from fastapi.responses import FileResponse
from datetime import datetime

# Helper to capture metadata
def get_client_metadata(request: Request):
    user_agent = request.headers.get("user-agent", "")
    
    # Simple UA parsing logic
    ua = user_agent.lower()
    device = "Desktop"
    if "mobile" in ua: device = "Mobile"
    elif "tablet" in ua: device = "Tablet"
    
    browser = "Other"
    if "chrome" in ua: browser = "Chrome"
    elif "firefox" in ua: browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua: browser = "Safari"
    elif "edge" in ua: browser = "Edge"
    
    os_name = "Other"
    if "windows" in ua: os_name = "Windows"
    elif "macintosh" in ua or "mac os" in ua: os_name = "MacOS"
    elif "linux" in ua: os_name = "Linux"
    elif "android" in ua: os_name = "Android"
    elif "iphone" in ua or "ipad" in ua: os_name = "iOS"

    return {
        "ip_address": request.client.host,
        "user_agent": user_agent,
        "browser": browser,
        "os": os_name,
        "device": device,
        "location": "Local/Unknown" # Would use GeoIP here
    }


@api_router.post("/surveys/", response_model=schemas.Survey)
def create_survey(survey: schemas.SurveyCreate, db: Session = Depends(get_db)):
    db_survey = models.Survey(title=survey.title, is_active=survey.is_active)
    db.add(db_survey)
    db.commit()
    db.refresh(db_survey)
    
    for q in survey.questions:
        db_question = models.SurveyQuestion(**q.model_dump(), survey_id=db_survey.id)
        db.add(db_question)
    
    db.commit()
    db.refresh(db_survey)
    return db_survey

@api_router.get("/surveys/", response_model=List[schemas.Survey])
def list_surveys(db: Session = Depends(get_db)):
    return db.query(models.Survey).all()

@api_router.get("/surveys/{survey_id}", response_model=schemas.Survey)
def get_survey(survey_id: int, db: Session = Depends(get_db)):
    db_survey = db.query(models.Survey).filter(models.Survey.id == survey_id).first()
    if not db_survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    return db_survey

@api_router.delete("/surveys/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db)):
    db_survey = db.query(models.Survey).filter(models.Survey.id == survey_id).first()
    if not db_survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    db.delete(db_survey)
    db.commit()
    return {"message": "Survey deleted successfully"}

@api_router.post("/surveys/{survey_id}/start")
async def start_submission(
    request: Request,
    survey_id: int,
    db: Session = Depends(get_db)
):
    # Metadata
    metadata = get_client_metadata(request)
    
    db_submission = models.SurveySubmission(
        survey_id=survey_id,
        ip_address=metadata["ip_address"],
        device=metadata["device"],
        browser=metadata["browser"],
        os=metadata["os"],
        location=metadata["location"],
        started_at=datetime.now()
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return {"submission_id": db_submission.id}

@api_router.post("/submissions/{submission_id}/answers")
async def save_answers(
    submission_id: int,
    responses: List[schemas.QuestionResponseCreate],
    db: Session = Depends(get_db)
):
    for resp in responses:
        db_resp = models.QuestionResponse(
            submission_id=submission_id,
            question_id=resp.question_id,
            answer=resp.answer,
            face_detected=resp.face_detected,
            face_score=resp.face_score
        )
        db.add(db_resp)
    db.commit()
    return {"message": "Answers saved"}

@api_router.post("/submissions/{submission_id}/media")
async def save_media(
    submission_id: int,
    video: UploadFile = File(...),
    snapshots: List[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    sub = db.query(models.SurveySubmission).filter(models.SurveySubmission.id == submission_id).first()
    if not sub: raise HTTPException(404, "Submission not found")

    upload_dir = "uploads/videos"
    snapshot_dir = "uploads/snapshots"
    os.makedirs(upload_dir, exist_ok=True)
    os.makedirs(snapshot_dir, exist_ok=True)
    
    video_filename = f"{uuid.uuid4()}_{video.filename}"
    video_path = os.path.join(upload_dir, video_filename)
    with open(video_path, "wb") as f:
        f.write(await video.read())
    
    sub.video_path = video_path

    if snapshots:
        for snap in snapshots:
            snap_filename = f"{uuid.uuid4()}_{snap.filename}"
            snap_path = os.path.join(snapshot_dir, snap_filename)
            with open(snap_path, "wb") as f:
                f.write(await snap.read())
            
            if snap.filename.startswith("q_"):
                q_id = int(snap.filename.split("_")[1].split(".")[0])
                resp = db.query(models.QuestionResponse).filter(
                    models.QuestionResponse.submission_id == submission_id,
                    models.QuestionResponse.question_id == q_id
                ).first()
                if resp:
                    resp.snapshot_path = snap_path

    db.commit()
    return {"message": "Media uploaded"}

@api_router.post("/submissions/{submission_id}/complete")
async def complete_submission(
    submission_id: int,
    db: Session = Depends(get_db)
):
    sub = db.query(models.SurveySubmission).filter(models.SurveySubmission.id == submission_id).first()
    if not sub: raise HTTPException(404, "Submission not found")
    
    sub.completed_at = datetime.now()
    
    # Calculate overall score
    responses = db.query(models.QuestionResponse).filter(models.QuestionResponse.submission_id == submission_id).all()
    if responses:
        sub.overall_score = sum(r.face_score for r in responses) / len(responses)
    
    db.commit()
    return {"message": "Submission completed"}


@api_router.get("/submissions/{submission_id}/export")
def export_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(models.SurveySubmission).filter(models.SurveySubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Create temp directory for ZIP
    temp_dir = f"temp_export_{submission_id}"
    os.makedirs(temp_dir, exist_ok=True)
    images_dir = os.path.join(temp_dir, "images")
    videos_dir = os.path.join(temp_dir, "videos")
    os.makedirs(images_dir, exist_ok=True)
    os.makedirs(videos_dir, exist_ok=True)
    
    # Copy video
    if sub.video_path and os.path.exists(sub.video_path):
        shutil.copy(sub.video_path, os.path.join(videos_dir, "full_session.mp4"))
    
    # Copy snapshots
    responses = []
    # Identify survey questions order
    survey = db.query(models.Survey).filter(models.Survey.id == sub.survey_id).first()
    questions_sorted = sorted(survey.questions, key=lambda x: x.order)
    q_map = {q.id: i+1 for i, q in enumerate(questions_sorted)}

    for resp in sub.responses:
        q_num = q_map.get(resp.question_id, 1)
        snap_name = f"q{q_num}_face.png"
        
        q_text = "Question"
        q = db.query(models.SurveyQuestion).filter(models.SurveyQuestion.id == resp.question_id).first()
        if q: q_text = q.question_text

        if resp.snapshot_path and os.path.exists(resp.snapshot_path):
            shutil.copy(resp.snapshot_path, os.path.join(images_dir, snap_name))
        
        responses.append({
            "question": q_text,
            "answer": "Yes" if resp.answer else "No",
            "face_detected": resp.face_detected,
            "score": int(resp.face_score),
            "face_image": f"/images/{snap_name}" if resp.snapshot_path else None
        })
    
    # Create metadata.json
    metadata = {
        "submission_id": f"sub{sub.id}",
        "survey_id": f"survey{sub.survey_id}",
        "started_at": sub.started_at.strftime('%Y-%m-%dT%H:%M:%SZ') if sub.started_at else None,
        "completed_at": sub.completed_at.strftime('%Y-%m-%dT%H:%M:%SZ') if sub.completed_at else None,
        "ip_address": sub.ip_address,
        "device": sub.device,
        "browser": sub.browser,
        "os": sub.os,
        "location": sub.location,
        "responses": responses,
        "overall_score": int(sub.overall_score)
    }
    
    with open(os.path.join(temp_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=4)
        
    # Zip everything
    zip_path = f"submission_{submission_id}.zip"
    shutil.make_archive(zip_path.replace(".zip", ""), 'zip', temp_dir)
    
    # Cleanup temp dir
    shutil.rmtree(temp_dir)
    
    return FileResponse(zip_path, filename=zip_path, background=None)

app.include_router(api_router)


