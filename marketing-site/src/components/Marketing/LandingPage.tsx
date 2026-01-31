import { MarketingLayout, COLORS } from "./MarketingLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  RefreshCw,
  LayoutDashboard,
  ScanBarcode,
  Hand,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Signal,
  Wifi,
  ClipboardCheck,
  Truck,
} from "lucide-react";
import { WarehouseLogo } from "@/components/Brand/WarehouseLogo";
import { getAppUrl } from "@/lib/appLinks";

export function LandingPage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <FeaturesOverview />
      <WorkflowSection />
      <AppPreview />
      <CtaSection />
    </MarketingLayout>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom right, ${COLORS.blue}10, white, ${COLORS.blueViolet}10)`,
        }}
      />
      <div className="absolute inset-0 marketing-grid opacity-60 pointer-events-none" />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top right, ${COLORS.blue}15, transparent, transparent)`,
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="text-center lg:text-left">
            <Badge
              variant="secondary"
              className="mb-6 border-0 marketing-fade-up"
              style={{
                backgroundColor: `${COLORS.blue}20`,
                color: COLORS.blue,
                ['--marketing-delay' as string]: "40ms",
              }}
            >
              Pre-Beta &middot; Invite Only
            </Badge>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight marketing-fade-up"
              style={{ ['--marketing-delay' as string]: "90ms" }}
            >
              Your floor companion for{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(to right, ${COLORS.blue}, ${COLORS.blueViolet})`,
                }}
              >
                GE inventory
              </span>
            </h1>

            <p
              className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 marketing-fade-up"
              style={{ ['--marketing-delay' as string]: "140ms" }}
            >
              Save trips to the GE DMS with quick lookups on any item on the floor.
              Real-time data mirroring, unified dashboards, and powerful status
              controls built for warehouse teams.
            </p>

            <div
              className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 marketing-fade-up"
              style={{ ['--marketing-delay' as string]: "190ms" }}
            >
            <a href={getAppUrl("/signup")}>
              <Button
                size="lg"
                className="text-white shadow-lg px-8 hover:opacity-90"
                style={{
                  background: `linear-gradient(to right, ${COLORS.blue}, ${COLORS.blueViolet})`,
                  boxShadow: `0 10px 15px -3px ${COLORS.blue}40`,
                }}
              >
                Request Early Access
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
              <a href="/features">
                <Button size="lg" variant="outline" className="px-8">
                  See Features
                </Button>
              </a>
            </div>

            <div
              className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 text-sm text-gray-500 marketing-fade-up"
              style={{ ['--marketing-delay' as string]: "240ms" }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: COLORS.green }} />
                Unlimited locations
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: COLORS.green }} />
                Works on any device
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" style={{ color: COLORS.green }} />
                Real-time sync
              </div>
            </div>
          </div>

          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  const loads = [
    { id: "Load 1824", status: "Ready", color: COLORS.green },
    { id: "Load 1825", status: "Prep", color: COLORS.orange },
    { id: "Load 1826", status: "Hold", color: COLORS.redOrange },
  ];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className="absolute -top-10 -left-10 h-32 w-32 rounded-full blur-3xl"
        style={{ backgroundColor: `${COLORS.blue}30` }}
      />
      <div
        className="absolute -bottom-14 right-0 h-36 w-36 rounded-full blur-3xl"
        style={{ backgroundColor: `${COLORS.blueViolet}25` }}
      />

      <div
        className="relative z-10 rounded-3xl border border-white/60 bg-white/85 p-6 shadow-2xl backdrop-blur marketing-fade-up"
        style={{ ['--marketing-delay' as string]: "160ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Live Load Board</div>
          <Badge
            className="border-0"
            style={{ backgroundColor: `${COLORS.green}20`, color: COLORS.green }}
          >
            Live
          </Badge>
        </div>

        <div className="mt-4 space-y-3">
          {loads.map((load) => (
            <div
              key={load.id}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: load.color }}
                />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {load.id}
                  </div>
                  <div className="text-xs text-gray-500">Dock A · 12 items</div>
                </div>
              </div>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${load.color}15`, color: load.color }}
              >
                {load.status}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-gray-600">
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2 text-center">
            <ScanBarcode className="mx-auto h-4 w-4" style={{ color: COLORS.blue }} />
            <div className="mt-1 font-medium">Scan</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2 text-center">
            <ClipboardCheck className="mx-auto h-4 w-4" style={{ color: COLORS.green }} />
            <div className="mt-1 font-medium">Verify</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2 text-center">
            <Truck className="mx-auto h-4 w-4" style={{ color: COLORS.orange }} />
            <div className="mt-1 font-medium">Dispatch</div>
          </div>
        </div>
      </div>

      <div
        className="absolute -bottom-10 -right-6 w-56 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl marketing-fade-up"
        style={{ ['--marketing-delay' as string]: "220ms" }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
          <Signal className="h-4 w-4" style={{ color: COLORS.blue }} />
          Floor Pulse
        </div>
        <div className="mt-3 space-y-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Wifi className="h-3.5 w-3.5" style={{ color: COLORS.blueGreen }} />
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: "78%", backgroundColor: COLORS.blueGreen }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS.yellowOrange }}
            />
            5 scans pending sync
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: COLORS.blue }}
            />
            3 operators active
          </div>
        </div>
      </div>
    </div>
  );
}

