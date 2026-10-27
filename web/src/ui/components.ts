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

export function companyAvatarSvg(id: number, className = ''): string {
  const shapes = [
    '<path d="M4 11 12 5l8 6v9H4v-9Z"/><path d="M9 20v-6h6v6M2 11 12 4l10 7"/>',
    '<path d="M4 21h16M7 21V6h5M7 6h13M12 6l8 4M17 10v8M14 18h6v3h-6z"/>',
    '<path d="M5 16a7 7 0 0 1 14 0M3 16h18v4H3zM9 9V6h6v3"/>',
    '<path d="M4 21V10h5v11M10 21V4h5v17M16 21v-8h5v8M2 21h20"/>',
    '<path d="M4 4h16v16H4z"/><path d="M8 16V8h8M8 12h5"/>',
  ]
  const index = Math.max(0, Math.min(4, id))
  return `<svg class="company-avatar avatar-${index} ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" opacity="0.12"/>${shapes[index]}</svg>`
}
