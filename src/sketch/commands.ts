// Every command a drawing understands. This one list drives the evaluator,
// the help window and the instructions for neural nets, so they never disagree.
import { inclination, quarters, rightTriangle, traces, unfold } from './dg';
import { projection } from './epure';
import * as g from './geometry';
import type { Expr } from './lang';
import type { Ctx, Hatching, Shape, SpaceKind, Val, Vec, Vec3 } from './types';

export type GroupId = 'points' | 'lines' | 'shapes' | 'graphs' | 'space' | 'text' | 'style' | 'view';

export const GROUPS: { id: GroupId; name: string }[] = [
  { id: 'points', name: 'Points and transformations' },
  { id: 'lines', name: 'Lines and segments' },
  { id: 'shapes', name: 'Circles, polygons and angles' },
  { id: 'graphs', name: 'Graphs' },
  { id: 'space', name: 'Space and projections' },
  { id: 'text', name: 'Labels and text' },
  { id: 'style', name: 'Appearance' },
  { id: 'view', name: 'View and axes' },
];

export interface Command {
  /** Russian name first, then GeoGebra's English one (then other accepted spellings). */
  names: string[];
  group: GroupId;
  /** Ways to call it; «@» stands for the name. */
  forms: string[];
  doc: string;
  /** Works on its own: shown in the help and inserted by its button. Written with English names. */
  example: string;
  /** Concerns the whole drawing: runs before everything else. */
  view?: boolean;
  run(args: Expr[], c: Ctx): Val;
}

/** Pen colours a drawing may use (null = the document's pen). */
export const COLORS: Record<string, string | null> = {
  black: null,
  чёрный: null,
  черный: null,
  red: '#d9533f',
  красный: '#d9533f',
  blue: '#2f6fd6',
  синий: '#2f6fd6',
  green: '#2f9a5b',
  зелёный: '#2f9a5b',
  зеленый: '#2f9a5b',
  orange: '#e07b2a',
  оранжевый: '#e07b2a',
  purple: '#9a4fd0',
  violet: '#9a4fd0',
  фиолетовый: '#9a4fd0',
  brown: '#8b5a2b',
  коричневый: '#8b5a2b',
  gray: '#7a8194',
  grey: '#7a8194',
  серый: '#7a8194',
  pink: '#d6487e',
  розовый: '#d6487e',
  cyan: '#2a9fc4',
  голубой: '#2a9fc4',
  yellow: '#c9a227',
  жёлтый: '#c9a227',
  желтый: '#c9a227',
};

const shape = (s: Shape): Val => ({ k: 'shape', s });
const point = (p: Vec): Val => shape({ type: 'point', p });
const num = (v: number): Val => ({ k: 'num', v });
const NONE: Val = { k: 'none' };
const ORIGIN: Vec = { x: 0, y: 0 };

function args(list: Expr[], ...counts: number[]) {
  if (counts.includes(list.length)) return;
  const word = (n: number) => `${n} ${n % 10 === 1 && n !== 11 ? 'argument' : n >= 2 && n <= 4 ? 'arguments' : 'arguments'}`;
  throw new Error(`expected ${counts.map(word).join(' or ')}, received ${list.length}`);
}

const is3 = (p: Vec | Vec3): p is Vec3 => 'z' in p;

/** An angle: written with ° it is in radians already; a bare number past a full turn is taken as degrees (45 for 45°). */
function angleArg(c: Ctx, e: Expr): number {
  const v = c.num(e);
  return Math.abs(v) > 2 * Math.PI + 1e-9 ? (v * Math.PI) / 180 : v;
}

/** A length of the drawing that must be above zero. */
function positive(c: Ctx, e: Expr, what: string): number {
  const v = c.num(e);
  if (!(v > 0)) throw new Error(`${what} must be positive`);
  return v;
}

/** Direction, spacing and crosswise hatching from the arguments after the figure. */
function hatchingOf(c: Ctx, list: Expr[]): Hatching {
  const angle = list[0] ? angleArg(c, list[0]) : Math.PI / 4;
  const gap = list[1] ? positive(c, list[1], 'hatching spacing') : undefined;
  return { angle, gap, cross: list[2] ? Math.round(c.num(list[2])) === 2 : false };
}

/** The graph of f from x = a to x = b, as points (the area under or between graphs is cut by them). */
function graphRun(f: (x: number) => number, a: number, b: number): Vec[] {
  if (!(b > a)) throw new Error('Expected a < b: hatching extends from x = a to x = b');
  const n = 160;
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y)) throw new Error(`Function is undefined at x = ${Math.round(x * 100) / 100}: cannot hatch this region`);
    out.push({ x, y });
  }
  return out;
}

/** The points of a figure: all on the sheet, or all in space (then it is drawn as an epure). */
function pointsOf(c: Ctx, list: Expr[]): { flat: Vec[] } | { space: Vec3[] } {
  const pts = list.map((e) => c.pointAny(e));
  const n = pts.filter(is3).length;
  if (n === 0) return { flat: pts };
  if (n === pts.length) return { space: pts as Vec3[] };
  throw new Error('Cannot mix 2D page points (x, y) and 3D spatial points (x, y, z)');
}

const space = (of: SpaceKind, pts: Vec3[]): Val => shape({ type: 'space', of, pts });
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Segment, line, ray or vector through two points, on the sheet or in space. */
function twoPoints(of: 'segment' | 'line' | 'ray' | 'vector', c: Ctx, list: Expr[]): Val {
  const pts = pointsOf(c, list);
  if ('space' in pts) return space(of, pts.space);
  return shape({ type: of, a: pts.flat[0], b: pts.flat[1] });
}

function lineOf(c: Ctx, e: Expr): Shape {
  const s = c.shape(e);
  if (!g.isLineLike(s)) throw new Error('Expected a line, segment, ray or vector');
  return s;
}

function circumcircle(a: Vec, b: Vec, p: Vec): Shape {
  const d = 2 * (a.x * (b.y - p.y) + b.x * (p.y - a.y) + p.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) throw new Error('The points are collinear; no circle can pass through them');
  const sa = a.x * a.x + a.y * a.y;
  const sb = b.x * b.x + b.y * b.y;
  const sp = p.x * p.x + p.y * p.y;
  const c = {
    x: (sa * (b.y - p.y) + sb * (p.y - a.y) + sp * (a.y - b.y)) / d,
    y: (sa * (p.x - b.x) + sb * (a.x - p.x) + sp * (b.x - a.x)) / d,
  };
  return { type: 'circle', c, r: g.dist(c, a) };
}

function hex(v: number): string {
  return Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, '0');
}

