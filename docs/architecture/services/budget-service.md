# Budget Service

**Responsibility:**
Manages categories, spending limits, and budget monitoring.

**Flow:**
User creates categories → transactions are aggregated per category → budget usage is calculated → alerts are triggered at thresholds.

**Features:**

- Budget tracking
- Threshold alerts (80% / 100%)
- Spend analytics per category

## API

| Method | Endpoint               | Purpose                         |
| ------ | ---------------------- | ------------------------------- |
| POST   | `/api/categories`      | Create a category               |
| GET    | `/api/categories`      | List categories                 |
| PUT    | `/api/categories/{id}` | Update a category               |
| DELETE | `/api/categories/{id}` | Delete a category               |
| GET    | `/api/budgets/status`  | Get budget usage/status summary |

## Class diagram

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

    BudgetController --> BudgetService : delegates to
    BudgetService --> CategoryRepository : manages categories
    BudgetService --> LimitRepository : manages limits
    CategoryRepository ..> Category : persists
    LimitRepository ..> BudgetLimit : persists
    BudgetService ..> BudgetUsage : computes
```
