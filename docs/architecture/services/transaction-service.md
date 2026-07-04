# Transaction Service

**Responsibility:**
Handles transaction import, normalization, storage, and transaction history management.

**Flow:**
Import CSV/text → send to AI Service for categorization → store transactions → expose history and filters.

**Features:**

- Bank CSV imports
- Free-text expense parsing
- Transaction history
- Filtering and manual edits

## API

| Method | Endpoint                   | Purpose                                        |
| ------ | -------------------------- | ---------------------------------------------- |
| POST   | `/api/transactions/import` | Import transactions from CSV/text              |
| POST   | `/api/transactions`        | Create a transaction                           |
| GET    | `/api/transactions`        | List transaction history (optionally filtered) |
| GET    | `/api/transactions/{id}`   | Get a single transaction by id                 |
| PATCH  | `/api/transactions/{id}`   | Update a transaction                           |
| DELETE | `/api/transactions/{id}`   | Delete a transaction                           |

## Class diagram

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
