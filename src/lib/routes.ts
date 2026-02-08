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
};

export function getPathForView(view: AppView, _sessionId?: string | null, displayId?: string | null): string {
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
      return '/update-password';
    case 'signup':
      return '/signup';
    case 'dashboard':
      return '/';
    case 'inventory':
      return '/inventory';
    case 'inventory-guide':
      return '/inventory-guide';
    case 'parts':
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

  const [first, second ] = segments;

  switch (first) {
    case 'login':
      return { view: 'login' };
    case 'reset-password':
      return { view: 'reset-password' };
    case 'update-password':
      return { view: 'update-password' };
    case 'signup':
      return { view: 'signup' };
    case 'app':
    case 'dashboard':
      return { view: 'dashboard' };
    case 'inventory':
      return { view: 'inventory' };
    case 'inventory-guide':
      return { view: 'inventory-guide' };
    case 'parts':
      return { view: 'parts' };
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
    case 'docs':
      return { view: 'docs' };
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
          return { view: 'settings-displays' };
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
