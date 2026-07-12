import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render crash caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-5 text-sm text-danger-700">
          <p className="font-semibold mb-1">Something broke rendering this tab.</p>
          <p className="text-xs text-danger-600 mb-3">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}
            className="px-3 py-1.5 bg-white border border-danger-200 rounded-lg text-xs font-medium hover:bg-danger-100">
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
