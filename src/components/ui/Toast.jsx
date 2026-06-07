import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

const ICONS  = { success:'✓', error:'✗', info:'ℹ', warning:'⚠' }
const COLORS = {
  success: { bg:'var(--color-success-bg)', border:'rgba(58,170,106,0.3)',  color:'var(--color-success)'  },
  error:   { bg:'var(--color-danger-bg)',  border:'rgba(224,85,85,0.3)',   color:'var(--color-danger)'   },
  info:    { bg:'var(--color-info-bg)',    border:'rgba(91,159,224,0.3)',  color:'var(--color-info)'     },
  warning: { bg:'rgba(232,148,58,0.15)',   border:'rgba(232,148,58,0.3)', color:'var(--color-warning)'  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div style={{
        position:'fixed', bottom:'24px', right:'24px',
        display:'flex', flexDirection:'column', gap:'10px',
        zIndex:99999, pointerEvents:'none',
      }}>
        {toasts.map(toast => {
          const c = COLORS[toast.type] || COLORS.success
          return (
            <div key={toast.id} onClick={() => dismiss(toast.id)}
              style={{
                display:'flex', alignItems:'center', gap:'10px',
                background:c.bg, border:`1px solid ${c.border}`,
                borderRadius:'8px', padding:'12px 16px',
                minWidth:'240px', maxWidth:'360px',
                boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
                pointerEvents:'all', cursor:'pointer',
                animation:'toastIn 250ms ease',
                fontFamily:'var(--font-body)',
              }}>
              <span style={{ fontSize:'16px', color:c.color, fontWeight:700, flexShrink:0 }}>
                {ICONS[toast.type]}
              </span>
              <span style={{ fontSize:'13px', color:'var(--text-primary)', lineHeight:1.4, flex:1 }}>
                {toast.message}
              </span>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translateX(40px); }
          to   { opacity:1; transform:translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.show
}
