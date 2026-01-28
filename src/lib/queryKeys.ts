export const queryKeys = {
  loads: {
    all: (locationId: string) => ['loads', locationId] as const,
    byType: (locationId: string, type: string) => ['loads', locationId, type] as const,
    detail: (locationId: string, type: string, name: string) =>
      ['loads', locationId, type, name] as const,
    count: (locationId: string, type: string, name: string) =>
      ['loads', locationId, type, name, 'count'] as const,
    conflicts: (locationId: string, type: string, name: string) =>
      ['loads', locationId, type, name, 'conflicts'] as const,
  },
  parts: {
    all: (locationId: string) => ['parts', locationId] as const,
    tracked: (locationId: string) => ['parts', locationId, 'tracked'] as const,
    alerts: (locationId: string) => ['parts', locationId, 'alerts'] as const,
    history: (locationId: string, productId?: string, days?: number) =>
      ['parts', locationId, 'history', productId, days] as const,
    available: (locationId: string, searchTerm?: string) =>
      ['parts', locationId, 'available', searchTerm] as const,
  },
  inventory: {
    all: (locationId: string) => ['inventory', locationId] as const,
    byType: (locationId: string, type: string) => ['inventory', locationId, type] as const,
    stats: (locationId: string) => ['inventory', locationId, 'stats'] as const,
  },
  activity: {
    all: (locationId: string) => ['activity', locationId] as const,
  },
  displays: {
    all: (locationId: string) => ['displays', locationId] as const,
    detail: (locationId: string, displayId: string) => ['displays', locationId, displayId] as const,
  },
  sessions: {
    all: (locationId: string) => ['sessions', locationId] as const,
    detail: (locationId: string, sessionId: string) => ['sessions', locationId, sessionId] as const,
  },
  products: {
    search: (searchTerm: string) => ['products', 'search', searchTerm] as const,
    detail: (productId: string) => ['products', productId] as const,
  },
} as const;
