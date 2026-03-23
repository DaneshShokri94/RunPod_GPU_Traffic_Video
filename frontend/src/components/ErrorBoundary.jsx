import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  componentDidCatch(error) {
    this.setState({ error: error.message })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          Error: {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}
