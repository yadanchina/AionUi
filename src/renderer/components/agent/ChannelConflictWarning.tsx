/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Button, Link, Space, Typography } from '@arco-design/web-react';
import { IconExclamationCircle } from '@arco-design/web-react/icon';
import React from 'react';

const { Paragraph, Text } = Typography;

interface ChannelConflictWarningProps {
  platform: 'lark' | 'telegram';
  openclawConfigPath: string;
  onDisableOpenClaw?: () => void;
  onIgnore?: () => void;
}

/**
 * Warning component when openclaw channel conflicts with DataExa Channels
 */
export const ChannelConflictWarning: React.FC<ChannelConflictWarningProps> = ({
  platform,
  openclawConfigPath,
  onDisableOpenClaw,
  onIgnore,
}) => {
  const platformName = platform === 'lark' ? 'Lark/Feishu' : 'Telegram';
  const channelKey = platform === 'lark' ? 'feishu' : 'telegram';

  return (
    <Alert
      type='warning'
      icon={<IconExclamationCircle />}
      title={`${platformName} Channel Conflict Detected`}
      content={
        <Space direction='vertical' size='medium' style={{ width: '100%' }}>
          <Paragraph>
            <Text bold>通用智能体 is handling {platformName} messages, not DataExa.</Text>
          </Paragraph>

          <Paragraph>
            Your {platformName} bot credentials are also configured in 通用智能体. This means:
            <ul>
              <li>
                <Text type='error'>Switching agents in DataExa will have no effect</Text>
              </li>
              <li>
                <Text type='error'>Messages are processed by 通用智能体&apos;s agent</Text>
              </li>
              <li>
                <Text type='success'>Messages still work (via 通用智能体)</Text>
              </li>
            </ul>
          </Paragraph>

          <Paragraph>
            <Text bold>To use DataExa Channels and switch agents:</Text>
          </Paragraph>

          <Paragraph>
            <Text type='secondary'>Option 1: Disable 通用智能体 {platformName} (Recommended)</Text>
            <br />
            Edit: <Text code>{openclawConfigPath}</Text>
            <br />
            Set: <Text code>{`channels.${channelKey}.enabled = false`}</Text>
            <br />
            Then restart 通用智能体 and DataExa.
          </Paragraph>

          <Paragraph>
            <Text type='secondary'>Option 2: Use a different bot</Text>
            <br />
            Create a new {platformName} bot with different credentials for DataExa.
          </Paragraph>

          <Paragraph>
            <Text type='secondary'>Option 3: Keep using 通用智能体</Text>
            <br />
            Disable {platformName} in DataExa Channels and continue using 通用智能体&apos;s integration.
          </Paragraph>

          <Space>
            {onDisableOpenClaw && (
              <Button type='primary' onClick={onDisableOpenClaw}>
                Help me disable 通用智能体 {platformName}
              </Button>
            )}
            {onIgnore && (
              <Button type='text' onClick={onIgnore}>
                Ignore (I know what I&apos;m doing)
              </Button>
            )}
          </Space>
        </Space>
      }
      closable={false}
      style={{ marginBottom: 16 }}
    />
  );
};

/**
 * Compact warning banner (for settings page)
 */
export const ChannelConflictBanner: React.FC<{ platform: 'lark' | 'telegram'; onLearnMore: () => void }> = ({
  platform,
  onLearnMore,
}) => {
  const platformName = platform === 'lark' ? 'Lark/Feishu' : 'Telegram';

  return (
    <Alert
      type='warning'
      content={
        <Space>
          <Text>通用智能体 {platformName} conflict detected - Agent switching won&apos;t work.</Text>
          <Link onClick={onLearnMore}>Learn more</Link>
        </Space>
      }
      closable
      style={{ marginBottom: 12 }}
    />
  );
};
