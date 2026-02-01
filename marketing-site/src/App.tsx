import { useEffect, useState } from "react"
import { LandingPage } from "@/components/Marketing/LandingPage"
import { FeaturesPage } from "@/components/Marketing/FeaturesPage"
import { PricingPage } from "@/components/Marketing/PricingPage"
import { SpeedInsights } from "@vercel/speed-insights/react"

type Route = "home" | "features" | "pricing"

const resolveRoute = (pathname: string): Route => {
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (normalized.startsWith("/features")) return "features"
  if (normalized.startsWith("/pricing")) return "pricing"
  return "home"
}

export function App() {
  const [route, setRoute] = useState<Route>(() => resolveRoute(window.location.pathname))

  useEffect(() => {
    const handleChange = () => setRoute(resolveRoute(window.location.pathname))
    window.addEventListener("popstate", handleChange)
    return () => window.removeEventListener("popstate", handleChange)
  }, [])

  return (
    <>
      {route === "features" && <FeaturesPage />}
      {route === "pricing" && <PricingPage />}
      {route === "home" && <LandingPage />}
      <SpeedInsights />
    </>
  )
}
