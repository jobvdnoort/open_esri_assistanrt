import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ep-org-panel" style={{ padding: '2rem' }}>
          <p className="form-error">
            Er ging iets mis{this.props.label ? ` (${this.props.label})` : ''}:{' '}
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="ep-btn ep-btn--outline"
            onClick={() => this.setState({ error: null })}
          >
            Opnieuw proberen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
