"""
/upload-image, /predict/rainfall, /predict/risk endpoints.
"""
import json
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import FloodImage, Prediction, WeatherData
from app.schemas.schemas import (
    FloodImageOut, RainfallPredictRequest, RainfallPredictOut,
    CombinedRiskRequest, CombinedRiskOut,
)
from app.ml.inference import predict_flood_image, predict_rainfall, ModelNotTrainedError
from app.services.risk_engine import compute_risk_score

router = APIRouter(tags=["predictions"])

UPLOAD_DIR = "uploads/flood_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8MB


@router.post("/upload-image", response_model=FloodImageOut)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG/PNG/WEBP images are allowed")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    try:
        label, confidence = predict_flood_image(contents)
    except ModelNotTrainedError as e:
        raise HTTPException(status_code=503, detail=str(e))

    safe_name = f"{uuid.uuid4().hex}_{os.path.basename(file.filename)}"
    with open(os.path.join(UPLOAD_DIR, safe_name), "wb") as f:
        f.write(contents)

    record = FloodImage(
        user_id=current_user.id,
        filename=safe_name,
        prediction=label,
        confidence=confidence,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/predict/rainfall", response_model=RainfallPredictOut)
def predict_rainfall_endpoint(
    payload: RainfallPredictRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        tomorrow, next_3 = predict_rainfall(payload.recent_rainfall_mm)
    except ModelNotTrainedError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.add(Prediction(
        user_id=current_user.id,
        prediction_type="rainfall",
        confidence=100.0,
        risk_level="Low",  # rainfall alone isn't a risk verdict; risk engine decides that
        risk_score=None,
        details_json=json.dumps({"tomorrow_mm": tomorrow, "next_3_days_mm": next_3}),
    ))
    db.commit()

    return RainfallPredictOut(tomorrow_mm=tomorrow, next_3_days_mm=next_3)


@router.post("/predict/risk", response_model=CombinedRiskOut)
def predict_combined_risk(
    payload: CombinedRiskRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    weather = None
    if payload.use_latest_weather:
        weather = db.query(WeatherData).order_by(WeatherData.timestamp.desc()).first()

    score, level, breakdown = compute_risk_score(
        flood_image_confidence=payload.flood_image_confidence,
        flood_image_label=payload.flood_image_label,
        rainfall_forecast_mm=payload.rainfall_forecast_mm,
        weather=weather,
    )

    db.add(Prediction(
        user_id=current_user.id,
        prediction_type="risk_combined",
        confidence=score,
        risk_level=level,
        risk_score=score,
        details_json=json.dumps(breakdown),
    ))
    db.commit()

    return CombinedRiskOut(risk_score=score, risk_level=level, breakdown=breakdown)
