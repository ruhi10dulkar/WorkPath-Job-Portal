import { useCallback, useEffect, useState } from 'react'
import { notificationService } from '../services/notificationService'
import { useToast } from '../context/useToast'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  const refresh = useCallback(async () => {
    try {
      const [items, count] = await Promise.all([notificationService.getAll(), notificationService.getUnreadCount()])
      setNotifications(items)
      setUnreadCount(count)
      setError('')
    } catch {
      setError('Notifications could not be loaded.')
    }
  }, [])

  useEffect(() => {
    const loadNotifications = window.setTimeout(refresh, 0)
    return () => window.clearTimeout(loadNotifications)
  }, [refresh])

  async function markRead(id) {
    try {
      const updated = await notificationService.markRead(id)
      setNotifications((items) => items.map((item) => item._id === id ? updated : item))
      setUnreadCount((count) => Math.max(0, count - 1))
      showToast('Notification marked as read')
    } catch {
      setError('This notification could not be updated.')
    }
  }

  async function markAllRead() {
    try {
      await notificationService.markAllRead()
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
      showToast('All notifications marked as read')
    } catch {
      setError('Notifications could not be updated.')
    }
  }

  return <div className="notification-menu">
    <button className="notification-trigger" type="button" aria-expanded={open} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} onClick={() => { setOpen((value) => !value); if (!open) refresh() }}>
      <svg className="bell-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span>Notifications</span>
      {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section className="notification-popover" aria-label="Notifications">
      <div className="notification-heading"><strong>Notifications</strong><button className="text-button" type="button" disabled={!unreadCount} onClick={markAllRead}>Mark all read</button></div>
      {error && <p className="notification-error" role="alert">{error}</p>}
      {!notifications.length && !error && <p className="notification-empty">You’re all caught up.</p>}
      <ul className="notification-list">
        {notifications.map((item) => <li key={item._id} className={item.isRead ? 'notification-item' : 'notification-item unread'}>
          <button type="button" className="notification-message" onClick={() => !item.isRead && markRead(item._id)}>
            <span className="notification-title">{item.title}</span><span>{item.message}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
          </button>
          {!item.isRead && <span className="notification-unread-dot" aria-label="Unread" />}
        </li>)}
      </ul>
    </section>}
  </div>
}
