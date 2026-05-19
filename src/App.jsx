import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { X, GripVertical, Moon, Sun, Plus } from 'lucide-react'

// ─── Music theory ─────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

const CHORD_INTERVALS = {
  Major:      [0, 4, 7],
  Minor:      [0, 3, 7],
  Diminished: [0, 3, 6],
  Maj7:       [0, 4, 7, 11],
  Min7:       [0, 3, 7, 10],
  Dom7:       [0, 4, 7, 10],
  Sus2:       [0, 2, 7],
}

const QUALITY_LABELS = {
  Major:      'maj',
  Minor:      'min',
  Diminished: 'dim',
  Maj7:       'maj7',
  Min7:       'min7',
  Dom7:       'dom7',
  Sus2:       'sus2',
}

function getChordTones(rootIndex, quality) {
  return (CHORD_INTERVALS[quality] ?? []).map(i => rootIndex + i)
}

function chordLabel(root, quality) {
  return `${root} ${QUALITY_LABELS[quality] ?? quality}`
}

// ─── Piano keyboard ───────────────────────────────────────────────────────────

const WHITE_KEY_PATTERN = [0, 2, 4, 5, 7, 9, 11]
const BLACK_KEY_PATTERN = [
  { noteIndex: 1,  afterWhite: 0 },
  { noteIndex: 3,  afterWhite: 1 },
  { noteIndex: 6,  afterWhite: 3 },
  { noteIndex: 8,  afterWhite: 4 },
  { noteIndex: 10, afterWhite: 5 },
]

function buildKeyArrays(octaves) {
  const white = []
  const black = []
  for (let oct = 0; oct < octaves; oct++) {
    WHITE_KEY_PATTERN.forEach(ni => white.push({ noteIndex: ni, octave: oct }))
    BLACK_KEY_PATTERN.forEach(({ noteIndex, afterWhite }) =>
      black.push({ noteIndex, afterWhite: afterWhite + oct * 7, octave: oct })
    )
  }
  return { white, black }
}

