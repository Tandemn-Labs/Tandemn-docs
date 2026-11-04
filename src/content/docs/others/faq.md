---
title: FAQ
description: Deployment requirements, system architecture, workload planning, and cluster integration for Tandemn.
---

## Deployment and prerequisites

### Which components are included in a Tandemn deployment?

The Kubernetes reference deployment consists of two packages, distributed as Helm charts:

- **Central control plane:** includes Koi, a resource map service that aggregates cluster reports, and a PostgreSQL database used by the control-plane services.
- **Per-cluster operator:** applies deployment plans and reports available resources and job status from each worker cluster.

The control plane runs in a designated central Kubernetes cluster. Worker clusters run the inference workloads. See the [architecture diagram](/architecture/tandemn-architecture/) for the component layout.

### What are the deployment prerequisites?

The reference architecture assumes:

- Kubernetes clusters with compute resources available for inference.
- Serving frameworks and inference engines compatible with the workloads.
- A federated metrics time-series database containing metrics from the participating clusters.
- Connectivity for operators to report resource state to the central resource map service, and for the planner to read metrics.

PostgreSQL is included in the control-plane package. The serving stack and federated metrics database must be available separately.

### Are multiple clouds or accelerator types required?

No. Tandemn can plan within a single resource pool as well as across heterogeneous pools. Multiple clusters, clouds, and accelerator types expand the placement choices available to the planner; they are not a requirement for using it. See the [deployment overview](https://www.tandemn.com/product/deploy).

### Which serving frameworks and accelerators does Tandemn target?

The reference architecture describes integration with serving frameworks such as NVIDIA Dynamo, llm-d, and AIBrix, and metrics from engines such as vLLM and SGLang. Koi is able to plave workloads on heterogeneous accelerators, such as NVIDIA GPUs, AMD GPUs, Google TPUs, etc

Each deployment requires a compatible combination of hardware, model, inference engine, and serving framework integration. Consult the documentation for the specific component versions to verify compatibility with the integrations described in the reference architecture.

## Architecture and integration

### How are planning and execution coordinated?

**Koi** reads job requirements, resource availability, and performance metrics to produce a deployment plan.

**The execution system** applies the plan. In the [Kubernetes architecture](/architecture/tandemn-architecture/), a Tandemn operator in each worker cluster translates the cluster-specific plan into resources for the installed serving frameworks. Those frameworks manage the model deployments and report their state through the operator.

Planning and execution operate as a continuous feedback loop: observe cluster state, generate a plan, reconcile the deployment, and incorporate observed results into the next planning cycle.

### How does Tandemn integrate with Kubernetes and the serving stack?

The components have distinct responsibilities:

| Component | Responsibility |
| --- | --- |
| Tandemn / Koi | Plan workload configuration and placement across available clusters and accelerators. |
| Tandemn cluster operator | Reconcile the plan into serving resources and report cluster state. |
| Serving framework, such as NVIDIA Dynamo, llm-d, or AIBrix | Manage the serving deployment within a cluster. |
| Inference engine, such as vLLM or SGLang | Load models and execute inference. |
| Kubernetes | Schedule and run the deployment's pods on cluster nodes. |

Koi makes deployment decisions above the serving stack. Applications continue to send inference requests to their serving endpoints.

## Workload management

### How are workloads submitted?

Submit deployment intent through the Tandemn Jobs HTTP API. A job describes the workload's requirements, such as serving objectives for an online endpoint or a completion deadline for offline inference.

A job can also specify cluster and accelerator restrictions, engine configuration fields, and Kubernetes labels or annotations. Koi uses these requirements when planning the deployment.

### Which deployment decisions does Koi make?

Koi plans workload placement and configuration together. Depending on the available integration and job constraints, these decisions include accelerator selection, serving configuration, parallelism, and replica counts across the fleet.

It evaluates alternatives against workload objectives and available capacity. The [planning algorithm](https://www.tandemn.com/product/algorithm) also accounts for prediction uncertainty and the disruption involved in changing a deployment.

### How are submitted jobs deployed?

In the Kubernetes reference architecture:

1. A job and its requirements are submitted through the Jobs API.
2. Cluster operators report resource capacity and the status of managed workloads.
3. Koi reads the jobs, the combined resource map, and serving metrics to produce a `GlobalPlan`.
4. Each cluster operator reconciles its `ClusterPlan` into resources managed by the installed serving framework.
5. Deployment state and performance feed into subsequent planning cycles.

A plan defines the desired deployment state. The operator and serving framework reconcile that state into running workloads; plan generation and deployment execution are separate stages.

### How frequently does Koi generate a deployment plan?

Koi runs periodically; the default interval is five minutes. Each planning cycle considers new jobs, resource changes, and metrics from existing deployments.

Replanning does not require changing every deployment. The algorithm accounts for reconfiguration costs, including model loading, warm-up, and draining, when comparing a change with retaining the current configuration.

## Resource discovery and telemetry

### How does Koi discover available resources?

Each operator reports a `ClusterResourceMap` containing compute resources and managed job state. The central resource map service combines these reports into a `GlobalResourceMap` for Koi.

The map represents capacity, occupancy, pending work, topology, and installed components. Koi uses this information to account for deployment resource requirements, topology, and runtime capabilities. See the [resource map reference](/reference/resource-map/).

### How are metrics collected?

Koi reads metrics through adapters for time-series databases and applications. The architecture describes sources such as Prometheus/Thanos, OpenTSDB, Grafana Mimir, and Cortex, with application metrics from vLLM, SGLang, and NVIDIA DCGM.

The reference deployment assumes metrics from all clusters are already available through a federated metrics database. Operators report resource and job state; the metrics integration provides observed serving and hardware performance.

## Additional documentation

See [Tandemn Architecture](/architecture/tandemn-architecture/) for the deployment layout and [Tandemn Planner (Koi)](/architecture/koi/) for planning inputs and outputs. For installation procedures, consult the setup instructions for the component and version being deployed.

## About Tandemn

### What is Tandemn?

Tandemn is a planning and execution system for inference workloads. It uses job requirements, available compute capacity, and observed performance to determine workload configurations and placements.

For example, an interactive model endpoint may have a latency target, while a batch job has a completion deadline. Tandemn accounts for both requirements when allocating shared accelerator capacity.
