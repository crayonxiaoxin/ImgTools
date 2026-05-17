<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { version } from '../../package.json'

const { t, locale } = useI18n()

const locales: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en': 'English',
}

function switchLang(lang: string) {
  locale.value = lang
  localStorage.setItem('imgtools-locale', lang)
}
</script>

<template>
  <header class="app-header">
    <img src="/logo.svg" alt="ImgTools" class="logo-icon" />
    <h1 class="logo">ImgTools</h1>
    <p class="tagline">{{ t('app.tagline') }}</p>
    <div class="spacer"></div>
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
  background: #fff;
  border-bottom: 1px solid #eee;
}
.logo-icon { width: 28px; height: 28px; }
.logo { font-size: 18px; font-weight: 700; margin: 0; color: #333; }
.tagline { font-size: 12px; color: #999; margin: 0 0 0 4px; }
.spacer { flex: 1; }
.lang-select {
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  color: #666;
  cursor: pointer;
  outline: none;
}
.lang-select:hover { border-color: #bbb; }
.version { font-size: 11px; color: #bbb; margin-left: 8px; }

@media (max-width: 768px) {
  .app-header { padding: 10px 12px; gap: 6px; }
  .logo-icon { width: 24px; height: 24px; }
  .logo { font-size: 16px; }
  .tagline { display: none; }
}
</style>
