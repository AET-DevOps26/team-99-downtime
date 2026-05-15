# ⚡ ExpenseFlow `by 99 Downtime`

---

## Component Diagram

![Component Diagram](./ComponentDiagram.png)
---

### 1. Auth Service

**Responsibility:**  
Handles authentication and identity (Better Auth), including user sign-in/sign-up flows, and issuing JWTs for token-based auth used by the other microservices.

**Flow:**  
Client signs in via AuthService → client retrieves a JWT (`/api/auth/token`) → client calls other services with `Authorization: Bearer <jwt>` → services validate tokens via JWKS (`/api/auth/jwks`).

**Features:**

- Email + password authentication
- (optionally) Social OAuth providers
- Session management (get session / sign out)
- Email verification
- Password reset + password change

**Client Usage (React):**

Create a Better Auth client in the React app

```ts
// apps/client/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [jwtClient()],
});
```

**JWT + JWKS for Microservices (Token-Based Auth):**

Other microservices can’t rely on browser session cookies, so they authenticate requests using a **JWT** issued by AuthService.

- The client retrieves a JWT via the JWT plugin:

```ts
const { data } = await authClient.token();
const jwt = data?.token;
```

- The client includes it on cross-service calls:

```ts
await fetch("/api/transactions", {
  headers: {
    Authorization: `Bearer ${jwt}`,
  },
});
```

- Each service validates tokens using AuthService’s **JWKS** endpoint (`GET /api/auth/jwks`) and caches keys. On `kid` mismatch, refresh JWKS. Spring can achieve this with the following `application.yml` entry:

```yml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          # The URL of auth service
          jwk-set-uri: http://auth-service:3000/api/auth/jwks
          issuer-uri: http://auth-service:3000
```

```mermaid
---
config:
  theme: dark
---
classDiagram
    direction TB

    class BetterAuth {
        +handler(request: Request): Promise~Response~
        +api: AuthAPI
        +options: AuthOptions
        +db: DatabaseAdapter
        +session: SessionManager
    }

    class AuthOptions {
        <<interface>>
        +database: DatabaseConfig
        +emailAndPassword: EmailPasswordConfig
        +socialProviders: Provider[]
        +plugins: BetterAuthPlugin[]
        +secondaryStorage: Storage
    }

    class DatabaseAdapter {
        <<interface>>
        +user: UserModel
        +session: SessionModel
        +account: AccountModel
        +verification: VerificationModel
        +create(table, data)
        +findOne(table, query)
    }

    class BetterAuthPlugin {
        <<abstract>>
        +id: string
        +hooks: PluginHooks
        +schema: TableSchema
        +endpoints: APIEndpoint[]
    }

    class User {
        +id: string
        +email: string
        +name: string
        +emailVerified: boolean
        +createdAt: Date
        +updatedAt: Date
    }

    class Session {
        +id: string
        +userId: string
        +expiresAt: Date
        +token: string
        +ipAddress: string
        +userAgent: string
        +createdAt: Date
        +updatedAt: Date
    }

    BetterAuth *-- AuthOptions : initialized with
    BetterAuth o-- DatabaseAdapter : talks to
    BetterAuth *-- Session : manages
    AuthOptions o-- BetterAuthPlugin : extends via
    DatabaseAdapter ..> User : persists
    DatabaseAdapter ..> Session : persists
```

---

### 2. Transaction Service

**Responsibility:**  
Handles transaction import, normalization, storage, and transaction history management.

**Flow:**  
Import CSV/text → send to AI Service for categorization → store transactions → expose history and filters.

**Features:**

- Bank CSV imports
- Free-text expense parsing
- Transaction history
- Filtering and manual edits

**API:**

| Method | Endpoint                   | Purpose                                        |
| ------ | -------------------------- | ---------------------------------------------- |
| POST   | `/api/transactions/import` | Import transactions from CSV/text              |
| POST   | `/api/transactions`        | Create a transaction                           |
| GET    | `/api/transactions`        | List transaction history (optionally filtered) |
| GET    | `/api/transactions/{id}`   | Get a single transaction by id                 |
| PATCH  | `/api/transactions/{id}`   | Update a transaction                           |
| DELETE | `/api/transactions/{id}`   | Delete a transaction                           |

