import { MarketingLayout, COLORS } from "./MarketingLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  LayoutDashboard,
  ScanBarcode,
  Hand,
  MapPin,
  Smartphone,
  CheckSquare,
  Truck,
  ClipboardCheck,
  Calendar,
  ArrowRight,
  Check,
  ShieldCheck,
  Cloud,
  Clock,
} from "lucide-react";
import { getAppUrl } from "@/lib/appLinks";

export function FeaturesPage() {
  return (
    <MarketingLayout>
      <PageHeader />
      <CoreFeatures />
      <ReliabilitySection />
      <FloorControls />
      <PwaSection />
      <CtaSection />
    </MarketingLayout>
  );
}

function PageHeader() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom right, ${COLORS.blueGreen}10, white, ${COLORS.blue}10)`,
        }}
      />
      <div className="absolute inset-0 marketing-grid opacity-50 pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <Badge
            variant="secondary"
            className="mb-6 border-0 marketing-fade-up"
            style={{
              backgroundColor: `${COLORS.blueGreen}20`,
              color: COLORS.blueGreen,
              ['--marketing-delay' as string]: "40ms",
            }}
          >
            Features
          </Badge>

          <h1
            className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight marketing-fade-up"
            style={{ ['--marketing-delay' as string]: "90ms" }}
          >
            Everything you need on the{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${COLORS.blueGreen}, ${COLORS.blue})`,
              }}
            >
              warehouse floor
            </span>
          </h1>

          <p
            className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto marketing-fade-up"
            style={{ ['--marketing-delay' as string]: "140ms" }}
          >
            Warehouse is designed from the ground up for usability. Every
            feature is optimized for quick, one-handed operation while you're on
            the move.
          </p>
        </div>
      </div>
    </section>
  );
}

