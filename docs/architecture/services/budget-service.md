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

| Method | Endpoint                       | Purpose                          |
| ------ | ------------------------------ | -------------------------------- |
| GET    | `/api/budgets/categories`      | List categories                  |
| POST   | `/api/budgets/categories`      | Create a category                |
| PATCH  | `/api/budgets/categories/{id}` | Update a category                |
| DELETE | `/api/budgets/categories/{id}` | Delete a category                |
| GET    | `/api/budgets/status`          | Get budget usage/status summary  |
| POST   | `/api/budgets/threshold-check` | Evaluate budget alert thresholds |
| GET    | `/api/budgets/me`              | Probe the authenticated user     |

## Class diagram

```mermaid
---
config:
  theme: dark
---
classDiagram
    direction TB

    class BudgetStatusController {
        -budgetStatusService: BudgetStatusService
        +status(jwt: Jwt): List~BudgetStatusResponse~
    }

    class BudgetStatusService {
        -categoryRepo: CategoryRepository
        -limitRepo: LimitRepository
        -transactionClient: TransactionClient
        +getStatus(userId: String, authHeader: String): List~BudgetStatusResponse~
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

    BudgetStatusController --> BudgetStatusService : delegates to
    BudgetStatusService --> CategoryRepository : manages categories
    BudgetStatusService --> LimitRepository : manages limits
    CategoryRepository ..> Category : persists
    LimitRepository ..> BudgetLimit : persists
    BudgetStatusService ..> BudgetUsage : computes
```
