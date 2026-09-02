from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline

app = FastAPI(
    title="OpsGraph API",
    version="0.2.0"
)

classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli"
)


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

    predictions = [
        {
            "category": label,
            "confidence": round(score, 3)
        }
        for label, score in zip(result["labels"], result["scores"])
    ]

    return {
        "description": incident.description,
        "category": category,
        "confidence": round(confidence, 3),
        "predictions": predictions
    }