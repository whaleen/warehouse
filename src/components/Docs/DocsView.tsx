import { useEffect, useMemo, useState, useRef } from 'react';
import "@assistant-ui/react-markdown/styles/dot.css";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppHeader } from '@/components/Navigation/AppHeader';
import { PageContainer } from '@/components/Layout/PageContainer';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type DocEntry = {
  id: string;
  title: string;
  displayTitle: string;
  path: string;
  content: string;
  group: string;
};

type SearchResult = DocEntry & {
  snippet?: string;
};

const docModules = import.meta.glob(
  [
    '../../../docs/**/*.md',
    '../../../README.md',
    '../../../services/ge-sync/README.md',
    '../../../services/ge-sync/src/scripts/README.md',
    '../../../src/components/Map/README.md',
  ],
  { as: 'raw', eager: true }
) as Record<string, string>;

const ACRONYMS = new Set(['ge', 'dms', 'api', 'ui', 'erp', 'fg', 'sta', 'asis', 'cso']);

const toTitle = (segment: string) => {
  return segment
    .replace(/\.md$/, '')
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      const normalized = word.toLowerCase();
      if (ACRONYMS.has(normalized)) return normalized.toUpperCase();
      return word[0]?.toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const extractTitle = (content: string, fallback: string) => {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.replace(/^#\s+/, '').trim();
    }
  }
  return fallback;
};

const getGroupLabel = (docPath: string) => {
  // Key overview docs go in "Start Here"
  if (docPath === 'README.md') return 'Start Here';
  if (docPath === 'services/ge-sync/README.md') return 'Start Here';
  if (docPath === 'services/ge-sync/src/scripts/README.md') return 'Start Here';
  if (docPath === 'src/components/Map/README.md') return 'Start Here';

  // Specific doc sections
  if (docPath.startsWith('docs/warehouse/')) return 'Warehouse';
  if (docPath.startsWith('docs/ge-dms/')) {
    if (docPath.includes('/pages/')) return 'GE DMS / Archive';
    return 'GE DMS';
  }
  if (docPath.startsWith('docs/agent/')) return 'Agent';
  if (docPath.startsWith('docs/features/')) return 'Features';
  if (docPath.startsWith('docs/architecture/')) return 'Architecture';
  if (docPath.startsWith('docs/')) return 'Docs';
  if (docPath.startsWith('services/')) return 'Services';
  if (docPath.startsWith('src/')) return 'Source';
  return 'Other';
};

