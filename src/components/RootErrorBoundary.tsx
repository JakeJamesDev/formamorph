import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RootCrashScreen } from './RootCrashScreen';

interface State {
  failure: { error: unknown; componentStack: string } | null;
}

/** Catches a crash anywhere below it and shows the recovery screen instead of a blank page. */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failure: null };

  // The screen shows at once on the derived state; the component stack only arrives in componentDidCatch.
  static getDerivedStateFromError(error: unknown): State {
    return { failure: { error, componentStack: '' } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('The app crashed:', error);
    this.setState({ failure: { error, componentStack: info.componentStack ?? '' } });
  }

  render() {
    const { failure } = this.state;
    if (!failure) return this.props.children;
    return <RootCrashScreen error={failure.error} componentStack={failure.componentStack} />;
  }
}
