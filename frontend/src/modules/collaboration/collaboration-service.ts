import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '../../services/config'
import type { Diagram } from '../uml/types'

export interface PresenceUser { id: string; name: string; role: string }
export type LockElementType = 'UML_CLASS' | 'UML_RELATION'
export interface ProjectLock { projectId: string; elementType: LockElementType; elementId: string; userId: string; socketId: string; userName: string; acquiredAt: string; expiresAt: string }
interface Ack<T> { ok: boolean; data?: T; status?: number; message?: string }
interface RealtimeChange { projectId: string; diagram: Diagram; originUserId: string; persistedAt: string }
export interface RealtimeProposalEvent {
  projectId: string
  proposal: import('../ai/types').SavedProposal
  originUser?: { id: string; name: string }
  receivedAt: string
  message: string
}
type Listener<T> = (value: T) => void

const changeEvents = ['uml:diagram:updated', 'uml:class:created', 'uml:class:updated', 'uml:class:moved', 'uml:class:deleted', 'uml:attribute:created', 'uml:attribute:updated', 'uml:attribute:deleted', 'uml:method:created', 'uml:method:updated', 'uml:method:deleted', 'uml:relation:created', 'uml:relation:updated', 'uml:relation:deleted']

class CollaborationClient {
  private socket: Socket | null = null; private projectId: string | null = null; private token = ''
  private readonly presenceListeners = new Set<Listener<PresenceUser[]>>(); private readonly lockListeners = new Set<Listener<ProjectLock[]>>(); private readonly changeListeners = new Set<Listener<RealtimeChange>>(); private readonly statusListeners = new Set<Listener<boolean>>()
  private readonly readyListeners = new Set<Listener<boolean>>()
  private readonly proposalListeners = new Set<Listener<RealtimeProposalEvent>>()
  private locks: ProjectLock[] = []; private renewTimer: ReturnType<typeof setInterval> | null = null
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect(token: string) {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer); this.disconnectTimer = null
    this.token = token
    if (!this.socket) {
      this.socket = io(`${SOCKET_URL}/collaboration`, { autoConnect: false, auth: { token }, reconnection: true })
      this.socket.on('connect', () => { this.status(true); if (this.projectId) void this.join(this.projectId).then(diagram => { if (diagram) this.changeListeners.forEach(listener => listener({ projectId: this.projectId!, diagram, originUserId: '', persistedAt: new Date().toISOString() })) }) })
      this.socket.on('disconnect', () => { this.status(false); this.ready(false) }); this.socket.on('connect_error', () => { this.status(false); this.ready(false) })
      this.socket.on('project:presence', value => this.presenceListeners.forEach(listener => listener(value)))
      this.socket.on('uml:lock:acquired', lock => this.updateLock(lock)); this.socket.on('uml:lock:released', lock => this.removeLock(lock))
      this.socket.on('uml:proposal:received', value => this.proposalListeners.forEach(listener => listener(value)))
      for (const event of changeEvents) this.socket.on(event, value => this.changeListeners.forEach(listener => listener(value)))
    } else this.socket.auth = { token }
    if (!this.socket.connected) this.socket.connect()
  }

  async join(projectId: string) {
    this.projectId = projectId; if (!this.socket?.connected) return null
    const response = await this.ack<{ projectId: string; diagram: Diagram; presence: PresenceUser[]; locks: ProjectLock[] }>('project:join', { projectId }); this.locks = response.locks; this.presenceListeners.forEach(listener => listener(response.presence)); this.lockListeners.forEach(listener => listener(this.locks)); this.ready(true); return response.diagram
  }
  async leave() { if (this.socket?.connected && this.projectId) await this.ack('project:leave', { projectId: this.projectId }).catch(() => undefined); this.projectId = null; this.locks = []; this.stopRenew() }
  disconnect() { void this.leave().finally(() => { this.socket?.disconnect(); this.socket = null }) }
  scheduleDisconnect() { if (this.disconnectTimer) clearTimeout(this.disconnectTimer); this.disconnectTimer = setTimeout(() => { this.disconnectTimer = null; this.disconnect() }, 50) }
  async acquire(elementType: LockElementType, elementId: string) { if (!this.projectId) throw new Error('Proyecto realtime no unido'); const lock = await this.ack<ProjectLock>('uml:lock:acquire', { projectId: this.projectId, elementType, elementId }); this.startRenew(lock); return lock }
  async release(elementType: LockElementType, elementId: string) { if (!this.projectId) return; await this.ack('uml:lock:release', { projectId: this.projectId, elementType, elementId }); this.stopRenew() }

  onPresence(listener: Listener<PresenceUser[]>) { this.presenceListeners.add(listener); return () => this.presenceListeners.delete(listener) }
  onLocks(listener: Listener<ProjectLock[]>) { this.lockListeners.add(listener); listener(this.locks); return () => this.lockListeners.delete(listener) }
  onChange(listener: Listener<RealtimeChange>) { this.changeListeners.add(listener); return () => this.changeListeners.delete(listener) }
  onProposal(listener: Listener<RealtimeProposalEvent>) { this.proposalListeners.add(listener); return () => this.proposalListeners.delete(listener) }
  onStatus(listener: Listener<boolean>) { this.statusListeners.add(listener); listener(Boolean(this.socket?.connected)); return () => this.statusListeners.delete(listener) }
  onReady(listener: Listener<boolean>) { this.readyListeners.add(listener); return () => this.readyListeners.delete(listener) }

  private async ack<T = unknown>(event: string, payload: unknown): Promise<T> { if (!this.socket) throw new Error('Servidor realtime no conectado'); const response = await this.socket.timeout(5_000).emitWithAck(event, payload) as Ack<T>; if (!response.ok || response.data === undefined) throw new Error(response.message ?? 'Operación realtime rechazada'); return response.data }
  private updateLock(lock: ProjectLock) { this.locks = [...this.locks.filter(value => !(value.projectId === lock.projectId && value.elementType === lock.elementType && value.elementId === lock.elementId)), lock]; this.lockListeners.forEach(listener => listener(this.locks)) }
  private removeLock(lock: ProjectLock) { this.locks = this.locks.filter(value => !(value.projectId === lock.projectId && value.elementType === lock.elementType && value.elementId === lock.elementId)); this.lockListeners.forEach(listener => listener(this.locks)) }
  private status(value: boolean) { this.statusListeners.forEach(listener => listener(value)) }
  private ready(value: boolean) { this.readyListeners.forEach(listener => listener(value)) }
  private startRenew(lock: ProjectLock) { this.stopRenew(); this.renewTimer = setInterval(() => { if (this.socket?.connected) void this.ack('uml:lock:renew', { projectId: lock.projectId, elementType: lock.elementType, elementId: lock.elementId }).catch(() => this.stopRenew()) }, 15_000) }
  private stopRenew() { if (this.renewTimer) clearInterval(this.renewTimer); this.renewTimer = null }
}

export const collaborationService = new CollaborationClient()
