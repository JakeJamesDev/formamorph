import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in place of the children once they throw. */
  fallback: ReactNode;
  onError?: (error: unknown) => void;
}

/** Holds a lazy-loaded part's failure to that part, so a failed chunk fetch never reaches the screen's boundary. */
export class LoadFailureBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('A lazy-loaded part did not load:', error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
