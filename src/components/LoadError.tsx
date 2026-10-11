import { Button } from "@/components/ui/button";
import { Card } from "@/components/site";

// Shown when a page's data fails to load. Without this an error looks exactly
// like an empty account ("no capabilities yet"), which reads as lost data.
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <Card>
        <h1 className="text-xl font-semibold">We couldn't load your MetaTwin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is a loading problem, not lost data — nothing has been deleted. Check your connection and try again.
        </p>
        <Button className="mt-5" onClick={onRetry}>Try again</Button>
      </Card>
    </main>
  );
}
