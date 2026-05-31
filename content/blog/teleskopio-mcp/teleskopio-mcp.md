---
title: The teleskopio MCP Server and llama.cpp
description: I'm going to show how MCP server works in the teleskopio application.
date: 2026-05-29
image: teleskopio+mcp.png
tags:
  - llm
  - golang
  - mcp
  - kubernetes
  - k8s
  - teleskopio
---

<div class="message-box">
	This post I wrote just by hand, english is not my native language and I've not use any LLM to fix or polish the text.
</div>

{% image "./teleskopio+mcp.png", "teleskopio-mcp", [900] %}

I've a pet project the [teleskopio](https://teleskopio.github.io). It's a kubernetes web UI to overview and manage cluster.
I started developing my own dashboard a year ago; [teleskopio](https://teleskopio.github.io) was born after struggling to manage clusters with the terminal.

One of the [planned feature was an MCP](https://github.com/teleskopio/teleskopio/issues/15) server implementation. Since I'm a big fun of local models, lurking a lot on the [u/LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/) sub.
I decide to add an [modelcontextprotocol](https://modelcontextprotocol.io/docs/getting-started/intro) server to the teleskopio by using llama.cpp and local model.

The teleskopio build around Kubernetes watchers and Dynamic resources, hence there is no hardcoded schema and required kubernetes version to work with, all resources loaded at runtime and updated by events subscriptions. The same api are under the hood of MCP integration.

First MVP integration is 3 tools, 1 prompt and completion accourding to the [modelcontextprotocol](https://modelcontextprotocol.io/docs/getting-started/intro).
As an MCP client I'm going to use [llama.cpp](https://github.com/ggml-org/llama.cpp) because it has a very robust MCP and tools integration.

Lets start (my host is MacOS btw):

Use [colima](https://github.com/abiosoft/colima) as docker engine.

```sh
colima status
INFO[0000] colima is running using macOS Virtualization.Framework
INFO[0000] arch: aarch64
INFO[0000] runtime: docker
INFO[0000] mountType: virtiofs
INFO[0000] docker socket: unix:///Users/roman/.colima/default/docker.sock
INFO[0000] containerd socket: unix:///Users/roman/.colima/default/containerd.sock
```

Spin up a [kind](https://kind.sigs.k8s.io) cluster.

```sh
docker ps
CONTAINER ID   IMAGE                  COMMAND                  CREATED      STATUS       PORTS                       NAMES
74a462cbf7de   kindest/node:v1.35.0   "/usr/local/bin/entr…"   4 days ago   Up 2 hours   127.0.0.1:50025->6443/tcp   kind-control-plane
```

Run teleskopio with `mcp.enabled = true`, (the way teleskopio [is deployed doesnt matter](https://teleskopio.github.io/install/#install), it can be in the docker, on the host, by helm).

```sh
cat config.yaml | yq .mcp
enabled: true
```

Spin up llama.cpp server with `Qwen3.6-27B-GGUF-8bit` model and add teleskopio mcp server (use llama-mcp-proxy enabled).

```sh
llama-server --port 8083 \
  --webui-mcp-proxy \
  -hf unsloth/Qwen3.6-27B-GGUF-8bit:UD-Q8_K_XL \
  -c 640000 \
  -ctk q4_0 \
  -ctv q4_0 \
  --alias Qwen3.6-27B-GGUF-8bit \
  --cache-reuse 32 \
  -ngl 35 \
  --reasoning on
```

{% image "./add-mcp-llama.png", "llama.cpp add mcp server", [900] %}

As an example of LLM usage I'm going to deploy 5 pods in the different namespaces. 1 pending with wrong image name (busyboxx), 2 failed (exit 1), 2 nginx containers without any problem.

{% image "./deploy-workloads.png", "kubernetes pods", [1100] %}

The teleskopio MCP contains a bunch of tools to fetch resources from cluster and one prompt to diagnose pods problems.

```md
You're an SRE engineer. Follow these steps to investigate pods issues and generate report for the user:

1. Fetch pods resource from the [THE SERVER ENDPOINT] server by using api_resources tool with kind Pod
2. Use list_resources tool to fetch Pod resources, use empty namespace argument to fetch pods across all namespaces, use field_selector status.phase!=Running to list pods in not Running state, request short resources overview.
3. If any pods returned look for CrashLoopBackOff, ImagePullBackOff, OOMKilled, FailedScheduling, Unhealthy, BackOff pod phase by requesting those full resources to analize.

CrashLoopBackOff: Looking logs for application errors
ImagePullBackOff: Wrong image name/tag or pull secrets
Pending: Insufficient resources, node selector mismatch, PVC not bound
OOMKilled: Container memory limit too low for workload or workload has resource leaking.
FailedMount: Missing ConfigMap, Secret, or PV

Return short report for the user.
```

By typing `/po...` the MCP prompt appears and arguments autocompletion fired (our servers from teleskopio).

{% image "./pods-diagnose-prompt.png", "pods diagnose prompt", [1100] %}

After submitting and waiting a for a while (5 mins) our LLM perform 4 turns and 3 tool calls and spend 10% of the context (64000)

{% image "./llm-stats.png", "llm stats", [1100] %}

Here is the report:

```md
# 🛠️ Pod Diagnosis Report

**Cluster:** `https://127.0.0.1:50025`
**Scan Scope:** All namespaces, non-Running pods
**Findings:** 3 problematic pods detected

---

### 🔴 1. `bad-image-pod-example`

- **Namespace:** `default`
- **Phase:** `Pending`
- **Issue:** `ImagePullBackOff`
- **Details:** Kubelet failed to pull image `busyboxx:latest`. Error: `pull access denied, repository does not exist or may require authorization`.
- **Root Cause:** Typo in image name (`busyboxx` instead of `busybox`) or missing/incorrect `imagePullSecrets`.
- **Recommendation:** Correct the image name/tag in the pod/deployment spec. If using a private registry, verify attached pull secrets.

### 🟠 2. `failed-command-example`

- **Namespace:** `default`
- **Phase:** `Failed`
- **Issue:** Container terminated with `Exit Code 1` (`Error`)
- **Details:** Pod command is explicitly set to `/bin/sh -c exit 1`, causing immediate failure. `restartPolicy: Never` prevents retries.
- **Recommendation:** This is an application/command configuration error, not a cluster issue. Review and correct the container's `command` or `args`.

### 🟠 3. `another-example`

- **Namespace:** `kube-system`
- **Phase:** `Failed`
- **Issue:** Container terminated with `Exit Code 1` (`Error`)
- **Details:** Identical to above; runs `/bin/sh -c exit 1` and fails immediately.
- **Recommendation:** Verify the container entrypoint/command. Ensure the workload doesn't exit prematurely on startup.

---

### 📊 Summary

- **ImagePullBackOff:** 1 pod (invalid image name)
- **Failed/Exit Error:** 2 pods (explicit `exit 1` command)
- **No detections for:** `CrashLoopBackOff`, `OOMKilled`, `FailedScheduling`, `Unhealthy`, or `BackOff` in this scan.
- **Action Required:** Fix image name for `bad-image-pod-example` and review container commands for the two `Failed` pods.
```

### Conclusion

TBH I'm impressed, right now the MCP protocol (<small>[it's still doubthfull does we need this protocol?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)</small>) is pretty robust to build wonderfull things. The teleskopio MCP server are harmless and able to perform only simple tasks, but it's strong enough to use it in everyday job. :thinking:

### Credits

- <small>[llama.cpp MCP support](https://github.com/ggml-org/llama.cpp/pull/18655)</small>
- <small>[mcp-go](https://github.com/mark3labs/mcp-go)</small>
- <small>[teleskopio](https://teleskopio.github.io)</small>

Thanks and Happy coding!
