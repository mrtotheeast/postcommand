import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('PostCommand error boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding:'60px 24px', textAlign:'center', maxWidth:'480px', margin:'0 auto' }}>
          <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'var(--color-danger-bg)', border:'1px solid rgba(192,57,43,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'22px', letterSpacing:'2px', color:'var(--text-primary)', marginBottom:'8px' }}>SOMETHING WENT WRONG</h2>
          <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'8px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'24px' }}>
            Your data is safe. This error has been noted.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--accent)', color:'var(--text-inverse)', border:'none', borderRadius:'var(--radius-sm)', padding:'0 24px', height:'44px', fontFamily:'var(--font-condensed)', fontSize:'13px', fontWeight:700, letterSpacing:'1px', cursor:'pointer' }}
          >
            RELOAD PAGE
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
