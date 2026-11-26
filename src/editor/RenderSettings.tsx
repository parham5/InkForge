import { useState } from 'react';
import { updateStyle, useHandwriting } from '../engine/handwriting';
import { Check, Slider, type SliderDef } from '../ui/StyleControls';
import { saveWear, useWear } from '../wear/settings';
import type { LayerShow, PrinterKind, WearSettings } from '../wear/wear';

/** The stages of a rendered sheet that can be left out (and are left out of the files too). */
const SHOWN: { key: keyof LayerShow; label: string; hint: string }[] = [
  { key: 'print', label: 'printed form', hint: 'printed form beneath the handwriting' },
  { key: 'drawings', label: 'drawings', hint: 'drawing and graph lines' },
  { key: 'text', label: 'text', hint: 'letters, annotations and labels' },
  { key: 'wear', label: 'wear', hint: 'smudges, eraser marks and compass punctures' },
  { key: 'folds', label: 'folds', hint: 'paper folds' },
];

const LINES: SliderDef[] = [
  { key: 'lineJitter', label: 'Line irregularity', min: 0, max: 1, step: 0.05, hint: 'Random line spacing: 0 follows the ruling exactly' },
  { key: 'sag', label: 'Baseline sag', min: 0, max: 1, step: 0.05, hint: 'Lines slope downward, and words and letters dip below the baseline' },
];

const SPACING: SliderDef[] = [
  { key: 'letterSpacing', label: 'Letter spacing', min: 0, max: 160, step: 1, hint: 'for unconnected letters' },
  { key: 'wordSpacing', label: 'Word spacing', min: 120, max: 700, step: 10, hint: 'space width' },
];

type Part = 'lines' | 'text' | 'wear';

/** The traces' sliders: what each does. */
const WEAR_SLIDERS: { key: 'smudge' | 'size' | 'erasers' | 'depth' | 'folds'; label: string; min: number; max: number; step: number; hint: string }[] = [
  { key: 'smudge', label: 'Smudges', min: 0, max: 2, step: 0.1, hint: 'Graphite smudges and pencil crumbs: 0 none, 1 typical, 2 heavily smudged' },
  { key: 'size', label: 'Smudge size', min: 0.5, max: 2, step: 0.1, hint: 'Size of hand smudges' },
  { key: 'erasers', label: 'Eraser marks', min: 0, max: 3, step: 1, hint: 'Number of erased lines, with faint stroke traces and surrounding eraser marks' },
  { key: 'depth', label: 'Puncture depth', min: 0.5, max: 2, step: 0.1, hint: 'Depth of the indentation around a compass puncture' },
  { key: 'folds', label: 'Folds', min: 0, max: 2, step: 0.1, hint: 'Soft folds from handling the paper: 0 flat, 2 crumpled' },
];

