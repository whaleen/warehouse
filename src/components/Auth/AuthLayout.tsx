import { ArrowLeft } from "lucide-react";
import { WarehouseLogo } from "@/components/Brand/WarehouseLogo";
const COLORS = {
  blue: '#1E88E5',
  blueViolet: '#5E35B1',
};

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(to bottom right, ${COLORS.blue}10, white, ${COLORS.blueViolet}10)`,
      }}
    >
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <WarehouseLogo className="h-9 w-9 text-gray-900" aria-hidden="true" />
              <span className="text-xl font-bold text-gray-900">Warehouse</span>
            </a>

            <a
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div
            className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl"
            style={{ boxShadow: `0 25px 50px -12px ${COLORS.blue}15` }}
          >
            <div className="text-center mb-8">
              <WarehouseLogo className="h-14 w-14 text-gray-900 mx-auto mb-4" title="Warehouse" />
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="mt-2 text-sm text-gray-500">{description}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
