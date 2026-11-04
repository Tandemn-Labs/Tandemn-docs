---
title: Tandemn Architecture
---

This page documents the reference architecture that Tandemn assumes for a complete Tandemn-enabled multi-cluster inference deployment. 

<img src="/diagrams/tandemn-reference-architecture-light.svg" alt="Tandemn reference architecture" class="dark:sl-hidden" />
<img src="/diagrams/tandemn-reference-architecture-dark.svg" alt="Tandemn reference architecture" class="light:sl-hidden" />

The reference architecture is split into 2 key components - the Tandemn control plane and the Tandemn per-cluster Kubernetes operator.

The Tandemn control plane is built around core components that allow the planner to understand the global state of all clusters and effectively make multi-cluster inference deployment plans.

The per-cluster Tandemn Kubernetes operator is responsible for reconciling each cluster's plan into actual model deployment resources and maintaining an up-to-date cluster map that covers available resources as well as status of running jobs.

## Tandemn control plane

The Tandemn control plane is distributed as a Helm chart. This package will be installed in a Kubernetes cluster chosen to be the central / control cluster, from which decisions will be made about inference deployments in all clusters. These are the following components in the Tandemn control plane:

### Planner (Koi)

The core component is Tandemn Koi's planner, which can be viewed as a black-box component requiring 3 inputs: (1) Jobs, (2) Metrics, (3) GlobalResourceMap; and producing 1 output: (1) GlobalPlan.

#### Input: Jobs

Koi handles both online and offline inference jobs, and takes in jobs through a HTTP endpoint using the Tandemn Jobs API. The Job API reflects deployment intent, such as serving objectives, deadlines etc. It can also encode restrictions like  clusters, accelerator types, or additional engine-config fields or Kubernetes labels/annotations. 

Find the schemas here: [Job schemas](/reference/job/)

#### Input: Metrics

Koi's metrics uses an adapter interface to ingest metrics from different metrics TSDBs (e.g. Prometheus/Thanos Store, OpenTSDB, Grafana Mimir, Cortex) and understand metrics from different applications (e.g. vLLM, SGLang, Nvidia DCGM). This adapter interface can be easily extended to custom TSDBs or to custom applications (e.g. new inference engines, new accelerators).

*Note: The reference architecture assumes that a federated metrics time-series database already exists, containing metrics from all clusters.*

#### Input: GlobalResourceMap

This is the live resource map of all clusters. For each cluster, it shows the current map of compute resources and the status of jobs that are running on them.

Find the schemas here: [Resource map schemas](/reference/resource-map/)

#### Output: GlobalPlan

At each planning tick, Koi produces a `GlobalPlan`, reflecting the deployment decisions for all clusters.

Find the schemas here: [Plan schemas](/reference/plan/)

### Resource Map Service

The resource map service is a small gRPC service built in Go. It has 2 RPC calls: (1) SetClusterResourceMap, (2) GetGlobalResourceMap. The first call allows individual tandemn-k8s-operators in each cluster to independently report live resource map state at a set frequency. The second call produces a global map, produced from concatenating the latest version of each cluster's live resource map.

### PostgreSQL Database

The Tandemn control plane is bundled with a small PostgreSQL database instance. This server instance is shared across the different services in the control plane, with each service owning its own sub-database within the shared instance.

## Per-cluster Kubernetes operator

The Tandemn Kubernetes operator is distributed as a Helm chart, and is installed in each worker cluster.

The operator works on top of existing inference serving frameworks and engines, such as Nvidia Dynamo, llm-d, AIBrix. It reconciles the `ClusterPlan` into the custom resources owned by the different serving frameworks, and allows the framework operators to continue to manage the deployment within the cluster.

The operator also reports a `ClusterResourceMap` to the resource map service within Tandemn control plane at a fixed frequency. This resource map contains a map of all compute resources that can be viewed by the operator, as well as the status of all jobs managed by the Tandemn planner (Koi).
