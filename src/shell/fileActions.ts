import { exportBlanks, importBlanks } from '../blank/blank';
import { exportDesks, importDesks } from '../desk/desks';
import { showDocument } from '../editor/docState';
import { createDocument, exportEverything, exportHandwriting, getSetting, importEverything, importHandwriting } from '../storage/db';
import { saveFile } from '../util/download';
import { flushWrites } from '../util/flush';
import { pickJsonFile } from '../util/pickFile';

/** The full backup also carries «Мои столы» (their photos make it large). */
export const BACKUP_DESKS_KEY = 'backup.desks';

export async function newDocument() {
  showDocument((await createDocument()).id);
}

/** Opens a document, or loads a full backup / handwriting file (any Handbook .json). */
export async function openJson() {
  const file = await pickJsonFile();
  if (!file) return;
  try {
    const data = JSON.parse(file.text);
    if (data?.format === 'handbook-backup' || data?.format === 'inkforge-backup') {
      const n = await importEverything(data);
      const desks = Array.isArray(data.desks) ? await importDesks(data.desks) : 0;
      if (Array.isArray(data.blanks)) await importBlanks(data.blanks);
      alert(`Restored from backup: documents — ${n.documents}, letter samples — ${n.samples}${desks ? `, desks — ${desks}` : ''}.`);
      return;
    }
    if (data?.format === 'handbook-handwriting' || data?.format === 'inkforge-handwriting') {
      await importHandwriting(data, false);
      alert(`Handwriting imported: letter samples — ${data.samples.length}.`);
      return;
    }
    if (!['handbook-document', 'inkforge-document'].includes(data?.format) || !data.content) throw new Error('This is not an InkForge document (.json)');
    showDocument((await createDocument(String(data.title ?? 'Untitled'), data.content)).id);
  } catch (err) {
    alert(String(err));
  }
}

/** Handwriting, every document and the settings in one file. */
export async function backupEverything() {
  // With the words typed a moment ago.
  await flushWrites();
  const withDesks = await getSetting(BACKUP_DESKS_KEY, false);
  const data = await exportEverything(withDesks ? await exportDesks() : undefined, await exportBlanks());
  const day = new Date().toISOString().slice(0, 10);
  await saveFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), `inkforge-backup-${day}.json`);
}

export async function saveHandwriting() {
  const data = await exportHandwriting();
  await saveFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'handwriting.inkforge.json');
}

export async function loadHandwriting() {
  const file = await pickJsonFile();
  if (!file) return;
  try {
    const data = JSON.parse(file.text);
    const replace = confirm('Replace your current handwriting? Choose Cancel to add samples to your existing collection.');
    await importHandwriting(data, replace);
  } catch (err) {
    alert(String(err));
  }
}
