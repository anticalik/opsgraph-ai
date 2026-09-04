from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline

from .database import engine, SessionLocal
from . import models

from sentence_transformers import SentenceTransformer, util

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="OpsGraph API",
    version="0.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

class IncidentRequest(BaseModel):
    description: str

class IncidentCategoryUpdate(BaseModel):
    category: str

@app.get("/")
def root():
    return {
        "name": "OpsGraph AI",
        "status": "running"
    }


@app.post("/incidents/analyze")
def analyze_incident(incident: IncidentRequest):
    if not incident.description.strip():
        raise HTTPException(
            status_code=400,
            detail="Incident description cannot be empty"
        )
    labels = [
        "Database",
        "Network",
        "Deployment",
        "Authentication",
        "Storage",
        "Performance"
    ]

    result = classifier(
        incident.description,
        candidate_labels=labels
    )

    category = result["labels"][0]
    confidence = result["scores"][0]
    historical_suggestion = None
    recommended_category = category
    recommendation_reason = "AI classification accepted"
    recommendation_score = confidence

    severity_labels = [
        "Critical",
        "High",
        "Medium",
        "Low",
    ]

    severity_result = classifier(
        incident.description,
        candidate_labels=severity_labels
    )

    severity = severity_result["labels"][0]
    severity_confidence = severity_result["scores"][0]
    
    db = SessionLocal()

    try:
        if confidence < 0.50:
            incidents = db.query(models.Incident).all()

            if incidents:
                query_embedding = embedding_model.encode(
                    incident.description,
                    convert_to_tensor=True
                )

                best_match = None
                best_similarity = 0
                best_raw_similarity = 0

                for item in incidents:
                    if item.description == incident.description:
                        continue
                    incident_embedding = embedding_model.encode(
                        item.description,
                        convert_to_tensor=True
                    )

                    similarity = util.cos_sim(
                        query_embedding,
                        incident_embedding
                    ).item()

                    weighted_similarity = similarity

                    if item.manually_corrected:
                        weighted_similarity += 0.05

                    if weighted_similarity > best_similarity:
                        best_similarity = weighted_similarity
                        best_raw_similarity = similarity
                        best_match = item

                if (
                    best_match is not None
                    and best_raw_similarity >= 0.80
                    and best_match.category != category
                ):
                    historical_suggestion = {
                        "category": best_match.category,
                        "similarity": round(best_raw_similarity, 3),
                        "incident_id": best_match.id
                    }

                    recommended_category = best_match.category
                    recommendation_reason = (
                        "Low AI confidence and strong historical match"
                    )
                    recommendation_score = best_raw_similarity

        existing_incident = (
            db.query(models.Incident)
            .filter(models.Incident.description == incident.description)
            .first()
        )

        if existing_incident:
            new_incident = existing_incident
        else:
            new_incident = models.Incident(
                description=incident.description,
                category=category,
                confidence=confidence,
                severity=severity,
                severity_confidence=severity_confidence
            )

            db.add(new_incident)
            db.commit()
            db.refresh(new_incident)

    finally:
        db.close()

    predictions = [
        {
            "category": label,
            "confidence": round(score, 3)
        }
        for label, score in zip(result["labels"], result["scores"])
    ]

    return {
        "id": new_incident.id,
        "description": incident.description,
        "category": category,
        "confidence": round(confidence, 3),
        "severity": severity,
        "severity_confidence": round(severity_confidence, 3),
        "historical_suggestion": historical_suggestion,
        "recommended_category": recommended_category,
        "recommendation_reason": recommendation_reason,
        "recommendation_score": round(recommendation_score, 3),
        "predictions": predictions
    }

@app.get("/incidents")
def get_incidents():
    db = SessionLocal()

    try:
        incidents = (
            db.query(models.Incident)
            .order_by(models.Incident.created_at.desc())
            .all()
        )

        return [
            {
                "id": item.id,
                "description": item.description,
                "category": item.category,
                "manually_corrected": item.manually_corrected,
                "confidence": round(item.confidence, 3),
                "severity": item.severity,
                "severity_confidence": (
                    round(item.severity_confidence, 3)
                    if item.severity_confidence is not None
                    else None
                ),
                "created_at": item.created_at,
            }
            for item in incidents
        ]

    finally:
        db.close()

@app.patch("/incidents/{incident_id}/category")
def update_incident_category(
    incident_id: int,
    update: IncidentCategoryUpdate
):
    allowed_categories = {
        "Database",
        "Network",
        "Deployment",
        "Authentication",
        "Storage",
        "Performance"
    }

    if update.category not in allowed_categories:
        raise HTTPException(
            status_code=400,
            detail="Invalid incident category"
        )

    db = SessionLocal()

    try:
        incident = (
            db.query(models.Incident)
            .filter(models.Incident.id == incident_id)
            .first()
        )

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found"
            )

        incident.category = update.category
        incident.manually_corrected = True
        db.commit()
        db.refresh(incident)

        return {
            "id": incident.id,
            "category": incident.category,
            "manually_corrected": incident.manually_corrected
        }

    finally:
        db.close()

@app.post("/incidents/similar")
def find_similar_incidents(incident: IncidentRequest):
    db = SessionLocal()

    try:
        incidents = db.query(models.Incident).all()

        if not incidents:
            return []

        query_embedding = embedding_model.encode(
            incident.description,
            convert_to_tensor=True
        )

        results = []

        for item in incidents:
            if item.description == incident.description:
                continue
            incident_embedding = embedding_model.encode(
                item.description,
                convert_to_tensor=True
            )

            similarity = util.cos_sim(
                query_embedding,
                incident_embedding
            ).item()

            results.append({
                "id": item.id,
                "description": item.description,
                "category": item.category,
                "manually_corrected": item.manually_corrected,
                "severity": item.severity,
                "severity_confidence": (
                    round(item.severity_confidence, 3)
                    if item.severity_confidence is not None
                    else None
                ),
                "similarity": round(similarity, 3)
            })

        results = [
            item
            for item in results
            if item["similarity"] >= 0.50
        ]

        results.sort(
            key=lambda item: item["similarity"],
            reverse=True
        )

        return results[:5]

    finally:
        db.close()

    