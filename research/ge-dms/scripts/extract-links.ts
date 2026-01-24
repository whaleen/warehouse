import * as fs from 'fs';

interface LinkInfo {
  category: string;
  name: string;
  url: string;
  tooltip: string;
}

// Read the captured HTML
const htmlPath = './browse-session/1769120425281-nav-4.html';
const html = fs.readFileSync(htmlPath, 'utf-8');

const links: LinkInfo[] = [];

// Parse the HTML to find all ge_delivers tables
const tableRegex = /<table id="ge_delivers"[^>]*>(.*?)<\/table>/gs;
const tables = [...html.matchAll(tableRegex)];

for (const tableMatch of tables) {
  const tableHtml = tableMatch[1];

  // Get category from thead
  const headerMatch = tableHtml.match(/<thead>.*?<td[^>]*>(.*?)<\/td>.*?<\/thead>/s);
  if (!headerMatch) continue;

  const category = headerMatch[1].trim().replace(/<[^>]*>/g, '');

  // Skip the "Links" column
  if (category === 'Links') {
    continue;
  }

  // Extract all links in tbody
  const linkRegex = /<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gs;
  const linkMatches = [...tableHtml.matchAll(linkRegex)];

  for (const linkMatch of linkMatches) {
    let url = linkMatch[1];
    const linkInner = linkMatch[2];

    // Extract the link text (skip the img tag)
    const nameMatch = linkInner.match(/>([^<]+)$/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim().replace(/\s+/g, ' ');

    // Extract tooltip from img alt
    const tooltipMatch = linkInner.match(/<img[^>]+alt="([^"]+)"/);
    const tooltip = tooltipMatch ? tooltipMatch[1] : '';

    // Handle javascript: links
    if (url.startsWith('javascript:')) {
      // Extract the actual page from postGotoPage calls
      const postGotoMatch = url.match(/postGotoPage\('([^']+)'\)/);
      if (postGotoMatch) {
        url = `/dms/${postGotoMatch[1]}`;
      }
    }

    links.push({
      category,
      name,
      url,
      tooltip
    });
  }
}

// Generate markdown checklist
let markdown = '# GE DMS Pages Checklist\n\n';
markdown += 'Check off pages you don\'t need, or add notes about what they\'re for.\n\n';

const categories = [...new Set(links.map(l => l.category))];

categories.forEach(category => {
  markdown += `## ${category}\n\n`;

  const categoryLinks = links.filter(l => l.category === category);
  categoryLinks.forEach(link => {
    markdown += `- [ ] **${link.name}**\n`;
    markdown += `  - URL: \`${link.url}\`\n`;
    if (link.tooltip) {
      markdown += `  - Description: ${link.tooltip}\n`;
    }
    markdown += `  - Notes: \n\n`;
  });
});

fs.writeFileSync('./ge-dms-pages-checklist.md', markdown);
console.log('✅ Checklist created: ge-dms-pages-checklist.md');

// Also save as JSON for programmatic use
fs.writeFileSync('./ge-dms-pages.json', JSON.stringify(links, null, 2));
console.log('✅ JSON data saved: ge-dms-pages.json');

console.log(`\n📊 Total pages to review: ${links.length}`);
console.log('\nBreakdown:');
categories.forEach(category => {
  const count = links.filter(l => l.category === category).length;
  console.log(`  ${category}: ${count} pages`);
});
