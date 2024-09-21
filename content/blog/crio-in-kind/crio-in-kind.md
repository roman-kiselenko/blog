---
title: Use CRI-O Container Runtime with KIND
description: Learn how to build a KIND (Kubernetes IN Docker) node image with a specific Kubernetes version and CRI-O container runtime.
date: 2024-05-08
image: crio-in-kind.jpg
tags:
- crio
- cri
- kind
- kubernetes
- k8s
---

<div class="message-box">
<p>KIND uses containerd by default as container runtime, however, it is possible to switch it by CRI-O.</p>
</div>

{% image "./crio-in-kind.jpg", "crio-in-kind", [900] %}

In this article, I'll demonstrate how to build [node image](https://kind.sigs.k8s.io/docs/design/node-image/) with particular Kubernetes version and [cri-o](https://github.com/cri-o/cri-o) container runtime.

### Build Base Image

We need `kind` sources in order to build the `base image`:

```sh
$ git clone git@github.com:kubernetes-sigs/kind.git
$ cd kind/images/base
$ make quick
./../../hack/build/init-buildx.sh
docker buildx build  --load --progress=auto -t gcr.io/k8s-staging-kind/base:v20240508-19df3db3 --pull --build-arg GO_VERSION=1.21.6  .
### ... some output here
```
The image `gcr.io/k8s-staging-kind/base:v20240508-19df3db3` is our [base image](https://kind.sigs.k8s.io/docs/design/base-image/). We'll use it for `node image` building.

### Build Node Image

Before start building `node image` we need kubernetes sources at `$GOPATH`.

```sh
$ mkdir -p "$GOPATH"/src/k8s.io/kubernetes
$ K8S_VERSION=v1.30.0
$ git clone --depth 1 --branch ${K8S_VERSION} https://github.com/kubernetes/kubernetes.git "$GOPATH"/src/k8s.io/kubernetes
```

Now let's build node image:

```sh
$ kind build node-image --base-image gcr.io/k8s-staging-kind/base:v20240508-19df3db3
Starting to build Kubernetes
+++ [0508 15:41:04] Verifying Prerequisites....
+++ [0508 15:41:04] Building Docker image kube-build:build-14d7110ae1-5-v1.30.0-go1.22.2-bullseye.0
+++ [0508 15:42:49] Creating data container kube-build-data-14d7110ae1-5-v1.30.0-go1.22.2-bullseye.0
+++ [0508 15:42:50] Syncing sources to container
+++ [0508 15:42:54] Running build command...
+++ [0508 15:42:46] Building go targets for linux/arm64
    k8s.io/kubernetes/cmd/kube-apiserver (static)
    k8s.io/kubernetes/cmd/kube-controller-manager (static)
    k8s.io/kubernetes/cmd/kube-proxy (static)
    k8s.io/kubernetes/cmd/kube-scheduler (static)
    k8s.io/kubernetes/cmd/kubeadm (static)
    k8s.io/kubernetes/cmd/kubectl (static)
    k8s.io/kubernetes/cmd/kubelet (non-static)
+++ [0508 15:45:16] Syncing out of container
+++ [0508 15:45:22] Building images: linux-arm64
+++ [0508 15:45:22] Starting docker build for image: kube-apiserver-arm64
+++ [0508 15:45:22] Starting docker build for image: kube-controller-manager-arm64
+++ [0508 15:45:22] Starting docker build for image: kube-scheduler-arm64
+++ [0508 15:45:22] Starting docker build for image: kube-proxy-arm64
+++ [0508 15:45:22] Starting docker build for image: kubectl-arm64
+++ [0508 15:45:32] Deleting docker image registry.k8s.io/kubectl-arm64:v1.30.0
+++ [0508 15:45:32] Deleting docker image registry.k8s.io/kube-scheduler-arm64:v1.30.0
+++ [0508 15:45:35] Deleting docker image registry.k8s.io/kube-proxy-arm64:v1.30.0
+++ [0508 15:45:35] Deleting docker image registry.k8s.io/kube-controller-manager-arm64:v1.30.0
+++ [0508 15:45:40] Deleting docker image registry.k8s.io/kube-apiserver-arm64:v1.30.0
+++ [0508 15:45:40] Docker builds done
Finished building Kubernetes
Building node image ...
Building in container: kind-build-1715175957-1495463435
Image "kindest/node:latest" build completed.
```

Now let's build our image with CRI-O on top of `kindest/node:latest`:

{% codetitle "", "Dockerfile" %}

```dockerfile
FROM kindest/node:latest

ARG CRIO_VERSION
ARG PROJECT_PATH=prerelease:/$CRIO_VERSION

RUN echo "Installing Packages ..." \
    && apt-get clean \
    && apt-get update -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    software-properties-common vim gnupg \
    && echo "Installing cri-o ..." \
    && curl -fsSL https://pkgs.k8s.io/addons:/cri-o:/$PROJECT_PATH/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/cri-o-apt-keyring.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/cri-o-apt-keyring.gpg] https://pkgs.k8s.io/addons:/cri-o:/$PROJECT_PATH/deb/ /" | tee /etc/apt/sources.list.d/cri-o.list \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get --option=Dpkg::Options::=--force-confdef install -y cri-o \
    && sed -i 's/containerd/crio/g' /etc/crictl.yaml \
    && systemctl disable containerd \
    && systemctl enable crio
```

Next let's build image with [prerelease:v1.30](https://github.com/cri-o/packaging/blob/main/README.md#prereleases) CRI-O version:

```sh
$ CRIO_VERSION=v1.30
$ docker build --build-arg CRIO_VERSION=$CRIO_VERSION -t kindnode/crio:$CRIO_VERSION .
```

With builded `node image` we can create the kind cluster:

{% codetitle "", "kind-crio.yaml" %}

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      criSocket: unix:///var/run/crio/crio.sock
  - |
    kind: JoinConfiguration
    nodeRegistration:
      criSocket: unix:///var/run/crio/crio.sock
- role: worker
  kubeadmConfigPatches:
  - |
    kind: JoinConfiguration
    nodeRegistration:
      criSocket: unix:///var/run/crio/crio.sock
```

### Create KIND cluster

Let's create cluster:

```sh
$ kind create cluster --image kindnode/crio:$CRIO_VERSION --config ./kind-crio.yaml
Creating cluster "kind" ...
 ✓ Ensuring node image (kindnode/crio:v1.30) 🖼
 ✓ Preparing nodes 📦 📦
 ✓ Writing configuration 📜
 ✓ Starting control-plane 🕹️
 ✓ Installing CNI 🔌
 ✓ Installing StorageClass 💾
 ✓ Joining worker nodes 🚜
Set kubectl context to "kind-kind"
You can now use your cluster with:

kubectl cluster-info --context kind-kind

Have a question, bug, or feature request? Let us know! https://kind.sigs.k8s.io/#community 🙂
```

### Deploy example

Let's try simple [`kubectl apply -f httpbin.yaml`](https://github.com/istio/istio/blob/master/samples/httpbin/httpbin.yaml):

{% codetitle "", "httpbin.yaml" %}

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: httpbin
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin
  labels:
    app: httpbin
    service: httpbin
spec:
  ports:
  - name: http
    port: 8000
    targetPort: 8080
  selector:
    app: httpbin
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: httpbin
spec:
  replicas: 1
  selector:
    matchLabels:
      app: httpbin
      version: v1
  template:
    metadata:
      labels:
        app: httpbin
        version: v1
    spec:
      serviceAccountName: httpbin
      containers:
      - image: docker.io/kong/httpbin
        imagePullPolicy: IfNotPresent
        name: httpbin
        # Same as found in Dockerfile's CMD but using an unprivileged port
        command:
        - gunicorn
        - -b
        - 0.0.0.0:8080
        - httpbin:app
        - -k
        - gevent
        env:
        # Tells pipenv to use a writable directory instead of $HOME
        - name: WORKON_HOME
          value: /tmp
        ports:
        - containerPort: 8080
```

Use `port-forward`:

```sh
$ kubectl port-forward svc/httpbin 8000:8000 -n default

Forwarding from 127.0.0.1:8000 -> 8080
Forwarding from [::1]:8000 -> 8080
```

In another terminal:

```sh
curl -X GET localhost:8000/get
{
  "args": {}, 
  "headers": {
    "Accept": "*/*", 
    "Host": "localhost:8000", 
    "User-Agent": "curl/8.4.0"
  }, 
  "origin": "127.0.0.1", 
  "url": "http://localhost:8000/get"
}
```

Everything is working like a charm :smile:

### Credits

* <small>[How to use CRI-O runtime with KIND](https://gist.github.com/aojea/bd1fb766302779b77b8f68fa0a81c0f2)</small>
* <small>[node image](https://kind.sigs.k8s.io/docs/design/node-image/)</small>

Happy coding!
