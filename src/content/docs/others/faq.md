---
title: FAQ
description: What Tandemn installs, how Koi plans inference workloads, and how cluster operators run those plans.
---

## Understanding Tandemn

### What does Tandemn do?

Tandemn plans how inference workloads should run on your compute infrastructure. You provide jobs and their requirements; Tandemn uses available capacity and observed performance to choose workload configurations and placements.

For example, an interactive model endpoint may need low response latency, while a batch job needs to finish by a deadline. Tandemn considers both when allocating their shared accelerator capacity.

### What are Koi and the execution system?

**Koi is the planner.** It reads job requirements, resource availability, and performance metrics, then produces a deployment plan.

**The execution system applies that plan.** In the [Kubernetes architecture](/architecture/tandemn-architecture/), a Tandemn operator in each worker cluster translates its part of the plan into resources for the installed serving frameworks. Those frameworks manage the model deployments and report their state through the operator.

Planning and execution form a continuous loop: observe the fleet, produce a plan, apply it, and use the results in the next planning cycle.

### How does Tandemn fit with Kubernetes, Dynamo, and vLLM?

These components work at different levels:

| Component | Responsibility |
| --- | --- |
| Tandemn / Koi | Plan workload configuration and placement across available clusters and accelerators. |
| Tandemn cluster operator | Reconcile the plan into serving resources and report cluster state. |
| Serving framework, such as NVIDIA Dynamo, llm-d, or AIBrix | Manage the serving deployment within a cluster. |
| Inference engine, such as vLLM or SGLang | Load models and execute inference. |
| Kubernetes | Schedule and run the deployment's pods on cluster nodes. |

Koi makes deployment decisions above the serving stack. Applications continue to send inference requests to their serving endpoints.

## Installing in your cluster

### What am I installing?

The Kubernetes reference deployment has two packages, distributed as Helm charts:

- **A central control plane:** Koi, a resource map service that combines cluster reports, and a bundled PostgreSQL database for the control-plane services.
- **A per-cluster operator:** installed in each worker cluster to apply deployment plans and report available resources and job status.

The control plane runs in a Kubernetes cluster you choose as the central cluster. Worker clusters run the inference workloads. See the [architecture diagram](/architecture/tandemn-architecture/) for the component layout.

### What infrastructure do I need first?

The reference architecture assumes:

- Kubernetes clusters with the compute resources you intend to use for inference.
- The serving frameworks and inference engines required by your workloads.
- A federated metrics time-series database containing metrics from the participating clusters.
- Connectivity for operators to report resource state to the central resource map service, and for the planner to read metrics.

The control-plane package includes PostgreSQL. The serving stack and federated metrics database are existing infrastructure that Tandemn integrates with.

### Do I need multiple clouds or different GPU types?

No. Tandemn can plan within a single resource pool as well as across heterogeneous pools. Multiple clusters, clouds, and accelerator types expand the placement choices available to the planner; they are not a requirement for using it. See the [deployment overview](https://www.tandemn.com/product/deploy).

### Which serving frameworks and accelerators can I use?

The reference architecture describes integration with serving frameworks such as NVIDIA Dynamo, llm-d, and AIBrix, and metrics from engines such as vLLM and SGLang. Koi targets heterogeneous accelerators, including NVIDIA GPUs, AMD GPUs, and Google TPUs.

A deployment needs a compatible combination of hardware, model, engine, and framework integration. The architecture examples describe the intended integrations; check the component documentation for the version you install to establish compatibility.

## Submitting and running workloads

### How do I tell Tandemn what to run?

Submit deployment intent through the Tandemn Jobs HTTP API. A job describes the workload's requirements, such as serving objectives for an online endpoint or a completion deadline for offline inference.

The job can also carry restrictions on clusters and accelerator types, engine configuration fields, and Kubernetes labels or annotations. Koi uses these requirements when planning the deployment.

### Can online serving and batch inference share resources?

Yes. Koi handles both online and offline inference jobs. Online jobs have serving requirements; batch jobs can have completion deadlines. Planning them together lets Koi consider their competing demands on the same capacity.

A service-level objective, or **SLO**, is a performance target for a workload, such as a latency or throughput target. It tells the planner what performance the deployment needs to deliver.

### What decisions does Koi make?

Koi plans workload placement and configuration together. Depending on the available integration and job constraints, choices include accelerator selection, serving configuration, parallelism, and replica counts across the fleet.

It evaluates alternatives against workload objectives and available capacity. The [planning algorithm](https://www.tandemn.com/product/algorithm) also accounts for prediction uncertainty and the disruption involved in changing a deployment.

### How does a job become a running deployment?

In the Kubernetes reference architecture:

1. You submit a job with its requirements through the Jobs API.
2. Cluster operators report resource capacity and the status of managed workloads.
3. Koi reads the jobs, the combined resource map, and serving metrics to produce a `GlobalPlan`.
4. Each cluster operator reconciles its `ClusterPlan` into resources managed by the installed serving framework.
5. Deployment state and performance feed into subsequent planning cycles.

A plan expresses the desired deployment. The operator and serving framework carry out the changes, so producing a plan and having a running model are separate steps.

### How often can the deployment plan change?

Koi runs periodically; the documented default interval is five minutes. Each planning tick considers new jobs, resource changes, and metrics from existing deployments.

Replanning does not require changing every deployment. The algorithm accounts for reconfiguration costs, including model loading, warm-up, and draining, when comparing a change with retaining the current configuration.

## Resource state and performance

### How does Koi know which resources are available?

Each operator reports a `ClusterResourceMap` containing compute resources and managed job state. The central resource map service combines these reports into a `GlobalResourceMap` for Koi.

The map represents capacity, occupancy, pending work, topology, and installed components. This lets planning account for the shape of a deployment and its environment rather than treating all accelerators as interchangeable. See the [resource map reference](/reference/resource-map/).

### Where do performance metrics come from?

Koi reads metrics through adapters for time-series databases and applications. The architecture describes sources such as Prometheus/Thanos, OpenTSDB, Grafana Mimir, and Cortex, with application metrics from vLLM, SGLang, and NVIDIA DCGM.

The reference deployment assumes metrics from all clusters are already available through a federated metrics database. Operators report resource and job state; the metrics integration provides observed serving and hardware performance.

### What does it mean that Koi learns from deployments?

Koi uses observed performance to improve the evidence behind future plans. As models, traffic, and hardware change, deployment results help it refine its expectations about which configurations will meet a workload's requirements.

Language models help propose candidate configurations. Deterministic tools predict performance, score candidates, and validate constraints before a plan is selected. See the [algorithm documentation](https://www.tandemn.com/product/algorithm) for the details.

### Where should I go next?

Read [Tandemn Architecture](/architecture/tandemn-architecture/) for the deployment layout and [Tandemn Planner (Koi)](/architecture/koi/) for the planner's inputs and outputs. Use the setup instructions for the component and version you intend to deploy; this FAQ explains the system rather than providing installation commands.
