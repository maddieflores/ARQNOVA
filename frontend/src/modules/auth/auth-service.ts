import { requestJson } from '../../services/http';
import { sessionStore } from './session-store';
import type { AuthUser, LoginInput, LoginResponse, RegisterInput, RegisterResponse } from './types';

export const authService = {
  login(input: LoginInput): Promise<LoginResponse> {
    return requestJson('/auth/login', { method: 'POST', body: input, authenticated: false });
  },
  register(input: RegisterInput): Promise<RegisterResponse> {
    return requestJson('/auth/register', { method: 'POST', body: input, authenticated: false });
  },
  getUser(signal?: AbortSignal): Promise<AuthUser> { return requestJson('/auth/me', { signal }); },
  saveSession(token: string): void { sessionStore.saveToken(token); },
  async recoverSession(signal?: AbortSignal): Promise<AuthUser | null> {
    return sessionStore.getToken() ? this.getUser(signal) : null;
  },
  hasSession(): boolean { return sessionStore.getToken() !== null; },
  logout(): void { sessionStore.clear(); },
};
