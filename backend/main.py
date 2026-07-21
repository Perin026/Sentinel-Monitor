"""
Entrypoint. Deliberately thin: `create_app()` (app/core/application.py) is
the only place that knows how to construct the application, so this file
and `tests/conftest.py` are the only two callers and can never drift.

Run directly for local development (`python main.py`), or via
`uvicorn main:app` for production (see Dockerfile's CMD, which uses the
latter without --reload).
"""
from __future__ import annotations

import uvicorn

from app.core.application import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
