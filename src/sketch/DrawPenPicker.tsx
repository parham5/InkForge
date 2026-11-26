import { DEFAULT_DRAW_PEN, DRAW_PEN_RANGES, type DrawPen } from '../editor/page';
import { GRAPHITE } from './render';

/** Colours for drawings; null is «auto»: the text's ink for a pen, graphite for a pencil. */
const COLORS: { name: string; color: string }[] = [
  { name: 'Graphite', color: GRAPHITE },
  { name: 'Dark blue', color: '#1f2a6b' },
  { name: 'Black', color: '#1b1c20' },
  { name: 'Red', color: '#b3261e' },
  { name: 'Green', color: '#2e6b3a' },
];

/** The line sliders: what each does, at its two ends. */
const SLIDERS: { key: keyof typeof DRAW_PEN_RANGES; label: string; hint: string; unit?: string }[] = [
  { key: 'wobble', label: 'Line wobble', hint: '0 ruler-straight, 1 steady hand, higher values more freehand' },
  { key: 'weight', label: 'Width', hint: 'relative to the handwriting pen', unit: '×' },
  { key: 'pressure', label: 'Pressure', hint: 'Stroke width variation along the line: 0 uniform' },
  { key: 'overshoot', label: 'Endpoint overshoot', hint: '0 ends exactly at the point; higher values extend beyond it' },
  { key: 'points', label: 'Marker variation', hint: '0 uses identical, regular markers. Higher values vary size, shape, closure and position. Add your own markers in Handwriting using ○ below the alphabet' },
  { key: 'joins', label: 'Line-to-marker joins', hint: '0 ends lines at the marker boundary. Higher values vary gaps, contact and overlap independently at each endpoint' },
];

interface Props {
  value: DrawPen;
  onChange: (next: DrawPen) => void;
  /** The document's ink: what «auto» means for a pen. */
  textInk: string;
}

/** Pen or pencil, its colour, whether labels stay in the text's pen, and how the lines are drawn. */
export function DrawPenPicker({ value, onChange, textInk }: Props) {
  const pencil = value.tool === 'pencil';
  const known = value.color === null || COLORS.some((c) => c.color === value.color);
  return (
    <div className="draw-pen">
      <div className="segmented" role="group" aria-label="Drawing tool">
        <button className={!pencil ? 'on' : ''} onClick={() => onChange({ ...value, tool: 'pen' })} title="Smooth ink stroke">
          ✒ Pen
        </button>
        <button className={pencil ? 'on' : ''} onClick={() => onChange({ ...value, tool: 'pencil' })} title="Fine gray stroke with paper grain">
          ✎ Pencil
        </button>
      </div>
      <div className="swatches" role="group" aria-label="Line color">
        <button
          className={`swatch auto ${value.color === null ? 'on' : ''}`}
          style={{ ['--sw' as string]: pencil ? GRAPHITE : textInk }}
          title={pencil ? 'Standard graphite pencil' : 'Match text'}
          aria-label={pencil ? 'Graphite' : 'Match text'}
          onClick={() => onChange({ ...value, color: null })}
        />
        {COLORS.filter((c) => !(pencil && c.color === GRAPHITE)).map((c) => (
          <button
            key={c.color}
            className={`swatch ${value.color === c.color ? 'on' : ''}`}
            style={{ ['--sw' as string]: c.color }}
            title={c.name}
            aria-label={c.name}
            onClick={() => onChange({ ...value, color: c.color })}
          />
        ))}
        <label className={`swatch custom ${known ? '' : 'on'}`} title="Custom color">
          <input type="color" value={value.color ?? (pencil ? GRAPHITE : textInk)} onChange={(e) => onChange({ ...value, color: e.target.value })} />
        </label>
      </div>
      {pencil && (
        <label className="check inline small">
          <input type="checkbox" checked={value.labelsInPen} onChange={(e) => onChange({ ...value, labelsInPen: e.target.checked })} />
          Draw labels in pen, matching the text
        </label>
      )}
      {pencil && (
        <label className="check inline small" title="Circles and arcs of at least 6 mm use an even radius and pressure with a center puncture; always enabled on forms">
          <input type="checkbox" checked={value.compass} onChange={(e) => onChange({ ...value, compass: e.target.checked })} />
          Compass-drawn arcs
        </label>
      )}
      <div className="draw-pen-sliders">
        {SLIDERS.map((s) => {
          const [min, max] = DRAW_PEN_RANGES[s.key];
          return (
            <label key={s.key} title={s.hint}>
              <span>
                {s.label}{' '}
                <output>
                  {s.unit ?? ''}
                  {value[s.key].toFixed(2).replace(/\.?0+$/, '')}
                </output>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={0.05}
                value={value[s.key]}
                onChange={(e) => onChange({ ...value, [s.key]: Number(e.target.value) })}
              />
            </label>
          );
        })}
        {SLIDERS.some((s) => value[s.key] !== DEFAULT_DRAW_PEN[s.key]) && (
          <button
            className="link-btn small"
            onClick={() => onChange({ ...value, wobble: 1, weight: 1, pressure: 1, overshoot: 1, points: 1, joins: 1 })}
            title="Restore default wobble, width, pressure, overshoot, markers and joins"
          >
            Reset lines and markers
          </button>
        )}
      </div>
    </div>
  );
}
