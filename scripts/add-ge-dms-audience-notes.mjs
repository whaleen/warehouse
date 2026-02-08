import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const geDmsDir = path.resolve(repoRoot, 'docs', 'ge-dms');

const noteHeader = '## Audience Notes';

const buildSection = (title, lines) => {
  const body = lines.map((line) => `- ${line}`).join('\n');
  return `### ${title}\n${body}`;
};

const makeNotes = (devLines, opsLines, agentLines) => [
  noteHeader,
  buildSection('For Developers', devLines),
  buildSection('For Operators', opsLines),
  buildSection('For Agent', agentLines),
  '',
].join('\n\n');

const docSpecific = new Map([
  ['overview.md', makeNotes(
    [
      'Use this as the entry point for GE DMS scope and core exports.',
      'Reference the archive index for source URLs and screenshots.',
    ],
    [
      'Start here if you are new to GE DMS navigation.',
      'Use the linked pages to find the right workflow or export.',
    ],
    [
      'Treat this as the top-level navigation summary.',
      'Prefer linked pages for any UI details.',
    ]
  )],
  ['exports.md', makeNotes(
    [
      'This lists all export pages that feed syncs.',
      'Use it to decide which export to integrate next.',
    ],
    [
      'Use exports when you need bulk data.',
      'If a report is missing, the Warehouse app will be stale.',
    ],
    [
      'Use this to choose the correct export source.',
      'Cite the linked page doc when answering export questions.',
    ]
  )],
  ['workflows.md', makeNotes(
    [
      'Use this to map UI workflows to sync requirements.',
      'Each workflow should link to a page doc for UI fields.',
    ],
    [
      'Use this as a quick workflow index.',
      'Jump to the linked page for step details.',
    ],
    [
      'Use this to answer "where do I go" questions.',
      'If a workflow is missing, say it is unknown.',
    ]
  )],
  ['glossary.md', makeNotes(
    [
      'Use this to normalize terms across GE DMS and Warehouse.',
      'Add new terms as they appear in exports.',
    ],
    [
      'Use this to decode acronyms in GE DMS screens.',
    ],
    [
      'Use these terms to avoid ambiguity in responses.',
    ]
  )],
  ['archive-index.md', makeNotes(
    [
      'Use this as the authoritative list of captured pages.',
      '404 entries indicate missing or gated pages.',
    ],
    [
      'Use this to find the exact page you need.',
    ],
    [
      'Prefer pages marked OK for UI details.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-backhaul.md', makeNotes(
    [
      'Open orders come from notComplete=Y; closed list is for historical baseline.',
      'Pick List is the line-item export for ISO detail.',
    ],
    [
      'Use Not Complete for active backhauls; Spreadsheet for completed list.',
      'Use Pick List on ISO detail to see order contents.',
    ],
    [
      'Backhaul list defines open vs closed; Pick List defines line items.',
      'If no open orders, report that clearly.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-tracktrace.md', makeNotes(
    [
      'Use this for CSO lookup when you need customer/order info.',
    ],
    [
      'Fastest way to look up a CSO.',
    ],
    [
      'Answer CSO lookup questions by routing here.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-orderdata.md', makeNotes(
    [
      'Primary export for full order history.',
    ],
    [
      'Use when Track & Trace is not enough.',
    ],
    [
      'Use this for bulk order export questions.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-inbound.md', makeNotes(
    [
      'Inbound summary feeds inbound receipts sync.',
    ],
    [
      'Use for inbound shipment workflow.',
    ],
    [
      'Answer inbound workflow questions from this page.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-checkin.md', makeNotes(
    [
      'Check-in workflow; see Downloads for reports.',
    ],
    [
      'Use for delivery completion steps.',
    ],
    [
      'Use for check-in workflow questions.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md', makeNotes(
    [
      'Operational report hub for inbound/check-in/parking lot.',
    ],
    [
      'Use to download operational reports.',
    ],
    [
      'Use this for report download questions.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-newasis.md', makeNotes(
    [
      'ASIS load list export source.',
    ],
    [
      'Use for ASIS load management exports.',
    ],
    [
      'Use for ASIS export questions.',
    ]
  )],
  ['pages/dms-erp-aws-prd-geappliances-com-dms-erpcheckinventory.md', makeNotes(
    [
      'ERP on-hand inventory export source.',
    ],
    [
      'Use for sub-inventory inventory checks.',
    ],
    [
      'Use for ERP on-hand inventory questions.',
    ]
  )],
]);

const getStatus = (content) => {
  const match = content.match(/\*\*Status:\*\*\s*([^\n]+)/i);
  return match ? match[1].trim() : 'Unknown';
};

const makeGenericNotes = (status) => {
  const statusLine = status && status.toLowerCase().includes('not found')
    ? 'WIP: Page returned 404 during capture; details may be missing.'
    : 'WIP: Add field list, workflow steps, and export details after review.';

  return makeNotes(
    [
      'Use this page for GE DMS UI reference and any exports it provides.',
      statusLine,
    ],
    [
      'Use this page for the operational workflow it represents.',
      statusLine,
    ],
    [
      'Only answer using details verified in this page.',
      statusLine,
    ]
  );
};

const stripExistingNotes = (content) => {
  const regex = new RegExp(`\n${noteHeader}[\s\S]*$`, 'm');
  return content.replace(regex, '').trimEnd();
};

const run = async () => {
  const files = await fs.readdir(geDmsDir, { recursive: true });
  const markdownFiles = files.filter((file) => typeof file === 'string' && file.endsWith('.md'));
  let updated = 0;

  for (const relative of markdownFiles) {
    const fullPath = path.join(geDmsDir, relative);
    const content = await fs.readFile(fullPath, 'utf8');
    const stripped = stripExistingNotes(content);
    const specific = docSpecific.get(relative);
    const notes = specific ?? makeGenericNotes(getStatus(content));
    const next = `${stripped}\n\n${notes}`;
    await fs.writeFile(fullPath, next);
    updated += 1;
  }

  console.log(`Updated ${updated} GE DMS docs with audience notes.`);
};

run().catch((error) => {
  console.error('Failed to add audience notes:', error instanceof Error ? error.message : error);
  process.exit(1);
});
