import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/compress' },
  { path: '/compress', name: 'compress', component: () => import('@/App.vue') },
  { path: '/convert', name: 'convert', component: () => import('@/App.vue') },
  { path: '/favicon', name: 'favicon', component: () => import('@/App.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
