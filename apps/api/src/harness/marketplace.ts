/**
 * Marketplace: listings and work orders.
 *
 * A listing is something an owner offers. A work order is an accepted unit of
 * work tied to a listing, a worker, and (once reserved) an escrow hold. The
 * marketplace owns the work-order lifecycle state machine; escrow/proof/
 * reputation are separate services wired together by the orchestrator.
 */
import type { DeterministicClock } from "./clock.ts";
import type { Listing, WorkOrder } from "./types.ts";

export class MarketplaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceError";
  }
}

export class MarketplaceService {
  private readonly listings = new Map<string, Listing>();
  private readonly workOrders = new Map<string, WorkOrder>();
  private readonly clock: DeterministicClock;

  constructor(clock: DeterministicClock) {
    this.clock = clock;
  }

  createListing(input: {
    ownerId: string;
    title: string;
    priceUnits: number;
  }): Listing {
    if (input.priceUnits <= 0) {
      throw new MarketplaceError("Listing price must be positive.");
    }
    const listing: Listing = {
      id: this.clock.id("lst"),
      ownerId: input.ownerId,
      title: input.title,
      priceUnits: input.priceUnits,
    };
    this.listings.set(listing.id, listing);
    return listing;
  }

  getListing(listingId: string): Listing {
    const listing = this.listings.get(listingId);
    if (!listing) throw new MarketplaceError(`Unknown listing: ${listingId}`);
    return listing;
  }

  createWorkOrder(input: { listingId: string; workerId: string }): WorkOrder {
    const listing = this.getListing(input.listingId);
    if (listing.ownerId === input.workerId) {
      throw new MarketplaceError("Owner cannot be the worker on their own listing.");
    }
    const workOrder: WorkOrder = {
      id: this.clock.id("wo"),
      listingId: listing.id,
      ownerId: listing.ownerId,
      workerId: input.workerId,
      priceUnits: listing.priceUnits,
      status: "created",
      escrowId: null,
    };
    this.workOrders.set(workOrder.id, workOrder);
    return workOrder;
  }

  getWorkOrder(workOrderId: string): WorkOrder {
    const wo = this.workOrders.get(workOrderId);
    if (!wo) throw new MarketplaceError(`Unknown work order: ${workOrderId}`);
    return wo;
  }

  setStatus(workOrderId: string, status: WorkOrder["status"]): WorkOrder {
    const wo = this.getWorkOrder(workOrderId);
    wo.status = status;
    return wo;
  }

  attachEscrow(workOrderId: string, escrowId: string): WorkOrder {
    const wo = this.getWorkOrder(workOrderId);
    wo.escrowId = escrowId;
    wo.status = "reserved";
    return wo;
  }
}
