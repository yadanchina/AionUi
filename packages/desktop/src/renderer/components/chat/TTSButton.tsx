/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useTTS } from '@renderer/hooks/useTTS';
import { iconColors } from '@renderer/styles/colors';
import { Tooltip } from '@arco-design/web-react';
import { VolumeNotice, VolumeMute } from '@icon-park/react';
import React, { useCallback } from 'react';

interface TTSButtonProps {
  text: string;
}

const TTSButton: React.FC<TTSButtonProps> = ({ text }) => {
  const { speak, speaking } = useTTS();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      speak(text);
    },
    [speak, text]
  );

  return (
    <Tooltip content={speaking ? '停止朗读' : '朗读'}>
      <div
        className='p-4px rd-4px cursor-pointer hover:bg-3 transition-colors opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto'
        onClick={handleClick}
        style={{ lineHeight: 0 }}
      >
        {speaking ? (
          <VolumeMute theme='outline' size='16' fill={iconColors.secondary} />
        ) : (
          <VolumeNotice theme='outline' size='16' fill={iconColors.secondary} />
        )}
      </div>
    </Tooltip>
  );
};

export default TTSButton;
