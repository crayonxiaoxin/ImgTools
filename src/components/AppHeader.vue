<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { version } from '../../package.json'

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
    <img src="/logo.svg" alt="ImgTools" class="logo-icon" />
    <h1 class="logo">ImgTools</h1>
    <p class="tagline">{{ t('app.tagline') }}</p>
    <div class="spacer"></div>
    <button class="theme-btn" @click="toggleTheme" :title="isDark ? '切换亮色模式' : '切换暗黑模式'">
      <svg v-if="isDark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    </button>
    <select class="lang-select" :value="locale" @change="switchLang(($event.target as HTMLSelectElement).value)">
      <option v-for="(label, key) in locales" :key="key" :value="key">{{ label }}</option>
    </select>
    <span class="version">v{{ version }}</span>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}
.logo-icon { width: 28px; height: 28px; }
.logo { font-size: 18px; font-weight: 700; margin: 0; color: var(--text); }
.tagline { font-size: 12px; color: var(--text-muted); margin: 0 0 0 4px; }
.spacer { flex: 1; }
.theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
}
.theme-btn:hover { border-color: var(--primary); color: var(--primary); }
.lang-select {
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  outline: none;
}
.lang-select:hover { border-color: var(--text-faint); }
.version { font-size: 11px; color: var(--text-faint); margin-left: 8px; }

@media (max-width: 768px) {
  .app-header { padding: 10px 12px; gap: 6px; }
  .logo-icon { width: 24px; height: 24px; }
  .logo { font-size: 16px; }
  .tagline { display: none; }
}
</style>
