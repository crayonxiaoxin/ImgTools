import { reactive } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const toasts = reactive<ToastItem[]>([])
let nextId = 1

function push(kind: ToastKind, message: string, durationMs = 4200) {
  const id = nextId++
  toasts.push({ id, kind, message })
  window.setTimeout(() => dismiss(id), durationMs)
  return id
}

export function dismiss(id: number) {
  const idx = toasts.findIndex(t => t.id === id)
  if (idx !== -1) toasts.splice(idx, 1)
}

export function useToast() {
  return {
    toasts,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message, 5600),
    info: (message: string) => push('info', message),
    dismiss,
  }
}
