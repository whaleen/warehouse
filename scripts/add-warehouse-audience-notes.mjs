import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const warehouseDir = path.resolve(repoRoot, 'docs', 'warehouse');

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
      'Use this as the entry point for Warehouse app scope and navigation.',
      'Link out to detailed pages for each workflow.',
    ],
    [
      'Start here to choose the right area in the app.',
    ],
    [
      'Use this for high-level app guidance; defer details to linked docs.',
    ]
  )],
  ['inventory.md', makeNotes(
    [
      'Inventory is the canonical search UI (serial/CSO/model).',
      'Use this when building inventory lookup endpoints.',
    ],
    [
      'Use Inventory to find a unit by serial/CSO/model.',
    ],
    [
      'Prefer Inventory for item lookups and filters.',
    ]
  )],
  ['scanning.md', makeNotes(
    [
      'Scanning writes GPS markers; Fog of War validates inventory.',
      'Use this to map scanner events to DB writes.',
    ],
    [
      'Use scanning to record locations; Fog of War needs valid serial/CSO.',
    ],
    [
      'Answer scanner questions from this doc only.',
    ]
  )],
  ['scanning-sessions.md', makeNotes(
    [
      'Sessions are scanner-managed; no dedicated UI page.',
    ],
    [
      'Use the Map scanner; there is no Sessions page.',
    ],
    [
      'Do not mention Sessions page; reference Map scanner.',
    ]
  )],
  ['warehouse-map.md', makeNotes(
    [
      'Map renders scan markers only (no warehouse layout).',
      'Inventory drawer toggles loads/buckets.',
    ],
    [
      'Use the map to locate last scanned items.',
    ],
    [
      'Do not claim filters/search/aisles; use this doc only.',
    ]
  )],
  ['loads.md', makeNotes(
    [
      'Loads map to sub-inventory and GE load metadata.',
      'Prep flags and sanity checks are key workflow fields.',
    ],
    [
      'Use Loads to prepare sold/pickup loads and update prep flags.',
    ],
    [
      'Use this for load prep and status questions.',
    ]
  )],
  ['actions.md', makeNotes(
    [
      'Actions derive from load status + sessions.',
    ],
    [
      'Use Actions to see priority prep and scan tasks.',
    ],
    [
      'Use Actions to answer “what should I do next”.',
    ]
  )],
  ['dashboard.md', makeNotes(
    [
      'Dashboard is summary-only, not the source of truth.',
    ],
    [
      'Use Dashboard for high-level counts and links.',
    ],
    [
      'Avoid detailed data claims; point to Inventory/Loads.',
    ]
  )],
  ['activity.md', makeNotes(
    [
      'Activity log shows sync and load updates.',
    ],
    [
      'Use Activity to audit recent changes.',
    ],
    [
      'Use for “what changed” questions.',
    ]
  )],
  ['settings.md', makeNotes(
    [
      'Settings controls SSO creds, locations, users, displays.',
    ],
    [
      'Use Settings to update location or user info.',
    ],
    [
      'Use Settings for “where do I configure X”.',
    ]
  )],
  ['troubleshooting.md', makeNotes(
    [
      'Use this to document known failure modes.',
    ],
    [
      'Use this for quick fixes and next steps.',
    ],
    [
      'If issue not listed, say unknown.',
    ]
  )],
  ['glossary.md', makeNotes(
    [
      'Keep terms consistent with GE DMS exports.',
    ],
    [
      'Use this to decode acronyms.',
    ],
    [
      'Use to avoid ambiguous terms.',
    ]
  )],
]);

const makeGenericNotes = () => makeNotes(
  ['WIP: Add developer mapping and data sources.'],
  ['WIP: Add user-facing steps and UI references.'],
  ['WIP: Add verified facts for agent responses.']
);

const stripExistingNotes = (content) => {
  const regex = new RegExp(`\n${noteHeader}[\s\S]*$`, 'm');
  return content.replace(regex, '').trimEnd();
};

const run = async () => {
  const entries = await fs.readdir(warehouseDir);
  const markdownFiles = entries.filter((file) => file.endsWith('.md'));
  let updated = 0;

  for (const file of markdownFiles) {
    const fullPath = path.join(warehouseDir, file);
    const content = await fs.readFile(fullPath, 'utf8');
    const stripped = stripExistingNotes(content);
    const notes = docSpecific.get(file) ?? makeGenericNotes();
    const next = `${stripped}\n\n${notes}`;
    await fs.writeFile(fullPath, next);
    updated += 1;
  }

  console.log(`Updated ${updated} Warehouse docs with audience notes.`);
};

run().catch((error) => {
  console.error('Failed to add warehouse audience notes:', error instanceof Error ? error.message : error);
  process.exit(1);
});
