import { useState } from 'react'
import { t } from '@lingui/core/macro'
import type { Account } from '../../types'
import { describeError } from '../../api'
import { formatPercent } from '../../format'
import { useAsync } from '../../hooks'
import { Money } from '../../privacy'
import { groupingLabel } from '../../budgetUi'
import { SearchSelect } from '../SearchSelect'
import {
  budgetPercent,
  budgetStateLabel,
  budgetSummary,
  budgetTransactionsSearch,
  loadBudgetProgresses,
} from './budgetProgress'
import { Card, Kpi } from './shared'

export function BudgetsTab({
  accounts,
  onNavigate,
}: {
  accounts: Account[]
  onNavigate: (url: string) => void
}) {
  const [grouping, setGrouping] = useState('all')
  const [accountId, setAccountId] = useState('all')
  const budgets = useAsync(() => loadBudgetProgresses(), ['report-budgets'])
  const reportAccounts = accounts.filter(
    (account) =>
      account.portfolioRole === 'NONE' && !account.excludeFromTotals && !account.sealed,
  )
  const entries = (budgets.data ?? []).filter(
    (entry) =>
      (grouping === 'all' || entry.budget.grouping === grouping) &&
      (accountId === 'all' || entry.progress.accountId === Number(accountId)),
  )
  const summary = budgetSummary(entries)
  const over = entries.filter((entry) => budgetStateLabel(entry.progress) === 'over')
  const warn = entries.filter((entry) => budgetStateLabel(entry.progress) === 'warn')

  return (
    <>
      {budgets.error ? (
        <div className="banner" role="alert">
          {describeError(budgets.error, t`Could not load the budgets.`)}
        </div>
      ) : null}

      <div className="report-filters">
        <label className="field compact-field">
          <span>{t`Frequency`}</span>
          <select value={grouping} onChange={(event) => setGrouping(event.target.value)}>
            <option value="all">{t`All`}</option>
            <option value="DAY">{t`Daily`}</option>
            <option value="WEEK">{t`Weekly`}</option>
            <option value="MONTH">{t`Monthly`}</option>
            <option value="YEAR">{t`Yearly`}</option>
          </select>
        </label>
        <label className="field compact-field">
          <span>{t`Account`}</span>
          <SearchSelect
            ariaLabel={t`Account`}
            value={accountId}
            options={[
              { value: 'all', label: t`All accounts` },
              ...reportAccounts.map((account) => ({
                value: String(account.id),
                label: account.label,
              })),
            ]}
            onChange={setAccountId}
          />
        </label>
        <button
          type="button"
          className="btn ghost"
          onClick={() => onNavigate('?view=budgets')}
        >
          {t`Manage budgets`}
        </button>
      </div>

      <div className="kpis">
        <Kpi
          label={t`Limit for the period`}
          tone="sky"
          value={
            summary ? (
              <Money
                scope="totals"
                amountMinor={summary.allocated}
                currency={summary.currency}
                fractionDigits={summary.fractionDigits}
              />
            ) : (
              '—'
            )
          }
          foot={summary ? `${summary.currency} · ${summary.periodDescription}` : t`No budgets`}
        />
        <Kpi
          label={t`Already spent`}
          tone="rose"
          value={
            summary ? (
              <Money
                scope="totals"
                amountMinor={summary.spent}
                currency={summary.currency}
                fractionDigits={summary.fractionDigits}
              />
            ) : (
              '—'
            )
          }
        />
        <Kpi
          label={t`Still available`}
          tone="mint"
          value={
            summary ? (
              <Money
                scope="totals"
                amountMinor={summary.remaining}
                currency={summary.currency}
                fractionDigits={summary.fractionDigits}
                showSign
              />
            ) : (
              '—'
            )
          }
        />
        <Kpi
          label={t`Consumed`}
          tone="lav"
          value={
            summary && summary.allocated > 0
              ? formatPercent((summary.spent / summary.allocated) * 100)
              : '—'
          }
          foot={
            over.length > 0
              ? t`${over.length} budgets over the limit`
              : t`${warn.length} close to the limit`
          }
        />
      </div>

      {entries.length > 0 && !summary ? (
        <p className="banner info">
          {t`Budgets with different currencies or periods are shown separately.`}
        </p>
      ) : null}

      {entries.length === 0 && !budgets.loading ? (
        <Card title={t`Budgets`}>
          <div className="empty">
            <h3>{t`No budgets yet`}</h3>
            <p>{t`Create a budget in the app to follow its spending here.`}</p>
          </div>
        </Card>
      ) : null}

      {warn.length + over.length > 0 ? (
        <Card
          title={t`Needs attention`}
          description={t`Budgets close to or over their limit, marked with text and an icon.`}
        >
          <div className="budget-alerts">
            {[...over, ...warn].map((entry) => {
              const state = budgetStateLabel(entry.progress)
              return (
                <div className={`budget-alert ${state}`} key={entry.budget.id}>
                  <span className="budget-alert-icon" aria-hidden="true">
                    {state === 'over' ? '!' : '≈'}
                  </span>
                  <div>
                    <strong>{entry.budget.title}</strong>
                    <div className="card-note">
                      {state === 'over'
                        ? t`Over the limit by ${formatPercent(
                            budgetPercent(entry.progress) - 100,
                          )}`
                        : t`${formatPercent(budgetPercent(entry.progress))} of the limit used`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onNavigate(budgetTransactionsSearch(entry))}
                  >
                    {t`See operations`}
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}

      <div className="budget-report-list">
        {entries.map((entry) => {
          const state = budgetStateLabel(entry.progress)
          const percent = budgetPercent(entry.progress)
          const account = accounts.find((item) => item.id === entry.progress.accountId)
          return (
            <Card
              key={entry.budget.id}
              title={entry.budget.title}
              description={`${groupingLabel(entry.budget.grouping)} · ${
                account?.label ?? entry.budget.accountName ?? ''
              } · ${entry.progress.periodDescription}`}
              action={
                <button
                  type="button"
                  className="link"
                  onClick={() =>
                    onNavigate(`?view=budgets&detail=${entry.budget.id}`)
                  }
                >
                  {t`Open the budget`}
                </button>
              }
            >
              <div className="budget-report-body">
                <div className="budget-report-numbers">
                  <span>
                    {t`Spent`}{' '}
                    <strong>
                      <Money
                        scope="totals"
                        amountMinor={entry.progress.spentMinor}
                        currency={entry.progress.currency}
                        fractionDigits={entry.progress.fractionDigits}
                      />
                    </strong>
                  </span>
                  <span>
                    {t`Limit`}{' '}
                    <strong>
                      <Money
                        scope="totals"
                        amountMinor={entry.progress.allocatedMinor}
                        currency={entry.progress.currency}
                        fractionDigits={entry.progress.fractionDigits}
                      />
                    </strong>
                  </span>
                  <span className={`budget-report-state ${state}`}>
                    {state === 'over'
                      ? t`Over the limit`
                      : state === 'warn'
                        ? t`Close to the limit`
                        : t`Within the limit`}
                  </span>
                </div>
                <div className="budget-report-bar">
                  <div
                    className={`budget-report-fill ${state}`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <div className="budget-report-foot">
                  <span>{formatPercent(percent)}</span>
                  <button
                    type="button"
                    className="link"
                    onClick={() => onNavigate(budgetTransactionsSearch(entry))}
                  >
                    {t`See operations`}
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
