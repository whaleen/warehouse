export type AppView =
  | 'login'
  | 'reset-password'
  | 'update-password'
  | 'signup'
  | 'dashboard'
  | 'inventory'
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
  | 'sessions'
  | 'floor-display'
  | 'map'
  | 'agent';

export type RouteState = {
  view: AppView;
  sessionId?: string | null;
  displayId?: string | null;
};

const baseSessionPath = '/scanning-sessions';

export function getPathForView(view: AppView, sessionId?: string | null, displayId?: string | null): string {
  if (view === 'sessions') {
    if (sessionId) return `${baseSessionPath}/${sessionId}`;
    return baseSessionPath;
  }
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
    case 'parts':
      return '/parts';
    case 'products':
      return '/products';
    case 'loads':
      return '/loads';
    case 'activity':
      return '/activity';
    case 'map':
      return '/map';
    case 'agent':
      return '/agent';
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
    case 'parts':
      return { view: 'parts' };
    case 'products':
      return { view: 'products' };
    case 'loads':
      return { view: 'loads' };
    case 'activity':
      return { view: 'activity' };
    case 'map':
      return { view: 'map' };
    case 'agent':
      return { view: 'agent' };
    case 'scanning-sessions':
    case 'sessions':
      return { view: 'sessions', sessionId: second ?? null };
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
