import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('../views/Dashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/sites',
      name: 'Sites',
      component: () => import('../views/Sites.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/databases',
      name: 'Databases',
      component: () => import('../views/Databases.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/email',
      name: 'Email',
      component: () => import('../views/Email.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/domains',
      name: 'Domains',
      component: () => import('../views/Domains.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/files',
      name: 'Files',
      component: () => import('../views/FileManager.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/ssl',
      name: 'SSL',
      component: () => import('../views/SSL.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/backups',
      name: 'Backups',
      component: () => import('../views/Backups.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/cron',
      name: 'Cron',
      component: () => import('../views/Cron.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'Users',
      component: () => import('../views/Users.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('../views/Settings.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'Profile',
      component: () => import('../views/Profile.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('../views/LoginPage.vue'),
      meta: { requiresAuth: false },
    },
  ],
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Check if route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
    return;
  }
  
  // Redirect authenticated users away from login page
  if (to.name === 'Login' && authStore.isAuthenticated) {
    next('/dashboard');
    return;
  }
  
  // Check if route requires admin role
  if (to.meta.requiresAdmin && authStore.user?.role !== 'ADMIN') {
    next('/dashboard');
    return;
  }
  
  next();
});

export default router;