function CoreFeatures() {
  const features = [
    {
      icon: RefreshCw,
      title: "GE DMS Data Mirroring",
      description:
        "Your single source of truth, mirrored in real-time. See inventory levels, load assignments, and item details without leaving the floor.",
      highlights: [
        "Real-time sync with GE DMS",
        "Offline-capable with background sync",
        "Instant item lookups by serial or model",
      ],
    },
    {
      icon: LayoutDashboard,
      title: "Unified Dashboard",
      description:
        "One view across all your locations. Track inventory, monitor loads, and spot issues before they become problems.",
      highlights: [
        "Multi-location overview",
        "Customizable widgets",
        "Activity feed and alerts",
      ],
    },
    {
      icon: ScanBarcode,
      title: "Quick Floor Lookups",
      description:
        "Scan any barcode for instant details. No more walking to a computer to check on an item.",
      highlights: [
        "Camera-based barcode scanning",
        "Serial number search",
        "Instant item history",
      ],
    },
    {
      icon: Hand,
      title: "Left/Right Handedness",
      description:
        "The UI adapts to your dominant hand. Controls shift to the side that's most comfortable for one-handed use.",
      highlights: [
        "Per-user preference",
        "Sidebar position adapts",
        "Touch-optimized controls",
      ],
    },
    {
      icon: MapPin,
      title: "Unlimited Locations",
      description:
        "Manage multiple warehouses from a single account. Each location has its own inventory, team, and settings.",
      highlights: [
        "Per-location permissions",
        "Cross-location reporting",
        "Easy team management",
      ],
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-16">
          {features.map((feature, index) => {
            const colorKeys = Object.keys(COLORS) as (keyof typeof COLORS)[];
            const colorKey = colorKeys[index % colorKeys.length];
            const color = COLORS[colorKey];
            return (
              <div
                key={feature.title}
                className={`flex flex-col lg:flex-row gap-8 lg:gap-16 items-center marketing-fade-up ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
                style={{ ['--marketing-delay' as string]: `${index * 100}ms` }}
              >
                <div className="flex-1">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl text-white mb-6"
                    style={{ backgroundColor: color }}
                  >
                    <feature.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    {feature.description}
                  </p>
                  <ul className="space-y-3">
                    {feature.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-center gap-3 text-gray-700"
                      >
                        <Check className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.green }} />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex-1 w-full">
                  <div className="rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200 p-8 min-h-[280px] flex items-center justify-center">
                    <div className="text-center">
                      <feature.icon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-sm text-gray-400">
                        Feature preview coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ReliabilitySection() {
  const reliability = [
    {
      icon: Cloud,
      title: "Always-on sync",
      description: "Queue updates offline and sync instantly when you reconnect.",
      color: COLORS.blueGreen,
    },
    {
      icon: ShieldCheck,
      title: "Audit-ready trail",
      description: "Every scan, status change, and assignment is logged automatically.",
      color: COLORS.blue,
    },
    {
      icon: Clock,
      title: "Live activity clock",
      description: "See when items move, who last touched them, and what changed.",
      color: COLORS.orange,
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-10 lg:p-12">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <div>
              <Badge
                variant="secondary"
                className="border-0 mb-5 marketing-fade-up"
                style={{
                  backgroundColor: `${COLORS.orange}20`,
                  color: COLORS.orange,
                  ['--marketing-delay' as string]: "60ms",
                }}
              >
                Reliability
              </Badge>
              <h2
                className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 marketing-fade-up"
                style={{ ['--marketing-delay' as string]: "110ms" }}
              >
                Built to run even when the dock is chaotic
              </h2>
              <p
                className="text-lg text-gray-600 marketing-fade-up"
                style={{ ['--marketing-delay' as string]: "160ms" }}
              >
                Warehouse keeps the floor coordinated with offline-safe
                updates, a complete activity timeline, and audit-ready logs for
                your team.
              </p>
            </div>

            <div className="space-y-4">
              {reliability.map((item, index) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm marketing-fade-up"
                  style={{ ['--marketing-delay' as string]: `${index * 90}ms` }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${item.color}20`, color: item.color }}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {item.title}
                    </div>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FloorControls() {
  const controls = [
    {
      icon: CheckSquare,
      title: "Todos",
      description: "Track tasks and to-dos per location or globally",
    },
    {
      icon: Truck,
      title: "Load Status",
      description: "Monitor load progress and prep requirements",
    },
    {
      icon: ClipboardCheck,
      title: "Sanity Checks",
      description: "Request and complete inventory verification",
    },
    {
      icon: Calendar,
      title: "Task Assignments",
      description: "Daily, weekly, or by pickup date urgency",
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            On-the-floor status controls
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            A thin layer of controls designed specifically for warehouse floor
            operations. Just enough to keep things moving.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {controls.map((control, index) => {
            const colorKeys = Object.keys(COLORS) as (keyof typeof COLORS)[];
            const colorKey = colorKeys[(index + 5) % colorKeys.length];
            const color = COLORS[colorKey];
            return (
              <div
                key={control.title}
                className="p-6 rounded-2xl border border-gray-100 bg-white hover:shadow-lg transition-all text-center marketing-fade-up"
                style={{ ['--marketing-delay' as string]: `${index * 80}ms` }}
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  <control.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {control.title}
                </h3>
                <p className="text-sm text-gray-600">{control.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PwaSection() {
  return (
    <section className="py-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl p-12 lg:p-16"
          style={{
            background: `linear-gradient(to bottom right, ${COLORS.orange}, ${COLORS.red})`,
          }}
        >
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-white mb-6">
                <Smartphone className="h-7 w-7" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                PWA on all devices
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Install Warehouse as a native app on any device. Works on
                Desktop, iOS, and Android with offline support and push
                notifications.
              </p>
              <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  Desktop
                </Badge>
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  iOS
                </Badge>
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  Android
                </Badge>
                <Badge className="bg-white/20 text-white border-0 hover:bg-white/30">
                  Offline Mode
                </Badge>
              </div>
            </div>

            <div className="flex-1 w-full max-w-sm">
              <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-8 text-center">
                <Smartphone className="h-24 w-24 text-white/40 mx-auto mb-4" />
                <p className="text-sm text-white/60">
                  Mobile preview coming soon
                </p>
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
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Ready to get started?
        </h2>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Warehouse is currently in pre-beta. Request early access to be among
          the first to try it.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
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
          <a href="/pricing">
            <Button size="lg" variant="outline" className="px-8">
              View Pricing
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
