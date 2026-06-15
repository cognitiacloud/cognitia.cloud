"use client";

import { PageContainer } from "@/components/shell";
import { ErrorState } from "@/components/ui";

/** Default route-level error boundary for the dashboard group. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageContainer>
      <ErrorState
        error={{
          title: "This view failed to load",
          message: error.message || "An unexpected error occurred while rendering this page.",
          code: error.digest,
        }}
        onRetry={reset}
      />
    </PageContainer>
  );
}
