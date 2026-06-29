from fastapi import APIRouter, Depends, FastAPI
from pydantic import BaseModel

from .auth import CurrentUser, require_user

app = FastAPI(title="ExpenseFlow AI Service", docs_url=None, redoc_url=None)

router = APIRouter(prefix="/api/genai")


class ExpenseRequest(BaseModel):
    text: str


@router.post("/analyze")
async def analyze_expense(
    request: ExpenseRequest,
    user: CurrentUser = Depends(require_user),
):
    # Protected: requires a valid auth-service JWT. `user.user_id` is the caller.
    # This is where your LLM logic will live; for now a mock structured response.
    return {
        "amount": 15.50,
        "category": "Dining",
        "merchant": "Munich Mensa",
        "currency": "EUR",
    }


@router.get("/me")
async def me(user: CurrentUser = Depends(require_user)):
    """Probe proving JWT validation works end-to-end."""
    return {"userId": user.user_id, "email": user.email}


@app.get("/health")
def health_check():
    # Public: no auth, so the container healthcheck keeps working.
    return {"status": "healthy"}


app.include_router(router)
