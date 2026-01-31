import { MarketingLayout, COLORS } from "./MarketingLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Sparkles, Map, Users, Rocket } from "lucide-react";
import { getAppUrl } from "@/lib/appLinks";

export function PricingPage() {
  return (
    <MarketingLayout>
      <PageHeader />
      <PricingCards />
      <OnboardingSection />
      <FaqSection />
    </MarketingLayout>
  );
}

function PageHeader() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom right, ${COLORS.violet}10, white, ${COLORS.redViolet}10)`,
        }}
      />
      <div className="absolute inset-0 marketing-grid opacity-50 pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <Badge
            variant="secondary"
            className="mb-6 border-0 marketing-fade-up"
            style={{
              backgroundColor: `${COLORS.violet}20`,
              color: COLORS.violet,
              ['--marketing-delay' as string]: "40ms",
            }}
          >
            Pricing
          </Badge>

          <h1
            className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight marketing-fade-up"
            style={{ ['--marketing-delay' as string]: "90ms" }}
          >
            Simple, transparent{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(to right, ${COLORS.violet}, ${COLORS.redViolet})`,
              }}
            >
              pricing
            </span>
          </h1>

          <p
            className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto marketing-fade-up"
            style={{ ['--marketing-delay' as string]: "140ms" }}
          >
            Warehouse is currently in pre-beta. During this period, we're
            working with select partners to refine the product.
          </p>
        </div>
      </div>
    </section>
  );
}

function PricingCards() {
  const features = [
    "Unlimited locations per company",
    "Unlimited team members",
    "Real-time GE DMS sync",
    "PWA for all devices",
    "Floor display support",
    "Activity logging",
    "Load management",
    "Barcode scanning",
    "Priority support",
  ];

  return (
    <section className="py-16 bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl border-2 p-8 lg:p-12 marketing-fade-up"
          style={{
            borderColor: `${COLORS.violet}40`,
            background: `linear-gradient(to bottom, ${COLORS.violet}08, white)`,
            ['--marketing-delay' as string]: "80ms",
          }}
        >
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    background: `linear-gradient(to bottom right, ${COLORS.violet}, ${COLORS.redViolet})`,
                  }}
                >
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <Badge
                  className="border-0"
                  style={{ backgroundColor: `${COLORS.violet}20`, color: COLORS.violet }}
                >
                  Pre-Beta
                </Badge>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Early Access
              </h2>

              <p className="text-gray-600 mb-8">
                Get in on the ground floor. We're offering exclusive access to
                select partners who want to help shape the future of warehouse
                management.
              </p>

              <div className="mb-8">
                <div className="text-4xl font-bold text-gray-900">
                  Contact us
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Pricing will be finalized after beta
                </p>
              </div>

              <a href={getAppUrl("/signup")}>
                <Button
                  size="lg"
                  className="w-full sm:w-auto text-white shadow-lg px-8 hover:opacity-90"
                  style={{
                    background: `linear-gradient(to right, ${COLORS.violet}, ${COLORS.redViolet})`,
                    boxShadow: `0 10px 15px -3px ${COLORS.violet}40`,
                  }}
                >
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>

            <div className="flex-1 lg:border-l lg:border-gray-200 lg:pl-12">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6">
                What's included
              </h3>
              <ul className="space-y-4">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${COLORS.green}20` }}
                    >
                      <Check className="h-3 w-3" style={{ color: COLORS.green }} />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center marketing-fade-up" style={{ ['--marketing-delay' as string]: "140ms" }}>
          <p className="text-sm text-gray-500">
            Have questions about pricing?{" "}
            <a
              href="mailto:hello@warehouse.app"
              className="font-medium hover:opacity-80"
              style={{ color: COLORS.blue }}
            >
              Get in touch
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

function OnboardingSection() {
  const steps = [
    {
      icon: Map,
      title: "Discovery & mapping",
      description: "We map your locations, load flow, and GE DMS touchpoints.",
      color: COLORS.blue,
    },
    {
      icon: Users,
      title: "Pilot with floor leads",
      description: "Start with a focused pilot and tune workflows in real time.",
      color: COLORS.green,
    },
    {
      icon: Rocket,
      title: "Full rollout",
      description: "Expand to every dock with onboarding support and playbooks.",
      color: COLORS.violet,
    },
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <Badge
            variant="secondary"
            className="mb-4 border-0 marketing-fade-up"
            style={{
              backgroundColor: `${COLORS.blue}15`,
              color: COLORS.blue,
              ['--marketing-delay' as string]: "40ms",
            }}
          >
            Onboarding
          </Badge>
          <h2
            className="text-3xl sm:text-4xl font-bold text-gray-900 marketing-fade-up"
            style={{ ['--marketing-delay' as string]: "90ms" }}
          >
            A rollout built around your floor
          </h2>
          <p
            className="mt-4 text-lg text-gray-600 marketing-fade-up"
            style={{ ['--marketing-delay' as string]: "140ms" }}
          >
            We keep onboarding tight and practical so your team sees impact
            quickly without slowing down operations.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm marketing-fade-up"
              style={{ ['--marketing-delay' as string]: `${index * 90}ms` }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl mb-4"
                style={{ backgroundColor: `${step.color}20`, color: step.color }}
              >
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const faqs = [
    {
      question: "What is pre-beta access?",
      answer:
        "Pre-beta access means you'll be among the first to use Warehouse. You'll help us identify issues, suggest improvements, and shape the product roadmap. In exchange, you'll get preferential pricing when we launch.",
    },
    {
      question: "How many locations can I have?",
      answer:
        "Unlimited. Whether you have one warehouse or twenty, Warehouse scales with you. Each location gets its own inventory, team, and settings.",
    },
    {
      question: "Do I need to install anything?",
      answer:
        "Warehouse is a Progressive Web App (PWA). You can use it in your browser or install it as a native app on any device - Desktop, iOS, or Android. No app store required.",
    },
    {
      question: "What about my existing GE DMS data?",
      answer:
        "Warehouse syncs with GE DMS in real-time. Your data stays in GE as the source of truth, while Warehouse provides a mobile-friendly interface for floor operations.",
    },
    {
      question: "Is my data secure?",
      answer:
        "Yes. Warehouse is built on Supabase with PostgreSQL. All data is encrypted in transit and at rest. We follow security best practices and will be SOC 2 compliant by launch.",
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-6">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-2xl border border-gray-100 bg-white p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {faq.question}
              </h3>
              <p className="text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
