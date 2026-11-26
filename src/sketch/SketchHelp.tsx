import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { copyText } from '../util/clipboard';
import { COMMANDS, FORMULA_HELP, GROUPS, localizeCode, type Command } from './commands';
import { EXAMPLES, sketchPrompt } from './prompt';
import { SketchFigure } from './SketchFigure';

type Lang = 'ru' | 'en';
const LANG_KEY = 'sketch.helpLang';

function savedLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'ru' ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

/** Drawn only once scrolled into view: the help holds dozens of small drawings. */
function LazySketch({ code, width, fontSize }: { code: string; width: number; fontSize: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <div ref={ref} className="sketch-preview" style={{ width, minHeight: 60 }}>
      {seen && <SketchFigure code={code} width={width} fontSize={fontSize} />}
    </div>
  );
}

interface CardProps {
  cmd: Command;
  lang: Lang;
  onInsert?: (code: string) => void;
  onCopy: (code: string) => void;
}

function CommandCard({ cmd, lang, onInsert, onCopy }: CardProps) {
  const name = lang === 'ru' ? cmd.names[0] : cmd.names[1];
  const other = cmd.names.filter((n) => n !== name).join(', ');
  const example = localizeCode(cmd.example, lang);
  return (
    <div className="sketch-cmd">
      <div className="sketch-cmd-text">
        <div className="sketch-cmd-head">
          {cmd.forms.map((f) => (
            <code key={f}>{f.replace('@', name)}</code>
          ))}
          <span className="muted small">{other}</span>
        </div>
        <p>{cmd.doc.replace(/@/g, name)}</p>
        <pre className="sketch-code">{example}</pre>
        <div className="row">
          {onInsert && (
            <button className="btn small" onClick={() => onInsert(example)}>
              Insert into drawing
            </button>
          )}
          <button className="btn small ghost" onClick={() => onCopy(example)}>
            Copy
          </button>
        </div>
      </div>
      <LazySketch code={example} width={190} fontSize={13} />
    </div>
  );
}

/**
 * Everything a drawing understands, with live examples in the user's hand,
 * and the request for a neural net (instructions + the task) ready to copy.
 */
