/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Widget error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div className='p-12px rd-8px bg-red-50 text-red-600 text-sm'>Widget rendering failed</div>;
    }
    return this.props.children;
  }
}
