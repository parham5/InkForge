import { TEMPLATES } from '../blocks/templates';
import type { DocContent } from '../model/types';

const p = (text: string) => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });

const shapes = TEMPLATES.find((t) => t.id === 'shapes')!;

export function welcomeContent(): DocContent {
  return {
    type: 'doc',
    content: [
      p('Welcome to InkForge — your handwriting, your typeface, your identity.'),
      p('1. Open Handwriting and write each letter several times. More samples give your writing more natural variation.'),
      p('2. Return here and type. Missing letters are underlined; select one to add it to your handwriting.'),
      p('3. Render the document to see your handwriting on the page. Use Print to save a PDF.'),
      p('Below is an interactive HTML block. Move, label, and connect the shapes. Its header opens the code and data.'),
      {
        type: 'htmlBlock',
        attrs: { title: shapes.title, code: shapes.code, data: shapes.data, height: 380 },
      },
      p('Your handwriting and embedded blocks make the page your own.'),
    ],
  };
}
