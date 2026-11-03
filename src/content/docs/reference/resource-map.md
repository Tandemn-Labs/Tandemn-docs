---
title: Resource Map
---

```protobuf
message GlobalResourceMap {
  // Exactly one snapshot per included cluster.cluster_id.
  repeated ClusterResourceMap cluster_resource_maps = 1;

  // Keys exactly match the included cluster IDs; each value equals that
  // snapshot's logical_counter. The RPC service must never publish a lower
  // counter for a cluster, retaining high-water marks separately even through
  // omission and reappearance. With changing membership, this sparse clock is
  // not a fully componentwise-monotonic vector clock.
  map<string, uint64> vector_clock = 2;
}

// -----------------------------------------------------------------------------
// Single-cluster snapshot.
// -----------------------------------------------------------------------------

// The compute and job sections are two views of the same allocations, not
// separate capacity debits. Unallocated pending pods and future reservations
// remain shaped demands that Koi fits into the remaining per-node capacity.
message ClusterResourceMap {
  ClusterIdentity cluster = 1;
  google.protobuf.Timestamp collected_at = 2;
  repeated CapacityPool capacity_pools = 3;
  repeated JobState jobs = 4;
  TopologyMap topology = 5;
  repeated InstalledComponent installed_components = 6;
  repeated ApiResource api_resources = 7;
  uint64 logical_counter = 8;
}

message ClusterIdentity {
  string cluster_id = 1;
  string display_name = 2;
  string provider = 3;
  string region = 4;
  string site = 5;
}

enum WorkloadKind {
  WORKLOAD_KIND_UNSPECIFIED = 0;
  WORKLOAD_KIND_ONLINE = 1;
  WORKLOAD_KIND_BATCH = 2;
}

// -----------------------------------------------------------------------------
// Node-type capacity and current occupancy.
// -----------------------------------------------------------------------------

enum PurchaseModel {
  PURCHASE_MODEL_UNSPECIFIED = 0;
  PURCHASE_MODEL_ON_DEMAND = 1;
  PURCHASE_MODEL_SPOT = 2;
  PURCHASE_MODEL_FLEX_START = 3;
  PURCHASE_MODEL_FIXED_ASSET = 4;

  // Physical reserved capacity, rather than a billing-only discount.
  PURCHASE_MODEL_RESERVED = 5;
}

message HourlyPrice {
  string currency_code = 1;

  // Exact decimal cost for one node-hour, e.g. "12.50". An absent price message
  // means unknown; zero cost must be stated explicitly.
  string decimal_amount = 2;
}

message CapacityPool {
  string id = 1;
  bool autoscaling_enabled = 2;

  // Configured pool-wide bounds across all node types. These describe possible
  // scale-out, not additional existing nodes. Absent bounds are unspecified.
  optional uint32 min_nodes = 3;
  optional uint32 max_nodes = 4;
  optional uint32 max_accelerators = 5;

  // Include configured node types even when their total_count is zero.
  repeated NodeTypeCapacity node_types = 6;
}

message NodeTypeCapacity {
  // Distinguishes variants of an instance type with different purchasing terms,
  // zones, or fabrics. These groups are the placement targets exposed to Koi.
  string id = 1;
  string instance_type = 2;
  string accelerator_model = 3;

  // Whole accelerators on one node, not shared-access tokens.
  uint32 accelerators_per_node = 4;

  // Existing nodes, including occupied and unavailable nodes. Every physical
  // node appears in exactly one pool/type group. Pending nodes are excluded.
  uint32 total_count = 5;
  HourlyPrice price_per_node_hour = 6;
  PurchaseModel purchase_model = 7;
  string zone = 8;
  string fabric_id = 9;
  string intra_node_interconnect = 10;

  // Effective administrator eligibility resolved by the operator.
  bool eligible_for_tandemn = 11;
  optional uint32 pending_node_count = 12;

  // One anonymous entry for each node with allocated or unavailable capacity.
  // The remaining total_count - in_use.size() nodes are fully idle before
  // accounting for pending work and reservations. Entries have no identity
  // across snapshots, and new placement still requires type eligibility.
  repeated NodeOccupancy in_use = 13;

  // Future chain-shaped demands on the remaining capacity, not pinned machines.
  repeated AutoscalingReservation reserved_for_autoscaling = 14;

  // Runtime bound for newly provisioned nodes, e.g. flex-start capacity.
  google.protobuf.Duration max_run_duration = 15;
}

message NodeOccupancy {
  // All allocations in this entry are on the same anonymous node. A chain may
  // have several pods here, or its pods may occur in several entries.
  repeated PodAllocation allocations = 1;
  uint32 external_accelerators_in_use = 2;

  // Otherwise unallocated accelerators unavailable due to health, cordoning,
  // or administrator restrictions. Does not overlap either kind of allocation.
  // Free capacity is accelerators_per_node minus these three disjoint amounts.
  uint32 unavailable_accelerators = 3;
}

message PodAllocation {
  string job_id = 1;
  string rank_id = 2;
  string chain_id = 3;

  // Index into the referenced rank's pod_requirements. No Kubernetes pod or
  // device identity is needed to preserve occupancy and chain membership.
  uint32 pod_index = 4;

  // Count assigned to the pod, even while it is starting or draining. One pod
  // allocation is indivisible across nodes; it appears in one occupancy entry.
  uint32 accelerator_count = 5;
}

message AutoscalingReservation {
  string job_id = 1;
  string rank_id = 2;

  // Future chains, excluding every chain already in RankState.chains, whether
  // pending or running.
  // On this node type, reserve this many copies of each matching PodRequirement.
  // A rank spanning types has an entry on each involved type with the SAME
  // count; those entries describe one chain count, not additive chain counts.
  uint32 additional_chains = 3;
}

// -----------------------------------------------------------------------------
// Observed work: Job -> Rank -> Chain -> accelerator-bearing pods.
// -----------------------------------------------------------------------------

// Pod requirements define resource demand; do not derive it by multiplying all
// parallelism degrees, whose composition is engine-specific.
message ParallelismConfig {
  optional uint32 tensor = 1;
  optional uint32 pipeline = 2;

  // Engine-internal DP, separate from the rank's chain count.
  optional uint32 data = 3;
  optional uint32 expert = 4;
  optional uint32 context = 5;
  optional uint32 sequence = 6;
}

message RuntimeConfig {
  string framework = 1;
  string framework_version = 2;
  string engine = 3;
  string engine_version = 4;
  string image_digest = 5;
  ParallelismConfig parallelism = 6;

  map<string, string> engine_parameters = 7;
}

enum WorkloadPhase {
  WORKLOAD_PHASE_UNKNOWN = 0;
  WORKLOAD_PHASE_PENDING = 1;
  WORKLOAD_PHASE_STARTING = 2;
  WORKLOAD_PHASE_RUNNING = 3;
  WORKLOAD_PHASE_DEGRADED = 4;
  WORKLOAD_PHASE_DRAINING = 5;
  WORKLOAD_PHASE_SUCCEEDED = 6;
  WORKLOAD_PHASE_FAILED = 7;
}

message WorkloadStatus {
  WorkloadPhase phase = 1;
  string reason = 2;
  string message = 3;
}

// This cluster's observation of a managed job, not its authoritative global
// completion state. Different ranks may serve the same job concurrently.
message JobState {
  string job_id = 1;
  WorkloadKind workload_kind = 2;
  repeated RankState ranks = 3;
  WorkloadStatus status = 4;
}

// Every chain in a rank has this same runtime and ordered pod footprint. Keep
// simultaneously running different shapes in separate rank observations.
message RankState {
  string rank_id = 1;
  RuntimeConfig runtime = 2;

  // One entry per accelerator-bearing pod in ONE complete chain. For example,
  // TP=4 is [4]; TP=4, PP=3 is [4, 4, 4]. These are not replica counts.
  repeated PodRequirement pod_requirements = 3;

  optional uint32 min_chains = 4;
  optional uint32 max_chains = 5;
  optional uint32 desired_chains = 6;

  // Include intended pending chains even before their pods exist. On scale-up,
  // a future reservation becomes a pending chain instead of being counted twice.
  repeated ChainState chains = 7;
  WorkloadStatus status = 8;
}

message PodRequirement {
  string pool_id = 1;
  string node_type_id = 2;

  // Must fit on a single node. Different pods of a chain may share a node when
  // they fit, or occupy separate nodes; their requirements must not be flattened
  // into one fungible accelerator total.
  uint32 accelerator_count = 3;
}

message ChainState {
  string chain_id = 1;

  // One state per rank pod requirement, including pods not yet created.
  repeated PodState pods = 2;
  WorkloadStatus status = 3;
}

message PodState {
  uint32 pod_index = 1;

  // Lifecycle of the logical pod described by the rank's requirement. Pending
  // includes not-yet-created pods. NodeOccupancy records indicate allocation:
  // an unallocated pending pod still needs its footprint; an allocated starting
  // pod already consumes capacity. Future-chain reservations exclude both.
  WorkloadStatus status = 2;
}

// -----------------------------------------------------------------------------
// Fabric-level connectivity and installed capabilities.
// -----------------------------------------------------------------------------

message Fabric {
  string id = 1;
  string transport = 2;
  bool rdma_ready = 3;

  // Planning estimates per node, not additive guarantees for every node pair.
  optional uint64 bandwidth_per_node_bps = 4;
  optional uint64 round_trip_latency_ns = 5;
}

// Directed connectivity between fabrics in this cluster. No node/NIC identities
// are needed. Bandwidth is an aggregate estimate shared by transfers on the link.
message FabricLink {
  string from_fabric_id = 1;
  string to_fabric_id = 2;
  optional uint64 bandwidth_bps = 3;
  optional uint64 round_trip_latency_ns = 4;
}

message TopologyMap {
  repeated Fabric fabrics = 1;
  repeated FabricLink links = 2;
}

message ApiResource {
  // Empty group denotes the Kubernetes core API group.
  string group = 1;
  string kind = 2;
  repeated string served_versions = 3;
}

// Installed software, not a catalogue of compatible deployment recipes.
message InstalledComponent {
  string name = 1;
  string version = 2;
}

```