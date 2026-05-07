from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="ExpenseFlow AI Service")

class ExpenseRequest(BaseModel):
    text: str

@app.post("/analyze")
async def analyze_expense(request: ExpenseRequest):
    # This is where your LLM logic will live
    # For now, we return a mock structured response
    return {
        "amount": 15.50,
        "category": "Dining",
        "merchant": "Munich Mensa",
        "currency": "EUR"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}