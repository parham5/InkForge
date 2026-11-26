import { readFileSync, writeFileSync } from 'node:fs';
import { initSync, Engine } from '../crates/glyph-core/pkg/glyph_core.js';

initSync({ module: readFileSync(new URL('../crates/glyph-core/pkg/glyph_core_bg.wasm', import.meta.url)) });
const wave = (id, char, height) => ({
  id, char, pointerType: 'mouse',
  strokes: [Array.from({ length: 61 }, (_, i) => ({
    x: i * 5, y: 30 + height * Math.abs(Math.sin(i / 60 * Math.PI * 2)), t: i * 6, p: 0.5,
  }))],
  entry: { x: 0, y: 30, connect: true }, exit: { x: 300, y: 30, connect: true },
});
const engine = new Engine();
engine.setFamily('InkForge Validation Hand');
engine.setSamples(JSON.stringify([wave('a1', 'a', 300), wave('a2', 'a', 320), wave('b1', 'b', 250)]));
const bytes = engine.buildFont();
writeFileSync(new URL('../validation-hand.ttf', import.meta.url), bytes);
console.log(`Generated ${bytes.length} TTF bytes`);
