// The request to a neural net that fills a blank: what it sees, what it must
// answer and how — built from the same command registry as the drawings, so
// it only hears of commands that really work.
import { COMMANDS, FORMULA_HELP, GROUPS } from '../sketch/commands';
import { MARK_RULES, RULES } from '../sketch/prompt';
import { BLANK_FORMATS, blankPaperMm, type Blank, type BlankMark } from './blank';
import { markMm, markText, type Area } from './marks';

export interface AskChoice {
  /** The student's variant (from a table on the blank), if any. */
  variant: string;
  /** How the work is signed: «Прізвище І. П.». */
  name: string;
  /** What to do: the whole blank, or these tasks («3», «4а, 4б»). */
  tasks: string;
  /** Anything else to say. */
  wishes: string;
}

export const DEFAULT_ASK: AskChoice = { variant: '', name: '', tasks: '', wishes: '' };

const KIND: Record<BlankMark['kind'], string> = { circle: "point (circle)", dot: "point", cross: "line intersection", end: "line endpoint", free: "point" };

/** A short example of an answer (another blank). */
export const ANSWER_EXAMPLE = `task 3
origin @2
A = FromProjections(@7, @6)
B = FromProjections(@9, @8)
h = TrueLength(A, B, 1)
g = TrueLength(A, B, 2)
note at @9 right: $\\alpha$ = {Inclination(A, B, 1):0}°, $\\beta$ = {Inclination(A, B, 2):0}°
note in R1: |AB| = {Length(h):0} mm

task 2
origin @12
L = FromProjections(@14, @13)
M = FromProjections(@16, @15)
Traces(L, M)
note in R2: Line l crosses quadrants {Quarters(L, M)}`;

/** The whole request; the marked picture goes with it. */
export function blankPrompt(b: Blank, marks: BlankMark[], areas: Area[], ask: AskChoice): string {
  const [w, h] = blankPaperMm(b);
  const out: string[] = [];
  const rule = (i: number) => RULES[i];
  out.push(
    "Complete the practical worksheet. InkForge writes the result in the user’s handwriting directly on the printed form. Return only the strict format below, specifying what to construct, what to write and where.",
    '',
    "IMAGE",
    "An annotated form image accompanies this text. These annotations are reference aids and will not appear on the paper:",
    "- blue grid at 10 mm intervals; edge numbers are millimeters from the top-left page corner, x rightward and y downward;",
    "- red markers @1, @2, … identify form points whose exact positions are known to the application;",
    "- green areas R1, R2, … identify free space on the page.",
    '',
    "DATA",
    `Paper: ${BLANK_FORMATS[b.format].name} ${b.landscape ? "landscape" : "portrait"}, ${w} × ${h} mm.`,
    `Variant: ${ask.variant.trim() || "not specified; if the form has a variant table, ask for the number before answering"}.`,
    `Student signature: ${ask.name.trim().replace(/\.$/, '') || "not specified; do not add a signature"}.`,
    `Complete: ${ask.tasks.trim() ? `only task ${ask.tasks.trim()}` : "the entire form, all tasks"}.`,
    ...(ask.wishes.trim() ? [`Additional instructions: ${ask.wishes.trim()}`] : []),
    '',
    "Form points in mm from the top-left corner, for reference only; use @number in the response:",
    ...marks.map((m, i) => `@${i + 1} ${markText(markMm(b, m))} — ${KIND[m.kind]}`),
    '',
    "Free areas (mm):",
    ...(areas.length ? areas.map((a, i) => `R${i + 1}: x ${Math.round(a.x)}…${Math.round(a.x + a.w)}, y ${Math.round(a.y)}…${Math.round(a.y + a.h)}`) : ["(none detected)"]),
    '',
    "SOLUTION METHOD",
    "1. Read each task in the image and solve it using textbook geometric constructions, such as right triangles, rotation or changes of projection planes, rather than numerical answers alone.",
    "2. Start from the printed geometry. Use @ markers beside labels A₁, B₂ and 0; do not estimate printed point coordinates from the grid. If a required point lacks a marker, say so in a # comment and use the grid for that point.",
    "3. Do not measure or calculate values that depend on printed geometry yourself. Put expressions in braces so the application uses exact coordinates: {Distance(A_1, B_0):0}, {Angle(B_1, A_1, B_0):0}. The number after the colon specifies decimal places.",
    "4. Write concise answers and annotations in the form’s language. Place the student signature on the designated signature line.",
    '',
    "RESPONSE FORMAT",
    "Use one code block labeled blank, with no surrounding explanations. Lines:",
    "  task N              start a task; use its printed number, such as 1, 2, 3 or 4a",
    "  origin @5           task origin at a printed point, usually 0 on the x₁₂ axis",
    "  origin (x, y)       or a position in page millimeters for a drawing in free space",
    "  drawing commands    one per line, from the COMMANDS list only",
    "  note WHERE: TEXT    handwritten annotation; WHERE is at @9 right (left, above, below), in R2, or (x, y) in page millimeters",
    "                      continue long annotations on following lines indented by two spaces",
    "  # …                 comment",
    '',
    "DRAWING COORDINATES",
    "Relative to the task origin, 1 unit = 1 mm. Page points (x, y): x rightward, y upward. Spatial points (x, y, z): x leftward along x₁₂, y downward on Π₁, z upward on Π₂. Do not redraw the printed x₁₂ axis or origin.",
    "  A_1 = @7                     printed form point, represented as a page point",
    "  A = FromProjections(@7, @6)  spatial point from horizontal A₁ and front A₂ projections",
    "  K = Projection(A, 1)         spatial point projected onto Π₁ (or 2, 3) as a page point",
    '',
    "DRAWING RULES",
    "- Do not redraw printed content. Points defined with @ are automatically hidden. Define and hide printed segments or lines needed for construction: h = Segment(A_1, B_1), Hide(h).",
    "- Name new points using textbook notation: A_0, B_0, K, M_1… Do not use @ markers as names for new points.",
    "- Use SetLineThickness(…, 2) for construction and projection links, SetLineStyle(…, 1) for hidden geometry, and default settings for results.",
    "- Use exact built-in constructions: TrueLength and Inclination for spatial segment length and inclination; Traces and Quarters for spatial lines; Unfold for pyramid nets. Do not reconstruct these manually with intersections and circles.",
    "- Construct specified angles and lengths exactly, such as Rotate(…, 45°) or Circle(A, 20), and write the supplied number in annotations. Use {…} only for derived construction values.",
    "- Use only the task’s notation and standard subscripts 0, 1, 2, 3 and primes, such as A_0, B_1 and A′. Do not invent new labels.",
    "- Place free-space drawings, such as nets, with origin (x, y) inside their R area and scale them to fit.",
    `- ${rule(2)}`,
    `- ${rule(3)}`,
    `- ${rule(4)}`,
    `- ${rule(7)}`,
    ...MARK_RULES.map((r) => `- ${r}`),
    "- Start comments with #.",
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
  out.push("Use $…$ for annotation formulas, such as $\\alpha$ = {…:0}°. Use A_1 for subscripts and x^2 for superscripts.", '', "EXAMPLE (a different form)", "```blank", ANSWER_EXAMPLE, '```');
  return out.join('\n');
}

/** A short request to mend what went wrong, for the same chat. */
export function fixPrompt(problems: { task: string; text: string }[]): string {
  return [
    "The application found errors in your response. Correct only these tasks and resend each complete task, starting with task N, in one code block labeled blank:",
    '',
    ...problems.map((p) => `- task ${p.task}: ${p.text}`),
  ].join('\n');
}
