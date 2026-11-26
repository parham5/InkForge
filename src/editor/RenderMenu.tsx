import { SlidersIcon } from '../ui/icons';
import { RenderSettings } from './RenderSettings';

/** Settings of how the text is drawn, next to the «Render» button. */
export function RenderMenu() {
  return (
    <details className="menu">
      <summary className="rail-btn" title="Render settings: строки, интервалы, соединения, следы работы" aria-label="Render settings">
        <SlidersIcon />
      </summary>
      <div className="menu-items render-menu">
        <RenderSettings />
      </div>
    </details>
  );
}
