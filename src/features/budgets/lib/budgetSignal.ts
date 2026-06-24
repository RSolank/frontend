// Moved to `shared/lib/budgetSignal` (the dashboard analytics zone classifies
// spend with the same logic, and the feature-boundary rule forbids importing a
// feature's internals). Re-exported here so existing budgets consumers
// (BudgetSignal / SpendGauge) keep their `../lib/budgetSignal` import.
export * from '../../../shared/lib/budgetSignal';
