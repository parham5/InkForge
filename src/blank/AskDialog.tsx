// «Ask AI»: the blank marked up for a chat, and the request to go
// with it. The marks can be put right first: a click on the picture adds a
// point there (sticking to the printing) or takes away the one clicked.
import { useEffect, useRef, useState } from 'react';
import { MM } from '../editor/page';
import { db, getSetting, setSetting } from '../storage/db';
import { copyText } from '../util/clipboard';
import { saveFile } from '../util/download';
import { blankSheet, type Blank, type BlankMark } from './blank';
import { findMarks, freeAreas, markAt, markedPicture, markMm, marksOf, sortMarks, type Area } from './marks';
import { blankPrompt, DEFAULT_ASK, type AskChoice } from './prompt';
import { snapper } from './snap';

const ASK_KEY = 'blank.ask';

export function AskDialog({ blank, onClose }: { blank: Blank; onClose: () => void }) {
  const [marks, setMarks] = useState<BlankMark[] | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [ask, setAsk] = useState<AskChoice>(DEFAULT_ASK);
  const [busy, setBusy] = useState<string | null>('Detecting points on form…');
  const [note, setNote] = useState<string | null>(null);
  const sheet = blankSheet(blank);
  const marksRef = useRef<BlankMark[] | null>(null);
  marksRef.current = marks;

  useEffect(() => {
    void getSetting<Partial<AskChoice>>(ASK_KEY, {}).then((a) => setAsk({ ...DEFAULT_ASK, ...a, tasks: '', wishes: '' }));
    void (async () => {
      setAreas(await freeAreas(blank));
      setMarks(await marksOf(blank, (m) => void db.blanks.update(blank.id, { marks: m })));
    })().catch((err) => setNote(`Could not annotate form: ${String(err)}`));
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [blank.id]);

  // The picture's memory is given back when the dialog closes.
  const pictureUrl = useRef<string | null>(null);
  pictureUrl.current = picture?.url ?? null;
  useEffect(
    () => () => {
      if (pictureUrl.current) URL.revokeObjectURL(pictureUrl.current);
    },
    [],
  );

  // The picture with the marks as they are now.
  useEffect(() => {
    if (!marks) return;
    let alive = true;
    setBusy('Drawing annotations…');
    void markedPicture(blank, marks, areas)
      .then((blob) => {
        if (!alive) return;
        setPicture((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      })
      .catch((err) => setNote(String(err)))
      .finally(() => alive && setBusy(null));
    return () => {
      alive = false;
    };
  }, [marks, areas]);

  const keep = (next: BlankMark[]) => {
    const sorted = sortMarks(blank, next);
    setMarks(sorted);
    void db.blanks.update(blank.id, { marks: sorted });
  };
  const changeAsk = (patch: Partial<AskChoice>) => {
    const next = { ...ask, ...patch };
    setAsk(next);
    void setSetting(ASK_KEY, { variant: next.variant, name: next.name });
  };

  /** A click on the picture: the mark there goes, or a new one is put (where the printing has a point). */
  const clickPicture = async (e: React.MouseEvent<HTMLImageElement>) => {
    const list = marksRef.current;
    if (!list) return;
    const r = e.currentTarget.getBoundingClientRect();
    const at = { x: ((e.clientX - r.left) / r.width) * (sheet.w / MM), y: ((e.clientY - r.top) / r.height) * (sheet.h / MM) };
    const near = list.findIndex((m) => {
      const p = markMm(blank, m, sheet);
      return Math.hypot(p.x - at.x, p.y - at.y) < 2.5;
    });
    if (near >= 0) {
      keep(list.filter((_, i) => i !== near));
      setNote(`Marker @${near + 1} removed. Later markers have been renumbered.`);
      return;
    }
    const snap = await snapper(blank);
    const p = e.altKey ? { x: at.x * MM, y: at.y * MM, kind: 'free' as const } : snap(at.x * MM, at.y * MM, sheet);
    keep([...list, markAt(blank, { x: p.x / MM, y: p.y / MM }, p.kind, sheet)]);
    setNote('Marker added. Markers are numbered by row, top to bottom and left to right.');
  };

  const findAgain = async () => {
    setBusy('Detecting points on form…');
    keep(await findMarks(blank));
    setNote('Points detected again.');
  };

  const copyPicture = async () => {
    if (!picture) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture.blob })]);
      setNote('Image copied. Paste it into your chat with Ctrl+V, then copy the prompt.');
    } catch {
      await saveFile(picture.blob, `${blank.name} — for AI.png`);
      setNote('Clipboard access was unavailable. The image was saved as a file; drag it into your chat.');
    }
  };
  const copyPrompt = async () => {
    if (!marks) return;
    const ok = await copyText(blankPrompt(blank, marks, areas, ask));
    setNote(ok ? 'Prompt copied. Paste it into your chat after the image, then send it.' : 'Could not copy prompt.');
  };

  return (
    <div className="sketch-help-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sketch-help ask-dialog" role="dialog" aria-modal="true" aria-label="Ask AI">
        <header className="ask-head">
          <h3>Fill a form with AI</h3>
          <button className="rail-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
            ✕
          </button>
        </header>
        <div className="ask-body">
          <div className="ask-picture">
            {picture ? (
              <img src={picture.url} alt="Form annotated for AI" onClick={(e) => void clickPicture(e)} title="Click a marker to remove it, or a form point to add one. Hold Alt to use the exact click position" />
            ) : (
              <p className="muted">{busy}</p>
            )}
          </div>
          <aside className="ask-side">
            <ol className="ask-steps">
              <li>
                <button className="btn primary" disabled={!picture} onClick={() => void copyPicture()}>
                  Copy image
                </button>
                <span className="muted small">then paste into an AI chat</span>
              </li>
              <li>
                <button className="btn primary" disabled={!marks} onClick={() => void copyPrompt()}>
                  Copy prompt
                </button>
                <span className="muted small">paste into the same chat and send</span>
              </li>
              <li>
                <span className="small">
                  Use the code block’s Copy button, then press <kbd>Ctrl+V</kbd> in the document to place the tasks on the form.
                </span>
              </li>
            </ol>
            <label className="ask-field">
              <span>Variant</span>
              <input value={ask.variant} onChange={(e) => changeAsk({ variant: e.target.value })} placeholder="7" />
            </label>
            <label className="ask-field">
              <span>Signature</span>
              <input value={ask.name} onChange={(e) => changeAsk({ name: e.target.value })} placeholder="Name and initials" />
            </label>
            <label className="ask-field">
              <span>Tasks</span>
              <input value={ask.tasks} onChange={(e) => changeAsk({ tasks: e.target.value })} placeholder="all (or: 3, 4a)" />
            </label>
            <label className="ask-field column">
              <span>Instructions</span>
              <textarea rows={3} value={ask.wishes} onChange={(e) => changeAsk({ wishes: e.target.value })} placeholder="for example: make the net larger" />
            </label>
            <p className="muted small">
              Points: {marks?.length ?? '…'}, free areas: {areas.length}. Click a marker in the image to remove it; click a form point to add one.{' '}
              <button className="link-btn" onClick={() => void findAgain()}>
                ↺ detect again
              </button>
            </p>
            {note && <p className="ask-note small">{note}</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}