const buildDocs = (): DocEntry[] => {
  return Object.entries(docModules)
    .map(([fullPath, content]) => {
      // Extract clean relative path
      const parts = fullPath.split('../../../')[1] || fullPath;
      const docPath = parts.replace(/^\//, '');

      const segments = docPath.split('/');
      const group = getGroupLabel(docPath);
      const title = segments.map(toTitle).join(' / ');
      const displayTitle = extractTitle(content, title);

      return {
        id: docPath, // Unique ID for each file
        title,
        displayTitle,
        path: docPath,
        content,
        group,
      };
    })
    .sort((a, b) => {
      // Sort by group first, then by displayTitle within group
      if (a.group !== b.group) {
        // Custom group ordering: Start Here first, then alphabetical
        if (a.group === 'Start Here') return -1;
        if (b.group === 'Start Here') return 1;
        return a.group.localeCompare(b.group);
      }
      return a.displayTitle.localeCompare(b.displayTitle);
    });
};

const allDocs = buildDocs();

const extractSnippet = (content: string, query: string, maxLength = 150): string => {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);

  if (index === -1) return '';

  const contextRadius = Math.floor(maxLength / 2);
  const start = Math.max(0, index - contextRadius);
  const end = Math.min(content.length, index + query.length + contextRadius);

  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  if (snippet.length > maxLength) {
    snippet = `${snippet.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  return snippet;
};

const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

interface DocsViewProps {
  docPath?: string | null;
}

export function DocsView({ docPath }: DocsViewProps) {
  const [search, setSearch] = useState('');
  const [activeDocId, setActiveDocId] = useState<string>(() => {
    // Try path-based parameter first, then fall back to query param for backward compatibility
    if (docPath) return docPath;
    const params = new URLSearchParams(window.location.search);
    return params.get('doc') ?? allDocs[0]?.id ?? '';
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const syncFromUrl = () => {
      // Extract doc path from URL pathname
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      // Path structure: /docs/:group/:page -> segments[1+]
      const pathBasedDoc = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : null;

      // Fall back to query param for backward compatibility
      const params = new URLSearchParams(window.location.search);
      const queryBasedDoc = params.get('doc');

      const next = pathBasedDoc || queryBasedDoc;
      if (next && next !== activeDocId) {
        setActiveDocId(next);
      }
    };
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('app:locationchange', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('app:locationchange', syncFromUrl);
    };
  }, [activeDocId]);

  const filteredDocs = useMemo<SearchResult[]>(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allDocs;

    return allDocs
      .filter((doc) =>
        doc.title.toLowerCase().includes(query) ||
        doc.path.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query)
      )
      .map((doc) => {
        // Extract snippet if match is in content
        const snippet = doc.content.toLowerCase().includes(query)
          ? extractSnippet(doc.content, query)
          : undefined;
        return { ...doc, snippet };
      });
  }, [search]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const activeDoc = useMemo<DocEntry | null>(
    () => allDocs.find((doc) => doc.id === activeDocId) ?? filteredDocs[0] ?? null,
    [activeDocId, filteredDocs]
  );

  useEffect(() => {
    if (!activeDoc) return;

    // Build path-based URL: /docs/:group/:page
    const currentPath = window.location.pathname;
    const expectedPath = `/docs/${activeDoc.id}`;

    // Only update if path changed
    if (currentPath === expectedPath) return;

    // Preserve query params (like ?from=dashboard)
    const params = new URLSearchParams(window.location.search);
    params.delete('doc'); // Remove legacy query param
    const query = params.toString();
    const nextUrl = query ? `${expectedPath}?${query}` : expectedPath;

    window.history.replaceState({}, '', nextUrl);
    window.dispatchEvent(new Event('app:locationchange'));
  }, [activeDoc]);

  const groupedDocs = useMemo<Array<[string, SearchResult[]]>>(() => {
    const groups = new Map<string, SearchResult[]>();
    filteredDocs.forEach((doc) => {
      const group = doc.group;
      const list = groups.get(group) ?? [];
      list.push(doc);
      groups.set(group, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => {
      // Start Here always first
      if (a === 'Start Here') return -1;
      if (b === 'Start Here') return 1;
      return a.localeCompare(b);
    });
  }, [filteredDocs]);

  const handleSelectDoc = (doc: DocEntry) => {
    setActiveDocId(doc.id);
  };

  const handleCopyPath = async () => {
    if (!activeDoc) return;
    try {
      await navigator.clipboard?.writeText(activeDoc.path);
    } catch {
      // Ignore clipboard errors
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if search input is focused
      const isSearchFocused = document.activeElement?.tagName === 'INPUT';
      if (!isSearchFocused || filteredDocs.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredDocs.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedDoc = filteredDocs[selectedIndex];
        if (selectedDoc) {
          handleSelectDoc(selectedDoc);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredDocs, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    selectedButtonRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }, [selectedIndex]);

  const markdownComponents = useMemo(() => ({
    h1: ({ className, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
      <h1 className={cn('scroll-m-20 text-2xl font-semibold tracking-tight mt-6 first:mt-0', className)} {...props} />
    ),
    h2: ({ className, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
      <h2 className={cn('scroll-m-20 text-xl font-semibold tracking-tight mt-6 first:mt-0', className)} {...props} />
    ),
    h3: ({ className, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
      <h3 className={cn('scroll-m-20 text-lg font-semibold tracking-tight mt-5 first:mt-0', className)} {...props} />
    ),
    p: ({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
      <p className={cn('leading-6 mt-3 first:mt-0', className)} {...props} />
    ),
    ul: ({ className, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
      <ul className={cn('mt-3 space-y-1.5 list-disc pl-5', className)} {...props} />
    ),
    ol: ({ className, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
      <ol className={cn('mt-3 space-y-1.5 list-decimal pl-5', className)} {...props} />
    ),
    li: ({ className, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
      <li className={cn('leading-6', className)} {...props} />
    ),
    a: ({ className, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
      <a className={cn('text-primary underline underline-offset-4', className)} {...props} />
    ),
    blockquote: ({ className, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote className={cn('mt-4 border-l-2 border-border pl-4 text-muted-foreground italic', className)} {...props} />
    ),
    code: ({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) => (
      <code className={cn('rounded bg-muted px-1.5 py-0.5 text-xs font-mono', className)} {...props} />
    ),
    pre: ({ className, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
      <pre className={cn('mt-4 rounded-lg border border-border/60 bg-muted/50 p-3 text-xs overflow-x-auto', className)} {...props} />
    ),
    table: ({ className, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
      <div className="mt-4 w-full overflow-x-auto">
        <table className={cn('w-full border-collapse text-sm', className)} {...props} />
      </div>
    ),
    th: ({ className, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
      <th className={cn('border border-border/60 bg-muted/60 px-2 py-1 text-left text-xs font-semibold', className)} {...props} />
    ),
    td: ({ className, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
      <td className={cn('border border-border/60 px-2 py-1 align-top text-xs', className)} {...props} />
    ),
  }), []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Docs" />
      <PageContainer className="py-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="p-4 space-y-4 h-fit">
            <div>
              <div className="text-sm font-semibold">Documentation</div>
              <div className="text-xs text-muted-foreground">
                Source: docs/agent
              </div>
            </div>
            <Input
              placeholder="Search docs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {groupedDocs.map(([group, docs]) => {
                // Calculate global index for each doc
                const groupStartIndex = filteredDocs.findIndex((d) => d.id === docs[0]?.id);
                return (
                  <div key={group} className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {group}
                    </div>
                    <div className="space-y-1">
                      {docs.map((doc, localIndex) => {
                        const globalIndex = groupStartIndex + localIndex;
                        const isKeyboardSelected = globalIndex === selectedIndex && !!search.trim();
                        const isActive = activeDoc?.id === doc.id;

                        return (
                          <button
                            key={doc.id}
                            ref={isKeyboardSelected ? selectedButtonRef : undefined}
                            type="button"
                            className={cn(
                              'w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                              isActive
                                ? 'bg-accent text-foreground'
                                : isKeyboardSelected
                                ? 'ring-2 ring-primary text-foreground'
                                : 'text-muted-foreground hover:bg-accent/50'
                            )}
                            onClick={() => handleSelectDoc(doc)}
                          >
                            <div className="font-medium">
                              {search.trim()
                                ? highlightMatch(doc.displayTitle, search.trim())
                                : doc.displayTitle}
                            </div>
                            {doc.snippet && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {highlightMatch(doc.snippet, search.trim())}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {filteredDocs.length === 0 && (
                <div className="text-sm text-muted-foreground">No docs match that search.</div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            {activeDoc ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{activeDoc.title}</div>
                    <div className="text-xs text-muted-foreground">{activeDoc.path}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCopyPath}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Path
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/20 p-4 text-sm">
                  <ReactMarkdown className="aui-md" remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {activeDoc.content.trim()}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No docs available.</div>
            )}
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
