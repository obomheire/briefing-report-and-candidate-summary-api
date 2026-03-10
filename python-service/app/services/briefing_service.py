from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.briefing import Briefing, BriefingMetric, BriefingPoint
from app.schemas.briefing import BriefingCreate


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    briefing = Briefing(
        company_name=payload.companyName.strip(),
        ticker=payload.ticker.strip().upper(),
        sector=payload.sector.strip() if payload.sector else None,
        analyst_name=payload.analystName.strip(),
        summary=payload.summary.strip(),
        recommendation=payload.recommendation.strip(),
    )
    db.add(briefing)
    db.flush()  # get briefing.id before inserting children

    for order, content in enumerate(payload.keyPoints):
        db.add(BriefingPoint(
            briefing_id=briefing.id,
            point_type="key_point",
            content=content.strip(),
            display_order=order,
        ))

    for order, content in enumerate(payload.risks):
        db.add(BriefingPoint(
            briefing_id=briefing.id,
            point_type="risk",
            content=content.strip(),
            display_order=order,
        ))

    for order, metric in enumerate(payload.metrics):
        db.add(BriefingMetric(
            briefing_id=briefing.id,
            name=metric.name.strip(),
            value=metric.value.strip(),
            display_order=order,
        ))

    db.commit()
    db.refresh(briefing)
    return _load_briefing(db, briefing.id)  # type: ignore[arg-type]


def list_briefings(db: Session, page: int, size: int) -> tuple[list[Briefing], int]:
    offset = (page - 1) * size
    total = db.scalar(select(func.count()).select_from(Briefing)) or 0
    rows = db.scalars(
        select(Briefing).order_by(Briefing.created_at.desc()).offset(offset).limit(size)
    ).all()
    return list(rows), total


def get_briefing(db: Session, briefing_id: int) -> Briefing | None:
    return _load_briefing(db, briefing_id)


def _load_briefing(db: Session, briefing_id: int) -> Briefing | None:
    stmt = (
        select(Briefing)
        .where(Briefing.id == briefing_id)
        .options(
            selectinload(Briefing.points),
            selectinload(Briefing.metrics),
        )
    )
    return db.scalars(stmt).first()


def save_generated_html(db: Session, briefing: Briefing, html: str) -> Briefing:
    from datetime import datetime, timezone

    briefing.html_content = html
    briefing.is_generated = True
    briefing.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(briefing)
    return briefing
