import { apiRequest } from './authService'

export const notificationService = {
  async getAll() {
    const result = await apiRequest('/notifications')
    return result.notifications
  },
  async getUnreadCount() {
    const result = await apiRequest('/notifications/unread-count')
    return result.count
  },
  async markRead(id) {
    const result = await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' })
    return result.notification
  },
  async markAllRead() {
    return apiRequest('/notifications/read-all', { method: 'PATCH' })
  },
}
