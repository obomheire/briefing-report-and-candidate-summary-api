from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class Briefing(Base):
    __tablename__ = "briefings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(255), nullable=False)
    ticker = Column(String(20), nullable=False)
    sector = Column(String(120), nullable=True)
    analyst_name = Column(String(120), nullable=False)
    summary = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    is_generated = Column(Boolean, nullable=False, default=False)
    generated_at = Column(DateTime(timezone=True), nullable=True)
    html_content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    points = relationship(
        "BriefingPoint", back_populates="briefing", cascade="all, delete-orphan", lazy="select"
    )
    metrics = relationship(
        "BriefingMetric", back_populates="briefing", cascade="all, delete-orphan", lazy="select"
    )


class BriefingPoint(Base):
    __tablename__ = "briefing_points"

    id = Column(Integer, primary_key=True, autoincrement=True)
    briefing_id = Column(Integer, ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False)
    point_type = Column(String(20), nullable=False)  # 'key_point' | 'risk'
    content = Column(Text, nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    briefing = relationship("Briefing", back_populates="points")


class BriefingMetric(Base):
    __tablename__ = "briefing_metrics"
    __table_args__ = (UniqueConstraint("briefing_id", "name", name="uq_briefing_metric_name"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    briefing_id = Column(Integer, ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(120), nullable=False)
    value = Column(String(120), nullable=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    briefing = relationship("Briefing", back_populates="metrics")
