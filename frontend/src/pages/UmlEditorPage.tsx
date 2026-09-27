import React, { useCallback, useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../modules/auth/AuthProvider'
import { diagramToFlow, flowNodeToMovePayload, type UmlClassNodeData, type UmlRelationEdgeData } from '../modules/uml/mappers'
import { UmlClassNode } from '../modules/uml/UmlClassNode'
import { UmlPropertiesPanel } from '../modules/uml/UmlPropertiesPanel'
import { umlService, type UmlRelationInput } from '../modules/uml/uml-service'
import type { Diagram, UmlClass, UmlRelation, UmlRelationType } from '../modules/uml/types'
import { ApiError } from '../services/http'
import {
  collaborationService,
  type LockElementType,
  type PresenceUser,
  type ProjectLock,
} from '../modules/collaboration/collaboration-service'
import { sessionStore } from '../modules/auth/session-store'
import { xmiService } from '../modules/xmi/xmi-service'
import { codeGeneratorService, type GenerationResult } from '../modules/code-generator/code-generator-service'
import { aiService } from '../modules/ai/ai-service'
import type { SavedProposal } from '../modules/ai/types'

const nodeTypes = { umlClass: UmlClassNode }
const relationTypes: { type: UmlRelationType; label: string; desc: string }[] = [
  { type: 'ASSOCIATION', label: 'Asociación (——)', desc: 'Conexión estructural básica' },
  { type: 'AGGREGATION', label: 'Agregación (◇——)', desc: 'Relación débil "tiene un"' },
  { type: 'COMPOSITION', label: 'Composición (◆——)', desc: 'Relación fuerte de pertenencia' },
  { type: 'INHERITANCE', label: 'Herencia (◁——)', desc: 'Generalización / Especialización' },
  { type: 'DEPENDENCY', label: 'Dependencia (┄┄▷)', desc: 'Uso transitorio o servicio' },
]
const multiplicities = ['1', '0..1', '*', '0..*', '1..*']

export function UmlEditorPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<UmlClassNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<UmlRelationEdgeData>>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null)
  const [isDraftingRelation, setIsDraftingRelation] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [relationDraft, setRelationDraft] = useState<UmlRelationInput>({
    sourceClassId: '',
    targetClassId: '',
    type: 'ASSOCIATION',
    sourceMultiplicity: '1',
    targetMultiplicity: '1',
    label: '',
  })
  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [locks, setLocks] = useState<ProjectLock[]>([])
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [realtimeReady, setRealtimeReady] = useState(false)
  const [selectionPending, setSelectionPending] = useState(false)
  const [xmiPending, setXmiPending] = useState(false)
  const [generationPending, setGenerationPending] = useState(false)
  const [generation, setGeneration] = useState<GenerationResult | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [showMiniMap, setShowMiniMap] = useState(true)
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select')
  const [infoToast, setInfoToast] = useState<string | null>(null)
  const [pendingProposals, setPendingProposals] = useState<SavedProposal[]>([])
  const [activeProposalModal, setActiveProposalModal] = useState<SavedProposal | null>(null)
  const [applyingProposal, setApplyingProposal] = useState(false)


  const apply = useCallback(
    (value: Diagram) => {
      const flow = diagramToFlow(value)
      setDiagram(value)
      setNodes(flow.nodes)
      setEdges(flow.edges)
    },
    [setEdges, setNodes]
  )

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const value = await umlService.get(id, signal)
      apply(value)
    },
    [apply, id]
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    load(controller.signal)
      .catch(failure => {
        if (!controller.signal.aborted) {
          if (failure instanceof ApiError && failure.status === 403) navigate('/dashboard', { replace: true })
          else setError(messageFor(failure))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    if (id) {
      void aiService
        .getProposals(id, 'PENDING')
        .then(setPendingProposals)
        .catch(() => undefined)
    }

    return () => controller.abort()
  }, [id, load, navigate])

  useEffect(() => {
    const token = sessionStore.getToken()
    if (!token) return
    const offPresence = collaborationService.onPresence(setPresence)
    const offLocks = collaborationService.onLocks(value => {
      setLocks(value)
      setError(current => (current?.startsWith('Editando:') ? null : current))
    })
    const offStatus = collaborationService.onStatus(setRealtimeConnected)
    const offReady = collaborationService.onReady(setRealtimeReady)
    const offChange = collaborationService.onChange(change => {
      if (change.projectId === id && change.originUserId !== user?.id) apply(change.diagram)
    })
    const offProposal = collaborationService.onProposal(event => {
      if (event.projectId === id) {
        setPendingProposals(current => [event.proposal, ...current.filter(p => p.id !== event.proposal.id)])
        setInfoToast('📱 Se recibió una nueva propuesta UML desde el dispositivo móvil.')
      }
    })
    collaborationService.connect(token)
    void collaborationService
      .join(id)
      .then(value => {
        if (value) apply(value)
      })
      .catch(failure => {
        if (failure instanceof ApiError && failure.status === 403) navigate('/dashboard', { replace: true })
        else setError(messageFor(failure))
      })
    return () => {
      offPresence()
      offLocks()
      offStatus()
      offReady()
      offChange()
      offProposal()
      collaborationService.scheduleDisconnect()
    }
  }, [apply, id, navigate, user?.id])

  useEffect(() => {
    setNodes(current =>
      current.map(node => ({
        ...node,
        data: {
          ...node.data,
          lockedBy: locks.find(
            lock => lock.elementType === 'UML_CLASS' && lock.elementId === node.id && lock.userId !== user?.id
          )?.userName,
        },
      }))
    )
  }, [diagram, locks, setNodes, user?.id])

  const handleApplySavedProposal = async (proposalId: string) => {
    setApplyingProposal(true)
    setError(null)
    try {
      const result = await aiService.applySavedProposal(id, proposalId)
      apply(result.diagram)
      setPendingProposals(current => current.filter(p => p.id !== proposalId))
      setActiveProposalModal(null)
      setMessage('Propuesta UML aplicada y persistida correctamente en PostgreSQL.')
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setApplyingProposal(false)
    }
  }

  const handleRejectSavedProposal = async (proposalId: string) => {
    setApplyingProposal(true)
    setError(null)
    try {
      await aiService.rejectProposal(id, proposalId)
      setPendingProposals(current => current.filter(p => p.id !== proposalId))
      setActiveProposalModal(null)
      setMessage('Propuesta UML rechazada.')
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setApplyingProposal(false)
    }
  }

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await operation()
      await load()
      setMessage(success)
      return true
    } catch (failure) {
      setError(messageFor(failure))
      return false
    } finally {
      setSaving(false)
    }

  }

  const selectedClass = diagram?.classes.find(item => item.id === selectedClassId) ?? null
  const selectedRelation = diagram?.relations.find(item => item.id === selectedRelationId) ?? null

  const createClass = () =>
    run(async () => {
      const count = diagram?.classes.length ?? 0
      const created = await umlService.createClass(id, {
        name: `NuevaClase${count + 1}`,
        x: 80 + count * 40,
        y: 80 + count * 40,
      })
      await collaborationService.acquire('UML_CLASS', created.id)
      setSelectedClassId(created.id)
      setSelectedRelationId(null)
      setIsDraftingRelation(false)
      setInspectorOpen(true)
    }, 'Clase creada y guardada.')

  const startNewRelation = () => {
    void releaseSelection()
    setSelectedClassId(null)
    setSelectedRelationId(null)
    setIsDraftingRelation(true)
    setRelationDraft({
      sourceClassId: '',
      targetClassId: '',
      type: 'ASSOCIATION',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
      label: '',
    })
    setInspectorOpen(true)
  }

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return
    setSelectedRelationId(null)
    setSelectedClassId(null)
    setIsDraftingRelation(true)
    setRelationDraft({
      sourceClassId: connection.source,
      targetClassId: connection.target,
      type: 'ASSOCIATION',
      sourceMultiplicity: '1',
      targetMultiplicity: '1',
      label: '',
    })
    setInspectorOpen(true)
  }

  const saveRelation = async (input: UmlRelationInput) => {
    if (!input.sourceClassId || !input.targetClassId) {
      setError('Selecciona las clases de origen y destino.')
      return
    }
    const update = {
      type: input.type,
      sourceMultiplicity: input.sourceMultiplicity,
      targetMultiplicity: input.targetMultiplicity,
      label: input.label,
    }
    if (
      await run(
        () =>
          selectedRelation
            ? umlService.updateRelation(id, selectedRelation.id, update)
            : umlService.createRelation(id, input),
        selectedRelation ? 'Relación actualizada.' : 'Relación creada.'
      )
    ) {
      if (selectedRelation) await collaborationService.release('UML_RELATION', selectedRelation.id).catch(() => undefined)
      setSelectedRelationId(null)
      setIsDraftingRelation(false)
    }
  }

  const returnTo = user?.role.name === 'COLABORADOR' ? '/shared-projects' : `/projects/${id}`
  const lockedByOther = (elementType: LockElementType, elementId: string) =>
    locks.find(lock => lock.elementType === elementType && lock.elementId === elementId && lock.userId !== user?.id)

  const releaseSelection = async () => {
    if (selectedClassId) await collaborationService.release('UML_CLASS', selectedClassId).catch(() => undefined)
    if (selectedRelationId) await collaborationService.release('UML_RELATION', selectedRelationId).catch(() => undefined)
  }

  const selectElement = async (elementType: LockElementType, elementId: string) => {
    const blocked = lockedByOther(elementType, elementId)
    if (blocked) {
      setError(`Editando: ${blocked.userName}`)
      return false
    }
    await releaseSelection()
    try {
      await collaborationService.acquire(elementType, elementId)
      setError(null)
      return true
    } catch (failure) {
      setError(messageFor(failure))
      return false
    }
  }

  const openRelation = (relation: UmlRelation) => {
    if (selectedRelationId !== relation.id) {
      setRelationDraft({
        sourceClassId: relation.sourceClassId,
        targetClassId: relation.targetClassId,
        type: relation.type,
        sourceMultiplicity: relation.sourceMultiplicity,
        targetMultiplicity: relation.targetMultiplicity,
        label: relation.label ?? '',
      })
    }
    setSelectedRelationId(relation.id)
    setSelectedClassId(null)
    setIsDraftingRelation(false)
    setInspectorOpen(true)
  }

  const exportXmi = async () => {
    setXmiPending(true)
    setError(null)
    try {
      const blob = await xmiService.export(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${diagram?.name ?? 'arqnova-diagram'}.xmi`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Archivo XMI exportado.')
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setXmiPending(false)
    }
  }

  const importXmi = async (file: File) => {
    if (!confirm('La importación reemplazará el contenido actual del diagrama. ¿Continuar?')) return
    setXmiPending(true)
    setError(null)
    setMessage(null)
    try {
      const result = await xmiService.import(id, file)
      apply(result.diagram)
      setSelectedClassId(null)
      setSelectedRelationId(null)
      setIsDraftingRelation(false)
      setMessage(`XMI importado: ${result.imported.classes} clases y ${result.imported.relations} relaciones.`)
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setXmiPending(false)
    }
  }

  const generateBackend = async () => {
    setGenerationPending(true)
    setError(null)
    setMessage(null)
    try {
      const result = await codeGeneratorService.generate(id)
      setGeneration(result)
      setMessage(`Backend generado: ${result.classCount} clases y ${result.fileCount} archivos.`)
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setGenerationPending(false)
    }
  }

  const downloadBackend = async () => {
    setGenerationPending(true)
    setError(null)
    try {
      const blob = await codeGeneratorService.download(id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'generated-backend.zip'
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Backend Spring Boot descargado.')
    } catch (failure) {
      setError(messageFor(failure))
    } finally {
      setGenerationPending(false)
    }
  }

  const triggerHelperNotice = (feature: string) => {
    setInfoToast(`${feature}: Puedes organizarlo directamente en tus entidades o estructurar paquetes en el modelo.`)
    setTimeout(() => setInfoToast(null), 4000)
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-[#080D24]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500" />
          <p role="status" className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Cargando editor UML…
          </p>
        </div>
      </div>
    )
  }

  if (!diagram) {
    return (
      <section className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-[#080D24] p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Editor no disponible</h1>
          <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            {error || 'No se pudo cargar el diagrama.'}
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
          >
            Ir al Panel Principal
          </Link>
        </div>
      </section>
    )
  }

  const showRelationInspector = Boolean(selectedRelation || isDraftingRelation || selectedRelationId)

  return (
    <section className="flex h-screen w-full flex-col overflow-hidden bg-white dark:bg-[#080D24] font-sans select-none">
      {/* 1. HEADER DEL ENTORNO DE TRABAJO (85-90PX) */}
      <header className="z-20 flex min-h-[85px] h-[88px] shrink-0 items-center justify-between gap-4 border-b border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] px-6 py-4 shadow-xs">
        {/* Izquierda: Volver + Separador + Logo ARQNOVA + Nombre con alta presencia + Badge CASE */}
        <div className="flex items-center gap-3.5">
          <Link
            to={returnTo}
            className="flex items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            title="Volver al proyecto"
          >
            <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Volver</span>
          </Link>

          <div className="h-8 w-px bg-slate-200/80 dark:bg-slate-800 hidden sm:block" />

          {/* ARQNOVA Brand Identity & Diagram Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  Editor UML · {diagram.name}
                </h1>
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 tracking-wider uppercase">
                  CASE
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5 hidden sm:block">
                Plataforma de Modelado y Generación de Software
              </span>
            </div>
          </div>
        </div>

        {/* Centro: Estado del Proyecto (Anfitrión, Realtime, Persistencia) */}
        <div className="hidden lg:flex items-center gap-3.5">
          {/* Anfitrión / Colaboradores conectados */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300" aria-label="Usuarios conectados">
            {presence.length > 0 ? (
              presence.map(person => (
                <span
                  key={person.id}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
                >
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  {person.name} · {person.role}
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100/90 dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                {user?.name || 'Anfitrión'}: {user?.role.name || 'ANFITRION'}
              </span>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Realtime Status Indicator */}
          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-3 py-1.5 shadow-2xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                realtimeConnected ? (realtimeReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping') : 'bg-rose-500'
              }`}
            />
            <span
              className={`text-xs font-semibold ${
                realtimeConnected ? (realtimeReady ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400') : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              Realtime: {realtimeConnected ? (realtimeReady ? 'conectado' : 'sincronizando') : 'desconectado'}
            </span>
          </div>

          {/* Autosave Status Indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {saving || xmiPending || generationPending ? (
              <span className="flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 shadow-2xs">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent" />
                <span>Procesando…</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800 shadow-2xs">
                <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Cambios persistidos</span>
              </span>
            )}
          </div>
        </div>

        {/* Derecha: Botones de Acción centrados verticalmente */}
        <div className="flex items-center gap-2.5">
          {/* XMI Export Button */}
          <button
            disabled={xmiPending || generationPending}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition"
            onClick={() => void exportXmi()}
            title="Exportar archivo XMI estándar"
          >
            <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Exportar XMI</span>
          </button>

          {/* XMI Import Label Button */}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition">
            <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="hidden sm:inline">Importar XMI</span>
            <input
              aria-label="Seleccionar archivo XMI"
              className="sr-only"
              type="file"
              accept=".xmi,.xml,application/xml,text/xml"
              disabled={xmiPending || generationPending}
              onChange={event => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void importXmi(file)
              }}
            />
          </label>

          {/* AI Generation Link */}
          <Link
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/50 px-3.5 py-2 text-xs font-bold text-violet-700 dark:text-violet-300 shadow-2xs hover:bg-violet-100 dark:hover:bg-violet-900/50 hover:text-violet-900 dark:hover:text-violet-100 transition"
            to={`/projects/${id}/ai-proposal`}
            title="Generar arquitectura y entidades con Inteligencia Artificial"
          >
            <svg className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="hidden md:inline">Generar con IA</span>
          </Link>

          {/* Frontend AI Generator Link */}
          <Link
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-3.5 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-900 dark:hover:text-indigo-100 transition"
            to={`/projects/${id}/frontend-generator`}
            title="Generar Meta-Prompt para Frontend IA"
          >
            <svg className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="hidden md:inline">Generar Frontend IA</span>
          </Link>

          {/* Backend Generator Button */}
          <button
            disabled={generationPending || xmiPending}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 transition"
            onClick={() => void generateBackend()}
            title="Generar código Spring Boot automáticamente"
          >
            <svg className="h-3.5 w-3.5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span className="hidden md:inline">{generationPending ? 'Generando…' : 'Generar Backend'}</span>
          </button>

          {/* Download ZIP Button */}
          {generation && (
            <button
              disabled={generationPending}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 transition"
              onClick={() => void downloadBackend()}
              title="Descargar código generado en formato ZIP"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Descargar ZIP</span>
            </button>
          )}

          {/* Primary Action: + Nueva Clase */}
          <button
            disabled={saving || xmiPending || generationPending || !realtimeReady}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-50 transition"
            onClick={() => void createClass()}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Nueva clase</span>
          </button>

          {/* Mobile/Tablet Panel Toggles */}
          <div className="flex lg:hidden items-center gap-1.5 pl-1">
            <button
              onClick={() => setSidebarOpen(curr => !curr)}
              className={`p-2 rounded-xl border text-xs ${
                sidebarOpen ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Alternar componentes UML"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <button
              onClick={() => setInspectorOpen(curr => !curr)}
              className={`p-2 rounded-xl border text-xs ${
                inspectorOpen ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
              title="Alternar inspector UML"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Global Floating Alert Notification */}
      {(error || message || infoToast) && (
        <div
          role={error ? 'alert' : 'status'}
          className={`mx-4 mt-2 flex items-center justify-between rounded-xl border px-4 py-2 text-xs font-medium shadow-md transition-all ${
            error
              ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200'
              : infoToast
              ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200'
              : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {error ? (
              <svg className="h-4 w-4 shrink-0 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            <span>{error ?? (message || infoToast)}</span>
          </div>
          <button
            onClick={() => {
              setError(null)
              setMessage(null)
              setInfoToast(null)
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Mobile Proposal Banner */}
      {pendingProposals.length > 0 && (
        <div
          role="region"
          aria-label="Propuesta recibida desde dispositivo móvil"
          className="mx-4 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-300 dark:border-indigo-800/80 bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 dark:from-[#131B3E] dark:via-[#182352] dark:to-[#0E1535] p-3.5 shadow-md transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Propuesta recibida desde dispositivo móvil
                </h3>
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/80 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300">
                  {pendingProposals.length} pendiente{pendingProposals.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                {pendingProposals[0].summary || 'Propuesta estructurada detectada mediante Gemini Multimodal.'} ·{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {pendingProposals[0].classesCount} clases, {pendingProposals[0].attributesCount} atributos, {pendingProposals[0].relationsCount} relaciones
                </strong>
                {pendingProposals[0].user?.name ? ` por ${pendingProposals[0].user.name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveProposalModal(pendingProposals[0])}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-[#0E1535] px-3.5 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs hover:bg-indigo-50 dark:hover:bg-[#182352] transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Ver propuesta</span>
            </button>

            <button
              disabled={applyingProposal}
              onClick={() => void handleApplySavedProposal(pendingProposals[0].id)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs disabled:opacity-50 transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{applyingProposal ? 'Aplicando…' : 'Aplicar cambios'}</span>
            </button>

            <button
              disabled={applyingProposal}
              onClick={() => void handleRejectSavedProposal(pendingProposals[0].id)}
              className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50 transition"
            >
              Rechazar
            </button>
          </div>
        </div>
      )}

      {/* Workspace: 3 Column Layout (Sidebar | Canvas | Inspector) */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* 2. SIDEBAR IZQUIERDO: COMPONENTES UML */}
        <aside
          className={`${
            sidebarOpen ? 'flex' : 'hidden'
          } w-full flex-col border-r border-slate-200/90 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#0E1535] z-10 shadow-lg lg:flex lg:w-72 shrink-0 transition-all`}
        >
          {/* Sidebar Header */}
          <div className="border-b border-slate-200/80 dark:border-slate-800 p-3.5 bg-white dark:bg-[#0E1535] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">COMPONENTES UML</h2>
            </div>
            <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
              CASE
            </span>
          </div>

          {/* Sidebar Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* UML Tools & Elements List */}
            <div className="space-y-2">
              {/* 1. Crear Clase */}
              <button
                disabled={saving || !realtimeReady}
                onClick={() => void createClass()}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] p-2.5 text-left shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-[#182352] hover:shadow-xs transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-white shadow-2xs group-hover:scale-105 transition-transform">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">Crear clase</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Entidad con atributos y métodos</div>
                </div>
              </button>

              {/* 2. Crear Relación / Nueva Relación */}
              <button
                onClick={startNewRelation}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] p-2.5 text-left shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-[#182352] hover:shadow-xs transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#6366F1] text-white shadow-2xs group-hover:scale-105 transition-transform">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">Nueva relación</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Asociación, agregación, herencia</div>
                </div>
              </button>

              {/* 3. Crear Paquete */}
              <button
                onClick={() => triggerHelperNotice('Paquete UML')}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] p-2.5 text-left shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-[#182352] hover:shadow-xs transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-2xs group-hover:scale-105 transition-transform">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">Crear paquete</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Contenedor modular de modelos</div>
                </div>
              </button>

              {/* 4. Crear Nota */}
              <button
                onClick={() => triggerHelperNotice('Nota UML')}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] p-2.5 text-left shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/40 dark:hover:bg-[#182352] hover:shadow-xs transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">Crear nota</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Documentación y reglas de negocio</div>
                </div>
              </button>

              {/* 5. Asistente IA */}
              <Link
                to={`/projects/${id}/ai-proposal`}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-violet-200 dark:border-violet-900/60 bg-gradient-to-br from-violet-50/50 to-indigo-50/50 dark:from-violet-950/40 dark:to-indigo-950/40 p-2.5 text-left shadow-2xs hover:border-violet-400 dark:hover:border-violet-700 hover:shadow-xs transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-violet-900 dark:text-violet-200">Asistente IA</div>
                  <div className="text-[11px] text-violet-700 dark:text-violet-300">Diseña diagramas con lenguaje natural</div>
                </div>
              </Link>

              {/* 6. Generar Frontend IA */}
              <Link
                to={`/projects/${id}/frontend-generator`}
                className="group flex w-full items-start gap-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 dark:from-indigo-950/40 dark:to-blue-950/40 p-2.5 text-left shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-xs transition"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-2xs group-hover:scale-105 transition-transform">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Generar Frontend IA</div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-300">Meta-Prompt para React, Angular o Vue</div>
                </div>
              </Link>
            </div>

            {/* Quick helper tip */}
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 px-1">
              También puedes conectar los manejadores de dos clases.
            </p>

            {/* Relaciones Section */}
            <div className="border-t border-slate-200/80 dark:border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Relaciones</h3>
                <span className="rounded-full bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                  {diagram.relations.length}
                </span>
              </div>

              {diagram.relations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3 text-center text-[11px] italic text-slate-500 dark:text-slate-400">
                  Sin relaciones en el diagrama
                </p>
              ) : (
                <ul className="space-y-1">
                  {diagram.relations.map(relation => {
                    const lock = lockedByOther('UML_RELATION', relation.id)
                    const isSelected = selectedRelationId === relation.id
                    return (
                      <li key={relation.id}>
                        <button
                          disabled={Boolean(lock) || selectionPending}
                          className={`flex w-full items-center justify-between rounded-xl border p-2 text-left text-xs font-medium transition ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 shadow-2xs font-semibold'
                              : 'border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#182352]'
                          } ${lock ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 opacity-80' : ''}`}
                          onClick={() => {
                            setSelectionPending(true)
                            void selectElement('UML_RELATION', relation.id)
                              .then(ok => {
                                if (ok) openRelation(relation)
                              })
                              .finally(() => setSelectionPending(false))
                          }}
                        >
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span className="truncate">{relation.label || relation.type}</span>
                          </div>
                          {lock && (
                            <span className="shrink-0 rounded-full bg-amber-200 dark:bg-amber-900/80 px-1.5 py-0.2 text-[9px] font-bold text-amber-900 dark:text-amber-200">
                              Editando: {lock.userName}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Quick Stats Footer */}
          <div className="border-t border-slate-200/80 dark:border-slate-800 p-3 bg-white dark:bg-[#0E1535] flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>
              Clases: <strong className="text-slate-800 dark:text-slate-200">{diagram.classes.length}</strong>
            </span>
            <span>
              Relaciones: <strong className="text-slate-800 dark:text-slate-200">{diagram.relations.length}</strong>
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">● Activo</span>
          </div>
        </aside>

        {/* 3. CANVAS CENTRAL: REACT FLOW */}
        <div className="relative flex-1 bg-[#f8fafc] dark:bg-[#080D24]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            panOnDrag={interactionMode === 'pan'}
            selectionOnDrag={interactionMode === 'select'}
            onNodeClick={(_, node) => {
              void selectElement('UML_CLASS', node.id).then(ok => {
                if (ok) {
                  setSelectedClassId(node.id)
                  setSelectedRelationId(null)
                  setIsDraftingRelation(false)
                  setInspectorOpen(true)
                }
              })
            }}
            onEdgeClick={(_, edge) => {
              const relation = diagram.relations.find(item => item.id === edge.id)
              if (relation) {
                void selectElement('UML_RELATION', edge.id).then(ok => {
                  if (ok) openRelation(relation)
                })
              }
            }}
            onNodeDragStart={(_, node) => {
              void collaborationService.acquire('UML_CLASS', node.id).catch(failure => {
                setError(messageFor(failure))
                void load()
              })
            }}
            onNodeDragStop={(_, node) => {
              void (async () => {
                if (!await run(() => umlService.moveClass(id, node.id, flowNodeToMovePayload(node)), 'Posición guardada.')) {
                  await load()
                }
                await collaborationService.release('UML_CLASS', node.id).catch(() => undefined)
              })()
            }}
          >
            {/* Figma style dot grid */}
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#94a3b8" className="opacity-40 dark:opacity-20" />
            
            {showMiniMap && (
              <MiniMap
                className="!bg-white/95 dark:!bg-[#0E1535]/95 !backdrop-blur-md !border !border-slate-200 dark:!border-slate-800 !shadow-lg !rounded-2xl overflow-hidden"
                nodeStrokeColor="#6366F1"
                nodeColor="#4F46E5"
              />
            )}
            
            <Controls className="!bg-white/95 dark:!bg-[#0E1535]/95 !backdrop-blur-md !border !border-slate-200 dark:!border-slate-800 !shadow-lg !rounded-2xl overflow-hidden !m-4" />

            {/* Floating Canvas Toolbar */}
            <CanvasFloatingToolbar
              showMiniMap={showMiniMap}
              setShowMiniMap={setShowMiniMap}
              interactionMode={interactionMode}
              setInteractionMode={setInteractionMode}
            />
          </ReactFlow>

          {/* Empty state overlay */}
          {diagram.classes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0E1535]/95 p-6 text-center shadow-xl backdrop-blur-md">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shadow-xs">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Lienzo en blanco</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">El diagrama está vacío. Crea tu primera clase.</p>
                <button
                  onClick={() => void createClass()}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Crear primera clase</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. PANEL DERECHO: INSPECTOR UML DINÁMICO */}
        {inspectorOpen && (
          <>
            {selectedClass && (
              <UmlPropertiesPanel
                umlClass={selectedClass}
                disabled={saving}
                onUpdateClass={value => run(() => umlService.updateClass(id, selectedClass.id, value), 'Clase actualizada.')}
                onDeleteClass={async () => {
                  if (await run(() => umlService.removeClass(id, selectedClass.id), 'Clase eliminada.')) {
                    await collaborationService.release('UML_CLASS', selectedClass.id).catch(() => undefined)
                    setSelectedClassId(null)
                  }
                }}
                onCreateAttribute={value =>
                  run(() => umlService.createAttribute(id, selectedClass.id, value), 'Atributo agregado.')
                }
                onUpdateAttribute={(attributeId, value) =>
                  run(() => umlService.updateAttribute(id, selectedClass.id, attributeId, value), 'Atributo actualizado.')
                }
                onDeleteAttribute={attributeId =>
                  run(() => umlService.removeAttribute(id, selectedClass.id, attributeId), 'Atributo eliminado.')
                }
                onCreateMethod={value =>
                  run(() => umlService.createMethod(id, selectedClass.id, value), 'Método agregado.')
                }
                onUpdateMethod={(methodId, value) =>
                  run(() => umlService.updateMethod(id, selectedClass.id, methodId, value), 'Método actualizado.')
                }
                onDeleteMethod={methodId =>
                  run(() => umlService.removeMethod(id, selectedClass.id, methodId), 'Método eliminado.')
                }
                onClose={() => {
                  void collaborationService.release('UML_CLASS', selectedClass.id)
                  setSelectedClassId(null)
                }}
              />
            )}

            {!selectedClass && !selectionPending && showRelationInspector && (
              <RelationPanel
                key={selectedRelation?.id ?? `${relationDraft.sourceClassId}:${relationDraft.targetClassId}`}
                classes={diagram.classes}
                relation={selectedRelation}
                draft={relationDraft}
                disabled={saving}
                onSave={saveRelation}
                onClose={() => {
                  if (selectedRelation) void collaborationService.release('UML_RELATION', selectedRelation.id).catch(() => undefined)
                  setSelectedRelationId(null)
                  setIsDraftingRelation(false)
                }}
                onDelete={
                  selectedRelation
                    ? async () => {
                        if (
                          confirm('¿Eliminar esta relación?') &&
                          (await run(() => umlService.removeRelation(id, selectedRelation.id), 'Relación eliminada.'))
                        ) {
                          await collaborationService.release('UML_RELATION', selectedRelation.id).catch(() => undefined)
                          setSelectedRelationId(null)
                          setIsDraftingRelation(false)
                        }
                      }
                    : undefined
                }
              />
            )}

            {!selectedClass && !selectionPending && !showRelationInspector && (
              <EmptyInspectorPanel
                diagramName={diagram.name}
                classCount={diagram.classes.length}
                relationCount={diagram.relations.length}
                onCreateClass={() => void createClass()}
                onNewRelation={startNewRelation}
              />
            )}
          </>
        )}
      </div>

      {/* Proposal Detail & Review Modal */}
      {activeProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1535] shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-[#131B3E]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Propuesta UML recibida desde dispositivo móvil
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeProposalModal.project?.name || diagram.name} · {new Date(activeProposalModal.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveProposalModal(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Summary Box */}
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-[#131B3E]/60 p-4">
                <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                  {activeProposalModal.summary || 'Análisis de imagen completado con éxito'}
                </div>
                {activeProposalModal.prompt && (
                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 italic">
                    «{activeProposalModal.prompt}»
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white dark:bg-[#0E1535] p-2 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base">{activeProposalModal.classesCount}</div>
                    <div className="text-[11px] text-slate-500">Clases</div>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-[#0E1535] p-2 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base">{activeProposalModal.attributesCount}</div>
                    <div className="text-[11px] text-slate-500">Atributos</div>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-[#0E1535] p-2 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base">{activeProposalModal.methodsCount}</div>
                    <div className="text-[11px] text-slate-500">Métodos</div>
                  </div>
                  <div className="rounded-lg bg-white dark:bg-[#0E1535] p-2 border border-slate-200 dark:border-slate-800">
                    <div className="font-extrabold text-indigo-600 dark:text-indigo-400 text-base">{activeProposalModal.relationsCount}</div>
                    <div className="text-[11px] text-slate-500">Relaciones</div>
                  </div>
                </div>
              </div>

              {/* Detected Elements / Actions Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Detalle del modelo propuesto
                </h4>

                {/* Direct classes format */}
                {activeProposalModal.proposalJson?.classes && activeProposalModal.proposalJson.classes.length > 0 && (
                  <div className="space-y-2">
                    {activeProposalModal.proposalJson.classes.map((cls, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/40 p-3">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                          <span>{cls.name}</span>
                          {cls.isAbstract && <span className="text-[10px] text-indigo-500 italic">«abstract»</span>}
                        </div>
                        {cls.attributes && cls.attributes.length > 0 && (
                          <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-4">
                            {cls.attributes.map((attr, aIdx) => (
                              <div key={aIdx}>
                                {attr.visibility === 'PUBLIC' ? '+' : attr.visibility === 'PRIVATE' ? '-' : '#'} {attr.name}: {attr.type}
                                {attr.isPrimaryKey && <span className="ml-1 text-[10px] text-amber-500 font-semibold">[PK]</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {cls.methods && cls.methods.length > 0 && (
                          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pl-4 border-t border-slate-200 dark:border-slate-800 pt-1">
                            {cls.methods.map((meth, mIdx) => (
                              <div key={mIdx}>
                                {meth.visibility === 'PUBLIC' ? '+' : meth.visibility === 'PRIVATE' ? '-' : '#'} {meth.name}(): {meth.returnType}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions format */}
                {activeProposalModal.proposalJson?.actions && activeProposalModal.proposalJson.actions.length > 0 && (
                  <div className="space-y-2">
                    {activeProposalModal.proposalJson.actions.map((act, idx) => (
                      <div key={idx} className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/40 p-2.5 text-xs">
                        <span className="rounded-md bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                          {act.action}
                        </span>
                        <div className="flex-1 text-slate-800 dark:text-slate-200">
                          {act.className && <span className="font-semibold">{act.className}</span>}
                          {act.attributeName && <span> Atributo: {act.attributeName} ({act.attributeType || 'String'})</span>}
                          {act.methodName && <span> Método: {act.methodName}(): {act.methodReturnType || 'void'}</span>}
                          {act.sourceClassName && act.targetClassName && (
                            <span> {act.sourceClassName} [{act.sourceMultiplicity || '1'}] ── {act.relationType || 'ASSOCIATION'} ── [{act.targetMultiplicity || '1'}] {act.targetClassName}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct relations format */}
                {activeProposalModal.proposalJson?.relations && activeProposalModal.proposalJson.relations.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Relaciones detectadas:</div>
                    {activeProposalModal.proposalJson.relations.map((rel, rIdx) => (
                      <div key={rIdx} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-2 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{rel.sourceClassName} ({rel.sourceMultiplicity || '1'})</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-[11px]">── {rel.type} ──</span>
                        <span>({rel.targetMultiplicity || '1'}) {rel.targetClassName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-[#131B3E]">
              <button
                disabled={applyingProposal}
                onClick={() => void handleRejectSavedProposal(activeProposalModal.id)}
                className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 disabled:opacity-50 transition cursor-pointer"
              >
                Rechazar propuesta
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveProposalModal(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#182352] transition cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  disabled={applyingProposal}
                  onClick={() => void handleApplySavedProposal(activeProposalModal.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{applyingProposal ? 'Aplicando cambios…' : 'Aplicar cambios'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}


function CanvasFloatingToolbar({
  showMiniMap,
  setShowMiniMap,
  interactionMode,
  setInteractionMode,
}: {
  showMiniMap: boolean
  setShowMiniMap: React.Dispatch<React.SetStateAction<boolean>>
  interactionMode: 'select' | 'pan'
  setInteractionMode: React.Dispatch<React.SetStateAction<'select' | 'pan'>>
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0E1535]/95 p-1.5 shadow-xl backdrop-blur-md transition-all">
      <button
        type="button"
        onClick={() => setInteractionMode('select')}
        className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition cursor-pointer ${
          interactionMode === 'select'
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Modo Seleccionar"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="m13 13 6 6" />
        </svg>
        <span>Seleccionar</span>
      </button>

      <button
        type="button"
        onClick={() => setInteractionMode('pan')}
        className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition cursor-pointer ${
          interactionMode === 'pan'
            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Modo Mover / Mano"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
        <span>Mover</span>
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

      <button
        type="button"
        onClick={() => void zoomIn({ duration: 200 })}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        title="Acercar (Zoom In)"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => void zoomOut({ duration: 200 })}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        title="Alejar (Zoom Out)"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => void fitView({ duration: 300, padding: 0.2 })}
        className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
        title="Ajustar vista (Fit View)"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        <span className="hidden sm:inline">Ajustar</span>
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

      <button
        type="button"
        onClick={() => setShowMiniMap(curr => !curr)}
        className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition cursor-pointer ${
          showMiniMap
            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352]'
        }`}
        title="Alternar Minimapa"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
        <span className="hidden sm:inline">Mapa</span>
      </button>
    </div>
  )
}

function EmptyInspectorPanel({
  diagramName,
  classCount,
  relationCount,
  onCreateClass,
  onNewRelation,
}: {
  diagramName: string
  classCount: number
  relationCount: number
  onCreateClass: () => void
  onNewRelation: () => void
}) {
  return (
    <aside
      className="flex w-full flex-col border-l border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0E1535]/95 backdrop-blur-md shadow-xl lg:w-96 shrink-0"
      aria-label="Inspector UML"
    >
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/60 dark:bg-[#131B3E]/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-white shadow-xs">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Inspector UML</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Resumen del diagrama</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* Tarjeta 1: Modo Inspección Activo */}
        <div className="rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 to-violet-50/40 dark:from-indigo-950/40 dark:to-violet-950/30 p-5 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-[#131B3E] text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/50">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              <path d="m13 13 6 6" />
            </svg>
          </div>
          <h3 className="text-xs font-bold text-slate-800 dark:text-white">Modo inspección activo</h3>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Haz clic en una <strong className="text-indigo-700 dark:text-indigo-400">clase</strong> o una <strong className="text-violet-700 dark:text-violet-400">relación</strong> en el lienzo para ver y modificar sus atributos, métodos y cardinalidades.
          </p>
        </div>

        {/* Tarjeta 2: Detalles del modelo */}
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/50 p-4 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Detalles del modelo</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Diagrama:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{diagramName}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Clases activas:</span>
              <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/80 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">{classCount}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Relaciones activas:</span>
              <span className="rounded-full bg-violet-100 dark:bg-violet-950/80 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">{relationCount}</span>
            </div>
          </div>
        </section>

        {/* Tarjeta 3: Acciones */}
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B3E] p-4 shadow-xs space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Acciones</h4>
          <button
            onClick={onCreateClass}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 transition cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Añadir entidad al modelo</span>
          </button>
          <button
            onClick={onNewRelation}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>Vincular entidades</span>
          </button>
        </section>
      </div>
    </aside>
  )
}

function RelationPanel({
  classes,
  relation,
  draft,
  disabled,
  onSave,
  onDelete,
  onClose,
}: {
  classes: UmlClass[]
  relation: UmlRelation | null
  draft: UmlRelationInput
  disabled: boolean
  onSave: (value: UmlRelationInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose?: () => void
}) {
  const [value, setValue] = useState<UmlRelationInput>(draft)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const update = <K extends keyof UmlRelationInput>(field: K, fieldValue: UmlRelationInput[K]) =>
    setValue(current => ({ ...current, [field]: fieldValue }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await onSave(value)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <aside
      className="flex w-full flex-col border-l border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#0E1535]/95 backdrop-blur-md shadow-xl lg:w-96 shrink-0"
      aria-label="Propiedades de relación"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/60 dark:bg-[#131B3E]/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#6366F1] text-white shadow-xs">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {relation ? 'Editar relación' : 'Nueva relación'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Inspector de Relaciones UML</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            title="Cerrar inspector"
          >
            <span className="sr-only">Cerrar</span>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Form Content */}
      <form className="flex-1 space-y-4 overflow-y-auto p-5" onSubmit={handleSubmit}>
        {/* Source & Target Classes */}
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/50 p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Entidades Conectadas</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Origen</label>
            <select
              aria-label="Clase de origen"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] p-2 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              value={value.sourceClassId}
              onChange={event => update('sourceClassId', event.target.value)}
              disabled={Boolean(relation)}
            >
              <option value="">Seleccionar</option>
              {classes.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Destino</label>
            <select
              aria-label="Clase de destino"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] p-2 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              value={value.targetClassId}
              onChange={event => update('targetClassId', event.target.value)}
              disabled={Boolean(relation)}
            >
              <option value="">Seleccionar</option>
              {classes.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Relation Type & Cardinality */}
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131B3E] p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Tipo y Cardinalidad</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo</label>
            <select
              aria-label="Tipo de relación"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] p-2 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              value={value.type}
              onChange={event => update('type', event.target.value as UmlRelationType)}
            >
              {relationTypes.map(option => (
                <option key={option.type} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Multiplicidad origen</label>
              <select
                aria-label="Multiplicidad de origen"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] p-2 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={value.sourceMultiplicity}
                onChange={event => update('sourceMultiplicity', event.target.value)}
              >
                {multiplicities.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Multiplicidad destino</label>
              <select
                aria-label="Multiplicidad de destino"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] p-2 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={value.targetMultiplicity}
                onChange={event => update('targetMultiplicity', event.target.value)}
              >
                {multiplicities.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Etiqueta</label>
            <input
              aria-label="Etiqueta de relación"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-3 py-2 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              maxLength={120}
              placeholder="ej. contiene, realiza, extiende"
              value={value.label ?? ''}
              onInput={event => update('label', event.currentTarget.value || undefined)}
            />
          </div>
        </section>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="submit"
            disabled={disabled || isSubmitting || classes.length < 1}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:opacity-95 disabled:opacity-50 transition"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {relation ? 'Guardar relación' : 'Crear relación'}
          </button>

          {onDelete && (
            <button
              type="button"
              disabled={disabled}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800 disabled:opacity-50 transition"
              onClick={() => void onDelete()}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 12-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Eliminar relación
            </button>
          )}
        </div>
      </form>
    </aside>
  )
}

function messageFor(failure: unknown) {
  return failure instanceof ApiError ? failure.message : 'No se pudo completar la operación. Intenta nuevamente.'
}
