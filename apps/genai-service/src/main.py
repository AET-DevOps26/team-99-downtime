import datetime
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel

from . import config, llm
from .auth import CurrentUser, require_user
from .categorize import (
    LlmUnavailableError,
    ParsedExpense,
    RowExpense,
    SkippedRow,
    TooVagueError,
    UnreadableFileError,
    categorize,
    parse_file,
)
from .store import StoredSummary, SummaryStore
from .summarize import NotEnoughDataError, WeeklyData, summarize


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.LLM_SKIP_STARTUP_CHECK:
        await llm.probe()
    # Summary persistence is optional: without DATABASE_URL the store stays
    # None and the summary routes answer 503 (see get_summary_store).
    app.state.summary_store = (
        await SummaryStore.connect(config.DATABASE_URL) if config.DATABASE_URL else None
    )
    yield
    if app.state.summary_store is not None:
        await app.state.summary_store.close()


app = FastAPI(
    title="ExpenseFlow AI Service",
    docs_url=None,
    redoc_url=None,
    openapi_url="/api/genai/openapi.json",
    lifespan=lifespan,
)

router = APIRouter(prefix="/api/genai")


def get_summary_store(request: Request) -> SummaryStore:
    store = getattr(request.app.state, "summary_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="SUMMARY_STORE_UNAVAILABLE")
    return store


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


class ParseFileRequest(BaseModel):
    content: str
    categories: list[str] = []


class ParseFileResponse(BaseModel):
    expenses: list[RowExpense]
    skipped: list[SkippedRow]


@router.post("/parse-file", response_model=ParseFileResponse)
async def parse_file_expenses(
    request: ParseFileRequest,
    user: CurrentUser = Depends(require_user),
):
    """Extract one expense per row/line from a bank CSV or free-text notes file.

    422 "UNREADABLE_FILE" is the contract for content with no expense data at
    all; individually unusable rows come back under "skipped" instead.
    """
    try:
        expenses, skipped = await parse_file(request.content, request.categories)
    except UnreadableFileError:
        raise HTTPException(status_code=422, detail="UNREADABLE_FILE") from None
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=502, detail="LLM_UNAVAILABLE") from exc
    return ParseFileResponse(expenses=expenses, skipped=skipped)


class SummaryResponse(BaseModel):
    summary: str
    weekStart: datetime.date
    generatedAt: datetime.datetime

    @classmethod
    def from_stored(cls, stored: StoredSummary) -> "SummaryResponse":
        return cls(
            summary=stored.summary,
            weekStart=stored.week_start,
            generatedAt=stored.generated_at,
        )


async def _generate_and_store(
    user_id: str, data: WeeklyData, store: SummaryStore
) -> SummaryResponse:
    try:
        text = await summarize(data)
    except NotEnoughDataError:
        raise HTTPException(status_code=422, detail="NOT_ENOUGH_DATA") from None
    except LlmUnavailableError as exc:
        raise HTTPException(status_code=502, detail="LLM_UNAVAILABLE") from exc
    stored = await store.upsert(user_id, data.week_start, text)
    return SummaryResponse.from_stored(stored)


@router.post("/summarize", response_model=SummaryResponse)
async def summarize_week(
    data: WeeklyData,
    user: CurrentUser = Depends(require_user),
    store: SummaryStore = Depends(get_summary_store),
):
    """Generate and persist the calling user's summary for the given week.

    The caller supplies the week's numbers (the dashboard forwards them from
    transaction-service's GET /api/transactions/weekly-report). 422
    "NOT_ENOUGH_DATA" is the contract for a week too sparse to summarize —
    nothing is stored then.
    """
    return await _generate_and_store(user.user_id, data, store)


@router.get("/summarize/latest", response_model=SummaryResponse)
async def latest_summary(
    user: CurrentUser = Depends(require_user),
    store: SummaryStore = Depends(get_summary_store),
):
    """The most recent stored summary; 404 "NO_SUMMARY" before the first one."""
    stored = await store.latest(user.user_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="NO_SUMMARY")
    return SummaryResponse.from_stored(stored)


class InternalSummarizeRequest(WeeklyData):
    userId: str


# The weekly scheduler in transaction-service calls this without a user JWT —
# it acts for many users at once and no user token exists in a cron. Trust is
# the network boundary: the gateway routes only /api/genai* here, so /internal
# is unreachable from outside the compose/cluster network. Hidden from the
# OpenAPI spec so the generated clients and Swagger UI only see user routes.
@app.post(
    "/internal/summarize", response_model=SummaryResponse, include_in_schema=False
)
async def internal_summarize(
    request: InternalSummarizeRequest,
    store: SummaryStore = Depends(get_summary_store),
):
    return await _generate_and_store(request.userId, request, store)


@router.get("/me")
async def me(user: CurrentUser = Depends(require_user)):
    """Probe proving JWT validation works end-to-end."""
    return {"userId": user.user_id, "email": user.email}


@app.get("/health")
def health_check():
    # Public: no auth, so the container healthcheck keeps working.
    return {"status": "healthy"}


app.include_router(router)
