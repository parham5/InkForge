import { useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditor } from '../blocks/CodeEditor';
import { sketchErrors } from './render';

/** What the pipette over a blank takes: a printed point, the drawing's origin, a point in space by its projections. */
export type PickKind = 'point' | 'origin' | 'space';

interface Props {
  code: string;
  onChange: (code: string) => void;
  onHelp: () => void;
  /** On a blank: take points off it with the pipette. */
  onPick?: (kind: PickKind) => void;
}

/** The commands of a drawing: typed or pasted from a neural net, applied as you type. */
export function SketchPanel({ code, onChange, onHelp, onPick }: Props) {
  const [draft, setDraft] = useState(code);
  const sent = useRef(code);
  const timer = useRef<number | undefined>(undefined);

  // Changed from outside: undo/redo, «Вставить» in the help.
  useEffect(() => {
    if (code !== sent.current) {
      sent.current = code;
      setDraft(code);
    }
  }, [code]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const edit = (text: string) => {
    setDraft(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      sent.current = text;
      onChange(text);
    }, 300);
  };

  const errors = useMemo(() => sketchErrors(draft), [draft]);
  const [goTo, setGoTo] = useState<{ line: number }>();

  return (
    <>
      <CodeEditor value={draft} language="plain" onChange={edit} goTo={goTo} />
      {errors.length > 0 ? (
        <ul className="sketch-errors">
          {errors.slice(0, 8).map((e) => (
            <li key={`${e.line}:${e.message}`} onClick={() => setGoTo({ line: e.line })} title="Show line">
              <b>Line {e.line}:</b> {e.message}
            </li>
          ))}
          {errors.length > 8 && <li>…and {errors.length - 8}</li>}
        </ul>
      ) : null}
      {onPick && (
        <div className="row sketch-pick">
          <span className="muted small">From form:</span>
          <button className="btn small" onClick={() => onPick('point')} title="Click a printed point to add its coordinates and a Hide command">
            ⌖ Point
          </button>
          <button className="btn small" onClick={() => onPick('space')} title="3D point: click the front projection, then the horizontal projection — A = (x, y, z)">
            ⌖ From projections
          </button>
          <button className="btn small" onClick={() => onPick('origin')} title="Drawing origin on the form, usually 0 on the x₁₂ axis: OnBlank(x, y)">
            ⌖ Origin
          </button>
        </div>
      )}
      <div className="row">
        <button className="btn small primary" onClick={onHelp}>
          All commands and AI prompt
        </button>
        <span className="muted small">
          {errors.length
            ? 'Lines with errors were skipped; the rest was drawn.'
            : 'The drawing updates immediately. Paste the entire AI response; code fences are accepted.'}
        </span>
      </div>
    </>
  );
}
