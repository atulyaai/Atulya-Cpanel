import { ref, reactive, readonly } from 'vue';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

const notifications = ref<Notification[]>([]);

export function useNotifications() {
  // Add a new notification
  function addNotification(notification: Omit<Notification, 'id' | 'timestamp'>) {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      id,
      timestamp: new Date(),
      duration: 5000, // Default 5 seconds
      ...notification,
    };

    notifications.value.push(newNotification);

    // Auto-remove notification after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }

  // Remove a notification by ID
  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  }

  // Clear all notifications
  function clearAll() {
    notifications.value = [];
  }

  // Helper functions for different notification types
  function success(title: string, message: string, duration?: number) {
    return addNotification({ type: 'success', title, message, duration });
  }

  function error(title: string, message: string, duration?: number) {
    return addNotification({ type: 'error', title, message, duration });
  }

  function warning(title: string, message: string, duration?: number) {
    return addNotification({ type: 'warning', title, message, duration });
  }

  function info(title: string, message: string, duration?: number) {
    return addNotification({ type: 'info', title, message, duration });
  }

  return {
    notifications: readonly(notifications),
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
  };
}
