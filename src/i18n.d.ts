import type en from './locales/en'

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends typeof en {}
}
