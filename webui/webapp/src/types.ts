export type TransactionKind = 'SIMPLE' | 'TRANSFER' | 'SPLIT'

export interface Meta {
  appVersion: string
  serverTime: string
  timeZone: string
  locale: string
  homeCurrency: string
  preferences: {
    timeEnabled: boolean
    valueDateEnabled: boolean
  }
}

export interface Account {
  id: number
  label: string
  type: string
  currency: string
  fractionDigits: number
  currentBalanceMinor: number
  totalMinor: number
  incomeMinor: number
  expensesMinor: number
  excludeFromTotals: boolean
  sealed: boolean
  color: number
  parentId: number | null
}

export interface EntityRef {
  id: number
  label: string
}

export interface CategoryRef {
  id: number
  label: string
  path: string | null
}

export interface SplitPart {
  id: number
  amountMinor: number
  payee: EntityRef | null
  category: CategoryRef | null
  tags: EntityRef[]
  comment: string
  method: EntityRef | null
  referenceNumber: string | null
  transferPeerId: number | null
}

export interface Transaction {
  id: number
  kind: TransactionKind
  accountId: number
  amountMinor: number
  currency: string
  fractionDigits: number
  date: string
  time: string | null
  valueDate: string
  payee: EntityRef | null
  category: CategoryRef | null
  tags: EntityRef[]
  comment: string
  method: EntityRef | null
  referenceNumber: string | null
  crStatus: string
  transferPeerId: number | null
  transferAccountId: number | null
  splitParts: SplitPart[] | null
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface Group {
  year: number
  second: number
  incomeMinor: number
  expensesMinor: number
  transfersMinor: number
}

export interface Category {
  id: number
  parentId: number | null
  label: string
  level: number
  color: number | null
  type: number | null
}

export interface Payee {
  id: number
  name: string
}

export interface Tag {
  id: number
  label: string
  color: number | null
}

export interface Method {
  id: number
  label: string
  isNumbered: boolean
  type: number
  accountTypes: string[]
}

export interface TransactionWrite {
  accountId: number
  amountMinor: number
  date: string
  time?: string | null
  valueDate?: string | null
  payeeId?: number | null
  categoryId?: number | null
  tagIds: number[]
  comment: string
  methodId?: number | null
  referenceNumber?: string | null
}

export interface TransferWrite {
  fromAccountId: number
  toAccountId: number
  amountMinor: number
  date: string
  time?: string | null
  valueDate?: string | null
  payeeId?: number | null
  comment: string
  methodId?: number | null
  referenceNumber?: string | null
  tagIds?: number[] | null
}

export interface SplitPartWrite {
  id?: number
  amountMinor: number
  categoryId?: number | null
  payeeId?: number | null
  tagIds?: number[] | null
  comment?: string
  methodId?: number | null
  referenceNumber?: string | null
}

export interface SplitWrite {
  accountId: number
  amountMinor: number
  date: string
  time?: string | null
  valueDate?: string | null
  payeeId?: number | null
  comment: string
  methodId?: number | null
  referenceNumber?: string | null
  tagIds?: number[] | null
  parts: SplitPartWrite[]
}

export interface FileEntry {
  name: string
  size: number
  modified: number
  link: string
}

export interface Budget {
  id: number
  accountId: number
  title: string
  description: string | null
  currency: string
  fractionDigits: number
  grouping: string
  color: number
  start: string | null
  end: string | null
  accountName: string | null
  isDefault: boolean
  uuid: string | null
  allocationMinor: number | null
}

export interface BudgetProgress {
  budgetId: number
  accountId: number
  title: string
  currency: string
  fractionDigits: number
  grouping: string
  periodYear: number | null
  periodSecond: number | null
  periodStart: string
  periodEnd: string
  periodDescription: string
  allocatedMinor: number
  spentMinor: number
  remainingMinor: number
  totalDays: number
  currentDay: number
  periodAllocationMinor: number | null
}

export interface BudgetWrite {
  accountId: number
  title: string
  description?: string | null
  grouping: string
  start?: string | null
  end?: string | null
  isDefault?: boolean
  amountMinor: number
}

export interface ReportSummary {
  accountId: number
  from: string
  to: string
  currency: string
  fractionDigits: number
  incomeMinor: number
  expensesMinor: number
  netMinor: number
  count: number
}

export interface BreakdownItem {
  id: number
  label: string
  amountMinor: number
  count: number
  share: number
}

export interface Breakdown {
  accountId: number
  from: string
  to: string
  by: 'category' | 'payee' | 'tag' | 'method'
  type: 'expense' | 'income' | 'both'
  currency: string
  fractionDigits: number
  totalMinor: number
  items: BreakdownItem[]
}

export interface BudgetAllocation {
  categoryId: number
  label: string
  level: number
  parentId: number | null
  allocatedMinor: number
  spentMinor: number
  rolloverPreviousMinor: number
  rolloverNextMinor: number
}

export interface BudgetAllocationWrite {
  categoryId: number
  amountMinor: number | null
  oneTime?: boolean
}

export interface BudgetAllocationsWrite {
  year: number
  second: number
  allocations: BudgetAllocationWrite[]
  rollover?: BudgetAllocationWrite[]
}

export interface BudgetHistoryPoint {
  periodYear: number | null
  periodSecond: number | null
  periodDescription: string
  allocatedMinor: number
  spentMinor: number
  remainingMinor: number
}
