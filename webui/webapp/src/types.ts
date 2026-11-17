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
