from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Sub-object schemas
# ---------------------------------------------------------------------------

class MetricIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=120)


class MetricRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    value: str
    display_order: int


class BriefingPointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    point_type: str
    content: str
    display_order: int


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class BriefingCreate(BaseModel):
    companyName: str = Field(min_length=1, max_length=255)
    ticker: str = Field(min_length=1, max_length=20)
    sector: str | None = Field(default=None, max_length=120)
    analystName: str = Field(min_length=1, max_length=120)
    summary: str = Field(min_length=1)
    recommendation: str = Field(min_length=1)
    keyPoints: list[str] = Field(min_length=2)
    risks: list[str] = Field(min_length=1)
    metrics: list[MetricIn] = Field(default_factory=list)

    @field_validator("ticker")
    @classmethod
    def ticker_must_be_uppercase(cls, v: str) -> str:
        if v != v.upper():
            raise ValueError("ticker must be uppercase")
        return v

    @field_validator("keyPoints")
    @classmethod
    def at_least_two_key_points(cls, v: list[str]) -> list[str]:
        if len(v) < 2:
            raise ValueError("at least 2 key points required")
        return v

    @field_validator("risks")
    @classmethod
    def at_least_one_risk(cls, v: list[str]) -> list[str]:
        if len(v) < 1:
            raise ValueError("at least 1 risk required")
        return v

    @model_validator(mode="after")
    def metric_names_must_be_unique(self) -> "BriefingCreate":
        names = [m.name for m in self.metrics]
        if len(names) != len(set(names)):
            raise ValueError("metric names must be unique within the same briefing")
        return self


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class BriefingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    ticker: str
    sector: str | None
    analyst_name: str
    summary: str
    recommendation: str
    is_generated: bool
    generated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    key_points: list[BriefingPointRead] = Field(default_factory=list)
    risks: list[BriefingPointRead] = Field(default_factory=list)
    metrics: list[MetricRead] = Field(default_factory=list)

    @classmethod
    def from_orm_briefing(cls, briefing: object) -> "BriefingRead":
        """Build response, splitting points by type and sorting by display_order."""
        key_points = sorted(
            [p for p in briefing.points if p.point_type == "key_point"],  # type: ignore[attr-defined]
            key=lambda p: p.display_order,
        )
        risks = sorted(
            [p for p in briefing.points if p.point_type == "risk"],  # type: ignore[attr-defined]
            key=lambda p: p.display_order,
        )
        metrics = sorted(briefing.metrics, key=lambda m: m.display_order)  # type: ignore[attr-defined]

        return cls(
            id=briefing.id,  # type: ignore[attr-defined]
            company_name=briefing.company_name,  # type: ignore[attr-defined]
            ticker=briefing.ticker,  # type: ignore[attr-defined]
            sector=briefing.sector,  # type: ignore[attr-defined]
            analyst_name=briefing.analyst_name,  # type: ignore[attr-defined]
            summary=briefing.summary,  # type: ignore[attr-defined]
            recommendation=briefing.recommendation,  # type: ignore[attr-defined]
            is_generated=briefing.is_generated,  # type: ignore[attr-defined]
            generated_at=briefing.generated_at,  # type: ignore[attr-defined]
            created_at=briefing.created_at,  # type: ignore[attr-defined]
            updated_at=briefing.updated_at,  # type: ignore[attr-defined]
            key_points=[BriefingPointRead.model_validate(p) for p in key_points],
            risks=[BriefingPointRead.model_validate(p) for p in risks],
            metrics=[MetricRead.model_validate(m) for m in metrics],
        )


class BriefingListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    ticker: str
    sector: str | None
    analyst_name: str
    recommendation: str
    is_generated: bool
    generated_at: datetime | None
    created_at: datetime


class BriefingListResponse(BaseModel):
    items: list[BriefingListItem]
    total: int
    page: int
    size: int
    pages: int


class GenerateResponse(BaseModel):
    id: int
    is_generated: bool
    generated_at: datetime
