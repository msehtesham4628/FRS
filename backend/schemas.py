from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

# Question Schemas
class SurveyQuestionBase(BaseModel):
    question_text: str
    order: int

class SurveyQuestionCreate(SurveyQuestionBase):
    pass

class SurveyQuestion(SurveyQuestionBase):
    id: int
    survey_id: int
    model_config = ConfigDict(from_attributes=True)

# Response Schemas
class QuestionResponseBase(BaseModel):
    question_id: int
    answer: bool
    face_detected: bool = True
    face_score: float
    snapshot_path: Optional[str] = None

class QuestionResponseCreate(QuestionResponseBase):
    pass

class QuestionResponse(QuestionResponseBase):
    id: int
    submission_id: int
    model_config = ConfigDict(from_attributes=True)

# Submission Schemas
class SurveySubmissionBase(BaseModel):
    survey_id: int
    ip_address: Optional[str] = None
    device: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    location: Optional[str] = None
    video_path: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    overall_score: float = 0.0

class SurveySubmissionCreate(SurveySubmissionBase):
    responses: List[QuestionResponseCreate]

class SurveySubmission(SurveySubmissionBase):
    id: int
    timestamp: datetime
    responses: List[QuestionResponse]
    model_config = ConfigDict(from_attributes=True)

# Survey Schemas
class SurveyBase(BaseModel):
    title: str
    is_active: bool = True

class SurveyCreate(SurveyBase):
    questions: List[SurveyQuestionCreate]

class Survey(SurveyBase):
    id: int
    created_at: datetime
    questions: List[SurveyQuestion]
    submissions: List[SurveySubmission] = []
    model_config = ConfigDict(from_attributes=True)

