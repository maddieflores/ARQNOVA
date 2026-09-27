import { useEffect, useState, type FormEvent } from 'react'
import type { UmlAttribute, UmlClass, UmlMethod, UmlVisibility } from './types'
import type { UmlAttributeInput, UmlMethodInput } from './uml-service'

const visibilities: UmlVisibility[] = ['PUBLIC', 'PRIVATE', 'PROTECTED', 'PACKAGE']

const visibilityLabels: Record<UmlVisibility, { label: string; symbol: string; color: string }> = {
  PUBLIC: { label: 'Público (+)', symbol: '+', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  PRIVATE: { label: 'Privado (-)', symbol: '-', color: 'text-rose-700 bg-rose-50 border-rose-200' },
  PROTECTED: { label: 'Protegido (#)', symbol: '#', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  PACKAGE: { label: 'Paquete (~)', symbol: '~', color: 'text-sky-700 bg-sky-50 border-sky-200' },
}

interface Props {
  umlClass: UmlClass
  disabled: boolean
  onUpdateClass: (value: { name: string; isAbstract: boolean }) => Promise<unknown>
  onDeleteClass: () => Promise<unknown>
  onCreateAttribute: (value: UmlAttributeInput) => Promise<unknown>
  onUpdateAttribute: (id: string, value: UmlAttributeInput) => Promise<unknown>
  onDeleteAttribute: (id: string) => Promise<unknown>
  onCreateMethod: (value: UmlMethodInput) => Promise<unknown>
  onUpdateMethod: (id: string, value: UmlMethodInput) => Promise<unknown>
  onDeleteMethod: (id: string) => Promise<unknown>
  onClose: () => void
}

export function UmlPropertiesPanel(props: Props) {
  const [name, setName] = useState(props.umlClass.name)
  const [isAbstract, setAbstract] = useState(props.umlClass.isAbstract)
  const [savingClass, setSavingClass] = useState(false)

  useEffect(() => {
    setName(props.umlClass.name)
    setAbstract(props.umlClass.isAbstract)
  }, [props.umlClass.id, props.umlClass.name, props.umlClass.isAbstract])

  const handleClassSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSavingClass(true)
    try {
      await props.onUpdateClass({ name, isAbstract })
    } finally {
      setSavingClass(false)
    }
  }

  return (
    <aside
      className="flex w-full flex-col border-l border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0E1535]/95 backdrop-blur-md shadow-xl lg:w-96"
      aria-label="Propiedades de clase"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4 bg-slate-50/60 dark:bg-[#131B3E]/60">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-white shadow-xs">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7V4h16v3M9 20h6M12 4v16" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Inspector UML</h2>
            <p className="text-[11px] text-slate-700 dark:text-slate-400">Propiedades de Clase</p>
          </div>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition"
          title="Cerrar inspector"
        >
          <span className="sr-only">Cerrar</span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {/* Class Identity Form */}
        <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/50 p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Identidad</h3>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">ID: {props.umlClass.id.slice(0, 8)}</span>
          </div>
          <form className="space-y-3" onSubmit={handleClassSubmit}>
            <div>
              <label htmlFor="class-name-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nombre de clase
              </label>
              <input
                id="class-name-input"
                aria-label="Nombre de clase"
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-3 py-2 text-sm font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                required
                maxLength={120}
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#182352]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                checked={isAbstract}
                onChange={event => setAbstract(event.target.checked)}
              />
              <span>Clase abstracta («abstract»)</span>
            </label>
            <button
              type="submit"
              disabled={props.disabled || savingClass}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-50 transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Guardar clase
            </button>
          </form>
        </section>

        {/* Member Editors */}
        <MemberEditor
          kind="attribute"
          items={props.umlClass.attributes}
          disabled={props.disabled}
          onCreate={props.onCreateAttribute}
          onUpdate={props.onUpdateAttribute}
          onDelete={props.onDeleteAttribute}
        />

        <MemberEditor
          kind="method"
          items={props.umlClass.methods}
          disabled={props.disabled}
          onCreate={props.onCreateMethod}
          onUpdate={props.onUpdateMethod}
          onDelete={props.onDeleteMethod}
        />

        {/* Danger Zone */}
        <section className="pt-2">
          <button
            type="button"
            disabled={props.disabled}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 px-4 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100/70 dark:hover:bg-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800 disabled:opacity-50 transition shadow-2xs"
            onClick={() => {
              if (confirm(`¿Eliminar la clase ${props.umlClass.name}?`)) void props.onDeleteClass()
            }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
            </svg>
            Eliminar clase
          </button>
        </section>
      </div>
    </aside>
  )
}

type MemberProps =
  | {
      kind: 'attribute'
      items: UmlAttribute[]
      disabled: boolean
      onCreate: (value: UmlAttributeInput) => Promise<unknown>
      onUpdate: (id: string, value: UmlAttributeInput) => Promise<unknown>
      onDelete: (id: string) => Promise<unknown>
    }
  | {
      kind: 'method'
      items: UmlMethod[]
      disabled: boolean
      onCreate: (value: UmlMethodInput) => Promise<unknown>
      onUpdate: (id: string, value: UmlMethodInput) => Promise<unknown>
      onDelete: (id: string) => Promise<unknown>
    }

function MemberEditor(props: MemberProps) {
  const isAttr = props.kind === 'attribute'
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState(isAttr ? 'String' : 'void')
  const [visibility, setVisibility] = useState<UmlVisibility>(isAttr ? 'PRIVATE' : 'PUBLIC')
  const [primary, setPrimary] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setEditing(null)
    setName('')
    setType(isAttr ? 'String' : 'void')
    setVisibility(isAttr ? 'PRIVATE' : 'PUBLIC')
    setPrimary(false)
  }

  const edit = (item: UmlAttribute | UmlMethod) => {
    setEditing(item.id)
    setName(item.name)
    setType('type' in item ? item.type : item.returnType)
    setVisibility(item.visibility)
    setPrimary('isPrimaryKey' in item && item.isPrimaryKey)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      let result: unknown
      if (props.kind === 'attribute') {
        const value = { name, type, visibility, isPrimaryKey: primary }
        result = editing ? await props.onUpdate(editing, value) : await props.onCreate(value)
      } else {
        const value = { name, returnType: type, visibility }
        result = editing ? await props.onUpdate(editing, value) : await props.onCreate(value)
      }
      if (result !== false) reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = isAttr ? 'Atributos' : 'Métodos'
  const titleSingle = isAttr ? 'atributo' : 'método'

  return (
    <section className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0E1535] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${isAttr ? 'bg-indigo-500' : 'bg-violet-500'}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">{title}</h3>
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          {props.items.length}
        </span>
      </div>

      {/* List of existing members */}
      <div className="space-y-1.5">
        {props.items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-2.5 text-center text-xs italic text-slate-600 dark:text-slate-400">
            Sin {title.toLowerCase()} definidos
          </p>
        ) : (
          props.items.map(item => {
            const vis = visibilityLabels[item.visibility]
            const typeStr = 'type' in item ? item.type : item.returnType
            const isPk = 'isPrimaryKey' in item && item.isPrimaryKey

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between rounded-lg border p-2 transition ${
                  editing === item.id
                    ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-1 ring-indigo-400'
                    : 'border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#131B3E]/60 hover:bg-slate-100/70 dark:hover:bg-[#182352]/70'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded border font-mono text-[10px] font-bold ${vis.color}`}
                    title={vis.label}
                  >
                    {vis.symbol}
                  </span>
                  <span className="truncate font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">:</span>
                  <span className="font-mono text-xs font-medium text-indigo-600 dark:text-indigo-400">{typeStr}</span>
                  {isPk && (
                    <span className="rounded bg-amber-100 dark:bg-amber-950/80 px-1 py-0.2 text-[9px] font-bold text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      PK
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition"
                    onClick={() => edit(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition"
                    onClick={() => {
                      if (confirm(`¿Eliminar ${item.name}?`)) void props.onDelete(item.id)
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add / Edit Form */}
      <form className="mt-3.5 space-y-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/50 p-3" onSubmit={submit}>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
          <span>{editing ? `Editar ${titleSingle}` : `Nuevo ${titleSingle}`}</span>
          {editing && (
            <button type="button" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" onClick={reset}>
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="sr-only">{`Nombre de ${titleSingle}`}</label>
            <input
              aria-label={`Nombre de ${titleSingle}`}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
              placeholder="Nombre"
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="sr-only">{isAttr ? 'Tipo de atributo' : 'Tipo de retorno'}</label>
            <input
              aria-label={isAttr ? 'Tipo de atributo' : 'Tipo de retorno'}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              required
              placeholder={isAttr ? 'Tipo (ej. String)' : 'Retorno (ej. void)'}
              value={type}
              onChange={event => setType(event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="sr-only">Visibilidad</label>
          <select
            aria-label="Visibilidad"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-2xs outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            value={visibility}
            onChange={event => setVisibility(event.target.value as UmlVisibility)}
          >
            {visibilities.map(value => (
              <option key={value} value={value}>
                {visibilityLabels[value].label}
              </option>
            ))}
          </select>
        </div>

        {isAttr && (
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
              checked={primary}
              onChange={event => setPrimary(event.target.checked)}
            />
            <span>Clave primaria (PK)</span>
          </label>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={props.disabled || isSubmitting}
            className="flex-1 rounded-md bg-slate-800 dark:bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-slate-900 dark:hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {editing ? 'Actualizar' : 'Agregar'} {titleSingle}
          </button>
          {editing && (
            <button
              type="button"
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0E1535] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182352] transition"
              onClick={reset}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </section>
  )
}

