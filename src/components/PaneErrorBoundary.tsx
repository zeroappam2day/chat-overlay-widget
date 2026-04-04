import { Component, type ReactNode, type ErrorInfo } from 'react';
import { usePaneStore } from '../store/paneStore';

interface Props {
  paneId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PaneErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`[PaneErrorBoundary] Pane ${this.props.paneId} crashed:`, error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleClose = (): void => {
    usePaneStore.getState().closePane(this.props.paneId);
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e] border-2 border-red-500/50 rounded p-4 text-center">
          <svg width="32" height="32" viewBox="0 0 16 16" fill="#f44747" className="mb-2">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8.75 8a.75.75 0 0 1-1.5 0V4.5a.75.75 0 0 1 1.5 0V8z" />
          </svg>
          <h3 className="text-sm font-medium text-red-400 mb-1">Pane crashed</h3>
          <p className="text-xs text-gray-400 mb-3 max-w-[300px]">
            {error?.message?.slice(0, 200) ?? 'Unknown error'}
          </p>
          {errorInfo?.componentStack && (
            <details className="mb-3 text-left w-full max-w-[400px]">
              <summary className="text-[10px] text-gray-500 cursor-pointer">Stack trace</summary>
              <pre className="text-[9px] text-gray-600 mt-1 overflow-auto max-h-[150px] bg-[#151515] p-2 rounded">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-3 py-1 text-xs bg-[#333] hover:bg-[#444] text-gray-300 rounded transition-colors"
            >
              Retry
            </button>
            <button
              onClick={this.handleClose}
              className="px-3 py-1 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded transition-colors"
            >
              Close Pane
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
