# ExpenseFlow 

## 1. Problem Statement

**Problem:**
Users struggle to track personal expenses across multiple banks and payment methods because financial information is scattered across different apps and accounts. Existing solutions often make expense tracking feel tedious, leading to inconsistent usage and limited visibility into spending habits.

**Target Audience:**
Individuals and small households who want a all-in-one option for tracking expenses and managing personal finances.

## 2. Main Functionality

High-level capabilities the app provides:

- **Bank Transaction Import:** Upload a CSV export from a bank or drop in a free-text description; the system ingests both.
- **AI-Powered Categorization:** A LangChain-based service classifies each transaction (e.g. `LIEFERANDO MUNICH` → *Dining*) without manual tagging.
- **Budget Management:** Users define monthly limits per category; the app tracks live spend against those limits.
- **Spending Dashboard:** Visual breakdown of spending per category, remaining budget, and historical trends.
- **Weekly AI Summary:** Plain-language narrative of the week's spending behavior and notable shifts.
- **Budget Alerts:** In-app notifications when a category crosses 80% or 100% of its limit.
- **Manual Entry & Edits:** Cash expenses can be added by hand; AI categorizations can be corrected by the user.

## 3. GenAI Integration

| Capability | What the LLM does | Why it matters |
|---|---|---|
| **Transaction categorization** | Maps strings ( `DB VERTRIEB`) or free-text input (`"12€ kebab for lunch"`) to a category from the user's budget list. | Eliminates the entry overhead and categorisation. |
| **Natural-language parsing** | Extracts amount, merchant, and category from informal text. | Lets users log expenses by typing one sentence. |
| **Weekly summary** | Produces a narrative like of the spendings *"You spent 23% more on dining this week, mostly on weekends."* | Provides trends and statistics|

## 4. Scenarios & Workflows

### Scenario A - Bank Import or Text Expense Upload

1. User configures budget categories and limits:
   - Groceries (€300)
   - Dining (€200)
   - Transport (€100)

2. User uploads:
   - a CSV export from one or multiple banks, or
   - an unstructured text file containing expenses.

3. The Transaction Service processes the uploaded data and forwards transactions to the AI Service for categorization.

4. Transactions are normalized and categorized automatically.

5. The Budget Service recalculates spending totals per category.

6. The dashboard updates in real time and displays:
   - Dining: €145 / €200 (72%)
   - Remaining budget per category
   - Recent transaction history across all connected banks and uploads.

7. Users can also access a centralized transaction history view containing all imported expenses in one place.


### Scenario B - Threshold Alert

1. User’s *Dining* budget reaches €165 / €200 after a new transaction.

2. The Budget Service detects that category usage exceeded the 80% threshold.

3. An alert event is generated.

4. The user receives an in-app notification:
   > "You've used 82% of your Dining budget — €35 remaining for this month."


### Scenario C - Weekly Spending Insight

1. A scheduled weekly job triggers the AI Service `/summarize` endpoint.

2. The AI Service receives:
   - categorized transactions from the current week
   - spending totals from the previous week.

3. The LLM generates a behavioral spending summary:
   > "Dining expenses increased by 23% compared to last week, primarily during weekends. Grocery spending decreased by €40."

4. The summary is displayed on the dashboard and optionally pushed as a notification.


### Scenario D - User Correction Feedback Loop

1. The AI Service incorrectly categorizes a pharmacy transaction as *Groceries*.

2. The user manually updates the category to *Health*.

3. The correction is stored in the system.

4. Future categorization requests can optionally use historical corrections to improve classification accuracy for similar transactions.

## 5. Preliminary Architecture — 3 Microservices

> Preliminary architecture focused on modularity and separation of concerns.

### 1. Transaction Service

**Responsibility:**  
Handles transaction import, normalization, storage, and history management.

**Flow:**  
Import CSV/text → send to AI Service for categorization → store transactions → expose history and filters.

**Features:**
- Bank CSV imports
- Free-text expense parsing
- Transaction history
- Filtering and manual edits

**API:**
- `POST /api/transactions/import`
- `POST /api/transactions`
- `GET /api/transactions`
- `GET /api/transactions/{id}`
- `PATCH /api/transactions/{id}/category`
- `DELETE /api/transactions/{id}`

---

### 2. Budget Service

**Responsibility:**  
Manages categories, spending limits, and budget monitoring.

**Flow:**  
User creates categories → transactions are aggregated per category → budget usage is calculated → alerts are triggered at thresholds.

**Features:**
- Budget tracking
- Threshold alerts (80% / 100%)
- Spend analytics per category

**API:**
- `POST /api/categories`
- `GET /api/categories`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}`
- `GET /api/budgets/status`

---

### 3. AI Service

**Responsibility:**  
Handles transaction categorization and financial summaries using LLM pipelines.

**Flow:**  
Receive transaction data → classify/summarize → return structured output.

**Features:**
- Transaction categorization
- Free-text parsing
- Weekly summaries
- User correction feedback loop

**API:**
- `POST /api/ai/categorize`
- `POST /api/ai/summarize`
- `GET /api/ai/summarize/latest`
