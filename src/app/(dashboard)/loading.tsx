import { PageContainer } from "@/components/shell";
import { LoadingState } from "@/components/ui";

/** Default route-level loading skeleton for the dashboard group. */
export default function DashboardLoading() {
  return (
    <PageContainer>
      <LoadingState />
    </PageContainer>
  );
}
