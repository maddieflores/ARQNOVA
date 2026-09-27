import { useRef, useState, type FormEvent } from 'react'
import type { AiImageInput, AiUmlAction, AiUmlProposal } from './types'
import { useSpeechRecognition } from './useSpeechRecognition'

export function AiProposalForm({
  loading,
  applying,
  applied,
  proposal,
  onGenerate,
  onApply,
  onCancel,
}: {
  loading: boolean
  applying: boolean
  applied: boolean
  proposal: AiUmlProposal | null
  onGenerate: (prompt: string, image?: AiImageInput) => Promise<void>
  onApply: () => Promise<void>
  onCancel: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [selectedImage, setSelectedImage] = useState<(AiImageInput & { previewUrl: string; size: number }) | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const basePromptRef = useRef('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  const {
    isSupported,
    isListening,
    errorMessage: speechError,
    startListening,
    stopListening,
    clearError: clearSpeechError,
  } = useSpeechRecognition({
    lang: 'es-ES',
    continuous: false,
    interimResults: true,
    onResult: (transcript) => {
      const base = basePromptRef.current
      const cleanTranscript = transcript.trim()
      if (!cleanTranscript) return
      const updatedPrompt = base ? `${base} ${cleanTranscript}` : cleanTranscript
      setPrompt(updatedPrompt)
    },
  })

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening()
    } else {
      basePromptRef.current = prompt.trim()
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


  const removeSelectedImage = () => {
    setSelectedImage(null)
    setImageError(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (isListening) {
      stopListening()
    }
    const value = prompt.trim()
    if (value || selectedImage) {
      void onGenerate(
        value,
        selectedImage
          ? {
              data: selectedImage.data,
              mimeType: selectedImage.mimeType,
              fileName: selectedImage.fileName,
            }
          : undefined,
      )
    }
  }


  const renderActionLabel = (action: AiUmlAction) => {
    switch (action.action) {
      case 'ADD_CLASS':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              + Clase
            </span>
            <div className="text-xs">
              <span className="font-bold text-slate-900 dark:text-white">{action.className}</span>
              {action.isAbstract && <span className="ml-1 text-slate-500 dark:text-slate-400 italic">(abstracta)</span>}
              {(action.attributes?.length || 0) > 0 && (
                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                  Atributos: {action.attributes?.map(a => `${a.name}: ${a.type}`).join(', ')}
                </div>
              )}
            </div>
          </div>
        )
      case 'UPDATE_CLASS':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              ✎ Modificar Clase
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              Renombrar a: <span className="font-bold text-slate-900 dark:text-white">{action.className}</span>
            </div>
          </div>
        )
      case 'DELETE_CLASS':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              🗑 Eliminar Clase
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              Eliminar entidad: <span className="font-bold text-rose-700 dark:text-rose-400">{action.className || action.classId}</span>
            </div>
          </div>
        )
      case 'ADD_ATTRIBUTE':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              + Atributo
            </span>
            <div className="text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Clase {action.className || 'Entidad'} → </span>
              <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                {action.attributeName || action.attribute?.name}: {action.attributeType || action.attribute?.type}
              </span>
              {action.isPrimaryKey && <span className="ml-1.5 rounded bg-amber-100 dark:bg-amber-950/60 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-300">PK</span>}
            </div>
          </div>
        )
      case 'UPDATE_ATTRIBUTE':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              ✎ Modificar Atributo
            </span>
            <div className="text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Clase {action.className || 'Entidad'} → </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {action.attributeName || action.attributeId}
              </span>
              {action.attributeType && <span className="text-indigo-600 dark:text-indigo-400"> (Nuevo tipo: {action.attributeType})</span>}
            </div>
          </div>
        )
      case 'DELETE_ATTRIBUTE':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              🗑 Eliminar Atributo
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              Eliminar atributo <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{action.attributeName || action.attributeId}</span> de <span className="font-semibold text-slate-900 dark:text-white">{action.className || 'Clase'}</span>
            </div>
          </div>
        )
      case 'ADD_METHOD':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              + Método
            </span>
            <div className="text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Clase {action.className || 'Entidad'} → </span>
              <span className="font-mono font-semibold text-indigo-700 dark:text-indigo-400">
                {action.methodName || action.method?.name}(): {action.methodReturnType || action.method?.returnType || 'void'}
              </span>
            </div>
          </div>
        )
      case 'UPDATE_METHOD':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              ✎ Modificar Método
            </span>
            <div className="text-xs">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Clase {action.className || 'Entidad'} → </span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                {action.methodName || action.methodId}()
              </span>
              {action.methodReturnType && <span className="text-indigo-600 dark:text-indigo-400"> (Retorno: {action.methodReturnType})</span>}
            </div>
          </div>
        )
      case 'DELETE_METHOD':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              🗑 Eliminar Método
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              Eliminar método <span className="font-mono font-bold text-rose-700 dark:text-rose-400">{action.methodName || action.methodId}()</span> de <span className="font-semibold text-slate-900 dark:text-white">{action.className || 'Clase'}</span>
            </div>
          </div>
        )
      case 'ADD_RELATION':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              + Relación
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              <span className="font-bold text-slate-900 dark:text-white">
                {action.sourceClassName || action.sourceClassId} [{action.sourceMultiplicity || '1'}] → {action.targetClassName || action.targetClassId} [{action.targetMultiplicity || '1'}]
              </span>{' '}
              <span className="font-mono text-indigo-700 dark:text-indigo-400 font-semibold">({action.relationType || 'ASSOCIATION'})</span>
            </div>
          </div>
        )
      case 'UPDATE_RELATION':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              ✎ Modificar Relación
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              Actualizar relación: <span className="font-mono font-semibold text-slate-900 dark:text-white">{action.relationType || 'Relación'}</span>
              {action.targetMultiplicity && <span className="text-indigo-600 dark:text-indigo-400"> (Multiplicidad destino: {action.targetMultiplicity})</span>}
            </div>
          </div>
        )
      case 'DELETE_RELATION':
        return (
          <div className="flex items-start gap-3 p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50/60 dark:bg-rose-950/30">
            <span className="shrink-0 mt-0.5 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              🗑 Eliminar Relación
            </span>
            <div className="text-xs text-slate-800 dark:text-slate-200">
              Eliminar relación entre entidades
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      {/* PANEL IZQUIERDO: Entrada de Prompt IA */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs flex flex-col justify-between transition-all"
        >
          <div>
            {/* Header del Formulario */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <div>
                  <label htmlFor="ai-prompt" className="text-sm font-bold text-slate-900 dark:text-white block">
                    Edición del diagrama con IA
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Indica cambios mediante texto, voz o adjuntando una imagen UML
                  </p>
                </div>
              </div>

              {/* Acciones de Entrada: Imagen y Voz */}
              <div className="flex items-center gap-2">
                {/* Input oculto para archivo de imagen */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleImageSelect}
                  tabIndex={-1}
                />

                {/* Botón de Entrada por Imagen / Foto */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={loading}
                  title="Seleccionar imagen o fotografía de un diagrama UML (PNG, JPG, WEBP)"
                  aria-label="Analizar imagen UML"
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                    selectedImage
                      ? 'border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                      : 'border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>{selectedImage ? 'Cambiar imagen' : 'Analizar imagen'}</span>
                </button>

                {/* Botón de Entrada por Voz (Micrófono Web Speech API) */}
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={loading}
                  title={isListening ? 'Detener escucha' : 'Hablar instrucción (Dictar por voz)'}
                  aria-label={isListening ? 'Detener escucha' : 'Hablar instrucción'}
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer shadow-2xs ${
                    isListening
                      ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200 dark:ring-rose-900/60 shadow-md shadow-rose-500/20'
                      : 'border border-slate-200/90 dark:border-slate-700 bg-slate-50 dark:bg-[#131B3E] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {isListening ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                      </span>
                      <span>Escuchando…</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                      <span>Hablar instrucción</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Banner de Error en Imagen */}
            {imageError && (
              <div
                role="alert"
                className="mt-3 flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:text-rose-300 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{imageError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImageError(null)}
                  aria-label="Cerrar aviso de imagen"
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 ml-2 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Card de Vista Previa de Imagen Seleccionada */}
            {selectedImage && (
              <div className="mt-3.5 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-[#131B3E] p-3 shadow-2xs transition">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedImage.previewUrl}
                    alt={selectedImage.fileName || 'Vista previa UML'}
                    className="h-12 w-12 rounded-lg border border-indigo-200 dark:border-indigo-700 object-cover shadow-2xs shrink-0 bg-white dark:bg-[#182352]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        Imagen UML seleccionada
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {(selectedImage.size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate mt-0.5" title={selectedImage.fileName}>
                      {selectedImage.fileName || 'diagrama-uml.png'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={loading}
                    className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-[#182352] px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-[#1f2d68] transition cursor-pointer"
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    disabled={loading}
                    aria-label="Eliminar imagen seleccionada"
                    title="Eliminar imagen"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-[#182352] text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Banner de Error en Reconocimiento de Voz */}
            {speechError && (
              <div
                role="alert"
                className="mt-3 flex items-center justify-between rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs font-medium text-amber-900 dark:text-amber-300 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{speechError}</span>
                </div>
                <button
                  type="button"
                  onClick={clearSpeechError}
                  aria-label="Cerrar aviso de voz"
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 ml-2 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Indicador Activo de Escucha */}
            {isListening && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2.5 text-xs font-medium text-rose-900 dark:text-rose-300 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                  <span>Micrófono activo · Habla tu instrucción ahora (ej. &ldquo;Agrega un atributo teléfono de tipo String a la clase Cliente&rdquo;)</span>
                </div>
                <button
                  type="button"
                  onClick={stopListening}
                  className="font-bold text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 underline cursor-pointer ml-2 shrink-0"
                >
                  Detener
                </button>
              </div>
            )}

            {/* Textarea de Entrada */}
            <div className="mt-4 relative">
              <textarea
                id="ai-prompt"
                aria-label="Describir modelo UML"
                className="w-full min-h-[220px] rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/50 dark:bg-[#131B3E] p-4 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs focus:border-indigo-500 focus:bg-white dark:focus:bg-[#161F46] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition"
                maxLength={2000}
                required={!selectedImage}
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                placeholder={
                  selectedImage
                    ? "Opcional: escribe instrucciones adicionales para guiar el análisis de la imagen (ej: 'Incorpora solo la clase Cliente y Pedido con sus relaciones') o genera los cambios directamente."
                    : "Ejemplos:\n• Agrega telefono de tipo String a Cliente\n• Cambia el tipo de telefono de String a Long\n• Agrega calcularTotal() a Pedido\n• Cambia Cliente a Usuario\n• Relaciona Cliente con Pedido mediante asociación"
                }
              />
            </div>

            {/* Footer de información y contador */}
            <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-medium">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Contexto del diagrama activo
              </span>
              <span className="font-mono text-slate-400 dark:text-slate-500">{prompt.length}/2000</span>
            </div>
          </div>

          {/* Botón Principal: Generar Propuesta */}
          <button
            type="submit"
            aria-label="Generar propuesta"
            disabled={loading || (!prompt.trim() && !selectedImage)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{selectedImage ? 'Analizando imagen con IA…' : 'Analizando con IA…'}</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>{selectedImage ? '✨ Analizar imagen y generar cambios' : '✨ Generar cambios con IA'}</span>
              </>
            )}
          </button>

        </form>
      </div>

      {/* PANEL DERECHO: Visualizador de Propuesta UML */}
      <section
        className="lg:col-span-7 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-6 shadow-xs min-h-[460px] flex flex-col justify-between"
        aria-label="Propuesta UML"
      >
        <div>
          {/* Header del Panel Derecho */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cambios UML propuestos</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Acciones estructuradas por el motor de IA</p>
              </div>
            </div>
            {proposal && (
              <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                ✓ Propuesta validada
              </span>
            )}
          </div>

          {/* Estado Vacío */}
          {!proposal ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50/80 dark:bg-[#131B3E] text-indigo-600 dark:text-indigo-400 shadow-inner mb-4">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Aún no existe una propuesta</h3>
              <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Escribe una instrucción en el panel izquierdo (por ejemplo para agregar o modificar clases, atributos, métodos o relaciones) para que la IA proponga las acciones de cambio.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-6">
              {/* Resumen de la IA */}
              {proposal.summary && (
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/40 p-3.5 text-xs text-indigo-950 dark:text-indigo-200 font-medium">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                    Resumen del cambio
                  </div>
                  {proposal.summary}
                </div>
              )}

              {/* Lista de Acciones Propuestas */}
              {proposal.actions && proposal.actions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Acciones a aplicar</h3>
                    <span className="rounded-full bg-slate-100 dark:bg-[#131B3E] px-2 py-0.2 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      {proposal.actions.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {proposal.actions.map((action, index) => (
                      <div key={index}>{renderActionLabel(action)}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección de Clases (para propuestas tradicionales o aditivas) */}
              {proposal.classes && proposal.classes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Clases</h3>
                    <span className="rounded-full bg-slate-100 dark:bg-[#131B3E] px-2 py-0.2 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      {proposal.classes.length}
                    </span>
                  </div>

                  <div className="grid gap-3.5 sm:grid-cols-2">
                    {proposal.classes.map(umlClass => (
                      <div
                        key={umlClass.name}
                        className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#131B3E] shadow-2xs hover:shadow-xs transition"
                      >
                        <div className="bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] px-3.5 py-2 text-white flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs tracking-tight">{umlClass.name}</span>
                          </div>
                          <span className="text-[9px] font-mono opacity-75">class</span>
                        </div>
                        <div className="p-3 text-xs space-y-2.5">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                              ATRIBUTOS
                            </div>
                            {umlClass.attributes.length === 0 ? (
                              <div className="text-[11px] italic text-slate-400 dark:text-slate-500">Sin atributos</div>
                            ) : (
                              <ul className="space-y-1">
                                {umlClass.attributes.map(attribute => (
                                  <li
                                    key={attribute.name}
                                    className="flex items-center justify-between font-mono text-[11px] text-slate-700 dark:text-slate-200 bg-slate-50/70 dark:bg-[#18224d] px-2 py-1 rounded"
                                  >
                                    <span>
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{attribute.visibility}</span> {attribute.name}:{' '}
                                      <span className="text-slate-500 dark:text-slate-400">{attribute.type}</span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sección de Relaciones (para propuestas tradicionales o aditivas) */}
              {proposal.relations && proposal.relations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Relaciones</h3>
                    <span className="rounded-full bg-slate-100 dark:bg-[#131B3E] px-2 py-0.2 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      {proposal.relations.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {proposal.relations.map((relation, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/70 dark:bg-[#131B3E] text-xs"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">
                          {relation.sourceClassName} [{relation.sourceMultiplicity || '1'}] → {relation.targetClassName} [{relation.targetMultiplicity || '1'}]
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
                          {relation.type} {relation.label && `(${relation.label})`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sección de Validación y Botones de Aplicación */}
        {proposal && (
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-5">
            <div className="mb-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">Confirmación de aplicación</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Al aplicar, las acciones se ejecutarán incrementalmente en PostgreSQL y se sincronizarán en tiempo real con el editor UML.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label="Aplicar al diagrama"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
                disabled={loading || applying || applied}
                onClick={() => void onApply()}
              >
                {applying ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Aplicando al diagrama…</span>
                  </>
                ) : applied ? (
                  <>
                    <span>✓ Cambios aplicados</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Aplicar cambios</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B3E] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#182352] hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition cursor-pointer"
                disabled={loading || applying}
                onClick={onCancel}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
