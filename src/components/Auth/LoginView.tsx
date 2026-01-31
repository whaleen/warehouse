import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { AuthLayout } from "./AuthLayout";

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error?.message || "Login failed");
      setLoading(false);
    } else {
      // Success - redirect to dashboard
      window.location.href = "/";
    }
  };

  return (
    <AuthLayout title="Welcome back" description="Sign in to your Warehouse account">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-700">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-700">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>

        <div className="flex items-center justify-between text-sm">
          <a
            href="/reset-password"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Forgot password?
          </a>
          <a
            href="/signup"
            className="text-gray-600 hover:text-gray-900"
          >
            Request access
          </a>
        </div>
      </form>
    </AuthLayout>
  );
}