/** Traces of work on the rendered sheets: shown here, printed and in every export while on. */
function WearPart() {
  const wear = useWear();
  const set = (patch: Partial<WearSettings>) => void saveWear({ ...wear, ...patch });
  return (
    <section>
      <div className="render-show" title="What appears on the rendered page, in print and in exported files">
        <span className="small muted">Show:</span>
        {SHOWN.map((x) => (
          <label key={x.key} className="check inline small" title={x.hint}>
            <input type="checkbox" checked={wear.show[x.key]} onChange={(e) => set({ show: { ...wear.show, [x.key]: e.target.checked } })} />
            {x.label}
          </label>
        ))}
      </div>
      <label className="slider" title="Printer appearance for the form on screen, in exports and in desk photos">
        <span>Form printer</span>
        <select value={wear.printer} onChange={(e) => set({ printer: e.target.value as PrinterKind })}>
          <option value="new">new</option>
          <option value="usual">standard</option>
          <option value="tired">worn</option>
        </select>
      </label>
      <label className="check" title="Visible after rendering and included in print, PDF, PNG, SVG and desk photos while enabled">
        <input type="checkbox" checked={wear.on} onChange={(e) => set({ on: e.target.checked })} />
        Work marks: pencil smudges, eraser marks and compass punctures
      </label>
      {wear.on && (
        <>
          {WEAR_SLIDERS.map((s) => (
            <label key={s.key} className="slider" title={s.hint}>
              <span>
                {s.label} <output>{String(wear[s.key])}</output>
              </span>
              <input type="range" min={s.min} max={s.max} step={s.step} value={wear[s.key]} onChange={(e) => set({ [s.key]: Number(e.target.value) })} />
            </label>
          ))}
          <label className="slider" title="Smudge direction: right-handed writing smudges graphite down and to the right">
            <span>Writing hand</span>
            <select value={wear.hand} onChange={(e) => set({ hand: e.target.value === 'left' ? 'left' : 'right' })}>
              <option value="right">right</option>
              <option value="left">left</option>
            </select>
          </label>
          <label className="check" title="Occasional sharp creases in addition to soft folds">
            <input type="checkbox" checked={wear.sharp} onChange={(e) => set({ sharp: e.target.checked })} />
            Sharp creases
          </label>
          <label className="check" title="At the centers of compass-drawn circles and arcs">
            <input type="checkbox" checked={wear.holes} onChange={(e) => set({ holes: e.target.checked })} />
            Compass punctures
          </label>
          <button className="btn small" onClick={() => set({ seed: wear.seed + 1 })} title="Keep these settings and randomize wear and fold positions">
            ↺ Shuffle wear
          </button>
          <button className="btn small" onClick={() => set({ printerSeed: wear.printerSeed + 1 })} title="Randomize toner streaks, smudges and specks">
            ↺ Shuffle printer effects
          </button>
        </>
      )}
    </section>
  );
}

/**
 * How the letters are put into text: lines, spacing, joins, pairs. Changes
 * both the editor and the rendered view; the shape of the letters themselves
 * is set in the handwriting studio.
 */
export function RenderSettings() {
  const { style } = useHandwriting();
  const [part, setPart] = useState<Part>('lines');
  return (
    <>
      <div className="pill" role="tablist" aria-label="Render settings">
        <button role="tab" aria-selected={part === 'lines'} className={part === 'lines' ? 'on' : ''} onClick={() => setPart('lines')}>
          Lines
        </button>
        <button role="tab" aria-selected={part === 'text'} className={part === 'text' ? 'on' : ''} onClick={() => setPart('text')}>
          Text
        </button>
        <button role="tab" aria-selected={part === 'wear'} className={part === 'wear' ? 'on' : ''} onClick={() => setPart('wear')}>
          Wear
        </button>
      </div>
      {part === 'wear' ? (
        <WearPart />
      ) : part === 'lines' ? (
        <section>
          {LINES.map((s) => (
            <Slider key={s.key} s={s} style={style} />
          ))}
        </section>
      ) : (
        <section>
          {SPACING.map((s) => (
            <Slider key={s.key} s={s} style={style} />
          ))}
          <label className="slider" title="Number of variants used for each letter in the text">
            <span>Variants per letter</span>
            <select value={style.variants} onChange={(e) => updateStyle({ variants: Number(e.target.value) })}>
              {[1, 3, 5, 7, 11, 13].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Check k="connect" label="Cursive writing: connect entry and exit points" style={style} />
          <Check
            k="bridge"
            label="Draw natural connecting strokes without bending the letters, even when the next letter has no entry stroke"
            style={style}
          />
          <Check k="kerning" label="Optical kerning: bring Г, Т, У and punctuation closer" style={style} />
          <Check k="pairs" label="Use recorded letter pairs (ст, но…)" style={style} />
          <button className="btn small" onClick={() => updateStyle({ seed: style.seed + 1 })} title="Choose different letter variants throughout the text">
            Shuffle variants
          </button>
        </section>
      )}
    </>
  );
}
