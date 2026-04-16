/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NextFunction, Request, Response } from 'express';
import type { IncomingMessage } from 'http';
import * as cookie from 'cookie';
import { AuthService } from '../service/AuthService';
import { UserRepository } from '../repository/UserRepository';
import { AUTH_CONFIG, SERVER_CONFIG } from '../../config/constants';

/**
 * Token payload interface
 */
export interface TokenPayload {
  userId: string;
  username: string;
}

function isRemoteWebuiAuthDisabled(): boolean {
  return SERVER_CONFIG.isWebServerActive;
}

/**
 * Token extractor for HTTP requests.
 */
class TokenExtractor {
  /**
   * Extract token from request, supporting:
   * 1. Authorization header (Bearer token)
   * 2. Cookie (aionui-session)
   */
  static extract(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    if (typeof req.cookies === 'object' && req.cookies) {
      const cookieToken = req.cookies[AUTH_CONFIG.COOKIE.NAME];
      if (typeof cookieToken === 'string' && cookieToken.trim() !== '') {
        return cookieToken;
      }
    }

    return null;
  }
}

interface ValidationStrategy {
  handleUnauthorized(res: Response): void;
}

class JsonValidationStrategy implements ValidationStrategy {
  handleUnauthorized(res: Response): void {
    res.status(403).json({ success: false, error: 'Access denied. Please login first.' });
  }
}

class HtmlValidationStrategy implements ValidationStrategy {
  handleUnauthorized(res: Response): void {
    res.status(403).send('Access Denied');
  }
}

class ValidatorFactory {
  static create(type: 'json' | 'html'): ValidationStrategy {
    if (type === 'html') {
      return new HtmlValidationStrategy();
    }

    return new JsonValidationStrategy();
  }
}

/**
 * Create authentication middleware.
 */
export const createAuthMiddleware = (type: 'json' | 'html' = 'json') => {
  const strategy = ValidatorFactory.create(type);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isRemoteWebuiAuthDisabled()) {
      next();
      return;
    }

    const token = TokenExtractor.extract(req);
    if (!token) {
      strategy.handleUnauthorized(res);
      return;
    }

    const decoded = await AuthService.verifyToken(token);
    if (!decoded) {
      strategy.handleUnauthorized(res);
      return;
    }

    const user = await UserRepository.findById(decoded.userId);
    if (!user) {
      strategy.handleUnauthorized(res);
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
    };

    next();
  };
};

export const TokenUtils = {
  extractFromRequest(req: Request): string | null {
    return TokenExtractor.extract(req);
  },
};

/**
 * TokenMiddleware utility - unified token authentication helpers.
 */
export const TokenMiddleware = {
  extractToken(req: Request): string | null {
    return TokenExtractor.extract(req);
  },

  async isTokenValid(token: string | null): Promise<boolean> {
    if (isRemoteWebuiAuthDisabled()) {
      return true;
    }

    return Boolean(token && (await AuthService.verifyToken(token)));
  },

  validateToken(options?: {
    responseType?: 'json' | 'html';
  }): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return createAuthMiddleware(options?.responseType ?? 'json');
  },

  extractWebSocketToken(req: IncomingMessage): string | null {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const cookieHeader = req.headers['cookie'];
    if (typeof cookieHeader === 'string') {
      const cookies = cookie.parse(cookieHeader);
      const cookieToken = cookies[AUTH_CONFIG.COOKIE.NAME];
      if (cookieToken) {
        return cookieToken;
      }
    }

    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (typeof protocolHeader === 'string' && protocolHeader.trim() !== '') {
      return protocolHeader.split(',')[0]?.trim() ?? null;
    }

    return null;
  },

  async validateWebSocketToken(token: string | null): Promise<boolean> {
    if (isRemoteWebuiAuthDisabled()) {
      return true;
    }

    return Boolean(token && (await AuthService.verifyWebSocketToken(token)));
  },
};
