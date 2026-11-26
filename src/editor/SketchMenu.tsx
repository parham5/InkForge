import type { Editor } from '@tiptap/react';
import { useState } from 'react';
import { openHelp } from '../shell/HelpDialogs';
import { DrawPenPicker } from '../sketch/DrawPenPicker';
import { DrawingIcon } from '../ui/icons';
import { DefaultsRow } from './DefaultsRow';
import type { PageSetup } from './page';
import { countSketchFences } from './sketchFences';

interface Props {
  editor: Editor | null;
  /** The rendered view is on: nothing can be inserted. */
  ink: boolean;
  setup: PageSetup;
  onChange: (next: PageSetup) => void;
}

const close = (el: HTMLElement) => el.closest('details')?.removeAttribute('open');

/** Everything about drawings: insert one, turn ``` commands into drawings, the help, and the pen they are drawn with. */
export function SketchMenu({ editor, ink, setup, onChange }: Props) {
  /** Drawings still sitting in the text as ```…```, counted when the menu opens. */
  const [fences, setFences] = useState(0);
  return (
    <details
      className="menu"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && editor) setFences(countSketchFences(editor.state.doc));
      }}
    >
      <summary className="rail-btn" title="Drawings" aria-label="Drawings">
        <DrawingIcon />
      </summary>
      <div className="menu-items sketch-menu">
        <button
          disabled={ink || !editor}
          onClick={(e) => {
            close(e.currentTarget);
            editor?.chain().focus().insertHtmlBlock({ kind: 'sketch', title: 'Drawing', code: '' }).run();
          }}
        >
          <strong>Insert drawing</strong>
          <span className="muted small">GeoGebra commands in your handwriting</span>
        </button>
        <button
          disabled={ink || !editor || fences === 0}
          onClick={(e) => {
            close(e.currentTarget);
            editor?.chain().focus().convertSketchFences().run();
          }}
        >
          <strong>Find drawings in text{fences > 0 ? ` (${fences})` : ''}</strong>
          <span className="muted small">commands between ``` or ёёё</span>
        </button>
        <button
          onClick={(e) => {
            close(e.currentTarget);
            openHelp('sketch');
          }}
        >
          <strong>Commands and AI prompt</strong>
        </button>
        <div className="sketch-menu-pen">
          <span className="menu-label">Drawing lines</span>
          <DrawPenPicker value={setup.drawPen} textInk={setup.ink} onChange={(drawPen) => onChange({ ...setup, drawPen })} />
          <DefaultsRow part={{ drawPen: setup.drawPen }} what="drawing lines and markers" />
        </div>
      </div>
    </details>
  );
}
