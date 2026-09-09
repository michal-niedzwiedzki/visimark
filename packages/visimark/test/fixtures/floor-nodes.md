# Kubernetes worker-node capacity

Worker-node budget **12000**<!--vmark=budget.WorkerBudget--> USD/month.
Each worker costs **250**<!--vmark=budget.WorkerNodeMonthlyCost-->.

```vmark #budget
WorkerBudget = 12000
WorkerNodeMonthlyCost = 250
ReservedCapacity = 20%
CPUPerWorker = 8
MemoryPerWorker = 32
```

```vmark #kubernetes
MaxNodes = FLOOR(budget.WorkerBudget / budget.WorkerNodeMonthlyCost, 1)
TotalCPU = MaxNodes * budget.CPUPerWorker
UsableCPU = FLOOR(TotalCPU * (1 - budget.ReservedCapacity), 1)
TotalMemory = MaxNodes * budget.MemoryPerWorker
UsableMemory = FLOOR(TotalMemory * (1 - budget.ReservedCapacity), 1)
```

Maximum worker nodes: **48**<!--vmark=kubernetes.MaxNodes-->

Total CPU: **384**<!--vmark=kubernetes.TotalCPU-->
Usable CPU after 20% headroom: **307**<!--vmark=kubernetes.UsableCPU-->

Total memory: **1536**<!--vmark=kubernetes.TotalMemory-->
Usable memory after 20% headroom: **1228**<!--vmark=kubernetes.UsableMemory-->
