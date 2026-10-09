import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const PORT = 5173;

const DEMO_ENTRIES = [
  {
    id: 'demo-2025-12-31', date: '2025-12-31', year: 2025, month: 12,
    title: '31 de dezembro de 2025',
    content: '# 31 de dezembro de 2025\n\nÚltimo registro fictício de 2025.\n\nEste arquivo existe apenas para testar a navegação do **Vault Commander**.'
  },
  {
    id: 'demo-2026-09-29', date: '2026-09-29', year: 2026, month: 9,
    title: '29 de setembro de 2026',
    content: '# 29 de setembro de 2026\n\nRegistro fictício para desenvolvimento.\n\nHoje organizei algumas ideias sobre [[OpenClaw]] e o futuro do acervo.\n\n> Nada aqui pertence ao diário real.'
  },
  {
    id: 'demo-2026-10-01', date: '2026-10-01', year: 2026, month: 10,
    title: '1 de outubro de 2026',
    content: '# 1 de outubro de 2026\n\nPrimeiro registro fictício de outubro.\n\n## Experimento\n\nO Vault Commander deverá navegar por Markdown, anexos e futuramente por [[Projetos|wikilinks do Obsidian]].\n\n- teclado\n- mouse\n- somente leitura\n- visual retrô'
  },
  {
    id: 'demo-2026-10-05', date: '2026-10-05', year: 2026, month: 10,
    title: '5 de outubro de 2026',
    content: '# 5 de outubro de 2026\n\nNasce o **Vault Commander**.\n\nA primeira meta é navegar por um acervo canônico sem alterar absolutamente nada.\n\n`C:\\\\DIARIUM> _`'
  }
];

async function loadConfig() {
  try {
    const raw = await fs.readFile(path.join(__dirname, 'config.json'), 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg.mode !== 'readonly') throw new Error('config.json deve usar mode="readonly".');
    if (!cfg.vaultPath || !cfg.canonicalPath) throw new Error('vaultPath/canonicalPath ausentes no config.json.');
    return { demo: false, ...cfg };
  } catch (error) {
    if (error?.code === 'ENOENT') return { demo: true, mode: 'readonly' };
    throw error;
  }
}

async function walkMarkdown(dir) {
  const out = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...await walkMarkdown(full));
    else if (item.isFile() && item.name.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out;
}

function dateFromName(file) {
  return path.basename(file).match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? null;
}

async function scanEntries() {
  const cfg = await loadConfig();
  if (cfg.demo) return DEMO_ENTRIES.map(({ content, ...entry }) => ({ ...entry, demo: true }));

  const root = path.resolve(cfg.vaultPath, cfg.canonicalPath);
  const files = await walkMarkdown(root);
  const entries = [];

  for (const file of files) {
    const date = dateFromName(file);
    if (!date) continue;
    const [year, month] = date.split('-').map(Number);
    const relativePath = path.relative(root, file).split(path.sep).join('/');
    const raw = await fs.readFile(file, 'utf8');
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || date;
    entries.push({
      id: Buffer.from(relativePath).toString('base64url'),
      relativePath, date, year, month, title, demo: false
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

async function readRealEntry(relativePath) {
  const cfg = await loadConfig();
  if (cfg.demo) throw new Error('Demo mode');
  const root = path.resolve(cfg.vaultPath, cfg.canonicalPath);
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Caminho inválido.');
  if (!resolved.toLowerCase().endsWith('.md')) throw new Error('Apenas Markdown é permitido.');
  return fs.readFile(resolved, 'utf8');
}

function highlightWikiLinks(html) {
  return html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) =>
    `<span class="wikilink" data-wikilink="${String(target).replace(/"/g, '&quot;')}">[[${label || target}]]</span>`
  );
}

app.disable('x-powered-by');
app.use(express.static(__dirname, { index: 'index.html' }));

app.get('/api/status', async (_req, res) => {
  try {
    const cfg = await loadConfig();
    const entries = await scanEntries();
    res.json({ ok: true, mode: 'readonly', demo: cfg.demo, entries: entries.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/years', async (_req, res) => {
  try {
    const entries = await scanEntries();
    res.json([...new Set(entries.map(e => e.year))].sort((a, b) => b - a));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/months/:year', async (req, res) => {
  try {
    const year = Number(req.params.year);
    const entries = await scanEntries();
    res.json([...new Set(entries.filter(e => e.year === year).map(e => e.month))].sort((a, b) => b - a));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/entries/:year/:month', async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const entries = await scanEntries();
    res.json(entries.filter(e => e.year === year && e.month === month));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/entry/:id', async (req, res) => {
  try {
    const entries = await scanEntries();
    const entry = entries.find(e => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entrada não encontrada.' });
    const raw = entry.demo
      ? DEMO_ENTRIES.find(e => e.id === entry.id)?.content ?? ''
      : await readRealEntry(entry.relativePath);
    res.json({ ...entry, html: highlightWikiLinks(md.render(raw)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('VAULT COMMANDER 0.3');
  console.log('Mode........ READ ONLY');
  console.log(`Address..... http://127.0.0.1:${PORT}`);
  console.log('');
});
