import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui";

/** App-wide 404. Rendered outside the shell chrome. */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link
            href="/overview"
            className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            Back to overview
          </Link>
        }
      />
    </div>
  );
}
