import { useEffect, useState } from 'react';
import { forgetPageDefaults, pageDefaults, savePageDefaults } from '../storage/db';
import type { PageSetup } from './page';

interface Props {
  /** The parts of the open document's setup this row saves for new documents. */
  part: Partial<PageSetup>;
  /** What they are, for the hints: «лист», «линии чертежей». */
  what: string;
}

/** «Save по умолчанию»: new documents start with these settings, as this one has them now. */
export function DefaultsRow({ part, what }: Props) {
  const keys = Object.keys(part) as (keyof PageSetup)[];
  const json = JSON.stringify(part);
  /** Whether the saved defaults are these exactly, and whether any of them are saved at all. */
  const [state, setState] = useState<{ same: boolean; saved: boolean } | null>(null);

  const check = () =>
    void pageDefaults().then((d) => {
      const saved = keys.some((k) => d?.[k] !== undefined);
      setState({ saved, same: saved && keys.every((k) => JSON.stringify(d?.[k]) === JSON.stringify(part[k])) });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(check, [json]);

  return (
    <div className="defaults-row">
      <button
        className="link-btn small"
        disabled={state?.same}
        onClick={() => void savePageDefaults(part).then(check)}
        title={`New documents will use these settings (${what}). Existing documents are unchanged.`}
      >
        {state?.same ? '✓ These are the default settings' : '★ Save as default'}
      </button>
      {state?.saved && (
        <button
          className="link-btn small muted"
          onClick={() => void forgetPageDefaults(keys).then(check)}
          title={`New documents will use the standard settings again (${what})`}
        >
          Standard
        </button>
      )}
    </div>
  );
}
