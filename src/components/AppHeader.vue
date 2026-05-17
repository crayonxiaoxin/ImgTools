<script setup lang="ts">
import { version } from '../../package.json'
</script>

<template>
  <header class="app-header">
    <img src="/logo.svg" alt="ImgTools" class="logo-icon" />
    <h1 class="logo">ImgTools</h1>
    <p class="tagline">浏览器端图片处理工具</p>
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
.logo-icon {
  width: 28px;
  height: 28px;
}
.logo {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: #333;
}
.tagline {
  font-size: 12px;
  color: #999;
  margin: 0 0 0 4px;
}
.version {
  font-size: 11px;
  color: #bbb;
  margin-left: auto;
}

@media (max-width: 768px) {
  .app-header {
    padding: 10px 12px;
  }
  .logo-icon {
    width: 24px;
    height: 24px;
  }
  .logo {
    font-size: 16px;
  }
  .tagline {
    display: none;
  }
}
</style>
