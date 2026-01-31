import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "./AuthLayout";
import supabase from "@/lib/supabase";

export function SignupView() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    const company = String(form.get("company") ?? "").trim();
    const locations = String(form.get("locations") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();

    if (!email || !password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    supabase.auth
      .signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || null,
            company_name: company || null,
            location_count: locations || null,
            notes: notes || null,
            requested_at: new Date().toISOString(),
          },
        },
      })
      .then(({ data, error: signUpError }) => {
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setSubmitted(true);
        setSubmittedEmail(email);
        setNeedsEmailConfirm(!data.session);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Sign up failed.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <AuthLayout title="Request access" description="Join the Warehouse waitlist">
      {submitted ? (
        <div className="space-y-4 text-sm text-gray-600">
          <p className="text-gray-900 text-base font-medium">Request received.</p>
          <p>
            {needsEmailConfirm
              ? "Check your email to confirm your request. We will follow up with access details and timing."
              : "Thanks for reaching out. We will follow up with access details and timing."}
          </p>
          {submittedEmail && (
            <p className="text-xs text-gray-500">Submitted for {submittedEmail}</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="waitlist-name" className="text-gray-700">
              Full name
            </Label>
            <Input
              id="waitlist-name"
              name="name"
              placeholder="Alex Johnson"
              autoComplete="name"
              className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waitlist-email" className="text-gray-700">
              Work email
            </Label>
            <Input
              id="waitlist-email"
              name="email"
              type="email"
              placeholder="alex@company.com"
              autoComplete="email"
              className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="waitlist-password" className="text-gray-700">
                Password
              </Label>
              <Input
                id="waitlist-password"
                name="password"
                type="password"
                placeholder="Create a password"
                autoComplete="new-password"
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="waitlist-password-confirm" className="text-gray-700">
                Confirm password
              </Label>
              <Input
                id="waitlist-password-confirm"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                autoComplete="new-password"
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waitlist-company" className="text-gray-700">
              Company name
            </Label>
            <Input
              id="waitlist-company"
              name="company"
              placeholder="Acme Appliances"
              className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waitlist-locations" className="text-gray-700">
              Locations
            </Label>
            <Input
              id="waitlist-locations"
              name="locations"
              placeholder="How many locations?"
              className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="waitlist-notes" className="text-gray-700">
              Notes
            </Label>
            <Input
              id="waitlist-notes"
              name="notes"
              placeholder="Any details we should know?"
              className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {loading ? "Submitting..." : "Request access"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <a href="/login" className="text-gray-600 hover:text-gray-900">
              Back to sign in
            </a>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
