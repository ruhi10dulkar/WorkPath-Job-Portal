import { useCallback, useMemo, useRef, useState } from 'react'
import ToastContext from '../context/toastContext'

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)
  const showToast = useCallback((message, type = 'success') => {
    window.clearTimeout(timer.current)
    setToast({ message, type })
    timer.current = window.setTimeout(() => setToast(null), 3500)
  }, [])
  const value = useMemo(() => ({ showToast }), [showToast])
  return <ToastContext.Provider value={value}>{children}{toast && <div className={`toast toast-${toast.type}`} role="status">{toast.message}<button type="button" aria-label="Dismiss message" onClick={() => setToast(null)}>×</button></div>}</ToastContext.Provider>
}

