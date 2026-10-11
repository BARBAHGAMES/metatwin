import { useState } from "react";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="h-4 w-4">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.1-5.1l-6.5-5.5C29.6 35.3 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.5l6.5 5.5C41.5 35.8 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export function OAuthButtons() {
  const { signInWithOAuth } = useAuth();
  const [pending, setPending] = useState<"google" | "github" | null>(null);

  async function go(provider: "google" | "github") {
    setPending(provider);
    const error = await signInWithOAuth(provider);
    if (error) {
      toast.error(error);
      setPending(null);
    }
    // On success the browser navigates away to the provider, so no need to reset `pending`.
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or continue with
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="w-full" disabled={pending !== null} onClick={() => go("google")}>
          <GoogleIcon /> {pending === "google" ? "Redirecting..." : "Google"}
        </Button>
        <Button type="button" variant="outline" className="w-full" disabled={pending !== null} onClick={() => go("github")}>
          <Github /> {pending === "github" ? "Redirecting..." : "GitHub"}
        </Button>
      </div>
    </div>
  );
}
