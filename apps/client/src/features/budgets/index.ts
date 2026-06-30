// Public API for the budgets feature — import from here, not from internal files.
// Budget-service also owns the category taxonomy, so category management lives here.
export { ManageCategoriesModal } from './ui/ManageCategoriesModal';
export { useBudgetStatus } from './hooks/useBudgetStatus';
export { iconFor } from './lib/categoryIcons';
export type { CategoryStatus } from './api/budgetApi';
export type { CategoryIconDef } from './lib/categoryIcons';
