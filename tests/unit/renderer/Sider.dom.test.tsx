/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({
    closePreview: vi.fn(),
  }),
}));

vi.mock('@renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@renderer/utils/ui/focus', () => ({
  blurActiveElement: vi.fn(),
}));

vi.mock('@renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: vi.fn(),
  getSiderTooltipProps: () => ({ disabled: true }),
}));

vi.mock('@renderer/styles/colors', () => ({
  iconColors: { primary: 'currentColor' },
}));

vi.mock('@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover', () => ({
  default: () => <div data-testid='conversation-search-popover' />,
}));

vi.mock('@renderer/pages/conversation/GroupedHistory', async () => {
  const router = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    default: () => {
      const { id } = router.useParams();
      return <div data-testid='grouped-history'>{id ?? 'missing-id'}</div>;
    },
  };
});

vi.mock('@renderer/pages/settings/components/SettingsSider', () => ({
  default: () => <div data-testid='settings-sider'>settings-sider</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@arco-design/web-react/icon', () => ({
  IconMoonFill: () => <span data-testid='icon-moon' />,
  IconSunFill: () => <span data-testid='icon-sun' />,
}));

vi.mock('@icon-park/react', () => ({
  ArrowCircleLeft: () => <span data-testid='icon-back' />,
  ListCheckbox: () => <span data-testid='icon-batch' />,
  Plus: () => <span data-testid='icon-plus' />,
  SettingTwo: () => <span data-testid='icon-settings' />,
}));

import Sider from '../../../src/renderer/components/layout/Sider';

const LayoutShell: React.FC = () => (
  <>
    <Sider />
    <Outlet />
  </>
);

describe('Sider', () => {
  it('renders grouped history inside the layout route without crashing on conversation pages', () => {
    render(
      <MemoryRouter initialEntries={['/conversation/conv-42']}>
        <Routes>
          <Route element={<LayoutShell />}>
            <Route path='/conversation/:id' element={<div data-testid='conversation-page' />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('grouped-history')).toHaveTextContent('conv-42');
    expect(screen.getByTestId('conversation-search-popover')).toBeInTheDocument();
  });

  it('renders the settings sider on settings routes', () => {
    render(
      <MemoryRouter initialEntries={['/settings/gemini']}>
        <Routes>
          <Route element={<LayoutShell />}>
            <Route path='/settings/gemini' element={<div data-testid='settings-page' />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('settings-sider')).toBeInTheDocument();
    expect(screen.queryByTestId('grouped-history')).not.toBeInTheDocument();
  });
});