export function SketchHelp({ onClose, onInsert }: { onClose: () => void; onInsert?: (code: string) => void }) {
  const [lang, setLang] = useState<Lang>(savedLang);
  const [query, setQuery] = useState('');
  const [task, setTask] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(noteTimer.current);
    };
  }, [onClose]);

  const pickLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // Private mode: the choice just is not remembered.
    }
  };

  const tell = (text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2200);
  };
  const copy = async (text: string, what: string) => {
    tell((await copyText(text)) ? `${what} — copied` : 'Could not copy. Select the text and press Ctrl+C');
  };
  const insert = onInsert
    ? (code: string) => {
        onInsert(code);
        tell('Inserted into drawing');
      }
    : undefined;

  const q = query.trim().toLowerCase();
  const matches = (c: Command) => !q || c.names.some((n) => n.toLowerCase().includes(q)) || c.doc.toLowerCase().includes(q);

  return createPortal(
    <div className="sketch-help-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sketch-help" role="dialog" aria-modal="true" aria-label="Drawing commands">
        <header className="sketch-help-top">
          <h2>Drawing: all commands</h2>
          <div className="seg" role="group" aria-label="Command names">
            <button className={lang === 'ru' ? 'on' : ''} onClick={() => pickLang('ru')}>
              Russian aliases
            </button>
            <button className={lang === 'en' ? 'on' : ''} onClick={() => pickLang('en')}>
              GeoGebra names
            </button>
          </div>
          <button className="sketch-help-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="sketch-help-body">
          <section className="sketch-ai">
            <h3>Ask AI</h3>
            <p className="muted">
              Describe what to draw. Instructions, commands and examples are added to your description. Paste the result into ChatGPT,
              Gemini or another AI chat. Paste its response into the drawing Commands panel or directly into the document. Code between
              code fences becomes a drawing; explanations remain text. The application renders the drawing in your handwriting,
              so the same commands always produce the same construction.
            </p>
            <textarea
              value={task}
              rows={2}
              placeholder="For example: triangle ABC with median AM and angle bisector BL"
              onChange={(e) => setTask(e.target.value)}
            />
            <div className="row">
              <button className="btn small primary" onClick={() => void copy(sketchPrompt(task), 'AI prompt')}>
                Copy prompt
              </button>
              <button className="btn small" onClick={() => void copy(sketchPrompt(), 'Instructions without a task')}>
                Instructions only
              </button>
            </div>
            <details>
              <summary>Preview the AI prompt</summary>
              <pre className="sketch-code prompt">{sketchPrompt(task)}</pre>
            </details>
          </section>

          <section>
            <h3>Writing commands</h3>
            <ul className="sketch-rules">
              <li>
                Use one command per line. Define a name before using it.
              </li>
              <li>
                Descriptive geometry: define a spatial point as <code>A = (2, 1, 3)</code>. The drawing becomes a Monge projection:
                the application draws A₁ and A₂, projection links and the x₁₂ axis, with x pointing left from O. Segments,
                lines and polygons built from these points are projected too. For a profile projection, use{' '}
                <code>{lang === 'ru' ? 'Проекции' : 'Projections'}(1, 2, 3)</code>, represent a plane with a triangle:{' '}
                <code>{lang === 'ru' ? 'Многоугольник' : 'Polygon'}(A, B, C)</code>.
              </li>
              <li>
                Enter a drawing directly in the text: a line containing <code>```</code>, then commands, then another line containing <code>```</code>{' '}
                (on a Russian keyboard the same key produces <code>ёёё</code> which is also accepted). After closing the final
                fence, the drawing appears in place. Press Backspace immediately afterward to restore the text. For existing text, choose Insert
                block → Find drawings in text.
              </li>
              <li>
                Point: <code>A = (2, 3)</code>. Use a decimal point <code>(2.5, 3)</code>, or a decimal comma when
                coordinates are separated with semicolons: <code>(2,5; 3)</code>.
              </li>
              <li>
                Graph: <code>f(x) = x^2 - 1</code> or <code>y = 2x + 1</code>. Vertical line: <code>x = 3</code>.
                Number: <code>r = 2</code>, then <code>{lang === 'ru' ? 'Окружность' : 'Circle'}(A, r)</code>.
              </li>
              <li>
                Names with subscripts and primes: <code>A_1</code>, <code>A_{'{12}'}</code>, <code>A'</code> produce labels A₁, A₁₂ and A′.
                Cyrillic А and Latin A refer to the same point.
              </li>
              <li>
                Russian and English command aliases are accepted: <code>Отрезок(A, B)</code> and <code>Segment(A, B)</code> are equivalent
                . Comments begin with <code>#</code>.
              </li>
              <li>
                Lines with errors are skipped and reported; the rest is drawn. GeoGebra display commands
                (SetPointStyle, SetDecoration and similar commands) may be silently ignored where unsupported. Legacy bracket syntax <code>Segment[A, B]</code>{' '}
                is also accepted.
              </li>
            </ul>
          </section>

          <input
            className="sketch-search"
            type="search"
            placeholder="Find a command: segment, circle, intersection…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {GROUPS.map((group) => {
            const list = COMMANDS.filter((c) => c.group === group.id && matches(c));
            if (!list.length) return null;
            return (
              <section key={group.id}>
                <h3>{group.name}</h3>
                {list.map((cmd) => (
                  <CommandCard key={cmd.names[1]} cmd={cmd} lang={lang} onInsert={insert} onCopy={(c) => void copy(c, 'Example')} />
                ))}
              </section>
            );
          })}

          {!q && (
            <section>
              <h3>Numbers and formulas</h3>
              <dl className="sketch-formulas">
                {FORMULA_HELP.map((f) => (
                  <div key={f.code}>
                    <dt>
                      <code>{f.code}</code>
                    </dt>
                    <dd>{f.doc}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {!q && (
            <section>
              <h3>Complete examples</h3>
              {EXAMPLES.map((ex) => {
                const code = localizeCode(ex.code, lang);
                return (
                  <div key={ex.title} className="sketch-cmd">
                    <div className="sketch-cmd-text">
                      <div className="sketch-cmd-head">
                        <strong>{ex.title}</strong>
                      </div>
                      <p className="muted">Task: {ex.task}</p>
                      <pre className="sketch-code">{code}</pre>
                      <div className="row">
                        {insert && (
                          <button className="btn small" onClick={() => insert(code)}>
                            Insert into drawing
                          </button>
                        )}
                        <button className="btn small ghost" onClick={() => void copy(code, 'Example')}>
                          Copy
                        </button>
                      </div>
                    </div>
                    <LazySketch code={code} width={260} fontSize={15} />
                  </div>
                );
              })}
            </section>
          )}
        </div>
        {note && <div className="sketch-help-note">{note}</div>}
      </div>
    </div>,
    document.body,
  );
}
