import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '32px',
            backgroundColor: 'var(--bg)',
            color: 'var(--alert)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)', marginBottom: '16px' }}>
            Application Error
          </h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--alert)' }}>
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              borderRadius: 'var(--radius)',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