function PianoKeyboard({ activeTones, mini = false }) {
  const octaves = 2
  const wW = mini ? 20 : 44
  const wH = mini ? 56 : 124
  const bW = mini ? 13 : 28
  const bH = mini ? 34 : 76
  const { white: whiteKeys, black: blackKeys } = buildKeyArrays(octaves)
  const totalW = whiteKeys.length * wW

  return (
    <svg
      viewBox={`0 0 ${totalW} ${wH}`}
      style={mini
        ? { display: 'block', width: totalW, height: wH }
        : { display: 'block', width: '100%', height: 'auto' }
      }
      aria-label="Piano keyboard"
    >
      {whiteKeys.map(({ noteIndex, octave }, i) => {
        const active = activeTones.includes(noteIndex + octave * 12)
        const x = i * wW
        return (
          <g key={i}>
            <rect
              x={x + 0.5}
              y={0}
              width={wW - 1}
              height={wH}
              rx={mini ? 2 : 4}
              className={
                active
                  ? 'fill-primary stroke-primary'
                  : 'fill-white stroke-border dark:fill-zinc-100 dark:stroke-zinc-300'
              }
              strokeWidth={1}
            />
            {active && (
              <text
                x={x + wW / 2}
                y={wH - (mini ? 6 : 12)}
                textAnchor="middle"
                dominantBaseline="auto"
                fontSize={mini ? 6 : 10}
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
                className="fill-primary-foreground"
                style={{ userSelect: 'none' }}
              >
                {NOTE_NAMES[noteIndex]}
              </text>
            )}
          </g>
        )
      })}

      {blackKeys.map(({ noteIndex, afterWhite, octave }, i) => {
        const active = activeTones.includes(noteIndex + octave * 12)
        const x = (afterWhite + 1) * wW - bW / 2
        return (
          <g key={i}>
            <rect
              x={x}
              y={0}
              width={bW}
              height={bH}
              rx={mini ? 2 : 3}
              className={
                active
                  ? 'fill-primary stroke-primary'
                  : 'fill-zinc-900 stroke-zinc-900 dark:fill-zinc-950 dark:stroke-zinc-950'
              }
            />
            {active && (
              <text
                x={x + bW / 2}
                y={bH - (mini ? 4 : 9)}
                textAnchor="middle"
                dominantBaseline="auto"
                fontSize={mini ? 5 : 9}
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
                className="fill-primary-foreground"
                style={{ userSelect: 'none' }}
              >
                {NOTE_NAMES[noteIndex]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Chord card ───────────────────────────────────────────────────────────────

function ChordCard({ chord, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chord.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  const tones = getChordTones(NOTE_NAMES.indexOf(chord.root), chord.quality)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex flex-col gap-2.5 rounded-lg border border-border bg-card px-3 pt-2.5 pb-3 shadow-sm w-fit select-none"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing touch-none p-0.5 -ml-0.5"
          aria-label="Drag to reorder"
        >
          <GripVertical size={13} />
        </button>
        <span className="text-xs font-semibold text-foreground tracking-tight">
          {chordLabel(chord.root, chord.quality)}
        </span>
        <button
          onClick={() => onRemove(chord.id)}
          className="text-muted-foreground hover:text-destructive transition-colors p-0.5 -mr-0.5"
          aria-label="Remove chord"
        >
          <X size={13} />
        </button>
      </div>
      <PianoKeyboard activeTones={tones} mini />
    </div>
  )
}

// ─── Select control ───────────────────────────────────────────────────────────

function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[110px]">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer appearance-none pr-8 bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundPosition: 'right 10px center',
        }}
      >
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

// ─── App root ─────────────────────────────────────────────────────────────────

let nextId = 1

export default function App() {
  const [dark, setDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
  )
  const [root, setRoot] = useState('C')
  const [quality, setQuality] = useState('Major')
  const [savedChords, setSavedChords] = useState([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const activeTones = getChordTones(NOTE_NAMES.indexOf(root), quality)

  const addChord = useCallback(() => {
    setSavedChords(prev => [...prev, { id: nextId++, root, quality }])
  }, [root, quality])

  const removeChord = useCallback(id => {
    setSavedChords(prev => prev.filter(c => c.id !== id))
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd({ active, over }) {
    if (over && active.id !== over.id) {
      setSavedChords(prev => {
        const from = prev.findIndex(c => c.id === active.id)
        const to = prev.findIndex(c => c.id === over.id)
        return arrayMove(prev, from, to)
      })
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground m-0">
              Piano Chord Visualizer
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Root position · No audio
            </p>
          </div>
          <button
            onClick={() => setDark(d => !d)}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-12 flex-1 w-full">
        {/* Chord selector section */}
        <section className="space-y-6 sm:space-y-7">
          <div className="flex flex-wrap items-end gap-3">
            <LabeledSelect
              label="Root note"
              value={root}
              onChange={setRoot}
              options={NOTE_NAMES}
            />
            <LabeledSelect
              label="Quality"
              value={quality}
              onChange={setQuality}
              options={Object.keys(CHORD_INTERVALS)}
            />
            <button
              onClick={addChord}
              className="h-9 self-end w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Plus size={14} />
              Add chord
            </button>
          </div>

          {/* Live keyboard preview */}
          <div className="space-y-2.5">
            <div className="flex items-baseline gap-2.5">
              <span className="text-xl font-semibold tracking-tight">
                {chordLabel(root, quality)}
              </span>
              <span className="text-sm text-muted-foreground">
                {activeTones.map(i => NOTE_NAMES[i % 12]).join(' · ')}
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
              <PianoKeyboard activeTones={activeTones} />
            </div>
          </div>
        </section>

        {/* Divider + saved chords */}
        {savedChords.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-t border-border pt-8">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Saved chords
              </span>
              <span className="text-[11px] text-muted-foreground">
                {savedChords.length}
              </span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={savedChords.map(c => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className="flex flex-wrap gap-3">
                  {savedChords.map(chord => (
                    <ChordCard key={chord.id} chord={chord} onRemove={removeChord} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            A simple chord reference tool · root position, no audio
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()}{' '}
            <a
              href="https://github.com/diefenbachr/experiment4pianotool"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline underline-offset-2"
            >
              Ryan Diefenbach
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
