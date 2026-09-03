from fastapi import FastAPI
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


@app.get("/")
def root():
    return {
        "name": "OpsGraph AI",
        "status": "running"
    }


@app.post("/incidents/analyze")
def analyze_incident(incident: IncidentRequest):
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
                confidence=confidence
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
                "confidence": round(item.confidence, 3),
                "created_at": item.created_at,
            }
            for item in incidents
        ]

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