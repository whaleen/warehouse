export type AppView =
  | 'login'
  | 'reset-password'
  | 'update-password'
  | 'signup'
  | 'dashboard'
  | 'inventory'
  | 'inventory-guide'
  | 'parts'
  | 'products'
  | 'settings-locations'
  | 'settings-location'
  | 'settings-company'
  | 'settings-users'
  | 'settings-profile'
  | 'settings-displays'
  | 'settings-gesync'
  | 'loads'
  | 'activity'
  | 'actions'
  | 'floor-display'
  | 'map'
  | 'agent'
  | 'data-quality'
  | 'docs';

export type RouteState = {
  view: AppView;
  sessionId?: string | null;
  displayId?: string | null;
  // Path-based parameters
  docPath?: string | null;        // docs/:group/:page → "group/page"
  inventoryType?: string | null;  // inventory/:type → "asis", "fg", etc.
  partsTab?: string | null;       // parts/:tab → "inventory", "history"
  displaySettingsId?: string | null; // settings/displays/:id
  resetToken?: string | null;     // update-password/:token
};

export function getPathForView(
  view: AppView,
  _sessionId?: string | null,
  displayId?: string | null,
  options?: {
    docPath?: string | null;
    inventoryType?: string | null;
    partsTab?: string | null;
    displaySettingsId?: string | null;
    resetToken?: string | null;
  }
): string {
  if (view === 'floor-display') {
    if (displayId) return `/display/${displayId}`;
    return '/display';
  }

  switch (view) {
    case 'login':
      return '/login';
    case 'reset-password':
      return '/reset-password';
    case 'update-password':
      if (options?.resetToken) return `/update-password/${options.resetToken}`;
      return '/update-password';
    case 'signup':
      return '/signup';
    case 'dashboard':
      return '/';
    case 'inventory':
      if (options?.inventoryType) return `/inventory/${options.inventoryType.toLowerCase()}`;
      return '/inventory';
    case 'inventory-guide':
      return '/inventory-guide';
    case 'parts':
      if (options?.partsTab) return `/parts/${options.partsTab}`;
      return '/parts';
    case 'products':
      return '/products';
    case 'loads':
      return '/loads';
    case 'activity':
      return '/activity';
    case 'actions':
      return '/actions';
    case 'map':
      return '/map';
    case 'agent':
      return '/agent';
    case 'data-quality':
      return '/data-quality';
    case 'docs':
      if (options?.docPath) return `/docs/${options.docPath}`;
      return '/docs';
    case 'settings-locations':
      return '/settings/locations';
    case 'settings-location':
      return '/settings/location';
    case 'settings-company':
      return '/settings/company';
    case 'settings-users':
      return '/settings/users';
    case 'settings-profile':
      return '/settings/profile';
    case 'settings-displays':
      if (options?.displaySettingsId) return `/settings/displays/${options.displaySettingsId}`;
      return '/settings/displays';
    case 'settings-gesync':
      return '/settings/gesync';
    default:
      return '/';
  }
}

export function parseRoute(pathname: string): RouteState {
  const normalized = pathname.replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) {
    return { view: 'dashboard' };
  }

  const [first, second, third] = segments;

  switch (first) {
    case 'login':
      return { view: 'login' };
    case 'reset-password':
      return { view: 'reset-password' };
    case 'update-password':
      // Support /update-password/:token for path-based reset tokens
      return { view: 'update-password', resetToken: second ?? null };
    case 'signup':
      return { view: 'signup' };
    case 'app':
    case 'dashboard':
      return { view: 'dashboard' };
    case 'inventory':
      // Support /inventory/:type for path-based type filtering
      return { view: 'inventory', inventoryType: second ?? null };
    case 'inventory-guide':
      return { view: 'inventory-guide' };
    case 'parts':
      // Support /parts/:tab for path-based tab navigation
      return { view: 'parts', partsTab: second ?? null };
    case 'products':
      return { view: 'products' };
    case 'loads':
      return { view: 'loads' };
    case 'activity':
      return { view: 'activity' };
    case 'actions':
      return { view: 'actions' };
    case 'map':
      return { view: 'map' };
    case 'agent':
      return { view: 'agent' };
    case 'data-quality':
      return { view: 'data-quality' };
    case 'docs': {
      // Support /docs/:group/:page... for hierarchical doc paths
      // Extract everything after /docs/ as the doc path
      const docPath = segments.slice(1).join('/');
      return { view: 'docs', docPath: docPath || null };
    }
    case 'settings':
      switch (second) {
        case 'location':
          return { view: 'settings-location' };
        case 'company':
          return { view: 'settings-company' };
        case 'users':
          return { view: 'settings-users' };
        case 'profile':
          return { view: 'settings-profile' };
        case 'displays':
          // Support /settings/displays/:id for path-based display selection
          return { view: 'settings-displays', displaySettingsId: third ?? null };
        case 'gesync':
          return { view: 'settings-gesync' };
        case 'locations':
        case undefined:
          return { view: 'settings-locations' };
        default:
          return { view: 'settings-locations' };
      }
    case 'display':
      return { view: 'floor-display', displayId: second ?? null };
    default:
      return { view: 'dashboard' };
  }
}

export function isPublicRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '');
  return (
    normalized.startsWith('/login') ||
    normalized.startsWith('/reset-password') ||
    normalized.startsWith('/update-password') ||
    normalized.startsWith('/signup') ||
    normalized.startsWith('/display')
  );
}
