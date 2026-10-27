import type { JournalEntry } from '../game/types'

export const money = (value: number): string => `${Math.round(value).toLocaleString('ru-RU')} ₽`
export const number = (value: number): string => Math.round(value).toLocaleString('ru-RU')
export const percent = (value: number): string => `${Math.round(value * 100)}%`
export const compactMoney = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`
  if (abs >= 1_000) return `${Math.round(value / 1_000).toLocaleString('ru-RU')} тыс. ₽`
  return money(value)
}
export const esc = (value: string): string => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
export const pad = (value: number): string => String(value).padStart(2, '0')

export function badge(text: string, tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' = 'neutral'): string {
  return `<span class="badge badge-${tone}">${esc(text)}</span>`
}

export function progress(value: number, label = '', tone = ''): string {
  const normalized = Math.max(0, Math.min(1, value))
  return `<div class="progress-wrap">${label ? `<div class="progress-label"><span>${esc(label)}</span><strong>${percent(normalized)}</strong></div>` : ''}<div class="progress ${tone}" role="progressbar" aria-valuenow="${Math.round(normalized * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${normalized * 100}%"></span></div></div>`
}

export function emptyState(icon: string, title: string, text: string, action = ''): string {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`
}

export function pageHeading(eyebrow: string, title: string, description: string, aside = ''): string {
  return `<header class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${aside}</header>`
}

export function journalItem(entry: JournalEntry): string {
  return `<article class="journal-item journal-${entry.kind}"><div class="journal-meta">День ${entry.day} · ${pad(entry.hour)}:00</div><p>${esc(entry.text)}</p></article>`
}
