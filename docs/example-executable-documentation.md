# IT Infrastructure Operating Budget

**Planning period:** 2026  
**Environment:** Production  
**Currency:** USD

The infrastructure operating budget for production is **$24,000/month**.

The Kubernetes cluster must run continuously and is expected to maintain enough spare capacity for normal workload fluctuations. We reserve **20% of compute capacity** as headroom.

## Monthly operating budget

| Cost | Monthly USD |
|---|---:|
| Total infrastructure budget | 24000 |
| Managed Kubernetes control plane | 300 |
| Load balancers | 400 |
| Persistent storage | 1800 |
| Database | 4200 |
| Network egress | 2200 |
| Monitoring and logging | 1600 |
| Backups | 800 |
| Other infrastructure | 700 |

The remaining budget is available for Kubernetes worker nodes.

```vmark #budget
WorkerBudget = TotalInfrastructureBudget
             - ManagedKubernetesControlPlane
             - LoadBalancers
             - PersistentStorage
             - Database
             - NetworkEgress
             - MonitoringAndLogging
             - Backups
             - OtherInfrastructure

WorkerBudgetPercentage = WorkerBudget / TotalInfrastructureBudget * 100
```

**Worker-node budget:** **$12,000/month**<!--vmark=budget.WorkerBudget-->

**Available for worker nodes:** **50.00%** of the infrastructure budget<!--vmark=budget.WorkerBudgetPercentage-->

## Kubernetes worker nodes

The standard production worker is an `m6i.2xlarge` instance.

| Parameter | Value |
|---|---:|
| Worker node monthly cost | 250 |
| CPU per worker (vCPU) | 8 |
| Memory per worker (GB) | 32 |
| Reserved capacity | 20% |

The cluster may spend at most the worker-node budget, while 20% of the resulting capacity must remain available as operational headroom.

```vmark #kubernetes
MaxNodes = FLOOR(WorkerBudget / WorkerNodeMonthlyCost, 1)

UsableNodes = FLOOR(MaxNodes * (1 - ReservedCapacity), 1)

TotalCPU = MaxNodes * CPUPerWorker
UsableCPU = FLOOR(TotalCPU * (1 - ReservedCapacity), 1)

TotalMemory = MaxNodes * MemoryPerWorker
UsableMemory = FLOOR(TotalMemory * (1 - ReservedCapacity), 1)
```

Therefore the maximum affordable Kubernetes cluster is:

**Maximum worker nodes:** **48**<!--vmark=kubernetes.MaxNodes-->

This provides:

**Total CPU:** **384 vCPU**<!--vmark=kubernetes.TotalCPU-->  
**Usable CPU after 20% headroom:** **307 vCPU**<!--vmark=kubernetes.UsableCPU-->

**Total memory:** **1,536 GB**<!--vmark=kubernetes.TotalMemory-->  
**Usable memory after 20% headroom:** **1,228 GB**<!--vmark=kubernetes.UsableMemory-->

## Capacity decision

The production Kubernetes cluster is therefore budgeted for a maximum of **48 worker nodes**.

The number **48 is not an independently maintained configuration value**. It is derived from:

1. the total infrastructure budget,
2. all non-Kubernetes operating costs,
3. the worker-node price,
4. and the required capacity reserve.

If any of those assumptions change, the documented cluster capacity changes with them.

## Machine-readable output

The same document can be queried by tooling:

```text
visimark eval infrastructure-budget.md --json
```

For example:

```json
{
  "budget": {
    "WorkerBudget": 12000,
    "WorkerBudgetPercentage": 50
  },
  "kubernetes": {
    "MaxNodes": 48,
    "TotalCPU": 384,
    "UsableCPU": 307,
    "TotalMemory": 1536,
    "UsableMemory": 1228
  }
}
```

A deployment tool could consume `kubernetes.MaxNodes` directly rather than maintaining a second configuration file.

## Why this is executable documentation

This document is not **code explaining a budget**.

It is **budget documentation that executes**.

The tables are the inputs.  
The VisiMark formulas are the rules.  
The anchored numbers are materialized results.  
`eval` exposes those results to other tools.

For example, changing the worker price from `$250` to `$300` automatically changes the derived maximum cluster size:

```text
$12,000 / $300 = 40 workers
```

The document therefore remains the single place where both the **decision** and the **reasoning behind the decision** live.

The important direction is:

**documentation → computation → machine-readable output**

rather than:

**code → generated documentation**