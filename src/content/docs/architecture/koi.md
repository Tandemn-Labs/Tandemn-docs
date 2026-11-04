---
title: Tandemn Planner (Koi)
---

Koi is Tandemn's planner, deploying mixed inference jobs across heterogeneous clusters (multi-cloud, hybrid) and heterogeneous accelerators (Nvidia, AMD, Google TPU etc). Koi runs in a continuous loop, producing a plan every tick (default: 5 mins). In every planning tick, Koi takes into account the new set of jobs and resources while also learning from existing deployments through metrics.

### Simplified view

<img src="/diagrams/planner-as-a-blackbox-light.svg" alt="Planner as a black box" class="dark:sl-hidden" />
<img src="/diagrams/planner-as-a-blackbox-dark.svg" alt="Planner as a black box" class="light:sl-hidden" />

Koi can be understood as a black-box planner with the inputs/outputs as shown. For more details about how this works in a larger Kubernetes architecture, refer to [Tandemn Architecture](/architecture/tandemn-architecture/).
