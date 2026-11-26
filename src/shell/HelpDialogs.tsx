import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import pkg from '../../package.json';

export type HelpId = 'letters' | 'keys' | 'about';


/** Fired on window to open a help page of the «Информация» menu (or the drawing help). */
export const HELP_EVENT = 'handbook:help';
export const openHelp = (which: HelpId | 'sketch') => window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: which }));

function Dialog({ title, onClose, children, narrow }: { title: string; onClose: () => void; children: ReactNode; narrow?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="sketch-help-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sketch-help help-dialog ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sketch-help-top">
          <h2>{title}</h2>
          <button className="sketch-help-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sketch-help-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The hints that used to stand over the handwriting studio. */
function LettersHelp() {
  return (
    <>
      <section>
        <h3>Lowercase and uppercase</h3>
        <p>
          Write lowercase letters between the baseline and x-height guides, with descenders (д, у, р) extending to the descender guide.
          A leading stroke from the left and a trailing stroke to the right define the entry and exit points for cursive writing.
        </p>
        <p>
          Uppercase letters reach the cap-height guide. To <b>connect</b> to the next letter, draw the connecting stroke{' '}
          <b>last</b>, ending on the right at the baseline or x-height. The exit marker
          turns green. Г, П, Т and Ф commonly remain unconnected; this is normal.
        </p>
        <p>Add as many samples as you like. Each one makes your handwriting more natural.</p>
      </section>
      <section>
        <h3>Letter pairs</h3>
        <p>
          Write a pair <b>in one movement</b>, as part of a word, including the connection. In text, the pair replaces
          individual letters for a natural join. Add your own using the custom pair field below the pairs.
        </p>
      </section>
      <section>
        <h3>Entry and exit points</h3>
        <p>
          Circles mark entry and exit points. Green means the letter connects here, at the baseline or
          x-height. Yellow means a connection is enabled but the point is not at the letter edge, so it cannot connect. Click
          to toggle a connection. Drag a misplaced circle to snap it to the nearest stroke endpoint.
        </p>
        <p>
          A sample without an entry is used at the start of a word; one with both connections is used in the middle; one without an exit is used at the end.
          Samples without either connection are used alone, in formulas, scripts and abbreviations. When fewer than three suitable samples exist,
          other samples are used with their leading or trailing strokes trimmed. Samples alternate: none is repeated consecutively,
          and at least half of the other samples are used before it returns.
        </p>
      </section>
      <section>
        <h3>Write a phrase</h3>
        <p>
          Write a complete word in your normal connected handwriting. You can start with an uppercase letter to record its connection.
          Words and letter case are chosen randomly, favoring letters with fewer than three samples.
        </p>
        <p>
          After choosing Mark letter boundaries, move boundaries with the lower handles and adjust their slant with the upper handles so each letter
          has its own color. Each cut becomes a connection point. In the Formulas set, each symbol is a separate character;
          scripts are generated from regular digits.
        </p>
      </section>
      <section>
        <h3>Alphabet</h3>
        <p>
          The controls below the alphabet select <b>аа / АА</b> for lowercase or uppercase and <b>Cyr / Lat / ∑</b> for Cyrillic, Latin or
          numbers, symbols and formulas. More symbols includes supported formula characters,
          LaTeX symbols, brackets and characters added from the document. A dashed cell means the character is missing; a dotted cell means it was
          derived automatically. Use ← → to open adjacent letters.
        </p>
        <p>
          The model value shows how many variation dimensions the engine has learned for this letter. New variants are generated from that range;
          Model creativity in Letter style controls how far they can vary.
        </p>
      </section>
    </>
  );
}

function KeysHelp() {
  const rows: [string, string][] = [
    ['Ctrl+N', 'new document'],
    ['Ctrl+O', 'open a document, handwriting file or backup (.json)'],
    ['Ctrl+P', 'print / PDF'],
    ['Ctrl+,  Ctrl+.', 'subscript and superscript'],
    ['Ctrl+Enter', 'start a new page here; at the start of a line, move that line too. Backspace at its start removes the break'],
    ['← →', 'Handwriting: adjacent letter'],
    ['Enter', 'Handwriting: save sample'],
    ['Esc', 'Handwriting: clear canvas'],
    ['Ctrl+Z', 'Handwriting: undo stroke'],
  ];
  return (
    <>
      <section>
        <h3>Keyboard shortcuts</h3>
        <dl className="sketch-formulas">
          {rows.map(([k, what]) => (
            <div key={k}>
              <dt>
                <code>{k}</code>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Formulas</h3>
        <p>
          Formulas pasted from ChatGPT, Gemini or Wikipedia become handwriting: <code>$f_1$</code> → f₁. You can also type:{' '}
          <code>$\Pi_1$</code> becomes Π₁ when you type the closing <code>$</code>; pressing Backspace immediately afterward restores
          the original text. Use Convert formulas $…$ in the Σ menu for formulas already in the document.
        </p>
      </section>
      <section>
        <h3>Drawings</h3>
        <p>
          Put <code>```</code> (or <code>ёёё</code>) on a line, followed by commands and another <code>```</code> line to create a drawing.
          Pasting a complete AI response works too. For existing text, choose Find drawings in text from the
          Drawings menu.
        </p>
      </section>
    </>
  );
}

function About() {
  return (
    <section className="about">
      <p className="about-name">
        InkForge <span className="muted">{pkg.version}</span>
      </p>
      <p>Your handwriting. Your typeface. Your identity.</p>
      <p>Developed and published by Parham Fallah. © 2026 Parham Fallah.</p>
      <p className="muted">
        Handwriting, documents and settings are stored only on this computer. To transfer them, choose File → Back up everything,
        then open the backup on the other computer using File → Open…
      </p>
      <p className="muted">This application is based on the authorized Handbook source. Original authorship and third-party notices are retained in the project documentation.</p>
    </section>
  );
}

export function HelpDialog({ which, onClose }: { which: HelpId; onClose: () => void }) {
  if (which === 'letters')
    return (
      <Dialog title="Writing letters" onClose={onClose}>
        <LettersHelp />
      </Dialog>
    );
  if (which === 'keys')
    return (
      <Dialog title="Keyboard shortcuts and formulas" onClose={onClose}>
        <KeysHelp />
      </Dialog>
    );
  return (
    <Dialog title="About InkForge" onClose={onClose} narrow>
      <About />
    </Dialog>
  );
}
