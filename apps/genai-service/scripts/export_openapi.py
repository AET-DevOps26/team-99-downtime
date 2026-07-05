"""Write the FastAPI OpenAPI schema to openapi/genai-service.json.

FastAPI builds the schema in-memory from the route decorators and Pydantic
models — no server, database or JWKS endpoint is contacted. Invoked via the
`export-openapi` Nx target (part of `bun run openapi` and the CI drift check),
which runs it as `uv run python -m scripts.export_openapi` so `src` resolves.
"""

import json
from pathlib import Path

from src.main import app

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_FILE = REPO_ROOT / "openapi" / "genai-service.json"


def main() -> None:
    OUT_FILE.write_text(json.dumps(app.openapi(), indent=2) + "\n")
    print(f"wrote {OUT_FILE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