export const COMMANDS: Command[] = [
  // ---------------------------------------------------------------- points
  {
    names: ['Середина', 'Midpoint'],
    group: 'points',
    forms: ['@(A, B)', '@(segment)'],
    doc: "Midpoint of segment AB.",
    example: 'A = (0, 0)\nB = (4, 2)\nSegment(A, B)\nM = Midpoint(A, B)',
    run(a, c) {
      args(a, 1, 2);
      if (a.length === 1) {
        const s = c.shape(a[0]);
        if (s.type === 'space' && s.of !== 'point' && s.of !== 'polygon') {
          const [p, q] = s.pts;
          return space('point', [{ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 }]);
        }
        const l = lineOf(c, a[0]) as { a: Vec; b: Vec };
        return point(g.mid(l.a, l.b));
      }
      const pts = pointsOf(c, a);
      if ('space' in pts) {
        const [p, q] = pts.space;
        return space('point', [{ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 }]);
      }
      return point(g.mid(pts.flat[0], pts.flat[1]));
    },
  },
  {
    names: ['Пересечение', 'Intersect'],
    group: 'points',
    forms: ['@(a, b)', '@(a, b, n)', '@(a, b, nearby point)'],
    doc: "Intersection of lines, segments, circles or graphs. For multiple intersections, n selects one from left to right, or provide a nearby point. Graph intersections are searched within the view, or from x = −10 to 10 without a view.",
    example: 'f(x) = x^2 - 2\ng(x) = x\nA = Intersect(f, g, 1)\nB = Intersect(f, g, 2)',
    run(a, c) {
      args(a, 2, 3);
      const pts = g.intersect(c.shape(a[0]), c.shape(a[1]), c.range());
      if (!pts.length) throw new Error('These objects do not intersect');
      if (a.length === 2) return point(pts[0]);
      const third = c.val(a[2]);
      if (third.k === 'shape' && third.s.type === 'point') {
        const near = third.s.p;
        return point(pts.reduce((best, p) => (g.dist(p, near) < g.dist(best, near) ? p : best)));
      }
      const n = Math.round(c.num(a[2]));
      if (n < 1 || n > pts.length) throw new Error(`Intersection count: ${pts.length}, requested index: ${n}`);
      return point(pts[n - 1]);
    },
  },
  {
    names: ['Расстояние', 'Distance'],
    group: 'points',
    forms: ['@(A, B)', '@(A, line)'],
    doc: "Distance between two points or from a point to a line. For 3D points this is the true spatial distance.",
    example: 'A = (0, 0)\nB = (3, 4)\nd = Distance(A, B)\nCircle(A, d)',
    run(a, c) {
      args(a, 2);
      const first = c.pointAny(a[0]);
      if (is3(first)) {
        const second = c.pointAny(a[1]);
        if (!is3(second)) throw new Error('Cannot mix 2D page points (x, y) and 3D spatial points (x, y, z)');
        return num(dist3(first, second));
      }
      return num(g.distanceTo(first, c.shape(a[1])));
    },
  },
  {
    names: ['Длина', 'Length'],
    group: 'points',
    forms: ['@(segment)'],
    doc: "Length of a segment or vector, perimeter of a polygon, or length of a circle or arc.",
    example: 'A = (0, 0)\nB = (3, 4)\ns = Segment(A, B)\nCircle(B, Length(s) / 2)',
    run(a, c) {
      args(a, 1);
      const s = c.shape(a[0]);
      if (s.type === 'space') {
        if (s.of === 'point' || s.of === 'line' || s.of === 'ray') throw new Error('Length is available for segments, vectors and polygons');
        const closed = s.of === 'polygon';
        let sum = 0;
        for (let i = 0; i + (closed ? 0 : 1) < s.pts.length; i++) sum += dist3(s.pts[i], s.pts[(i + 1) % s.pts.length]);
        return num(sum);
      }
      if (s.type === 'segment' || s.type === 'vector') return num(g.dist(s.a, s.b));
      if (s.type === 'polygon') return num(s.pts.reduce((sum, p, i) => sum + g.dist(p, s.pts[(i + 1) % s.pts.length]), 0));
      if (s.type === 'circle') return num(2 * Math.PI * s.r);
      if (s.type === 'arc') return num(s.r * Math.abs(s.sweep));
      throw new Error('Length is available for segments, vectors, polygons, circles and arcs');
    },
  },
  {
    names: ['Поворот', 'Rotate'],
    group: 'points',
    forms: ['@(object, angle)', '@(object, angle, center)'],
    doc: "Rotate an object counterclockwise around a center, defaulting to the origin. Append ° for degrees, such as 60°.",
    example: 'O = (0, 0)\nA = (3, 0)\nB = Rotate(A, 60°, O)\nSegment(O, A)\nSegment(O, B)',
    run(a, c) {
      args(a, 2, 3);
      const angle = c.num(a[1]);
      const o = a[2] ? c.point(a[2]) : ORIGIN;
      return shape(g.mapShape(c.shape(a[0]), (p) => g.rotate(p, angle, o), false, 1, c.range()));
    },
  },
  {
    names: ['Перенос', 'Translate'],
    group: 'points',
    forms: ['@(object, vector)'],
    doc: "Translate an object by a vector.",
    example: 'A = (0, 0)\nB = (2, 1)\nC = (1, 3)\nt = Polygon(A, B, C)\nv = Vector((0, 0), (4, 0))\nTranslate(t, v)',
    run(a, c) {
      args(a, 2);
      const d = c.vec(a[1]);
      return shape(g.mapShape(c.shape(a[0]), (p) => g.add(p, d), false, 1, c.range()));
    },
  },
  {
    names: ['Отражение', 'Reflect'],
    group: 'points',
    forms: ['@(object, line)', '@(object, point)'],
    doc: "Reflect an object across a line or through a point.",
    example: 'A = (1, 1)\nB = (3, 2)\nm = Line((0, 0), (0, 1))\ns = Segment(A, B)\nReflect(s, m)',
    run(a, c) {
      args(a, 2);
      const s = c.shape(a[0]);
      const m = c.shape(a[1]);
      if (m.type === 'point') {
        const o = m.p;
        return shape(g.mapShape(s, (p) => g.sub(g.mul(o, 2), p), false, 1, c.range()));
      }
      const l = g.lineParams(m);
      const d = g.unit(l.d);
      const mirror = (p: Vec) => {
        const foot = g.add(l.a, g.mul(d, g.dot(g.sub(p, l.a), d)));
        return g.sub(g.mul(foot, 2), p);
      };
      return shape(g.mapShape(s, mirror, true, 1, c.range()));
    },
  },
  {
    names: ['Гомотетия', 'Dilate'],
    group: 'points',
    forms: ['@(object, k)', '@(object, k, center)'],
    doc: "Scale an object by factor k from a center, defaulting to the origin.",
    example: 'O = (0, 0)\nA = (1, 0)\nB = (0, 1)\nt = Polygon(O, A, B)\nDilate(t, 2, O)',
    run(a, c) {
      args(a, 2, 3);
      const k = c.num(a[1]);
      const o = a[2] ? c.point(a[2]) : ORIGIN;
      return shape(g.mapShape(c.shape(a[0]), (p) => g.add(o, g.mul(g.sub(p, o), k)), false, k, c.range()));
    },
  },

  // ---------------------------------------------------------------- lines
  {
    names: ['Отрезок', 'Segment'],
    group: 'lines',
    forms: ['@(A, B)'],
    doc: "Segment AB.",
    example: 'A = (0, 0)\nB = (4, 1)\nSegment(A, B)',
    run(a, c) {
      args(a, 2);
      return twoPoints('segment', c, a);
    },
  },
  {
    names: ['Прямая', 'Line'],
    group: 'lines',
    forms: ['@(A, B)', '@(A, a)'],
    doc: "Line through A and B, or through A parallel to line a. The line extends to the drawing edges.",
    example: 'A = (0, 0)\nB = (3, 1)\na = Line(A, B)\nC = (0, 2)\nLine(C, a)',
    run(a, c) {
      args(a, 2);
      const second = c.val(a[1]);
      if (second.k === 'shape' && second.s.type === 'space' && second.s.of !== 'point' && second.s.of !== 'polygon') {
        const p = c.pointAny(a[0]);
        if (!is3(p)) throw new Error('Cannot mix 2D page points (x, y) and 3D spatial points (x, y, z)');
        const [u, v] = second.s.pts;
        return space('line', [p, { x: p.x + v.x - u.x, y: p.y + v.y - u.y, z: p.z + v.z - u.z }]);
      }
      if (second.k === 'shape' && g.isLineLike(second.s)) {
        const p = c.point(a[0]);
        const l = g.lineParams(second.s);
        return shape({ type: 'line', a: p, b: g.add(p, l.d) });
      }
      return twoPoints('line', c, a);
    },
  },
  {
    names: ['Луч', 'Ray'],
    group: 'lines',
    forms: ['@(A, B)'],
    doc: "Ray starting at A and passing through B.",
    example: 'A = (0, 0)\nB = (2, 1)\nRay(A, B)',
    run(a, c) {
      args(a, 2);
      return twoPoints('ray', c, a);
    },
  },
  {
    names: ['Вектор', 'Vector'],
    group: 'lines',
    forms: ['@(A, B)', '@(B)'],
    doc: "Vector from A to B with an arrow, or from the origin to B.",
    example: 'A = (0, 0)\nB = (3, 2)\nv = Vector(A, B)',
    run(a, c) {
      args(a, 1, 2);
      if (a.length === 1) {
        const b = c.pointAny(a[0]);
        return is3(b) ? space('vector', [{ x: 0, y: 0, z: 0 }, b]) : shape({ type: 'vector', a: ORIGIN, b });
      }
      return twoPoints('vector', c, a);
    },
  },
  {
    names: ['Перпендикуляр', 'PerpendicularLine', 'Perpendicular'],
    group: 'lines',
    forms: ['@(A, a)'],
    doc: "Line through A perpendicular to line or segment a.",
    example: 'A = (0, 0)\nB = (5, 1)\nC = (2, 3)\na = Line(A, B)\nPerpendicularLine(C, a)',
    run(a, c) {
      args(a, 2);
      const p = c.point(a[0]);
      const l = g.lineParams(lineOf(c, a[1]));
      return shape({ type: 'line', a: p, b: g.add(p, g.perp(l.d)) });
    },
  },
  {
    names: ['СерединныйПерпендикуляр', 'PerpendicularBisector'],
    group: 'lines',
    forms: ['@(A, B)', '@(segment)'],
    doc: "Perpendicular bisector of segment AB.",
    example: 'A = (0, 0)\nB = (4, 2)\nSegment(A, B)\nPerpendicularBisector(A, B)',
    run(a, c) {
      args(a, 1, 2);
      let p: Vec;
      let q: Vec;
      if (a.length === 1) {
        const s = lineOf(c, a[0]) as { a: Vec; b: Vec };
        p = s.a;
        q = s.b;
      } else {
        p = c.point(a[0]);
        q = c.point(a[1]);
      }
      const m = g.mid(p, q);
      return shape({ type: 'line', a: m, b: g.add(m, g.perp(g.sub(q, p))) });
    },
  },
  {
    names: ['Биссектриса', 'AngleBisector'],
    group: 'lines',
    forms: ['@(A, B, C)'],
    doc: "Bisector of angle ABC, with the middle point as its vertex.",
    example: 'A = (4, 0)\nB = (0, 0)\nC = (1, 3)\nSegment(B, A)\nSegment(B, C)\nAngleBisector(A, B, C)',
    run(a, c) {
      args(a, 3);
      const p = c.point(a[0]);
      const v = c.point(a[1]);
      const q = c.point(a[2]);
      const u = g.add(g.unit(g.sub(p, v)), g.unit(g.sub(q, v)));
      const d = g.len(u) < 1e-9 ? g.perp(g.sub(p, v)) : u;
      return shape({ type: 'line', a: v, b: g.add(v, d) });
    },
  },
  {
    names: ['Касательная', 'Tangent'],
    group: 'lines',
    forms: ['@(x₀, f)', '@(A, f)'],
    doc: "Tangent to graph f at x₀, or at point A on the graph.",
    example: 'f(x) = x^2 / 2\nA = (1, f(1))\nTangent(A, f)',
    run(a, c) {
      args(a, 2);
      const first = c.val(a[0]);
      const x0 = first.k === 'shape' && first.s.type === 'point' ? first.s.p.x : c.num(a[0]);
      const f = c.fn(a[1]);
      const h = 1e-5 * (1 + Math.abs(x0));
      const y0 = f(x0);
      const k = (f(x0 + h) - f(x0 - h)) / (2 * h);
      if (!Number.isFinite(y0) || !Number.isFinite(k)) throw new Error('The graph has no tangent at this point');
      return shape({ type: 'line', a: { x: x0, y: y0 }, b: { x: x0 + 1, y: y0 + k } });
    },
  },

  {
    names: ['ШтрихованнаяЛиния', 'HatchedLine', 'ЛинияСоШтриховкой'],
    group: 'lines',
    forms: ['@(line, P)', '@(line, P, length, spacing)'],
    doc: "Line with short diagonal hatch marks on the side containing P, for half-plane boundaries, ground or fixed supports. If the named line already exists, only hatching is added. Otherwise the line is drawn too. Stroke length and spacing use drawing units; defaults correspond to 1.5 and 2 mm on a form.",
    example: 'A = (-3, 0)\nB = (3, 0)\nl = Segment(A, B)\nHatchedLine(l, (0, -1))',
    run(a, c) {
      args(a, 2, 3, 4);
      const l = lineOf(c, a[0]) as Extract<Shape, { type: 'segment' | 'ray' | 'line' | 'vector' }>;
      const of = l.type === 'vector' ? 'segment' : l.type;
      const len = a[2] ? positive(c, a[2], 'hatch stroke length') : undefined;
      const gap = a[3] ? positive(c, a[3], 'hatch stroke spacing') : undefined;
      let drawn = false;
      if (a[0].t === 'name') {
        try {
          drawn = !c.item(a[0]).hidden;
        } catch {
          drawn = false;
        }
      }
      return shape({ type: 'hatched', of, a: l.a, b: l.b, side: c.point(a[1]), line: !drawn, len, gap });
    },
  },

  // ---------------------------------------------------------------- shapes
  {
    names: ['Окружность', 'Circle'],
    group: 'shapes',
    forms: ['@(O, r)', '@(O, A)', '@(A, B, C)'],
    doc: "Circle with center O and radius r, with center O through A, or through three points.",
    example: 'O = (0, 0)\nCircle(O, 2)',
    run(a, c) {
      args(a, 2, 3);
      if (a.length === 3) return shape(circumcircle(c.point(a[0]), c.point(a[1]), c.point(a[2])));
      const o = c.point(a[0]);
      const second = c.val(a[1]);
      const r = second.k === 'shape' && second.s.type === 'point' ? g.dist(o, second.s.p) : c.num(a[1]);
      if (!(r > 0)) throw new Error('Radius must be positive');
      return shape({ type: 'circle', c: o, r });
    },
  },
  {
    names: ['Дуга', 'CircularArc', 'ДугаОкружности'],
    group: 'shapes',
    forms: ['@(O, A, B)'],
    doc: "Counterclockwise circular arc centered at O, from A to ray OB.",
    example: 'O = (0, 0)\nA = (3, 0)\nB = (0, 3)\nCircularArc(O, A, B)',
    run(a, c) {
      args(a, 3);
      const o = c.point(a[0]);
      const p = c.point(a[1]);
      const q = c.point(a[2]);
      const from = g.angleOf(g.sub(p, o));
      let sweep = g.angleOf(g.sub(q, o)) - from;
      while (sweep <= 0) sweep += 2 * Math.PI;
      return shape({ type: 'arc', c: o, r: g.dist(o, p), from, sweep });
    },
  },
  {
    names: ['Полуокружность', 'Semicircle'],
    group: 'shapes',
    forms: ['@(A, B)'],
    doc: "Semicircle on segment AB, on the left when traveling from A to B.",
    example: 'A = (-2, 0)\nB = (2, 0)\nSegment(A, B)\nSemicircle(A, B)',
    run(a, c) {
      args(a, 2);
      const p = c.point(a[0]);
      const q = c.point(a[1]);
      const m = g.mid(p, q);
      return shape({ type: 'arc', c: m, r: g.dist(p, q) / 2, from: g.angleOf(g.sub(q, m)), sweep: Math.PI });
    },
  },
  {
    names: ['Штриховка', 'Hatch', 'Заштриховать'],
    group: 'shapes',
    forms: ['@(shape)', '@(shape, angle, spacing)', '@(shape, angle, spacing, 2)', '@(f, a, b)', '@(f, g, a, b)', '@(f, g, a, b, angle, spacing)'],
    doc: "Hand-drawn hatching inside a named polygon or circle, preserving its outline. @(f, a, b) hatches between f and the x-axis; @(f, g, a, b) hatches between graphs over x = a to b. The default angle is 45°; append ° for degrees. Spacing uses drawing units (1 unit = 1 mm on forms), with a default corresponding to 2 mm. A final 2 adds crosshatching. Use this command for sections, faces, inequalities and areas instead of drawing individual segments.",
    example: 'f(x) = x^2\ng(x) = x + 2\nHatch(f, g, -1, 2)',
    run(a, c) {
      if (a.length < 1 || a.length > 7) throw new Error('Expected 1 to 7 arguments');
      const first = c.shape(a[0]);
      if (first.type === 'graph') {
        const second = a[1] ? c.val(a[1]) : null;
        const between = second?.k === 'shape' && second.s.type === 'graph';
        const at = between ? 2 : 1;
        if (a.length < at + 2) throw new Error(between ? 'Use Hatch(f, g, a, b) between graphs from x = a to x = b' : 'Use Hatch(f, a, b) from x = a to x = b');
        const x0 = Math.min(c.num(a[at]), c.num(a[at + 1]));
        const x1 = Math.max(c.num(a[at]), c.num(a[at + 1]));
        const top = graphRun(first.f, x0, x1);
        const bottom = between ? graphRun(c.fn(a[1]), x0, x1) : top.map((p) => ({ x: p.x, y: 0 }));
        return shape({ type: 'region', pts: [...top, ...bottom.reverse()], hatch: hatchingOf(c, a.slice(at + 2)) });
      }
      if (a.length > 4) throw new Error('For shapes, use at most Hatch(shape, angle, spacing, 2)');
      const hatch = hatchingOf(c, a.slice(1));
      const flatOf = (s: Shape): Vec[] | null =>
        s.type === 'polygon' || s.type === 'region'
          ? s.pts
          : s.type === 'circle'
            ? Array.from({ length: 64 }, (_, i) => g.add(s.c, g.mul(g.dir((i / 64) * Math.PI * 2), s.r)))
            : null;
      if (first.type === 'space' ? first.of !== 'polygon' : !flatOf(first)) throw new Error('Hatching requires a polygon, circle or region between graphs');
      if (a[0].t === 'name') {
        c.item(a[0]).hatch = hatch;
        return NONE;
      }
      // A figure written right here: only its hatching is drawn.
      if (first.type === 'space') throw new Error('Name the spatial polygon first: t = Polygon(…), then Hatch(t)');
      return shape({ type: 'region', pts: flatOf(first)!, hatch });
    },
  },
  {
    names: ['Многоугольник', 'Polygon'],
    group: 'shapes',
    forms: ['@(A, B, C, …)', '@(A, B, n)'],
    doc: "Polygon through the vertices, or a regular n-sided polygon on side AB.",
    example: 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)\nPolygon(A, B, C)',
    run(a, c) {
      if (a.length < 3) throw new Error('A polygon needs at least three vertices');
      if (a.length === 3 && c.val(a[2]).k === 'num') {
        const n = Math.round(c.num(a[2]));
        if (n < 3 || n > 100) throw new Error('A regular polygon needs 3 to 100 sides');
        const pts = [c.point(a[0]), c.point(a[1])];
        for (let i = 2; i < n; i++) {
          const prev = pts[i - 2];
          const cur = pts[i - 1];
          pts.push(g.add(cur, g.rotate(g.sub(cur, prev), (2 * Math.PI) / n)));
        }
        return shape({ type: 'polygon', pts });
      }
      const pts = pointsOf(c, a);
      return 'space' in pts ? space('polygon', pts.space) : shape({ type: 'polygon', pts: pts.flat });
    },
  },
  {
    names: ['Угол', 'Angle'],
    group: 'shapes',
    forms: ['@(A, B, C)'],
    doc: "Angle ABC, with vertex B, shown as an arc and its value in degrees. Right angles use a square marker.",
    example: 'A = (4, 0)\nB = (0, 0)\nC = (2, 3)\nSegment(B, A)\nSegment(B, C)\nAngle(A, B, C)',
    run(a, c) {
      args(a, 3);
      const p = c.point(a[0]);
      const v = c.point(a[1]);
      const q = c.point(a[2]);
      if (g.dist(p, v) < 1e-12 || g.dist(q, v) < 1e-12) throw new Error('Angle endpoints must differ from the vertex');
      const from = g.angleOf(g.sub(p, v));
      return shape({ type: 'angle', v, from, sweep: g.turn(from, g.angleOf(g.sub(q, v))) });
    },
  },

  // ---------------------------------------------------------------- graphs
  {
    names: ['Функция', 'Function'],
    group: 'graphs',
    forms: ['@(expression, a, b)'],
    doc: "Plot an expression in x only from a to b. General graphs can be entered as f(x) = … or y = …",
    example: 'f(x) = Function(x^2, -1, 2)',
    run(a, c) {
      args(a, 1, 3);
      const f = c.fn(a[0]);
      if (a.length === 1) return shape({ type: 'graph', f, domain: null });
      const lo = Math.min(c.num(a[1]), c.num(a[2]));
      const hi = Math.max(c.num(a[1]), c.num(a[2]));
      return shape({ type: 'graph', f: (x) => (x < lo || x > hi ? NaN : f(x)), domain: [lo, hi] });
    },
  },
  {
    names: ['Кривая', 'Curve'],
    group: 'graphs',
    forms: ['@(x(t), y(t), t, a, b)'],
    doc: "Parametric curve with x and y expressed in t, from t = a to b.",
    example: 'Curve(3cos(t), 2sin(t), t, 0, 2pi)',
    run(a, c) {
      args(a, 5);
      const t = a[2];
      if (t.t !== 'name') throw new Error('The third argument must be a parameter name, such as t');
      const fx = c.fn(a[0], t.name);
      const fy = c.fn(a[1], t.name);
      return shape({ type: 'curve', f: (v) => ({ x: fx(v), y: fy(v) }), t0: c.num(a[3]), t1: c.num(a[4]) });
    },
  },
  {
    names: ['Если', 'If'],
    group: 'graphs',
    forms: ['@(condition, a)', '@(condition, a, b)'],
    doc: "Return a when the condition is true, otherwise b or no value. For piecewise functions: f(x) = If(x < 0, -x, x^2).",
    example: 'f(x) = If(x < 0, -x, x^2)',
    run(a, c) {
      args(a, 2, 3);
      if (c.bool(a[0])) return c.val(a[1]);
      return a[2] ? c.val(a[2]) : num(NaN);
    },
  },

  // ---------------------------------------------------------------- space
  {
    names: ['Точка', 'Point'],
    group: 'space',
    forms: ['@(x, y, z)', '@(x, y)'],
    doc: "Point from coordinates, equivalent to A = (x, y, z). Three coordinates create a 3D point and a Monge projection drawing with A₁, A₂, projection links and the x₁₂ axis. Segments, lines and polygons built from these points are projected too.",
    example: 'A = Point(4, 2, 3)',
    run(a, c) {
      args(a, 2, 3);
      const v = a.map((e) => c.num(e));
      return v.length === 3 ? space('point', [{ x: v[0], y: v[1], z: v[2] }]) : point({ x: v[0], y: v[1] });
    },
  },
  {
    names: ['Проекции', 'Projections'],
    group: 'space',
    forms: ['@(1, 2)', '@(1, 2, 3)'],
    doc: "Select projection planes: 1 horizontal (Π₁), 2 front (Π₂), 3 profile (Π₃). Default: @(1, 2). Profile projection adds z and y axes and the 45° transfer line.",
    example: 'Projections(1, 2, 3)\nA = (4, 2, 3)',
    view: true,
    run(a, c) {
      if (!a.length) throw new Error('Specify projection planes: 1, 2 or 3');
      const planes = a.map((e) => Math.round(c.num(e)));
      if (planes.some((k) => k < 1 || k > 3)) throw new Error('Projection planes are 1, 2 and 3');
      c.scene.view.planes = planes;
      return NONE;
    },
  },
  {
    names: ['ПоПроекциям', 'FromProjections'],
    group: 'space',
    forms: ['@(A_1, A_2)'],
    doc: "Reconstruct a 3D point from its horizontal A₁ and front A₂ projections on the drawing. x follows the x₁₂ axis left from O; y is the distance of A₁ below the axis; z is the distance of A₂ above it. Useful for projections printed on a form.",
    example: 'A_1 = (-3, -2)\nA_2 = (-3, 4)\nA = FromProjections(A_1, A_2)\nHide(A_1)\nHide(A_2)\nB = (6, 1, 2)\nSegment(A, B)',
    run(a, c) {
      args(a, 2);
      const h = c.point(a[0]);
      const f = c.point(a[1]);
      const sx = c.scene.view.xRight ? 1 : -1;
      return space('point', [{ x: (sx * (h.x + f.x)) / 2, y: -h.y, z: f.y }]);
    },
  },
  {
    names: ['Проекция', 'Projection'],
    group: 'space',
    forms: ['@(A, 1)', '@(A, 2)', '@(A, 3)'],
    doc: "Project a 3D point onto Π₁, Π₂ or Π₃ as a 2D drawing point for constructions such as right triangles and rotations. Perpendiculars and circles can be constructed from it.",
    example: 'A = (4, 2, 3)\nB = (1, 4, 1)\nSegment(A, B)\nK = Projection(B, 1)\nPerpendicularLine(K, Segment(Projection(A, 1), K))',
    run(a, c) {
      args(a, 2);
      const p = c.pointAny(a[0]);
      if (!('z' in p)) throw new Error('Projection requires a spatial point (x, y, z)');
      const plane = Math.round(c.num(a[1]));
      if (plane < 1 || plane > 3) throw new Error('Projection plane must be 1, 2 or 3');
      return point(projection(p, plane, !!c.scene.view.xRight));
    },
  },
  // ------------------------------------------------ descriptive geometry, exactly
  {
    names: ['НатуральнаяВеличина', 'TrueLength'],
    group: 'space',
    forms: ['@(A, B)', '@(A, B, 2)', '@(A, B, 1, "B_0")'],
    doc: "Construct the true length of spatial segment AB using a right triangle on Π₁ (1, default) or Π₂ (2). The perpendicular leg is the z or y difference, drawn away from the axis. Hypotenuse A₁B₀ or A₂B₀ is the true length, and the angle at A gives inclination to the plane. Returns the hypotenuse; Length(h) gives its length.",
    example: 'A = (30, 10, 20)\nB = (10, 30, 45)\nSegment(A, B)\nh = TrueLength(A, B)',
    run(a, c) {
      args(a, 2, 3, 4);
      const pa = c.pointAny(a[0]);
      const pb = c.pointAny(a[1]);
      if (!is3(pa) || !is3(pb)) throw new Error('True length requires a spatial segment with (x, y, z) points');
      const n = a[2] ? Math.round(c.num(a[2])) : 1;
      if (n !== 1 && n !== 2) throw new Error('Plane must be 1 (Π₁) or 2 (Π₂)');
      const t = rightTriangle(pa, pb, n, !!c.scene.view.xRight);
      const base = a[1].t === 'name' ? a[1].name.replace(/_.*$/, '') : 'B';
      const name0 = a[3] ? c.str(a[3]) : `${base}_0`;
      c.draw({ type: 'segment', a: t.bn, b: t.b0 }, { thin: true });
      c.draw({ type: 'point', p: t.b0 }, { label: name0 });
      const from = Math.atan2(t.bn.y - t.an.y, t.bn.x - t.an.x);
      let sweep = Math.atan2(t.b0.y - t.an.y, t.b0.x - t.an.x) - from;
      if (sweep > Math.PI) sweep -= 2 * Math.PI;
      if (sweep < -Math.PI) sweep += 2 * Math.PI;
      c.draw({ type: 'angle', v: t.an, from, sweep }, { label: n === 1 ? 'α' : 'β' });
      return shape({ type: 'segment', a: t.an, b: t.b0 });
    },
  },
  {
    names: ['УголНаклона', 'Inclination'],
    group: 'space',
    forms: ['@(A, B, 1)', '@(A, B, 2)'],
    doc: "Exact inclination of spatial segment AB to Π₁ (1) or Π₂ (2), in degrees. In annotations: {Inclination(A, B, 1):0}°.",
    example: 'A = (30, 10, 20)\nB = (10, 30, 45)\nSegment(A, B)\nText(Inclination(A, B, 1), (0, -20))',
    run(a, c) {
      args(a, 3);
      const pa = c.pointAny(a[0]);
      const pb = c.pointAny(a[1]);
      if (!is3(pa) || !is3(pb)) throw new Error('Inclination requires a spatial segment with (x, y, z) points');
      const n = Math.round(c.num(a[2]));
      if (n !== 1 && n !== 2) throw new Error('Plane must be 1 (Π₁) or 2 (Π₂)');
      return num(inclination(pa, pb, n));
    },
  },
  {
    names: ['Следы', 'Traces'],
    group: 'space',
    forms: ['@(A, B)'],
    doc: "Exact horizontal H and front F traces of spatial line AB, with projections H₁, H₂, F₁, F₂, projection links and extended line projections. Use {Quarters(A, B)} for the spatial quadrants crossed by the line.",
    example: 'A = (40, 10, 15)\nB = (10, 25, 5)\nSegment(A, B)\nTraces(A, B)',
    run(a, c) {
      args(a, 2);
      const pa = c.pointAny(a[0]);
      const pb = c.pointAny(a[1]);
      if (!is3(pa) || !is3(pb)) throw new Error('Traces require a spatial line with (x, y, z) points');
      const xr = !!c.scene.view.xRight;
      const { h, f } = traces(pa, pb);
      if (!h && !f) throw new Error('The line is parallel to both planes and has no traces');
      for (const [t, letter] of [[h, 'H'], [f, 'F']] as const) {
        if (!t) continue;
        const p1 = projection(t, 1, xr);
        const p2 = projection(t, 2, xr);
        c.draw({ type: 'segment', a: p1, b: p2 }, { thin: true });
        c.draw({ type: 'point', p: p1 }, { label: `${letter}_1` });
        c.draw({ type: 'point', p: p2 }, { label: `${letter}_2` });
        // The projections of the line carried on to the trace.
        for (const n of [1, 2] as const) {
          const end = projection(t, n, xr);
          const pa2 = projection(pa, n, xr);
          const pb2 = projection(pb, n, xr);
          const near = Math.hypot(pa2.x - end.x, pa2.y - end.y) < Math.hypot(pb2.x - end.x, pb2.y - end.y) ? pa2 : pb2;
          c.draw({ type: 'segment', a: near, b: end }, { thin: true });
        }
      }
      return NONE;
    },
  },
  {
    names: ['Четверти', 'Quarters'],
    group: 'space',
    forms: ['@(A, B)'],
    doc: "Text listing the spatial quadrants crossed by line AB, such as I, II, III. Use {Quarters(A, B)} in an annotation.",
    example: 'A = (40, 10, 15)\nB = (10, 25, -5)\nSegment(A, B)\nText(Quarters(A, B), (0, 30))',
    run(a, c) {
      args(a, 2);
      const pa = c.pointAny(a[0]);
      const pb = c.pointAny(a[1]);
      if (!is3(pa) || !is3(pb)) throw new Error('Quadrants require a spatial line with (x, y, z) points');
      return { k: 'str', v: quarters(pa, pb).join(', ') };
    },
  },
  {
    names: ['Развёртка', 'Unfold', 'Развертка'],
    group: 'space',
    forms: ['@(S, A, B, C, P)', '@(S, A, B, C, P, angle)'],
    doc: "Exact net of spatial pyramid SABC. Vertex S′ is at drawing point P; edge S′A′ uses the supplied angle in degrees, default −60°. Faces use true edge lengths, and base ABC is attached outside A′B′. Labels: S, A′, B′, C′, A″, C₀.",
    example: 'S = (20, 25, 50)\nA = (50, 5, 0)\nB = (0, 5, 0)\nC = (25, 40, 0)\nUnfold(S, A, B, C, (90, 40))',
    run(a, c) {
      args(a, 5, 6);
      const pts = a.slice(0, 4).map((e) => c.pointAny(e));
      if (!pts.every(is3)) throw new Error('A net requires a spatial pyramid with (x, y, z) points');
      const [sp, ...base] = pts as Vec3[];
      const at = c.point(a[4]);
      const angle = a[5] ? c.num(a[5]) : -60;
      const u = unfold(sp, base, at, angle);
      const names = ["A'", "B'", "C'", "A''"];
      u.ring.forEach((p, i) => {
        c.draw({ type: 'segment', a: u.s, b: p });
        if (i > 0) c.draw({ type: 'segment', a: u.ring[i - 1], b: p });
        c.draw({ type: 'point', p }, { label: names[i] });
      });
      c.draw({ type: 'segment', a: u.ring[0], b: u.base });
      c.draw({ type: 'segment', a: u.ring[1], b: u.base });
      c.draw({ type: 'point', p: u.base }, { label: 'C_0' });
      c.draw({ type: 'point', p: u.s }, { label: 'S' });
      return NONE;
    },
  },
  {
    names: ['ОсьX', 'XAxis'],
    group: 'space',
    forms: ['@("left")', '@("right")'],
    doc: "Direction of the x-axis in a Monge drawing. Defaults to left from O, following descriptive geometry convention.",
    example: 'XAxis("right")\nA = (4, 2, 3)',
    view: true,
    run(a, c) {
      args(a, 1);
      const dir = c.str(a[0]).trim().toLowerCase();
      if (['вправо', 'right', 'направо'].includes(dir)) c.scene.view.xRight = true;
      else if (['влево', 'left', 'налево'].includes(dir)) c.scene.view.xRight = false;
      else throw new Error('The x-axis direction must be left or right');
      return NONE;
    },
  },

  // ---------------------------------------------------------------- text
  {
    names: ['Текст', 'Text'],
    group: 'text',
    forms: ['@("text", A)', '@("text", (x, y))'],
    doc: "Handwritten text with its bottom-left corner at the point. Use A_1 for subscripts and x^2 for superscripts.",
    example: 'Text("Vertex", (1, 2))',
    run(a, c) {
      args(a, 1, 2);
      return shape({ type: 'text', text: c.str(a[0]), at: a[1] ? c.point(a[1]) : null });
    },
  },
  {
    names: ['Заголовок', 'Title'],
    group: 'text',
    forms: ['@("text")'],
    doc: "Title above the drawing.",
    example: 'Title("Function graph")\nf(x) = x^2',
    view: true,
    run(a, c) {
      args(a, 1);
      c.scene.title = c.str(a[0]);
      return NONE;
    },
  },
  {
    names: ['Подпись', 'SetCaption'],
    group: 'text',
    forms: ['@(object, "text")'],
    doc: "Custom object caption instead of its name. Points display their names automatically.",
    example: 'f(x) = sin(x)\nSetCaption(f, "y = sin x")',
    run(a, c) {
      args(a, 2);
      const it = c.item(a[0]);
      it.caption = c.str(a[1]);
      it.showLabel = true;
      return NONE;
    },
  },
  {
    names: ['ПоказатьПодпись', 'ShowLabel'],
    group: 'text',
    forms: ['@(object, true)', '@(object, false)'],
    doc: "Show or hide an object caption. Only points and angles have captions by default.",
    example: 'f(x) = x^2\nShowLabel(f, true)',
    run(a, c) {
      args(a, 1, 2);
      c.item(a[0]).showLabel = a[1] ? c.bool(a[1]) : true;
      return NONE;
    },
  },

  // ---------------------------------------------------------------- style
  {
    names: ['Цвет', 'SetColor'],
    group: 'style',
    forms: ['@(object, "red")'],
    doc: "Pen color: red, blue, green, orange, purple, brown, gray, pink, cyan, yellow or black. Russian color aliases are also accepted.",
    example: 'f(x) = x^2\nSetColor(f, "red")',
    run(a, c) {
      args(a, 2, 4);
      const it = c.item(a[0]);
      if (a.length === 4) {
        const rgb = a.slice(1).map((e) => c.num(e));
        const k = rgb.every((v) => v <= 1) ? 255 : 1;
        it.color = `#${rgb.map((v) => hex(v * k)).join('')}`;
        return NONE;
      }
      const name = c.str(a[1]).trim().toLowerCase();
      if (/^#[0-9a-f]{6}$/.test(name)) it.color = name;
      else if (name in COLORS) it.color = COLORS[name] ?? undefined;
      else throw new Error(`Unknown color “${name}»: available colors: red, blue, green, orange, purple, brown, gray, pink, cyan, yellow, black`);
      return NONE;
    },
  },
  {
    names: ['СтильЛинии', 'SetLineStyle'],
    group: 'style',
    forms: ['@(object, n)'],
    doc: "Line style: 0 solid, 1 dashed for hidden lines, 2 short dashes, 3 dotted, 4 dash-dot for axes.",
    example: 'A = (0, 0)\nB = (4, 2)\ns = Segment(A, B)\nSetLineStyle(s, 1)',
    run(a, c) {
      args(a, 2);
      const n = Math.round(c.num(a[1]));
      if (n < 0 || n > 4) throw new Error('Line style must be a number from 0 to 4');
      c.item(a[0]).lineStyle = n;
      return NONE;
    },
  },
  {
    names: ['СтильТочки', 'SetPointStyle'],
    group: 'style',
    forms: ['@(point, n)'],
    doc: "Point style: 0 filled, 1 cross ×, 2 open circle for excluded points or discontinuities, 3 plus +. Lines do not pass through an open circle.",
    example: 'f(x) = x + 1\nA = (1, 2)\nSetPointStyle(A, 2)',
    run(a, c) {
      args(a, 2);
      const n = Math.round(c.num(a[1]));
      if (n < 0) throw new Error('Point style must be 0, 1, 2 or 3');
      // GeoGebra's other styles to the nearest: 5 ◇ open, 4 ◆ and the triangles filled.
      c.item(a[0]).pointStyle = n <= 3 ? n : n === 5 ? 2 : 0;
      return NONE;
    },
  },
  {
    names: ['Толщина', 'SetLineThickness'],
    group: 'style',
    forms: ['@(object, n)'],
    doc: "Line thickness from 1 to 13. Default: 5. Thin projection and construction lines: 2.",
    example: 'A = (0, 0)\nB = (4, 2)\ns = Segment(A, B)\nSetLineThickness(s, 2)',
    run(a, c) {
      args(a, 2);
      c.item(a[0]).thickness = Math.min(Math.max(c.num(a[1]), 1), 13);
      return NONE;
    },
  },
  {
    names: ['Заливка', 'SetFilling'],
    group: 'style',
    forms: ['@(object, fraction)'],
    doc: "Hatching density inside a polygon or circle: 0 none, 1 maximum.",
    example: 'A = (0, 0)\nB = (4, 0)\nC = (1, 3)\nt = Polygon(A, B, C)\nSetFilling(t, 0.3)',
    run(a, c) {
      args(a, 2);
      c.item(a[0]).filling = Math.min(Math.max(c.num(a[1]), 0), 1);
      return NONE;
    },
  },
  {
    names: ['Скрыть', 'Hide', 'SetVisibleInView'],
    group: 'style',
    forms: ['@(object)'],
    doc: "Hide an object while keeping it available for constructions. SetVisibleInView(object, 1, false) is also accepted.",
    example: 'A = (0, 0)\nB = (4, 0)\na = Line(A, B)\nHide(a)\nC = (2, 3)\nH = Intersect(PerpendicularLine(C, a), a)\nSegment(C, H)',
    run(a, c) {
      args(a, 1, 3);
      c.item(a[0]).hidden = a.length === 3 ? !c.bool(a[2]) : true;
      return NONE;
    },
  },

  // ---------------------------------------------------------------- view
  {
    names: ['Окно', 'ZoomIn'],
    group: 'view',
    forms: ['@(xmin, ymin, xmax, ymax)', '@(xmin, xmax)'],
    doc: "Set the visible plane region. Without this command, the view automatically fits all content.",
    example: 'ZoomIn(-2pi, -1.5, 2pi, 1.5)\nf(x) = sin(x)',
    view: true,
    run(a, c) {
      args(a, 2, 4);
      const [x0, x1] = a.length === 4 ? [a[0], a[2]] : [a[0], a[1]];
      const xr: [number, number] = [c.num(x0), c.num(x1)];
      if (!(xr[0] < xr[1])) throw new Error('xmin must be less than xmax');
      c.scene.view.x = xr;
      c.scene.view.xPi = c.usesPi(x0) || c.usesPi(x1);
      if (a.length === 4) {
        const yr: [number, number] = [c.num(a[1]), c.num(a[3])];
        if (!(yr[0] < yr[1])) throw new Error('ymin must be less than ymax');
        c.scene.view.y = yr;
        c.scene.view.yPi = c.usesPi(a[1]) || c.usesPi(a[3]);
      }
      return NONE;
    },
  },
  {
    names: ['Оси', 'ShowAxes'],
    group: 'view',
    forms: ['@(true)', '@(false)'],
    doc: "Show or hide coordinate axes. Axes appear by default only when the drawing includes graphs.",
    example: 'ShowAxes(true)\nA = (2, 1)',
    view: true,
    run(a, c) {
      c.scene.view.axes = a.length ? c.bool(a[a.length - 1]) : true;
      return NONE;
    },
  },
  {
    names: ['Сетка', 'ShowGrid'],
    group: 'view',
    forms: ['@(true)', '@(false)'],
    doc: "Show or hide the grid.",
    example: 'ShowGrid(true)\nf(x) = x / 2',
    view: true,
    run(a, c) {
      c.scene.view.grid = a.length ? c.bool(a[a.length - 1]) : true;
      return NONE;
    },
  },
  {
    names: ['НаБланке', 'OnBlank'],
    group: 'view',
    forms: ['@(x, y)', '@(x, y, mm)'],
    doc: "Place a drawing on a form. The origin is (x, y) in millimeters from the top-left page corner, with y downward. One drawing unit is 1 mm unless the third argument specifies otherwise. Automatic view fitting and axes are disabled because they are already printed. Use the ⌖ eyedropper to pick form points.",
    example: 'OnBlank(120, 95)\nA = (0, 0)\nB = (30, 20)\nSegment(A, B)',
    view: true,
    run(a, c) {
      args(a, 2, 3);
      const x = c.num(a[0]);
      const y = c.num(a[1]);
      const unit = a[2] ? c.num(a[2]) : 1;
      if (![x, y].every(Number.isFinite) || !(unit > 0)) throw new Error('Expected two coordinates in mm from the top-left page corner and an optional positive mm-per-unit value');
      c.scene.view.blank = { x, y, unit };
      return NONE;
    },
  },
  {
    names: ['Пропорции', 'SetAxesRatio'],
    group: 'view',
    forms: ['@(1, 1)', '@(a, b)'],
    doc: "Axis scale: a x-units have the same length as b y-units. @(1, 1) uses equal scales, already the default when there are no graphs or when circles are present.",
    example: 'SetAxesRatio(1, 1)\nf(x) = x^2 / 4',
    view: true,
    run(a, c) {
      args(a, 2);
      const p = c.num(a[0]);
      const q = c.num(a[1]);
      if (!(p > 0 && q > 0)) throw new Error('Scale requires two positive numbers');
      c.scene.view.ratio = p / q;
      return NONE;
    },
  },
];

