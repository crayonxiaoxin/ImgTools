import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/compress' },
  { path: '/compress', name: 'compress', component: () => import('@/views/ModePage.vue') },
  { path: '/convert', name: 'convert', component: () => import('@/views/ModePage.vue') },
  { path: '/favicon', name: 'favicon', component: () => import('@/views/ModePage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