function FeaturesOverview() {
  const features = [
    {
      icon: RefreshCw,
      title: "GE DMS Data Mirroring",
      description:
        "Real-time visibility into up-to-date GE data right from the warehouse floor. No more walking to a computer.",
    },
    {
      icon: LayoutDashboard,
      title: "Unified Dashboard",
      description:
        "One dashboard across all your locations. See inventory, loads, and status at a glance.",
    },
    {
      icon: ScanBarcode,
      title: "Quick Floor Lookups",
      description:
        "Scan any item on the floor for instant details. Save trips and reduce errors.",
    },
    {
      icon: Hand,
      title: "Left/Right Handedness",
      description:
        "UI adapts to your dominant hand for comfortable one-handed operation on mobile.",
    },
    {
      icon: MapPin,
      title: "Unlimited Locations",
      description:
        "Manage multiple warehouse locations from a single account with per-location controls.",
    },
    {
      icon: Smartphone,
      title: "PWA on All Devices",
      description:
        "Install on Desktop, iOS, or Android. Works offline and syncs when back online.",
    },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Built for the warehouse floor
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A thin layer of on-the-floor status controls: todos, load status,
            sanity checks, and task assignments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const colorKeys = Object.keys(COLORS) as (keyof typeof COLORS)[];
            const colorKey = colorKeys[index % colorKeys.length];
            const color = COLORS[colorKey];
            return (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-lg transition-all marketing-fade-up"
                style={{
                  ['--hover-border' as string]: `${color}40`,
                  ['--marketing-delay' as string]: `${index * 80}ms`,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-white mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const steps = [
    {
      title: "Scan on the floor",
      description: "Identify any item with one-hand scanning from anywhere on the dock.",
      icon: ScanBarcode,
      color: COLORS.blue,
    },
    {
      title: "Verify inventory fast",
      description: "Confirm serials, capture photos, and update status without leaving the line.",
      icon: ClipboardCheck,
      color: COLORS.green,
    },
    {
      title: "Coordinate load prep",
      description: "See prep blockers, task owners, and pickup timing in one place.",
      icon: Truck,
      color: COLORS.orange,
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="space-y-6">
            <Badge
              variant="secondary"
              className="border-0 marketing-fade-up"
              style={{
                backgroundColor: `${COLORS.blueGreen}20`,
                color: COLORS.blueGreen,
                ['--marketing-delay' as string]: "60ms",
              }}
            >
              Workflow
            </Badge>
            <h2
              className="text-3xl sm:text-4xl font-bold text-gray-900 marketing-fade-up"
              style={{ ['--marketing-delay' as string]: "110ms" }}
            >
              From dock to delivery in three moves
            </h2>
            <p
              className="text-lg text-gray-600 marketing-fade-up"
              style={{ ['--marketing-delay' as string]: "150ms" }}
            >
              Warehouse keeps the floor moving by compressing the work into a
              simple loop. Scan, verify, and ship without juggling multiple
              systems.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-5 marketing-fade-up"
                style={{ ['--marketing-delay' as string]: `${index * 90}ms` }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${step.color}20`, color: step.color }}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Step {index + 1}
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {step.title}
                  </div>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AppPreview() {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 marketing-grid opacity-40 pointer-events-none" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Designed for usability
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Dark and light modes, responsive layouts, and intuitive controls
            that work in any lighting condition.
          </p>
        </div>

        {/* App screenshot mockups */}
        <div className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Dark mode mockup */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-gray-900 border border-gray-800">
              <div className="absolute top-0 inset-x-0 h-8 bg-gray-800 flex items-center px-4 gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="pt-8 p-6 min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <WarehouseLogo className="h-16 w-16 text-gray-200 mx-auto mb-4" title="Warehouse" />
                  <p className="text-gray-400 text-sm">Dashboard - Dark Mode</p>
                  <p className="text-gray-500 text-xs mt-2">
                    Screenshot coming soon
                  </p>
                </div>
              </div>
            </div>

            {/* Light mode mockup */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white border border-gray-200">
              <div className="absolute top-0 inset-x-0 h-8 bg-gray-100 flex items-center px-4 gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="pt-8 p-6 min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <WarehouseLogo className="h-16 w-16 text-gray-400 mx-auto mb-4" title="Warehouse" />
                  <p className="text-gray-600 text-sm">Dashboard - Light Mode</p>
                  <p className="text-gray-400 text-xs mt-2">
                    Screenshot coming soon
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section
      className="py-24"
      style={{
        background: `linear-gradient(to bottom right, ${COLORS.blue}, ${COLORS.blueViolet})`,
      }}
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Ready to streamline your warehouse?
        </h2>
        <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto">
          Join the pre-beta and be among the first to experience the future of
          warehouse floor management.
        </p>
        <div className="mt-10">
          <a href={getAppUrl("/signup")}>
            <Button
              size="lg"
              className="bg-white hover:bg-gray-50 shadow-lg px-8"
              style={{ color: COLORS.blue }}
            >
              Request Early Access
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
