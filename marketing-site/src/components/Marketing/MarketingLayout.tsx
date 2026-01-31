import { Button } from "@/components/ui/button";
import { WarehouseLogo } from "@/components/Brand/WarehouseLogo";
import { getAppUrl } from "@/lib/appLinks";

// Color palette for loads - edit these to refine contrast
// Export for use in other marketing components
export const COLOR_PALETTE = [
  { label: 'Red', value: '#E53935' },
  { label: 'Red-Orange', value: '#F4511E' },
  { label: 'Orange', value: '#FB8C00' },
  { label: 'Yellow-Orange', value: '#F9A825' },
  { label: 'Yellow', value: '#FDD835' },
  { label: 'Yellow-Green', value: '#C0CA33' },
  { label: 'Green', value: '#43A047' },
  { label: 'Blue-Green', value: '#009688' },
  { label: 'Blue', value: '#1E88E5' },
  { label: 'Blue-Violet', value: '#5E35B1' },
  { label: 'Violet', value: '#8E24AA' },
  { label: 'Red-Violet', value: '#D81B60' },
];

// Named color shortcuts for easy use
export const COLORS = {
  red: '#E53935',
  redOrange: '#F4511E',
  orange: '#FB8C00',
  yellowOrange: '#F9A825',
  yellow: '#FDD835',
  yellowGreen: '#C0CA33',
  green: '#43A047',
  blueGreen: '#009688',
  blue: '#1E88E5',
  blueViolet: '#5E35B1',
  violet: '#8E24AA',
  redViolet: '#D81B60',
};

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white marketing-root">
      <MarketingHeader />
      <ColorSwatchBar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}

function ColorSwatchBar() {
  return (
    <div
      className="sticky top-16 z-40 h-2 w-full grid grid-cols-12"
    >
      {COLOR_PALETTE.map((color) => (
        <div
          key={color.value}
          className="h-full relative group cursor-pointer"
          style={{ backgroundColor: color.value }}
          title={`${color.label}: ${color.value}`}
        >
        </div>
      ))}
    </div>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <WarehouseLogo className="h-9 w-9 text-gray-900" aria-hidden="true" />
            <span className="text-xl font-bold text-gray-900">Warehouse</span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <a
              href="/features"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Features
            </a>
            <a
              href="/pricing"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <a href={getAppUrl("/login")}>
              <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                Sign in
              </Button>
            </a>
            <a href={getAppUrl("/signup")}>
              <Button
                size="sm"
                style={{
                  background: `linear-gradient(to right, ${COLORS.blue}, ${COLORS.blueViolet})`,
                }}
                className="text-white shadow-lg hover:opacity-90"
              >
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <WarehouseLogo className="h-8 w-8 text-gray-900" aria-hidden="true" />
            <span className="font-semibold text-gray-900">Warehouse</span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-gray-600">
            <a href="/features" className="hover:text-gray-900 transition-colors">
              Features
            </a>
            <a href="/pricing" className="hover:text-gray-900 transition-colors">
              Pricing
            </a>
          </nav>

          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Warehouse. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
