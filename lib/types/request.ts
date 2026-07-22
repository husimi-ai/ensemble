/**
 * Compute/data asks from a group and the data-provider marketplace they can
 * open. Mirrors `resource_requests`, `data_request_listings`,
 * `provider_applications` (task 001, migration `0004_requests_versions_jobs.sql`).
 */

/** Whether a group is asking for compute or for data. Column `resource_requests.kind`. */
export type ResourceKind = "compute" | "data";

/** Request lifecycle; a data request can be `published` -> a listing. */
export type ResourceRequestStatus = "requested" | "fulfilled" | "published";

/**
 * A compute|data ask from a group; routes to the operator console. Table
 * `resource_requests`. DB mapping: `groupId`<->`group_id`.
 */
export interface ResourceRequest {
  id: string;
  groupId: string;
  kind: ResourceKind;
  description: string;
  status: ResourceRequestStatus;
  createdAt: string;
}

/** Listing lifecycle. Column `data_request_listings.status`. */
export type DataRequestListingStatus = "open" | "matched" | "closed";

/**
 * A published data need, ranked to likely providers (C12). Table
 * `data_request_listings`. DB mapping: `requestId`<->`request_id`
 * (`resource_requests.id`).
 */
export interface DataRequestListing {
  id: string;
  requestId: string;
  title: string;
  description: string;
  status: DataRequestListingStatus;
  createdAt: string;
}

/** Provider-application lifecycle; on accept the provider becomes a Membership. */
export type ProviderApplicationStatus = "pending" | "accepted" | "rejected";

/**
 * A provider "applying to help" on a data listing (C15). Table
 * `provider_applications`. DB mapping: `listingId`<->`listing_id`,
 * `userId`<->`user_id`.
 */
export interface ProviderApplication {
  id: string;
  listingId: string;
  userId: string;
  message: string | null;
  status: ProviderApplicationStatus;
  createdAt: string;
}
