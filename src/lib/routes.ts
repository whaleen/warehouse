export type AppView =
  | 'dashboard'
  | 'inventory'
  | 'parts'
  | 'products'
  | 'settings-locations'
  | 'settings-company'
  | 'settings-users'
  | 'settings-displays-setup'
  | 'settings-displays-list'
  | 'settings-displays-settings'
  | 'loads'
  | 'create-load'
  | 'create-session'
  | 'floor-display';

export type RouteState = {
  view: AppView;
  sessionId?: string | null;
  displayId?: string | null;
};

const baseSessionPath = '/scanning-sessions';

export function getPathForView(view: AppView, sessionId?: string | null, displayId?: string | null): string {
  if (view === 'create-load') return '/loads/new';
  if (view === 'create-session') {
    if (sessionId) return `${baseSessionPath}/${sessionId}`;
    return baseSessionPath;
  }
  if (view === 'floor-display') {
    if (displayId) return `/display/${displayId}`;
    return '/display';
  }

  switch (view) {
    case 'dashboard':
      return '/';
    case 'inventory':
      return '/inventory';
    case 'parts':
      return '/parts';
    case 'products':
      return '/products';
    case 'loads':
      return '/loads';
    case 'settings-locations':
      return '/settings/locations';
    case 'settings-company':
      return '/settings/company';
    case 'settings-users':
      return '/settings/users';
    case 'settings-displays-setup':
      return '/settings/displays/setup';
    case 'settings-displays-list':
      return '/settings/displays/list';
    case 'settings-displays-settings':
      return '/settings/displays/settings';
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
    case 'dashboard':
      return { view: 'dashboard' };
    case 'inventory':
      return { view: 'inventory' };
    case 'parts':
      return { view: 'parts' };
    case 'products':
      return { view: 'products' };
    case 'loads':
      if (second === 'new') {
        return { view: 'create-load' };
      }
      return { view: 'loads' };
    case 'scanning-sessions':
    case 'sessions':
      return { view: 'create-session', sessionId: second ?? null };
    case 'settings':
      switch (second) {
        case 'company':
          return { view: 'settings-company' };
        case 'users':
          return { view: 'settings-users' };
        case 'displays':
          switch (third) {
            case 'setup':
              return { view: 'settings-displays-setup' };
            case 'settings':
              return { view: 'settings-displays-settings' };
            case 'list':
            case undefined:
              return { view: 'settings-displays-list' };
            default:
              return { view: 'settings-displays-list' };
          }
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
  return pathname.startsWith('/display');
}
