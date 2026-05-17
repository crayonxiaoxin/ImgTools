import { createI18n } from 'vue-i18n'
import zhCN from '@/locales/zh-CN'
import zhTW from '@/locales/zh-TW'
import en from '@/locales/en'

function detectLocale(): string {
  const langs = navigator.languages || [navigator.language]
  for (const lang of langs) {
    if (lang.startsWith('zh-TW') || lang.startsWith('zh-HK') || lang.startsWith('zh-MO')) return 'zh-TW'
    if (lang.startsWith('zh')) return 'zh-CN'
    if (lang.startsWith('en')) return 'en'
  }
  return 'zh-CN'
}

const saved = localStorage.getItem('imgtools-locale')

export default createI18n({
  legacy: false,
  locale: saved || detectLocale(),
  fallbackLocale: 'en',
  messages: { 'zh-CN': zhCN, 'zh-TW': zhTW, en },
})
