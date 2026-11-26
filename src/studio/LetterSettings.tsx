import { useHandwriting } from '../engine/handwriting';
import { Check, Slider, type SliderDef } from '../ui/StyleControls';

/** What changes the letters themselves: you see it right here, on the letters you write. */
const LETTERS: SliderDef[] = [
  { key: 'weight', label: 'Pen width', min: 18, max: 120, step: 1, hint: 'in font units (1000 units per em)' },
  { key: 'pressure', label: 'Pressure', min: 0, max: 1, step: 0.05, hint: 'how pressure affects stroke width' },
  { key: 'jitter', label: 'Natural variation', min: 0, max: 1.5, step: 0.05, hint: 'random variation in each letter' },
  { key: 'fantasy', label: 'Model creativity', min: 0, max: 2, step: 0.05, hint: 'How far generated samples may vary: 0 follows your samples, 1 stays within your range, 2 explores further' },
  { key: 'slant', label: 'Slant', min: -20, max: 20, step: 1, hint: 'degrees; positive values lean right' },
];

/** Shape of the letters: pen, slant, the learned model. Lives in the handwriting studio. */
export function LetterSettings() {
  const { style, building, lastBuildMs, samples, joinLow, joinHigh, derived, error } = useHandwriting();
  return (
    <section className="panel float">
      <h3>Letter style</h3>
      {LETTERS.map((s) => (
        <Slider key={s.key} s={s} style={style} />
      ))}
      <Check k="interpolate" label="Generate new variants from the learned model" style={style} />
      <Check k="derive" label="Derive missing glyphs: й, ё, О, С, Latin letters and symbols" style={style} />
      <p className="build-status">
        {error ? (
          <span className="error">Font build error: {error}</span>
        ) : building ? (
          'Building font…'
        ) : (
          <>
            Font built in {lastBuildMs} ms · samples: {samples.length} · derived: {derived.size}
            {joinLow !== null && <> · joins: lower {joinLow}{joinHigh !== null && <>, upper {joinHigh}</>}</>}
          </>
        )}
      </p>
    </section>
  );
}
