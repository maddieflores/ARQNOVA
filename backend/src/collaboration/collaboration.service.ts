import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Server } from 'socket.io';
import type { AuthUser } from '../auth/auth-user';

export type LockElementType = 'UML_CLASS' | 'UML_RELATION';
export interface ProjectLock { projectId: string; elementType: LockElementType; elementId: string; userId: string; socketId: string; userName: string; acquiredAt: string; expiresAt: string }
interface PresenceConnection { socketId: string; user: AuthUser }

@Injectable()
export class CollaborationService implements OnModuleDestroy {
  static readonly LOCK_TTL_MS = 30_000;
  private server?: Server;
  private readonly presence = new Map<string, Map<string, PresenceConnection>>();
  private readonly locks = new Map<string, ProjectLock>();
  private readonly cleanupTimer = setInterval(() => this.cleanupExpiredLocks(), 5_000);

  constructor() { this.cleanupTimer.unref(); }
  onModuleDestroy() { clearInterval(this.cleanupTimer); }
  attachServer(server: Server) { this.server = server; }
  room(projectId: string) { return `project:${projectId}`; }

  join(projectId: string, socketId: string, user: AuthUser) {
    const connections = this.presence.get(projectId) ?? new Map<string, PresenceConnection>();
    connections.set(socketId, { socketId, user }); this.presence.set(projectId, connections);
    return this.getPresence(projectId);
  }

  leave(projectId: string, socketId: string) {
    const connections = this.presence.get(projectId); connections?.delete(socketId); if (connections?.size === 0) this.presence.delete(projectId);
    const released = this.releaseBySocket(socketId, projectId); this.emitPresence(projectId); for (const lock of released) this.emitLock(projectId, 'uml:lock:released', lock);
  }

  disconnect(socketId: string) {
    const projects: string[] = [];
    for (const [projectId, connections] of this.presence) if (connections.delete(socketId)) { projects.push(projectId); if (connections.size === 0) this.presence.delete(projectId); }
    const released = this.releaseBySocket(socketId); for (const projectId of projects) this.emitPresence(projectId); for (const lock of released) this.emitLock(lock.projectId, 'uml:lock:released', lock);
  }

  getPresence(projectId: string) {
    const unique = new Map<string, AuthUser>(); for (const connection of this.presence.get(projectId)?.values() ?? []) unique.set(connection.user.id, connection.user);
    return [...unique.values()].map(user => ({ id: user.id, name: user.name, role: user.role.name }));
  }

  getLocks(projectId: string) { this.cleanupExpiredLocks(); return [...this.locks.values()].filter(lock => lock.projectId === projectId); }

  acquire(projectId: string, elementType: LockElementType, elementId: string, socketId: string, user: AuthUser) {
    this.cleanupExpiredLocks(); const key = this.lockKey(projectId, elementType, elementId); const existing = this.locks.get(key);
    if (existing && existing.socketId !== socketId) throw new ConflictException(`Elemento bloqueado por ${existing.userName}`);
    const now = new Date(); const lock: ProjectLock = { projectId, elementType, elementId, userId: user.id, socketId, userName: user.name, acquiredAt: existing?.acquiredAt ?? now.toISOString(), expiresAt: new Date(now.getTime() + CollaborationService.LOCK_TTL_MS).toISOString() };
    this.locks.set(key, lock); this.emitLock(projectId, 'uml:lock:acquired', lock); return lock;
  }

  release(projectId: string, elementType: LockElementType, elementId: string, socketId: string) {
    const key = this.lockKey(projectId, elementType, elementId); const lock = this.locks.get(key);
    if (!lock || lock.socketId !== socketId) return false;
    this.locks.delete(key); this.emitLock(projectId, 'uml:lock:released', lock); return true;
  }

  assertCanEdit(projectId: string, elementType: LockElementType, elementId: string, userId: string) {
    this.cleanupExpiredLocks(); const lock = this.locks.get(this.lockKey(projectId, elementType, elementId));
    if (lock && lock.userId !== userId) throw new ConflictException(`Elemento bloqueado por ${lock.userName}`);
  }

  publish(projectId: string, event: string, diagram: unknown, originUserId: string) {
    this.server?.to(this.room(projectId)).emit(event, { projectId, diagram, originUserId, persistedAt: new Date().toISOString() });
  }

  emitProposalReceived(projectId: string, proposal: unknown, originUser?: { id: string; name: string }) {
    this.server?.to(this.room(projectId)).emit('uml:proposal:received', {
      projectId,
      proposal,
      originUser,
      receivedAt: new Date().toISOString(),
      message: 'Se recibió una nueva propuesta UML desde el dispositivo móvil.',
    });
  }

  emitPresence(projectId: string) { this.server?.to(this.room(projectId)).emit('project:presence', this.getPresence(projectId)); }

  private releaseBySocket(socketId: string, projectId?: string) {
    const released: ProjectLock[] = []; for (const [key, lock] of this.locks) if (lock.socketId === socketId && (!projectId || lock.projectId === projectId)) { this.locks.delete(key); released.push(lock); } return released;
  }
  private cleanupExpiredLocks() { const now = Date.now(); for (const [key, lock] of this.locks) if (new Date(lock.expiresAt).getTime() <= now) { this.locks.delete(key); this.emitLock(lock.projectId, 'uml:lock:released', lock); } }
  private emitLock(projectId: string, event: string, lock: ProjectLock) { this.server?.to(this.room(projectId)).emit(event, lock); }
  private lockKey(projectId: string, type: LockElementType, elementId: string) { return `${projectId}:${type}:${elementId}`; }
}