```mermaid
---
config:
  theme: dark
---
classDiagram
    direction TB

    class TransactionController {
        <<RestController>>
        -transactionService: TransactionService
        +importCSV(file: File): Response
        +createTransaction(dto: TransactionDTO): Response
        +updateTransaction(id: UUID, dto: TransactionDTO): Response
        +getHistory(filters: Filters): List~Transaction~
    }

    class TransactionService {
        -transactionRepostiory: TransactionRepository
        -genAiServiceClient: GenAiServiceClient
        +processCSVImport(file: File): Task
        +normalizeData(raw: RawData): Transaction
        +processWithGenAI(transaction: Transaction): Transaction
        +processWithGenAIBatch(transactions: Transaction[]): Transaction[]
    }

    class TransactionRepository {
        <<interface>>
        +save(entity: Transaction)
        +findByFilters(filters: Filters): Page~Transaction~
        +findByUserId(userId: String): List~Transaction~
    }

    class GenAiServiceClient {
        <<interface>>
        +categorize(data: Map): AICategoryResponse
    }

    class Transaction {
        +id: UUID
        +userId: String
        +date: DateTime
        +amount: BigDecimal
        +currency: String
        +description: String
        +category: String
        +metadata: JsonNode
    }

    class Filters {
        +startDate: Date
        +endDate: Date
        +minAmount: Double
        +maxAmount: Double
        +categories: String[]
    }


    TransactionController --> TransactionService : delegates to
    TransactionController ..> Filters : binds query params
    TransactionService --> TransactionRepository : persists via
    TransactionService --> GenAiServiceClient
    TransactionRepository ..> Transaction : manages
    TransactionService ..> Transaction : maps DTOs to
```

---

### 3. Budget Service

**Responsibility:**  
Manages categories, spending limits, and budget monitoring.

**Flow:**  
User creates categories → transactions are aggregated per category → budget usage is calculated → alerts are triggered at thresholds.

**Features:**

- Budget tracking
- Threshold alerts (80% / 100%)
- Spend analytics per category

**API:**

| Method | Endpoint               | Purpose                         |
| ------ | ---------------------- | ------------------------------- |
| POST   | `/api/categories`      | Create a category               |
| GET    | `/api/categories`      | List categories                 |
| PUT    | `/api/categories/{id}` | Update a category               |
| DELETE | `/api/categories/{id}` | Delete a category               |
| GET    | `/api/budgets/status`  | Get budget usage/status summary |

```mermaid
---
config:
  theme: dark
---
classDiagram
    direction TB

    class BudgetController {
        -budgetService: BudgetService
        +createCategory(dto: CategoryDTO): ResponseEntity
        +getCategories(): List~Category~
        +getBudgetStatus(): BudgetSummaryDTO
        +updateThreshold(id: UUID, limit: Double)
    }

    class BudgetService {
        -categoryRepo: CategoryRepository
        -limitRepo: LimitRepository
        -transactionClient: TransactionClient
        +calculateUsage(userId: String): List~BudgetUsage~
        +checkThresholds(userId: String): List~Alert~
    }

    class CategoryRepository {
        <<interface>>
        +findByUserId(userId: String): List~Category~
        +findByName(name: String): Category
    }

    class LimitRepository {
        <<interface>>
        +findByCategoryId(categoryId: UUID): BudgetLimit
    }

    class Category {
        +id: UUID
        +userId: String
        +name: String
        +icon: String
        +color: String
    }

    class BudgetLimit {
        +id: UUID
        +categoryId: UUID
        +monthlyLimit: BigDecimal
        +alertThreshold: Double
        +isActive: Boolean
    }

    class BudgetUsage {
        +categoryId: UUID
        +spentAmount: BigDecimal
        +remainingAmount: BigDecimal
        +percentage: Double
    }

    %% Relationships
    BudgetController --> BudgetService : delegates to
    BudgetService --> CategoryRepository : manages categories
    BudgetService --> LimitRepository : manages limits
    CategoryRepository ..> Category : persists
    LimitRepository ..> BudgetLimit : persists
    BudgetService ..> BudgetUsage : computes

```

---

### 4. Notification Service (or different service?)

**Responsibility:**  
Sends out notifications when budget limits are reached.

**TBD**

---

### 5. AI Service

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

| Method | Endpoint                   | Purpose                                      |
| ------ | -------------------------- | -------------------------------------------- |
| POST   | `/api/ai/categorize`       | Categorize a transaction / free-text expense |
| POST   | `/api/ai/summarize`        | Generate a financial summary                 |
| GET    | `/api/ai/summarize/latest` | Fetch the latest summary                     |

```mermaid
---
config:
  theme: dark
---
classDiagram
    direction TB

    class GenAIController {
        TBD
        +categorize(data: ): JSONResponse
        +summarize(data: ): JSONResponse
        +get_latest_summary(): JSONResponse
    }

```

---
