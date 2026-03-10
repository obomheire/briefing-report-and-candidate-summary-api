from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.sample_item import SampleItemCreate, SampleItemRead
from app.services.sample_item_service import create_sample_item, list_sample_items

router = APIRouter(prefix="/sample-items", tags=["sample-items"])


@router.post("", response_model=SampleItemRead, status_code=status.HTTP_201_CREATED)
def create_item(payload: SampleItemCreate, db: Annotated[Session, Depends(get_db)]) -> SampleItemRead:
    item = create_sample_item(db, payload)
    return SampleItemRead.model_validate(item)


@router.get("", response_model=list[SampleItemRead])
def get_items(db: Annotated[Session, Depends(get_db)]) -> list[SampleItemRead]:
    items = list_sample_items(db)
    return [SampleItemRead.model_validate(item) for item in items]
