from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Survey(Base):
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    questions = relationship("SurveyQuestion", back_populates="survey", cascade="all, delete-orphan")
    submissions = relationship("SurveySubmission", back_populates="survey", cascade="all, delete-orphan")

class SurveyQuestion(Base):
    __tablename__ = "survey_questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"))
    question_text = Column(String)
    order = Column(Integer)

    survey = relationship("Survey", back_populates="questions")

class SurveySubmission(Base):
    __tablename__ = "survey_submissions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"))
    ip_address = Column(String)
    device = Column(String)
    browser = Column(String)
    os = Column(String)
    location = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True), server_default=func.now())
    overall_score = Column(Float, default=0.0)
    video_path = Column(String) # Path to the full survey video

    survey = relationship("Survey", back_populates="submissions")
    responses = relationship("QuestionResponse", back_populates="submission", cascade="all, delete-orphan")

class QuestionResponse(Base):
    __tablename__ = "question_responses"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("survey_submissions.id"))
    question_id = Column(Integer, ForeignKey("survey_questions.id"))
    answer = Column(Boolean) # Yes/No
    face_detected = Column(Boolean, default=True)
    face_score = Column(Float)
    snapshot_path = Column(String) # Path to the face snapshot

    submission = relationship("SurveySubmission", back_populates="responses")


