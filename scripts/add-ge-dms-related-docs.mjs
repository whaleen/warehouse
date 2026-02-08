import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const pagesDir = path.resolve(repoRoot, 'docs', 'ge-dms', 'pages');

const docLink = (label, docPath) => {
  const encoded = encodeURIComponent(docPath);
  return `- ${label}: [/docs?doc=${encoded}](/docs?doc=${encoded})`;
};

const baseLinks = [
  '## Related Docs',
  docLink('GE DMS Overview', 'docs/ge-dms/overview.md'),
  docLink('GE DMS Exports', 'docs/ge-dms/exports.md'),
  docLink('GE DMS Workflows', 'docs/ge-dms/workflows.md'),
  docLink('GE DMS Archive Index', 'docs/ge-dms/archive-index.md'),
];

const addLinks = (links) => [...baseLinks, ...links, ''].join('\n');

const relatedMap = {
  'dms-erp-aws-prd-geappliances-com-dms-tracktrace.md': addLinks([
    docLink('Order Download', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-orderdata.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-orderdata.md': addLinks([
    docLink('Track & Trace', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-tracktrace.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-checkin.md': addLinks([
    docLink('Downloads', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md'),
    docLink('Inbound', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-inbound.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-inbound.md': addLinks([
    docLink('Downloads', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md'),
    docLink('Check In', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-checkin.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md': addLinks([
    docLink('Check In', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-checkin.md'),
    docLink('Inbound', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-inbound.md'),
    docLink('Parking Lot', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-parkinglot.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-reportsummary.md': addLinks([
    docLink('Downloads', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-parkinglot.md': addLinks([
    docLink('Downloads', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-checkin-downloadsindex.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-openorderreport.md': addLinks([
    docLink('Order Download', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-orderdata.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-newasis.md': addLinks([
    docLink('Backhaul', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-backhaul.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-backhaul.md': addLinks([
    docLink('ASIS', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-newasis.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-truckstatus.md': addLinks([
    docLink('Warehouse Exception Report', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-truckstatus-warehouse-exception-report.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-truckstatus-warehouse-exception-report.md': addLinks([
    docLink('Truck Status', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-truckstatus.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-pod-search.md': addLinks([
    docLink('Track & Trace', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-tracktrace.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-erpcheckinventory.md': addLinks([
    docLink('Cycle Count Inv Orgs', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-cyclecount-invorgs.md'),
  ]),
  'dms-erp-aws-prd-geappliances-com-dms-cyclecount-invorgs.md': addLinks([
    docLink('ERP On Hand Qty', 'docs/ge-dms/pages/dms-erp-aws-prd-geappliances-com-dms-erpcheckinventory.md'),
  ]),
};

const defaultRelatedBlock = addLinks([]);

const run = async () => {
  const entries = await fs.readdir(pagesDir);
  const markdownFiles = entries.filter((entry) => entry.endsWith('.md'));
  let updated = 0;

  for (const file of markdownFiles) {
    const filePath = path.join(pagesDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const stripped = content.replace(/\n## Related Docs[\s\S]*$/, '\n').trimEnd();
    const relatedBlock = relatedMap[file] ?? defaultRelatedBlock;
    const nextContent = `${stripped}\n\n${relatedBlock}`;
    await fs.writeFile(filePath, nextContent);
    updated += 1;
  }

  console.log(`Updated ${updated} GE DMS archive pages.`);
};

run().catch((error) => {
  console.error('Failed to add related docs:', error instanceof Error ? error.message : error);
  process.exit(1);
});
