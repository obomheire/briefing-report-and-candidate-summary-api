from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sample_item import SampleItem
from app.schemas.sample_item import SampleItemCreate


def create_sample_item(db: Session, payload: SampleItemCreate) -> SampleItem:
    item = SampleItem(name=payload.name.strip(), description=payload.description)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def list_sample_items(db: Session) -> list[SampleItem]:
    query = select(SampleItem).order_by(SampleItem.created_at.desc(), SampleItem.id.desc())
    return list(db.scalars(query).all())
