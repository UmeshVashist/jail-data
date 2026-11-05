/**
 * client/src/components/ErrorBoundary.jsx
 * Global React Error Boundary to catch render crashes and prevent blank screens
 */

import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo);
    window.__REACT_ERROR__ = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    };
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="d-flex align-items-center justify-content-center p-4 min-vh-50">
          <div className="card custom-table-card border-danger p-4 rounded-3 text-center" style={{ maxWidth: '600px', width: '100%' }}>
            <div className="mb-3">
              <i className="bi bi-exclamation-triangle-fill text-danger fs-1"></i>
            </div>
            <h4 className="fw-bold text-white mb-2">Something went wrong</h4>
            <p className="text-muted small mb-3">
              An unexpected render error occurred in this section. The rest of the portal is safe.
            </p>
            {this.state.error && (
              <div className="alert alert-dark text-start font-monospace small mb-3 p-3 bg-black border-secondary border-opacity-50 overflow-auto" style={{ maxHeight: '160px' }}>
                <span className="text-danger fw-bold">{this.state.error.toString()}</span>
              </div>
            )}
            <div className="d-flex justify-content-center gap-2">
              <button
                type="button"
                className="btn btn-outline-cyan btn-sm px-3"
                onClick={this.handleReset}
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i> Try Again
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm px-3"
                onClick={this.handleReload}
              >
                <i className="bi bi-arrow-clockwise me-1"></i> Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
