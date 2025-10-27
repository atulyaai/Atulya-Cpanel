import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// Mock the auth store
const mockAuthStore = {
  isLoading: false,
  isAuthenticated: false,
  checkAuth: vi.fn(),
};

vi.mock('./stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}));

// Mock components
vi.mock('./components/Sidebar.vue', () => ({
  default: { name: 'Sidebar', template: '<div>Sidebar</div>' },
}));

vi.mock('./components/Topbar.vue', () => ({
  default: { name: 'Topbar', template: '<div>Topbar</div>' },
}));

vi.mock('./views/LoginPage.vue', () => ({
  default: { name: 'LoginPage', template: '<div>LoginPage</div>' },
}));

// Mock PrimeVue components
vi.mock('primevue/toast', () => ({
  default: { name: 'Toast', template: '<div>Toast</div>' },
}));

vi.mock('primevue/confirmdialog', () => ({
  default: { name: 'ConfirmDialog', template: '<div>ConfirmDialog</div>' },
}));

describe('App', () => {
  let router: any;

  beforeEach(() => {
    setActivePinia(createPinia());
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/login', component: { template: '<div>Login</div>' } },
      ],
    });

    vi.clearAllMocks();
  });

  it('should render loading overlay when loading', () => {
    mockAuthStore.isLoading = true;
    mockAuthStore.isAuthenticated = false;

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.find('.fixed.inset-0').exists()).toBe(true);
    expect(wrapper.find('.animate-spin').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading...');
  });

  it('should render login page when not authenticated', () => {
    mockAuthStore.isLoading = false;
    mockAuthStore.isAuthenticated = false;

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.findComponent({ name: 'LoginPage' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'Sidebar' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'Topbar' }).exists()).toBe(false);
  });

  it('should render main layout when authenticated', () => {
    mockAuthStore.isLoading = false;
    mockAuthStore.isAuthenticated = true;

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.findComponent({ name: 'LoginPage' }).exists()).toBe(false);
    expect(wrapper.findComponent({ name: 'Sidebar' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'Topbar' }).exists()).toBe(true);
    expect(wrapper.find('main').exists()).toBe(true);
  });

  it('should call checkAuth on mount', async () => {
    mockAuthStore.isLoading = false;
    mockAuthStore.isAuthenticated = false;

    mount(App, {
      global: {
        plugins: [router],
      },
    });

    // Wait for next tick to ensure onMounted is called
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockAuthStore.checkAuth).toHaveBeenCalled();
  });

  it('should render toast and confirmation dialog components', () => {
    mockAuthStore.isLoading = false;
    mockAuthStore.isAuthenticated = true;

    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.findComponent({ name: 'Toast' }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: 'ConfirmDialog' }).exists()).toBe(true);
  });
});