import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const archiveDir = path.resolve(repoRoot, '.ge-dms-archive');
const publicDir = path.resolve(repoRoot, 'public', 'ge-dms-archive');
const docsPagesDir = path.resolve(repoRoot, 'docs', 'ge-dms', 'pages');
const indexPath = path.resolve(archiveDir, 'index.jsonl');

const slugify = (input) =>
  input
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const readIndex = async () => {
  const raw = await fs.readFile(indexPath, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const copyArchiveFiles = async () => {
  const entries = await fs.readdir(archiveDir);
  const files = entries.filter((file) => /\.(png|html|txt)$/i.test(file));
  await ensureDir(publicDir);

  await Promise.all(
    files.map(async (file) => {
      const from = path.join(archiveDir, file);
      const to = path.join(publicDir, file);
      await fs.copyFile(from, to);
    })
  );
};

const writePageDocs = async (pages) => {
  await ensureDir(docsPagesDir);

  for (const entry of pages) {
    const status = entry.title && entry.title.toLowerCase().includes('404') ? 'Not Found' : 'OK';
    const slug = slugify(entry.url || entry.title || 'page');
    const filename = `${slug}.md`;
    const title = entry.title || slug.replace(/-/g, ' ');
    const exportsList = (entry.exportButtons || []).filter(Boolean);

    const screenshotFile = entry.screenshot ? path.basename(entry.screenshot) : '';
    const htmlFile = entry.htmlFile ? path.basename(entry.htmlFile) : '';
    const textFile = entry.textFile ? path.basename(entry.textFile) : '';

    const content = [
      `# ${title}`,
      '',
      `**URL:** ${entry.url || 'Unknown'}`,
      `**Status:** ${status}`,
      exportsList.length ? `**Exports:** ${exportsList.join(', ')}` : '**Exports:** None',
      `**Captured:** ${entry.timestamp || 'Unknown'}`,
      '',
      screenshotFile ? `![${title}](/ge-dms-archive/${screenshotFile})` : '',
      '',
      '## Archive Files',
      htmlFile ? `- HTML: /ge-dms-archive/${htmlFile}` : '- HTML: Not captured',
      textFile ? `- Text: /ge-dms-archive/${textFile}` : '- Text: Not captured',
      '',
      '## Notes',
      '- Review the screenshot + HTML to document fields and workflow steps.',
      '',
    ]
      .filter(Boolean)
      .join('\n');

    await fs.writeFile(path.resolve(docsPagesDir, filename), content);
  }
};

const writeArchiveIndex = async (pages) => {
  const lines = [
    '# GE DMS UI Archive Index',
    '',
    'Generated from `.ge-dms-archive/index.jsonl`.',
    '',
    '| Page | URL | Status | Exports | Doc |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const entry of pages) {
    const status = entry.title && entry.title.toLowerCase().includes('404') ? 'Not Found' : 'OK';
    const slug = slugify(entry.url || entry.title || 'page');
    const filename = `${slug}.md`;
    const exportsList = (entry.exportButtons || []).filter(Boolean);
    const exportsText = exportsList.length ? exportsList.join(', ') : 'None';

    lines.push(
      `| ${entry.title || slug} | ${entry.url || ''} | ${status} | ${exportsText} | docs/ge-dms/pages/${filename} |`
    );
  }

  await fs.writeFile(path.resolve(repoRoot, 'docs', 'ge-dms', 'archive-index.md'), lines.join('\n') + '\n');
};

const run = async () => {
  await ensureDir(publicDir);
  const pages = await readIndex();
  await copyArchiveFiles();
  await writePageDocs(pages);
  await writeArchiveIndex(pages);
  console.log(`Published ${pages.length} pages to public/ge-dms-archive.`);
};

run().catch((error) => {
  console.error('Failed to publish GE DMS archive:', error instanceof Error ? error.message : error);
  process.exit(1);
});
