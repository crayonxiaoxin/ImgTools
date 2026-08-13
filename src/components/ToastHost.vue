<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="item in toasts"
        :key="item.id"
        class="toast"
        :class="item.kind"
        role="status"
      >
        <span class="toast-msg">{{ item.message }}</span>
        <button type="button" class="toast-close" :aria-label="'Dismiss'" @click="dismiss(item.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 72px;
  right: var(--space-4);
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(360px, calc(100vw - 32px));
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-surface);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.toast.success {
  border-color: color-mix(in srgb, var(--success) 30%, var(--border));
  background: color-mix(in srgb, var(--success-bg) 80%, var(--bg-surface));
}
.toast.error {
  border-color: color-mix(in srgb, var(--danger) 30%, var(--border));
  background: color-mix(in srgb, var(--danger-bg) 80%, var(--bg-surface));
  color: var(--danger);
}
.toast.info {
  border-color: color-mix(in srgb, var(--primary) 25%, var(--border));
  background: color-mix(in srgb, var(--primary-bg) 70%, var(--bg-surface));
}
.toast-msg {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
  word-break: break-word;
}
.toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
.toast-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--ease), transform var(--ease);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .toast-host {
    top: auto;
    bottom: 72px;
    right: var(--space-2);
    left: var(--space-2);
    max-width: none;
  }
}
</style>
