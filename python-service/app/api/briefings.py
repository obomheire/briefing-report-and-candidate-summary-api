import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingListItem, BriefingListResponse, BriefingRead, GenerateResponse
from app.services import briefing_formatter, briefing_service

router = APIRouter(prefix="/briefings", tags=["briefings"])

DbDep = Annotated[Session, Depends(get_db)]


@router.get("", response_model=BriefingListResponse)
def list_briefings(
    db: DbDep,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> BriefingListResponse:
    briefings, total = briefing_service.list_briefings(db, page, size)
    return BriefingListResponse(
        items=[BriefingListItem.model_validate(b) for b in briefings],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("", response_model=BriefingRead, status_code=status.HTTP_201_CREATED)
def create_briefing(payload: BriefingCreate, db: DbDep) -> BriefingRead:
    briefing = briefing_service.create_briefing(db, payload)
    return BriefingRead.from_orm_briefing(briefing)


@router.get("/{briefing_id}", response_model=BriefingRead)
def get_briefing(briefing_id: int, db: DbDep) -> BriefingRead:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found")
    return BriefingRead.from_orm_briefing(briefing)


@router.post("/{briefing_id}/generate", response_model=GenerateResponse)
def generate_report(briefing_id: int, db: DbDep) -> GenerateResponse:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found")

    view_model = briefing_formatter.build_report_view_model(briefing)
    html = briefing_formatter.render_briefing_html(view_model)
    updated = briefing_service.save_generated_html(db, briefing, html)

    return GenerateResponse(
        id=updated.id,
        is_generated=updated.is_generated,
        generated_at=updated.generated_at,  # type: ignore[arg-type]
    )


@router.get("/{briefing_id}/html")
def get_briefing_html(briefing_id: int, db: DbDep) -> Response:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if briefing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Briefing not found")
    if not briefing.is_generated or not briefing.html_content:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Report has not been generated yet. Call POST /briefings/{id}/generate first.",
        )
    return Response(content=briefing.html_content, media_type="text/html")
