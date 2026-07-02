from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel

from .auth import CurrentUser, require_user
from .categorize import (
    CsvRowExpense,
    LlmUnavailableError,
    NotCsvError,
    ParsedExpense,
    SkippedRow,
    TooVagueError,
    categorize,
    parse_csv,
)

app = FastAPI(
    title="ExpenseFlow AI Service",
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/genai/openapi.json",
)

router = APIRouter(prefix="/api/genai")


class CategorizeRequest(BaseModel):
    text: str
    # The caller's category names; the model files each expense into one.
    categories: list[str] = []


class CategorizeResponse(BaseModel):
    expenses: list[ParsedExpense]


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_expenses(
    request: CategorizeRequest,
    user: CurrentUser = Depends(require_user),
):
    """Extract one or more structured expenses from a free-text sentence.

    422 "TOO_VAGUE" is the contract for a sentence the model cannot extract from.
    """
    try:
        expenses = await categorize(request.text, request.categories)
    except TooVagueError:
        raise HTTPException(status_code=422, detail="TOO_VAGUE") from None
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=502, detail="LLM_UNAVAILABLE") from exc
    return CategorizeResponse(expenses=expenses)


class ParseCsvRequest(BaseModel):
    csv: str
    categories: list[str] = []


class ParseCsvResponse(BaseModel):
    expenses: list[CsvRowExpense]
    skipped: list[SkippedRow]


@router.post("/parse-csv", response_model=ParseCsvResponse)
async def parse_csv_expenses(
    request: ParseCsvRequest,
    user: CurrentUser = Depends(require_user),
):
    """Extract one expense per debit row from a raw bank CSV of any format.

    422 "NOT_CSV" is the contract for content that isn't tabular data at all;
    individual unusable rows come back under "skipped" instead of failing.
    """
    try:
        expenses, skipped = await parse_csv(request.csv, request.categories)
    except NotCsvError:
        raise HTTPException(status_code=422, detail="NOT_CSV") from None
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=502, detail="LLM_UNAVAILABLE") from exc
    return ParseCsvResponse(expenses=expenses, skipped=skipped)


@router.get("/me")
async def me(user: CurrentUser = Depends(require_user)):
    """Probe proving JWT validation works end-to-end."""
    return {"userId": user.user_id, "email": user.email}


@app.get("/health")
def health_check():
    # Public: no auth, so the container healthcheck keeps working.
    return {"status": "healthy"}


app.include_router(router)
