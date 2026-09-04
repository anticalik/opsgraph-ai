from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean
from sqlalchemy.sql import func

from .database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)

    description = Column(Text, nullable=False)

    category = Column(String(100), nullable=False)

    manually_corrected = Column(Boolean, nullable=False, default=False)

    confidence = Column(Float, nullable=False)

    severity = Column(String(20), nullable=True)
    severity_confidence = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )