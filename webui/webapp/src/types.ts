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
