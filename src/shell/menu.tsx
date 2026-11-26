import { useEffect, useRef } from 'react';
import { isDesktop } from '../util/download';

export type CommandId =
  | 'file.new'
  | 'file.open'
  | 'file.backup'
  | 'file.backupDesks'
  | 'file.saveHandwriting'
  | 'file.loadHandwriting'
  | 'file.print'
  | 'app.quit'
  | 'theme.system'
  | 'theme.light'
  | 'theme.dark'
  | 'help.letters'
  | 'help.sketch'
  | 'help.keys'
  | 'help.about';

interface Entry {
  id: CommandId;
  text: string;
  /** Shown next to the item; the keys themselves are handled by useMenuKeys. */
  keys?: string;
  check?: boolean;
}

const MENU: { text: string; items: (Entry | '-')[] }[] = [
  {
    text: 'File',
    items: [
      { id: 'file.new', text: 'New document', keys: 'Ctrl+N' },
      { id: 'file.open', text: 'Open…', keys: 'Ctrl+O' },
      '-',
      { id: 'file.backup', text: 'Back up everything…' },
      { id: 'file.backupDesks', text: 'Include photographed desks', check: true },
      '-',
      { id: 'file.saveHandwriting', text: 'Export handwriting…' },
      { id: 'file.loadHandwriting', text: 'Import handwriting…' },
      '-',
      { id: 'file.print', text: 'Print / PDF…', keys: 'Ctrl+P' },
      '-',
      { id: 'app.quit', text: 'Quit' },
    ],
  },
  {
    text: 'Settings',
    items: [
      { id: 'theme.system', text: 'System theme', check: true },
      { id: 'theme.light', text: 'Light theme', check: true },
      { id: 'theme.dark', text: 'Dark theme', check: true },
    ],
  },
  {
    text: 'Help',
    items: [
      { id: 'help.letters', text: 'Writing letters' },
      { id: 'help.sketch', text: 'Sketch commands and prompts' },
      { id: 'help.keys', text: 'Keyboard shortcuts and formulas' },
      '-',
      { id: 'help.about', text: 'About InkForge' },
    ],
  },
];

/** Ctrl + the key's place on the keyboard (so it works in any layout). */
const KEYS: Record<string, CommandId> = { KeyN: 'file.new', KeyO: 'file.open', KeyP: 'file.print' };

type Checked = Partial<Record<CommandId, boolean>>;

/** The menu's shortcuts, handled by the page itself. */
export function useMenuKeys(run: (id: CommandId) => void) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const id = KEYS[e.code];
      if (!id) return;
      e.preventDefault();
      latest.current(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** The window menu, in the title bar. «Выход» only where there is a window to close. */
export function WebMenu({ run, checked }: { run: (id: CommandId) => void; checked: Checked }) {
  return (
    <nav className="web-menu no-print" aria-label="Menu">
      {MENU.map((g) => (
        <details key={g.text} className="menu">
          <summary>{g.text}</summary>
          <div className="menu-items web-menu-items">
            {g.items
              .filter((it) => it === '-' || it.id !== 'app.quit' || isDesktop())
              .map((it, i) =>
                it === '-' ? (
                  <hr key={i} className="menu-sep" />
                ) : (
                  <button
                    key={it.id}
                    onClick={(e) => {
                      e.currentTarget.closest('details')?.removeAttribute('open');
                      run(it.id);
                    }}
                  >
                    <span className="web-menu-tick">{it.check && checked[it.id] ? '✓' : ''}</span>
                    <span>{it.text}</span>
                    {it.keys && <kbd>{it.keys}</kbd>}
                  </button>
                ),
              )}
          </div>
        </details>
      ))}
    </nav>
  );
}
