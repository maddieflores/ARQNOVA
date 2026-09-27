import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { UmlClassNodeData } from './mappers'
import type { UmlVisibility } from './types'

const symbol: Record<UmlVisibility, string> = { PUBLIC: '+', PRIVATE: '-', PROTECTED: '#', PACKAGE: '~' }

const visibilityConfig: Record<UmlVisibility, { text: string; bg: string; border: string }> = {
  PUBLIC: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  PRIVATE: { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  PROTECTED: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  PACKAGE: { text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
}

export function UmlClassNode({ data, selected }: NodeProps) {
  const nodeData = data as UmlClassNodeData
  const umlClass = nodeData.umlClass
  const isAbstract = umlClass.isAbstract

  return (
    <div
      className={`group relative min-w-72 rounded-2xl border bg-white/95 dark:bg-[#0E1535]/95 backdrop-blur-md text-xs transition-all duration-300 ease-out select-none ${
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-2xl shadow-indigo-500/20 scale-[1.02]'
          : 'border-slate-200/90 dark:border-slate-800 shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/60 hover:shadow-xl hover:scale-[1.008]'
      }`}
    >
      {/* Target handle top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-3.5 !w-3.5 !rounded-full !border-2 !border-indigo-600 dark:!border-indigo-400 !bg-white dark:!bg-[#0E1535] !shadow-md transition-all duration-200 hover:!scale-130 hover:!bg-indigo-50 dark:hover:!bg-[#182352]"
      />

      {/* Class Header with Gradient by Type */}
      <div
        className={`overflow-hidden rounded-t-2xl px-4 py-3 text-white shadow-sm transition-colors ${
          isAbstract
            ? 'bg-gradient-to-r from-purple-700 via-purple-600 to-fuchsia-600'
            : 'bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20 backdrop-blur-xs shadow-2xs">
              {isAbstract ? (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="12 2 2 12 12 22 22 12" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              )}
            </div>
            <div className="overflow-hidden">
              <span
                className={`block truncate text-sm font-bold tracking-tight text-white drop-shadow-xs ${
                  isAbstract ? 'italic' : ''
                }`}
              >
                {umlClass.name}
              </span>
            </div>
          </div>
          {isAbstract && (
            <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-xs border border-white/30">
              «abstract»
            </span>
          )}
        </div>
      </div>

      {/* Attributes Section */}
      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131B3E]/60 px-3.5 py-2.5">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <svg className="h-3 w-3 text-indigo-500 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Atributos</span>
          </div>
          <span className="rounded-full bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700 dark:text-slate-300">
            {umlClass.attributes.length}
          </span>
        </div>

        {umlClass.attributes.length === 0 ? (
          <div className="py-1 text-[11px] italic text-slate-600 dark:text-slate-400">Sin atributos</div>
        ) : (
          <div className="space-y-1">
            {umlClass.attributes.map(attribute => {
              const vis = visibilityConfig[attribute.visibility]
              return (
                <div
                  key={attribute.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-transparent bg-white/80 dark:bg-[#182352]/70 px-2 py-1 shadow-2xs hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden font-mono text-[11px]">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border font-bold text-[10px] ${vis.text} ${vis.bg} ${vis.border}`}
                    >
                      {symbol[attribute.visibility]}
                    </span>
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {attribute.name}: {attribute.type}
                    </span>
                  </div>
                  {attribute.isPrimaryKey && (
                    <span className="shrink-0 rounded-md bg-gradient-to-r from-amber-100 to-amber-200 dark:from-amber-950/80 dark:to-amber-900/60 px-1.5 py-0.2 text-[9px] font-bold text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 shadow-2xs">
                      {'{PK}'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Methods Section */}
      <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0E1535] px-3.5 py-2.5 rounded-b-2xl">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <svg className="h-3 w-3 text-violet-500 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>Métodos</span>
          </div>
          <span className="rounded-full bg-slate-200/80 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700 dark:text-slate-300">
            {umlClass.methods.length}
          </span>
        </div>

        {umlClass.methods.length === 0 ? (
          <div className="py-1 text-[11px] italic text-slate-600 dark:text-slate-400">Sin métodos</div>
        ) : (
          <div className="space-y-1">
            {umlClass.methods.map(method => {
              const vis = visibilityConfig[method.visibility]
              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-transparent bg-slate-50/70 dark:bg-[#182352]/50 px-2 py-1 hover:border-violet-200 dark:hover:border-violet-500/40 hover:bg-violet-50/40 dark:hover:bg-violet-950/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden font-mono text-[11px]">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border font-bold text-[10px] ${vis.text} ${vis.bg} ${vis.border}`}
                    >
                      {symbol[method.visibility]}
                    </span>
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {method.name}(): {method.returnType}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Source handle bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3.5 !w-3.5 !rounded-full !border-2 !border-indigo-600 dark:!border-indigo-400 !bg-white dark:!bg-[#0E1535] !shadow-md transition-all duration-200 hover:!scale-130 hover:!bg-indigo-50 dark:hover:!bg-[#182352]"
      />

      {/* Active Editor Lock Banner */}
      {nodeData.lockedBy && (
        <div className="absolute -top-3.5 -right-2 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-amber-500/25 border border-amber-300/40 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
          <span>Editando: {nodeData.lockedBy}</span>
        </div>
      )}
    </div>
  )
}

