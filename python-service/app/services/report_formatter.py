from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "templates"


class ReportFormatter:
    """Starter formatter utility for future report-generation work."""

    def __init__(self) -> None:
        self._env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(enabled_extensions=("html", "xml"), default_for_string=True),
        )

    def render_base(self, title: str, body: str) -> str:
        template = self._env.get_template("base.html")
        return template.render(title=title, body=body, generated_at=self.generated_timestamp())

    @staticmethod
    def generated_timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()
