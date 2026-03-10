"""
Transforms a Briefing ORM object into a report view model and renders the HTML.

Keeps all display-logic decisions (ordering, label formatting, title construction,
timestamp presentation) out of the controller and away from the template.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from jinja2 import Environment, FileSystemLoader, select_autoescape

if TYPE_CHECKING:
    from app.models.briefing import Briefing

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"

_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(enabled_extensions=("html",), default_for_string=True),
)


# ---------------------------------------------------------------------------
# View model dataclasses — what the template receives
# ---------------------------------------------------------------------------

@dataclass
class MetricViewModel:
    label: str   # normalized / title-cased name
    value: str


@dataclass
class BriefingReportViewModel:
    report_title: str
    company_name: str
    ticker: str
    sector: str
    analyst_name: str
    summary: str
    recommendation: str
    key_points: list[str]
    risks: list[str]
    metrics: list[MetricViewModel]
    generated_at_display: str  # human-readable UTC string


# ---------------------------------------------------------------------------
# Formatter
# ---------------------------------------------------------------------------

def build_report_view_model(briefing: Briefing) -> BriefingReportViewModel:
    """Transform a Briefing ORM record into a display-ready view model."""
    key_points = [
        p.content
        for p in sorted(
            (p for p in briefing.points if p.point_type == "key_point"),
            key=lambda p: p.display_order,
        )
    ]
    risks = [
        p.content
        for p in sorted(
            (p for p in briefing.points if p.point_type == "risk"),
            key=lambda p: p.display_order,
        )
    ]
    metrics = [
        MetricViewModel(label=_normalize_label(m.name), value=m.value)
        for m in sorted(briefing.metrics, key=lambda m: m.display_order)
    ]

    sector_display = briefing.sector or "N/A"
    report_title = f"{briefing.company_name} ({briefing.ticker}) — Analyst Briefing"
    generated_at = briefing.generated_at or datetime.now(timezone.utc)
    generated_at_display = generated_at.strftime("%d %b %Y, %H:%M UTC")

    return BriefingReportViewModel(
        report_title=report_title,
        company_name=briefing.company_name,
        ticker=briefing.ticker,
        sector=sector_display,
        analyst_name=briefing.analyst_name,
        summary=briefing.summary,
        recommendation=briefing.recommendation,
        key_points=key_points,
        risks=risks,
        metrics=metrics,
        generated_at_display=generated_at_display,
    )


def render_briefing_html(view_model: BriefingReportViewModel) -> str:
    """Render the briefing report template with the given view model."""
    template = _jinja_env.get_template("briefing_report.html")
    return template.render(report=view_model)


def _normalize_label(name: str) -> str:
    """Title-case a metric name, preserving acronyms (e.g. 'P/E Ratio' stays as-is)."""
    # If all words are already upper or title-cased, keep them; otherwise title-case
    words = name.strip().split()
    return " ".join(w if w.isupper() else w.capitalize() for w in words)
