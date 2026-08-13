<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const locales: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en': 'English',
}

const isDark = ref(document.documentElement.classList.contains('dark'))

function switchLang(lang: string) {
  locale.value = lang
  localStorage.setItem('imgtools-locale', lang)
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('imgtools-theme', isDark.value ? 'dark' : 'light')
}
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <img src="/logo.svg?v=2" alt="ImgTools" class="logo-icon" />
      <div class="brand-text">
        <h1 class="logo">ImgTools</h1>
        <p class="tagline">{{ t('app.tagline') }}</p>
      </div>
    </div>
    <div class="header-actions">
      <button
        class="icon-btn"
        type="button"
        @click="toggleTheme"
        :title="isDark ? t('app.themeToLight') : t('app.themeToDark')"
      >
        <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
      <div class="select-wrap">
        <select class="lang-select" :value="locale" @change="switchLang(($event.target as HTMLSelectElement).value)">
          <option v-for="(label, key) in locales" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 14px var(--space-4);
  background: color-mix(in srgb, var(--bg-surface) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.logo-icon { width: 28px; height: 28px; flex-shrink: 0; }
.brand-text { min-width: 0; }
.logo {
  font-size: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 0;
  color: var(--text);
  line-height: 1.15;
}
.tagline {
  font-size: 11px;
  color: var(--text-muted);
  margin: 2px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-h);
  height: var(--control-h);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color var(--ease), color var(--ease), background var(--ease);
}
.icon-btn:hover {
  border-color: var(--border-strong);
  color: var(--text);
  background: var(--bg-hover);
}
.select-wrap {
  position: relative;
}
.lang-select {
  appearance: none;
  height: var(--control-h);
  padding: 0 28px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background:
    var(--bg-surface)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  color: var(--text-secondary);
  font-size: var(--font-caption);
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: border-color var(--ease);
}
.lang-select:hover,
.lang-select:focus {
  border-color: var(--border-strong);
}

@media (max-width: 768px) {
  .app-header { padding: 12px var(--space-2); }
  .tagline { display: none; }
}
</style>
