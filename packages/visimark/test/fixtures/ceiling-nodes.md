# Kubernetes workers needed

Required CPU **307**<!--vmark=demand.RequiredCPU--> vCPU.
Each worker provides **8**<!--vmark=demand.CPUPerWorker--> vCPU.

```vmark #demand
RequiredCPU = 307
CPUPerWorker = 8
```

```vmark #kubernetes
MinNodes = CEILING(demand.RequiredCPU / demand.CPUPerWorker, 1)
```

Minimum worker nodes: **39**<!--vmark=kubernetes.MinNodes-->
