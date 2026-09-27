import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { aiService } from './ai-service'
import type { AiImageInput, AiUmlClass, AiUmlProposal, AiUmlRelation } from './types'
import { useSpeechRecognition } from './useSpeechRecognition'
import { ApiError } from '../../services/http'

type GenerationMode = 'text' | 'voice' | 'image'

const EXAMPLE_TEMPLATES = [
  {
    title: 'Sistema de Biblioteca',
    description: 'Crear un sistema de biblioteca con Usuario, Libro, Préstamo, Categoría y Multa, con sus atributos, métodos y relaciones.',
  },
  {
    title: 'Gestión Clínica',
    description: 'Diseñar un sistema de gestión hospitalaria con Paciente, Médico, ConsultaMédica, HistoriaClínica y Receta.',
  },
  {
    title: 'Comercio Electrónico',
    description: 'Modelo para tienda en línea con Cliente, Pedido, DetallePedido, Producto, Carrito y Pago.',
  },
  {
    title: 'Gestión Universitaria',
    description: 'Sistema académico con Estudiante, Profesor, Curso, Matrícula, Aula y Calificación.',
  },
]

export function AiNewDiagramGenerator({ initialMode = 'text' }: { initialMode?: GenerationMode }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<GenerationMode>(initialMode)
  const [textPrompt, setTextPrompt] = useState('')
  const [voicePrompt, setVoicePrompt] = useState('')
  const [selectedImage, setSelectedImage] = useState<(AiImageInput & { previewUrl: string; size: number }) | null>(null)
  const [imageNotes, setImageNotes] = useState('')
  const [imageError, setImageError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<AiUmlProposal | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const baseVoicePromptRef = useRef('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  const {
    isSupported: isSpeechSupported,
    isListening,
    errorMessage: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    lang: 'es-ES',
    continuous: false,
    interimResults: true,
    onResult: (transcript) => {
      const base = baseVoicePromptRef.current
      const clean = transcript.trim()
      if (!clean) return
      const updated = base ? `${base} ${clean}` : clean
      setVoicePrompt(updated)
    },
  })

  const toggleVoice = () => {
    if (isListening) {
      stopListening()
    } else {
      baseVoicePromptRef.current = voicePrompt.trim()
      startListening()
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null)
    const file = event.target.files?.[0]
    if (!file) return

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp']

    const isValidMime = file.type ? allowedMimes.includes(file.type.toLowerCase()) : false
    const isValidExt = allowedExts.includes(ext)

    if (!isValidMime && !isValidExt) {
      setImageError('Formato no compatible. Por favor seleccione una imagen PNG, JPG/JPEG o WEBP.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }

    const mimeType = isValidMime
      ? file.type
      : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : 'image/jpeg'

    const maxBytes = 5 * 1024 * 1024 // 5 MB
    if (file.size > maxBytes) {
      setImageError('La imagen supera el tamaño máximo permitido de 5 MB.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
      setSelectedImage({
        data: cleanBase64,
        mimeType,
        fileName: file.name,
        previewUrl: dataUrl,
        size: file.size,
      })
    }
    reader.onerror = () => {
      setImageError('No se pudo leer el archivo de imagen seleccionado.')
    }
    reader.readAsDataURL(file)
  }

  const handleGenerate = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    if (isListening) stopListening()

    let activePrompt = ''
    let activeImage: AiImageInput | undefined

    if (mode === 'text') {
      activePrompt = textPrompt.trim()
      if (!activePrompt) {
        setError('Por favor ingresa una descripción para el sistema UML.')
        return
      }
    } else if (mode === 'voice') {
      activePrompt = voicePrompt.trim()
      if (!activePrompt) {
        setError('Por favor dicta o escribe una instrucción por voz.')
        return
      }
    } else if (mode === 'image') {
      if (!selectedImage) {
        setError('Por favor selecciona una imagen o fotografía del diagrama UML.')
        return
      }
      activeImage = {
        data: selectedImage.data,
        mimeType: selectedImage.mimeType,
        fileName: selectedImage.fileName,
      }
      activePrompt = imageNotes.trim()
    }

    setLoading(true)
    setError(null)
    try {
      const result = await aiService.generateNewUml(activePrompt, activeImage)
      setProposal(result.proposal)
      const suggestedName = result.proposal.summary
        ? result.proposal.summary.replace(/^sistema\s+de\s+/i, '').slice(0, 40).trim()
        : 'Sistema UML con IA'
      setProjectName(suggestedName ? suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1) : 'Nuevo Sistema UML')
      setProjectDescription(result.proposal.summary || '')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible generar el modelo UML con IA.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDiagram = async () => {
    if (!proposal) return
    setCreating(true)
    setError(null)
    try {
      const finalName = projectName.trim() || 'Proyecto UML IA'
      const result = await aiService.createProjectFromProposal(proposal, finalName, projectDescription.trim())
      navigate(`/projects/${result.project.id}/editor`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al persistir el proyecto y diagrama.')
      setCreating(false)
    }
  }

  const handleCancelPreview = () => {
    setProposal(null)
    setError(null)
  }

  const renderRelationTypeBadge = (type: string) => {
    const badges: Record<string, { label: string; bg: string; text: string }> = {
      ASSOCIATION: { label: 'Asociación', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
      AGGREGATION: { label: 'Agregación ◇', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
      COMPOSITION: { label: 'Composición ◆', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
      INHERITANCE: { label: 'Herencia ▷', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
      DEPENDENCY: { label: 'Dependencia ⇢', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
    }
    const info = badges[type] || { label: type, bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' }
    return (
      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${info.bg} ${info.text} uppercase tracking-wider`}>
        {info.label}
      </span>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Banner de Error */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-900 shadow-sm animate-fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold">
              ✕
            </div>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* SI NO HAY PROPUESTA GENERADA: MOSTRAR SELECTOR DE MODALIDADES Y FORMULARIO */}
      {!proposal && (
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* Encabezado descriptivo de la funcionalidad */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 text-white shadow-md shadow-indigo-500/20">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Generar nuevo diagrama UML con IA
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Crea un modelo de clases UML completo desde cero sin necesidad de un diagrama previo.
                  </p>
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
              Modelo desde cero
            </span>
          </div>

          {/* Selector de Modalidades (3 Pestañas: Texto, Voz, Imagen) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Modalidad Texto */}
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all text-left cursor-pointer ${
                mode === 'text'
                  ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-600/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E] hover:bg-slate-100 dark:hover:bg-[#18224d] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                  mode === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-[#161F46] text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">1. Generar desde texto</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Descripción en lenguaje natural</p>
              </div>
            </button>

            {/* 2. Modalidad Voz */}
            <button
              type="button"
              onClick={() => setMode('voice')}
              className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all text-left cursor-pointer ${
                mode === 'voice'
                  ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/50 shadow-md shadow-purple-500/10 ring-2 ring-purple-600/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E] hover:bg-slate-100 dark:hover:bg-[#18224d] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                  mode === 'voice' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white dark:bg-[#161F46] text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">2. Generar desde voz</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Dictado y reconocimiento de voz</p>
              </div>
            </button>

            {/* 3. Modalidad Imagen */}
            <button
              type="button"
              onClick={() => setMode('image')}
              className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all text-left cursor-pointer ${
                mode === 'image'
                  ? 'border-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/50 shadow-md shadow-cyan-500/10 ring-2 ring-cyan-600/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E] hover:bg-slate-100 dark:hover:bg-[#18224d] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition ${
                  mode === 'image' ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white dark:bg-[#161F46] text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">3. Generar desde imagen</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Análisis visual multimodal</p>
              </div>
            </button>
          </div>

          {/* Formulario según la modalidad activa */}
          <form onSubmit={handleGenerate} className="space-y-6 pt-2">
            {/* 1. MODO TEXTO */}
            {mode === 'text' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="text-prompt" className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Descripción del sistema o requisitos
                  </label>
                  <textarea
                    id="text-prompt"
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    rows={5}
                    placeholder="Ejemplo: Crear un sistema de biblioteca con Usuario, Libro, Préstamo y relaciones entre estas entidades, incluyendo atributos como código, nombre, fecha y métodos de préstamo..."
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#131B3E] p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition resize-none"
                    disabled={loading}
                  />
                </div>

                {/* Plantillas de Ejemplo Rápidas */}
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">O prueba con una plantilla de ejemplo:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {EXAMPLE_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.title}
                        type="button"
                        onClick={() => setTextPrompt(tmpl.description)}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#131B3E] hover:bg-indigo-50 dark:hover:bg-[#1A2552] hover:border-indigo-300 dark:hover:border-indigo-500/50 transition text-left cursor-pointer group"
                      >
                        <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{tmpl.title}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{tmpl.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. MODO VOZ */}
            {mode === 'voice' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleVoice}
                      disabled={loading}
                      aria-label={isListening ? 'Detener dictado' : 'Iniciar dictado por voz'}
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl font-bold transition shadow-md cursor-pointer ${
                        isListening
                          ? 'bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                    >
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {isListening ? 'Escuchando tu voz...' : 'Presiona el micrófono para dictar'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Habla con claridad describiendo las clases, atributos y relaciones que deseas generar.
                      </p>
                    </div>
                  </div>

                  {isListening && (
                    <span className="flex items-center gap-2 rounded-full bg-rose-100 dark:bg-rose-950/60 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-rose-600"></span>
                      Grabando audio
                    </span>
                  )}
                </div>

                {speechError && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                    {speechError}
                  </div>
                )}

                <div>
                  <label htmlFor="voice-prompt" className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Texto reconocido (puedes revisarlo y corregirlo antes de generar):
                  </label>
                  <textarea
                    id="voice-prompt"
                    value={voicePrompt}
                    onChange={(e) => setVoicePrompt(e.target.value)}
                    rows={4}
                    placeholder="El texto dictado aparecerá aquí en tiempo real..."
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#131B3E] p-4 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-purple-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition resize-none"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* 3. MODO IMAGEN */}
            {mode === 'image' && (
              <div className="space-y-4">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {imageError && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs font-semibold text-rose-800 dark:text-rose-300">
                    {imageError}
                  </div>
                )}

                {!selectedImage ? (
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E]/50 hover:bg-indigo-50/40 dark:hover:bg-[#18224d] hover:border-indigo-400 dark:hover:border-indigo-500 transition cursor-pointer text-center space-y-2"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 font-bold">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        Haz clic aquí para seleccionar o arrastrar una imagen UML
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Soporta imágenes PNG, JPG/JPEG y WEBP de hasta 5 MB.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/60 dark:bg-cyan-950/30">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={selectedImage.previewUrl}
                        alt={selectedImage.fileName || 'Vista previa'}
                        className="h-16 w-16 rounded-xl border border-cyan-200 dark:border-cyan-800 object-cover bg-white dark:bg-[#131B3E] shadow-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {selectedImage.fileName || 'diagrama-uml.png'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {(selectedImage.size / 1024).toFixed(1)} KB · Imagen lista para análisis multimodal
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1A2552] transition cursor-pointer"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedImage(null)}
                        className="rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-200 dark:hover:bg-rose-900 transition cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="image-notes" className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                    Instrucciones adicionales o aclaraciones (opcional):
                  </label>
                  <input
                    id="image-notes"
                    type="text"
                    value={imageNotes}
                    onChange={(e) => setImageNotes(e.target.value)}
                    placeholder="Ejemplo: Extraer todas las clases visibles e incluir multiplicidades 1 a muchos en la relación..."
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#131B3E] px-4 py-3 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-cyan-600 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-cyan-500/10 transition"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Botón de Generar con IA */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Analizando con Gemini IA...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <span>Generar modelo UML con IA</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VISTA PREVIA DEL MODELO GENERADO (CUANDO GEMINI RESPONDE) */}
      {proposal && (
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 sm:p-8 shadow-sm space-y-6 animate-fade-in">
          
          {/* Header de la Vista Previa */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Vista Previa del Modelo UML Generado
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Revisa las clases, atributos, métodos y relaciones generadas antes de crear el diagrama.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                {proposal.classes?.length || 0} Clases · {proposal.relations?.length || 0} Relaciones
              </span>
            </div>
          </div>

          {/* Resumen de Gemini */}
          {proposal.summary && (
            <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/40 text-xs sm:text-sm text-indigo-950 dark:text-indigo-200 leading-relaxed font-medium">
              <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">Resumen de la propuesta:</span>
              {proposal.summary}
            </div>
          )}

          {/* Configuración del Nuevo Proyecto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-[#131B3E] border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <label htmlFor="project-name" className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                Nombre del nuevo proyecto:
              </label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Nombre del proyecto..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161F46] px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="project-desc" className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">
                Descripción (opcional):
              </label>
              <input
                id="project-desc"
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Descripción del proyecto..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161F46] px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          {/* GRID DE CLASES GENERADAS */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Clases identificadas ({proposal.classes?.length || 0})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proposal.classes?.map((cls: AiUmlClass, idx: number) => (
                <div key={`${cls.name}-${idx}`} className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] shadow-2xs overflow-hidden flex flex-col">
                  {/* Encabezado de Clase */}
                  <div className="p-3.5 bg-slate-50 dark:bg-[#161F46] border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        Clase
                      </span>
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">{cls.name}</span>
                    </div>
                    {cls.isAbstract && (
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 italic">
                        «abstract»
                      </span>
                    )}
                  </div>

                  {/* Atributos */}
                  <div className="p-3.5 space-y-1.5 flex-1 border-b border-slate-100 dark:border-slate-700/60">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Atributos ({cls.attributes?.length || 0})</p>
                    {cls.attributes && cls.attributes.length > 0 ? (
                      <div className="space-y-1">
                        {cls.attributes.map((attr, aIdx) => (
                          <div key={aIdx} className="flex items-center justify-between text-xs font-mono text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-[#18224d] px-2 py-1 rounded-lg">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                {attr.visibility === 'PUBLIC' ? '+' : attr.visibility === 'PROTECTED' ? '#' : attr.visibility === 'PACKAGE' ? '~' : '-'}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white truncate">{attr.name}</span>
                              <span className="text-slate-400 dark:text-slate-500">:</span>
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">{attr.type}</span>
                            </div>
                            {attr.isPrimaryKey && (
                              <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1 py-0.2 text-[8px] font-bold text-amber-800 dark:text-amber-300 shrink-0">
                                PK
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Sin atributos iniciales</p>
                    )}
                  </div>

                  {/* Métodos */}
                  <div className="p-3.5 space-y-1.5 bg-white dark:bg-[#131B3E]">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Métodos ({cls.methods?.length || 0})</p>
                    {cls.methods && cls.methods.length > 0 ? (
                      <div className="space-y-1">
                        {cls.methods.map((meth, mIdx) => (
                          <div key={mIdx} className="flex items-center text-xs font-mono text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-[#18224d] px-2 py-1 rounded-lg">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mr-1.5">
                              {meth.visibility === 'PUBLIC' ? '+' : meth.visibility === 'PROTECTED' ? '#' : meth.visibility === 'PACKAGE' ? '~' : '-'}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white truncate">{meth.name}()</span>
                            <span className="text-slate-400 dark:text-slate-500 mx-1">:</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-medium">{meth.returnType}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Sin métodos iniciales</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* LISTA DE RELACIONES GENERADAS */}
          {proposal.relations && proposal.relations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Relaciones identificadas ({proposal.relations.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {proposal.relations.map((rel: AiUmlRelation, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-[#131B3E]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <span className="font-bold text-indigo-700 dark:text-indigo-400">{rel.sourceClassName}</span>
                      <span className="rounded bg-slate-200 dark:bg-[#18224d] px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                        {rel.sourceMultiplicity || '1'}
                      </span>
                      <span className="text-slate-400">⟶</span>
                      <span className="font-bold text-indigo-700 dark:text-indigo-400">{rel.targetClassName}</span>
                      <span className="rounded bg-slate-200 dark:bg-[#18224d] px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                        {rel.targetMultiplicity || '1'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {rel.label && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                          "{rel.label}"
                        </span>
                      )}
                      {renderRelationTypeBadge(rel.type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BOTONES DE ACCIÓN: CREAR DIAGRAMA O CANCELAR */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancelPreview}
              disabled={creating}
              className="w-full sm:w-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] px-5 py-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A2552] hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancelar / Modificar consulta
            </button>

            <button
              type="button"
              onClick={handleCreateDiagram}
              disabled={creating}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
            >
              {creating ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Creando proyecto y persistiendo...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span>Crear diagrama</span>
                </>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  )
}
