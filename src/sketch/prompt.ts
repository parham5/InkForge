// Instructions for neural nets: the command list, the rules and examples,
// built from the same registry the app runs, so a model can only be told
// about commands that really work.
import { COMMANDS, FORMULA_HELP, GROUPS } from './commands';

export interface SketchExample {
  title: string;
  /** What one would ask for. */
  task: string;
  /** The answer, with English command names. */
  code: string;
}

export const EXAMPLES: SketchExample[] = [
  {
    title: "Function graphs",
    task: "Plot sine and cosine from −2π to 2π and label both",
    code: `Title("Function graphs")
ZoomIn(-2pi, -1.5, 2pi, 1.5)
f(x) = sin(x)
g(x) = cos(x)
SetColor(g, "red")
SetCaption(f, "y = sin x")
SetCaption(g, "y = cos x")`,
  },
  {
    title: "Triangle with altitude",
    task: "Triangle ABC with a dashed altitude CH and a right-angle marker at H",
    code: `A = (0, 0)
B = (6, 0)
C = (2, 4)
Polygon(A, B, C)
H = Intersect(PerpendicularLine(C, Line(A, B)), Line(A, B))
h = Segment(C, H)
SetLineStyle(h, 1)
Angle(B, H, C)`,
  },
  {
    title: "Intersection points",
    task: "Parabola y = x² − 2, line y = x, and their intersections A and B",
    code: `f(x) = x^2 - 2
g(x) = x
SetCaption(f, "y = x^2 - 2")
SetCaption(g, "y = x")
A = Intersect(f, g, 1)
B = Intersect(f, g, 2)`,
  },
  {
    title: "Open point",
    task: "Graph y = (x² − 1)/(x − 1), with an open point at x = 1",
    code: `f(x) = (x^2 - 1) / (x - 1)
SetCaption(f, "y = (x^2 - 1)/(x - 1)")
A = (1, 2)
SetPointStyle(A, 2)
SetCaption(A, "")`,
  },
  {
    title: "Area between graphs",
    task: "Hatch the region between parabola y = x² and line y = x + 2",
    code: `f(x) = x^2
g(x) = x + 2
SetCaption(f, "y = x^2")
SetCaption(g, "y = x + 2")
A = Intersect(f, g, 1)
B = Intersect(f, g, 2)
Hatch(f, g, x(A), x(B))`,
  },
  {
    title: "Plane projections",
    task: "Monge projection of plane ABC: A(2, 1, 3), B(5, 3, 1), C(1, 4, 4)",
    code: `Title("Plane ABC")
A = (2, 1, 3)
B = (5, 3, 1)
C = (1, 4, 4)
Polygon(A, B, C)`,
  },
  {
    title: "Three views of a segment",
    task: "Segment AB in three projections and its midpoint M: A(6, 2, 4), B(2, 4, 1)",
    code: `Projections(1, 2, 3)
A = (6, 2, 4)
B = (2, 4, 1)
Segment(A, B)
M = Midpoint(A, B)`,
  },
];

/** How marks are drawn: open points, hatching, dashed lines — for drawings and blanks alike. */
export const MARK_RULES = [
  "Use SetPointStyle(A, 2) for excluded points, graph discontinuities and open interval endpoints. This draws an open circle which lines do not cross. Filled points need no settings.",
  "Use Hatch for sections, faces, areas and inequalities: Hatch(t) for polygon or circle t, Hatch(f, a, b) between a graph and the x-axis, and Hatch(f, g, a, b) between graphs. Do not draw hatching with individual segments.",
  "Use HatchedLine(l, P) for a half-plane boundary, ground or fixed support: short diagonal marks along l on the side containing P.",
  "Use SetLineStyle(…, 1) for hidden outlines and SetLineStyle(…, 4) for axes and symmetry lines.",
  "The application adds pencil smudges, eraser marks and compass punctures automatically. Do not draw them.",
];

export const RULES = [
  "Reply with one code block containing one command per line. Do not add explanations before or after it.",
  "Use only commands from the list below, with English GeoGebra-style names. Do not output HTML, SVG, TikZ, Python or unsupported commands.",
  "Define points and functions before objects built from them. Define each name once and before its first use.",
  "Name points with uppercase Latin letters, optionally with subscripts or primes: A, B, A_1, A_2, A′. Use lowercase names for lines, segments and functions: a, s, f, g. Names x and y are reserved for axes.",
  "Use decimal points: 2.5. Append ° for degrees: 30°. Use pi for π. Multiplication signs are optional: 2x.",
  "Let the application choose color, width, line style and view unless requested otherwise. Exceptions: hidden or auxiliary lines use SetLineStyle(…, 1); projection and construction lines use SetLineThickness(…, 2); distinguish multiple graphs with SetColor and SetCaption.",
  "Nest hidden auxiliary constructions directly, such as Intersect(PerpendicularLine(C, a), a), or hide them with Hide(…).",
  "Points are labeled automatically. Use SetCaption only for a different label. Write labels and text in English, in quotes. Use A_1 for subscripts and x^2 for superscripts.",
  "For spatial or descriptive geometry, define points with three coordinates, A = (x, y, z), and construct Segment, Line, Ray, Polygon and Midpoint from them. The application draws Monge projections A₁ and A₂, links and the x₁₂ axis automatically. Do not calculate projections or draw axes and links yourself. Use spatial names without projection subscripts, such as A, B and C; the application adds 1, 2 and 3. Use Projections(1, 2, 3) for a profile view.",
  "GeoGebra 3D plane and solid commands (Plane, Sphere, Prism, Pyramid…) are unavailable. Represent a plane with triangle Polygon(A, B, C).",
  ...MARK_RULES,
  "Start optional comments with #.",
];

/** Plain-text instructions for a chat with a neural net, optionally with the task. */
export function sketchPrompt(task = ''): string {
  const out: string[] = [];
  out.push(
    "You create drawings and graphs for InkForge. The application renders them in the user’s handwriting. " +
      "Provide GeoGebra-style commands describing what to draw; the application handles the rendering.",
    '',
    "RESPONSE RULES",
    ...RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    "SYNTAX",
    "A = (2, 3): point; f(x) = x^2 - 1 or y = 2x + 1: graph; x = 3: vertical line; r = 2: number;",
    "s = Segment(A, B): named object available to later commands; Segment(A, B): unnamed object;",
    "A = (x, y, z): spatial point. The drawing becomes a Monge projection: x along x₁₂, y toward the viewer, z upward.",
    '',
    "COMMANDS",
  );
  for (const group of GROUPS) {
    out.push(`# ${group.name}`);
    for (const cmd of COMMANDS.filter((c) => c.group === group.id)) {
      const name = cmd.names[1];
      out.push(`${cmd.forms.map((f) => f.replace('@', name)).join(' | ')} — ${cmd.doc.replace(/@/g, name)}`);
    }
  }
  out.push('', "NUMBERS AND FORMULAS");
  for (const f of FORMULA_HELP) out.push(`${f.code} — ${f.doc}`);
  out.push('', "EXAMPLES");
  for (const ex of EXAMPLES) out.push('', `Task: ${ex.task}`, '```', ex.code, '```');
  out.push('', "TASK", task.trim() || "(describe what to draw here)");
  return out.join('\n');
}
