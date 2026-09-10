# IT Infrastructure Operating Budget

**Planning period:** 2026  
**Environment:** Production  
**Currency:** USD

The infrastructure operating budget for production is **$24000.00**<!--vmark=budget.total_budget--> /month.

The Kubernetes cluster must run continuously and is expected to maintain enough spare capacity for normal workload fluctuations. We reserve **20.00%**<!--vmark=budget.reserved_capacity--> of compute capacity as headroom.

## Monthly operating budget

| Cost                              | USD |
|------------------------------------|----:|
| Managed Kubernetes control plane   | 300 |
| Load balancers                     | 400 |
| Persistent storage                 | 1800 |
| Database                           | 4200 |
| Network egress                     | 2200 |
| Monitoring and logging             | 1600 |
| Backups                            | 800 |
| Other infrastructure               | 700 |

```vmark #budget
total_budget = 24000
reserved_capacity = 20%

other_costs = SUM(USD)
WorkerBudget = total_budget - other_costs
WorkerBudgetPercentage = WorkerBudget / total_budget
```

The remaining budget is available for Kubernetes worker nodes.

**Worker-node budget:** **$12000.00**<!--vmark=budget.WorkerBudget--> /month

**Available for worker nodes:** **50.00%**<!--vmark=budget.WorkerBudgetPercentage--> of the infrastructure budget

## Kubernetes worker nodes

The standard production worker is an `m6i.2xlarge` instance, costing
**$250.00**<!--vmark=kubernetes.worker_node_cost--> per month, with
**8**<!--vmark=kubernetes.cpu_per_worker--> vCPU and
**32**<!--vmark=kubernetes.memory_per_worker--> GB of memory.

The cluster may spend at most the worker-node budget, while 20% of the resulting capacity must remain available as operational headroom.

```vmark #kubernetes
worker_node_cost = 250
cpu_per_worker = 8
memory_per_worker = 32

MaxNodes = ROUND(budget.WorkerBudget / worker_node_cost - 0.5, 0)
UsableNodes = ROUND(MaxNodes * (1 - budget.reserved_capacity) - 0.5, 0)

TotalCPU = MaxNodes * cpu_per_worker
UsableCPU = ROUND(TotalCPU * (1 - budget.reserved_capacity) - 0.5, 0)

TotalMemory = MaxNodes * memory_per_worker
UsableMemory = ROUND(TotalMemory * (1 - budget.reserved_capacity) - 0.5, 0)
```

Therefore the maximum affordable Kubernetes cluster is:

**Maximum worker nodes:** **48**<!--vmark=kubernetes.MaxNodes--> (**38**<!--vmark=kubernetes.UsableNodes--> after the 20% headroom reserve)

This provides:

**Total CPU:** **384 vCPU**<!--vmark=kubernetes.TotalCPU-->  
**Usable CPU after 20% headroom:** **307 vCPU**<!--vmark=kubernetes.UsableCPU-->

**Total memory:** **1536 GB**<!--vmark=kubernetes.TotalMemory-->  
**Usable memory after 20% headroom:** **1228 GB**<!--vmark=kubernetes.UsableMemory-->

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
  "command": "eval",
  "visimark": "0.1.1",
  "status": "ok",
  "file": "infrastructure-budget.md",
  "values": {
    "budget.total_budget": "24000",
    "budget.reserved_capacity": "0.2",
    "budget.other_costs": "12000",
    "budget.WorkerBudget": "12000",
    "budget.WorkerBudgetPercentage": "0.5",
    "kubernetes.worker_node_cost": "250",
    "kubernetes.cpu_per_worker": "8",
    "kubernetes.memory_per_worker": "32",
    "kubernetes.MaxNodes": "48",
    "kubernetes.UsableNodes": "38",
    "kubernetes.TotalCPU": "384",
    "kubernetes.UsableCPU": "307",
    "kubernetes.TotalMemory": "1536",
    "kubernetes.UsableMemory": "1228"
  },
  "assertions": [],
  "charts": []
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
