from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Integer, String, func

from app.db.base import Base


class SampleItem(Base):
    __tablename__ = "sample_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
