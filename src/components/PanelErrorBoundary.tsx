import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { describeError, showErrorDetails } from '@/lib/errorDetails';
import { PanelCrashCard } from './PanelCrashCard';

interface Props {
  children: ReactNode;
  /** The card clears when this value changes, so a different item gets a fresh panel. */
  resetKey?: unknown;
}

interface State {
  failure: { error: unknown; componentStack: string } | null;
  // Bumped by Try Again so the children remount instead of resuming the broken tree.
  attempt: number;
}

/** Catches a crash in one editor panel and shows the card in its place. Edits live in the data provider, so they survive. */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { failure: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { failure: { error, componentStack: '' } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('An editor panel crashed:', error);
    this.setState({ failure: { error, componentStack: info.componentStack ?? '' } });
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failure && !Object.is(prev.resetKey, this.props.resetKey)) this.tryAgain();
  }

  private tryAgain = () => {
    this.setState((s) => ({ failure: null, attempt: s.attempt + 1 }));
  };

  private viewDetails = () => {
    const { failure } = this.state;
    if (!failure) return;
    const entry = describeError(failure.error, 'This panel stopped working.');
    const stack = failure.componentStack.trim();
    showErrorDetails(stack ? { ...entry, details: `${entry.details}\n\nComponent stack:\n${stack}` } : entry);
  };

  render() {
    const { failure, attempt } = this.state;
    if (!failure) return <Fragment key={attempt}>{this.props.children}</Fragment>;
    return <PanelCrashCard onViewDetails={this.viewDetails} onTryAgain={this.tryAgain} />;
  }
}
