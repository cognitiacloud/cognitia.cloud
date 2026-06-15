import {
  ShieldCheck,
  PlayCircle,
  TrendingUp,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shell";
import {
  StatCard,
  Card,
  CardHeader,
  Button,
  EmptyState,
  TableContainer,
} from "@/components/ui";

export const metadata = { title: "Overview" };

/**
 * Overview dashboard — Lane A renders the structure (stat grid, panels, table
 * frame) with placeholder content. Downstream lanes replace the placeholders
 * with live metrics, the approvals queue, and the recent-runs table.
 */
export default function OverviewPage() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Overview"
        subtitle="Pipeline health and governed activity at a glance."
        actions={
          <Button variant="primary" size="sm">
            New run
          </Button>
        }
      />

      {/* Headline metrics — wired to live data by downstream lanes. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending approvals"
          value="—"
          icon={ShieldCheck}
          tone="accent"
          delta={{ direction: "flat", label: "Awaiting operator review" }}
        />
        <StatCard
          label="Active runs"
          value="—"
          icon={PlayCircle}
          delta={{ direction: "flat", label: "Across all workflows" }}
        />
        <StatCard
          label="Pipeline influenced"
          value="—"
          icon={TrendingUp}
          delta={{ direction: "flat", label: "Trailing 30 days" }}
        />
        <StatCard
          label="Engaged contacts"
          value="—"
          icon={Users}
          delta={{ direction: "flat", label: "Trailing 30 days" }}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TableContainer
            title="Recent runs"
            description="Latest governed operator activity"
            toolbar={
              <Button variant="ghost" size="sm">
                View all
                <ArrowUpRight className="size-3.5" />
              </Button>
            }
          >
            <EmptyState
              compact
              icon={PlayCircle}
              title="No runs yet"
              description="When the operator executes a workflow, runs will appear here with their governance status."
            />
          </TableContainer>
        </div>

        <Card flush>
          <CardHeader
            title="Approvals queue"
            description="Actions awaiting your decision"
            className="p-5"
          />
          <EmptyState
            compact
            icon={ShieldCheck}
            title="Queue is clear"
            description="Nothing needs your review right now."
          />
        </Card>
      </div>
    </PageContainer>
  );
}
