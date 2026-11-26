import { useRef, useState } from 'react';
import { addSample, useHandwriting } from '../engine/handwriting';
import { detectAnchors } from '../model/anchors';
import { uid } from '../model/types';
import { CaptureCanvas, CaptureHandle } from '../studio/CaptureCanvas';

interface Props {
  char: string;
  rect: DOMRect;
  onClose: () => void;
}

/** Draw a missing letter without leaving the document. */
export function MissingGlyphPopover({ char, rect, onClose }: Props) {
  const { style, byChar } = useHandwriting();
  const handle = useRef<CaptureHandle>(null);
  const [saved, setSaved] = useState(0);
  const count = byChar.get(char)?.length ?? 0;

  const width = 460;
  const left = Math.min(Math.max(rect.left - width / 2, 12), window.innerWidth - width - 12);
  const below = rect.bottom + 330 < window.innerHeight;
  const top = below ? rect.bottom + 8 : Math.max(rect.top - 338, 12);

  return (
    <div className="popover" style={{ left, top, width }} role="dialog" aria-label={`Write letter ${char}`}>
      <header>
        <strong>
          Write “{char}»
        </strong>
        <span className="muted small">{count > 0 ? `samples: ${count}` : 'no handwriting sample yet'}</span>
        <button className="btn ghost small" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <CaptureCanvas
        char={char}
        penWidth={style.weight}
        height={240}
        hotkeys={false}
        handle={handle}
        onSave={(strokes, pointerType) => {
          const { entry, exit } = detectAnchors(char, strokes);
          void addSample({ id: uid(), char, strokes, entry, exit, pointerType, createdAt: Date.now() });
          setSaved((n) => n + 1);
        }}
      />
      <footer>
        {saved > 0 && <span className="muted small">Saved: {saved}. You can add another sample.</span>}
        <button className="btn small" onClick={onClose}>
          Done
        </button>
      </footer>
    </div>
  );
}