/** Numbers and formulas: shown in the help and in the instructions. */
export const FORMULA_HELP: { code: string; doc: string }[] = [
  { code: '+ − * / ^ ( )', doc: "Arithmetic; multiplication signs are optional: 2x, 3sin(x), 2(x + 1)" },
  { code: 'pi, e', doc: "Constants π and e; π can also be entered as a symbol" },
  { code: '30°', doc: "Degrees; without °, angles use radians" },
  { code: 'sqrt(x), abs(x), |x|', doc: "Square root and absolute value" },
  { code: 'sin cos tan cot', doc: "Trigonometry, also accepting tg and ctg; arguments use radians" },
  { code: 'asin acos atan', doc: "Inverse trigonometry, also accepting arcsin, arccos and arctg" },
  { code: 'ln(x), lg(x), log(b, x), exp(x)', doc: "Natural, base-10 and base-b logarithms; log(x) is natural, as in GeoGebra" },
  { code: 'floor ceil round sgn min max', doc: "Rounding, sign, minimum and maximum" },
  { code: 'x(A), y(A)', doc: "Coordinates of point A" },
  { code: 'f(2)', doc: "Value of a defined function" },
  { code: 'A + (1, 0), 2v', doc: "Points and vectors can be added and multiplied by a number" },
];

