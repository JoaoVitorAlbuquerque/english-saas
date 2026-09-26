import { ErrorState } from '@english-saas/ui';
import { Component } from 'react';
import type { ReactNode } from 'react';

import { t } from '../messages/pt-BR';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-ground p-6">
          <ErrorState
            title={t('error.boundary.title')}
            description={t('error.boundary.description')}
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