/** GeoGebra commands that only matter on a screen: skipped without complaint. */
export const IGNORED = [
  'SetPointSize',
  'SetDecoration',
  'SetLabelMode',
  'SetLayer',
  'SetFixed',
  'SetTooltipMode',
  'SetDynamicColor',
  'SetLevelOfDetail',
  'SetTrace',
  'SetBackgroundColor',
  'SetPerspective',
  'SetSpinSpeed',
  'SetTooltip',
  'ShowLayer',
  'HideLayer',
  'StartAnimation',
  'SelectObjects',
  'UpdateConstruction',
  'CenterView',
];
const ignored = new Set(IGNORED.map((n) => n.toLowerCase()));

export function isIgnored(name: string): boolean {
  return ignored.has(name.toLowerCase());
}

const byName = new Map<string, Command>();
for (const cmd of COMMANDS) for (const n of cmd.names) byName.set(n.toLowerCase().replace(/ё/g, 'е'), cmd);

export function findCommand(name: string): Command | undefined {
  return byName.get(name.toLowerCase().replace(/ё/g, 'е'));
}

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** «Segmnt» → «Segment»: the closest known command, if any is close. */
export function suggestCommand(name: string): string | null {
  const key = name.toLowerCase();
  let best: string | null = null;
  let bestD = Infinity;
  for (const cmd of COMMANDS) {
    for (const n of cmd.names) {
      const d = distance(key, n.toLowerCase());
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
  }
  return bestD <= Math.max(2, Math.floor(key.length / 4)) ? best : null;
}

/** The example or any code with command names in one language: «ru» or «en». */
export function localizeCode(code: string, lang: 'ru' | 'en'): string {
  return code.replace(/[\p{L}]+(?=\()/gu, (word) => {
    const cmd = findCommand(word);
    if (!cmd) return word;
    return lang === 'ru' ? cmd.names[0] : cmd.names[1];
  });
}
