---
title: Development On Apple Silicon with Lima
description: A concise tutorial detailing the setup of development VMs on Apple Silicon MacBooks.
date: 2024-02-12
image: lima-and-mac.jpg
tags:
- vm
- lima
- arm
- macbook
- apple silicon
---

<div class="message-box">
<p>"Lima launches Linux virtual machines with automatic file sharing and port forwarding (similar to WSL2)." – Lima Website
</div>

{% image "./lima-and-mac.jpg", "macbook language icon", [900] %}

In this article, I'll demonstrate how to provision a Virtual Machine for software development that currently lacks support for Apple silicon. I'll be utilizing [Lima VMs](https://lima-vm.io/) to establish development and testing environments specifically tailored for the [cri-o](https://github.com/cri-o/cri-o) project.

### Installation

It's better to install `Lima` with `brew`, follow the instruction [here.](https://lima-vm.io/docs/installation/)

### Create VM 

Next step is create a VM:

```bash
limactl create crio
INFO[0000] Creating an instance "crio" from template://default (Not from template://crio)
WARN[0000] This form is deprecated. Use `limactl create --name=crio template://default` instead
? Creating an instance "crio"  [Use arrows to move, type to filter]
  Proceed with the current configuration
> Open an editor to review or modify the current configuration
  Choose another template (docker, podman, archlinux, fedora, ...)
  Exit
```
Choose the *"Open an editor to review or modify the current configuration"* option to review and modify the VM configuration. (Ensure the `$EDITOR` variable is declared to utilize this option).

The `arch` option:

```yaml
arch: x86_64
```

If you choose wrong arch option the following error will be raised:

```bash
INFO[0028] Starting the instance "crio" with VM driver "qemu"
INFO[0028] QEMU binary "/opt/homebrew/bin/qemu-system-aarch64" seems properly signed with the "com.apple.security.hypervisor" entitlement
FATA[0023] [skipped to download: "https://cloud-images.ubuntu.com/releases/23.10/release-20240125/ubuntu-23.10-server-cloudimg-amd64.img": unsupported arch: "x86_64"]
```

As you can see from the `lima.yaml` file, the default template is `Ubuntu 23.10` on `x86_64`.

We'll use unstable artifacts from [the kubic repository](https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/unstable/xUbuntu_23.10).

Lets mount the directory with project:

```yaml
mounts:
  # Location of cri-o repository
  - location: "~/Documents/dev/opensource/cri-o"
    writable: true
```

Next add provision scripts in order to install all needed runtime dependencies:

Upgrade the instance on boot 

```yaml
upgradePackages: true
```

The `provision` option, this part follows the [install.md](https://github.com/cri-o/cri-o/blob/main/install.md#debian-bullseye-or-higher---ubuntu-2004-or-higher) guide:

```yaml
provision:
# `system` is executed with the root privilege
- mode: system
  script: |
    #!/bin/bash
    # Install deps
    set -eux -o pipefail
    export DEBIAN_FRONTEND=noninteractive
    export OS=xUbuntu_22.04
    export VERSION=1.24
    echo "deb [signed-by=/usr/share/keyrings/libcontainers-archive-keyring.gpg] https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/$OS/ /" > /etc/apt/sources.list.d/devel:kubic:libcontainers:stable.list
    echo "deb [signed-by=/usr/share/keyrings/libcontainers-crio-archive-keyring.gpg] https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable:/cri-o:/$VERSION/$OS/ /" > /etc/apt/sources.list.d/devel:kubic:libcontainers:stable:cri-o:$VERSION.list
    mkdir -p /usr/share/keyrings
    curl -L https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable/$OS/Release.key | gpg --dearmor -o /usr/share/keyrings/libcontainers-archive-keyring.gpg
    curl -L https://download.opensuse.org/repositories/devel:/kubic:/libcontainers:/stable:/cri-o:/$VERSION/$OS/Release.key | gpg --dearmor -o /usr/share/keyrings/libcontainers-crio-archive-keyring.gpg
    apt-get update -qq && apt-get install -y \
      libbtrfs-dev \
      containers-common \
      git \
      bats \
      libassuan-dev \
      libdevmapper-dev \
      libglib2.0-dev \
      libc6-dev \
      libgpgme-dev \
      libgpg-error-dev \
      libseccomp-dev \
      libsystemd-dev \
      libselinux1-dev \
      pkg-config \
      go-md2man \
      cri-o-runc \
      libudev-dev \
      software-properties-common \
      gcc \
      make
    # Install golang
    wget https://go.dev/dl/go1.21.0.linux-amd64.tar.gz -O go.tar.gz
    tar -C /usr/local -xzvf go.tar.gz
    rm -rf go
    echo 'export GOROOT=/usr/local/go' >> ~/.profile
    echo 'export GOPATH=$HOME/go' >> ~/.profile
    echo 'export PATH=$GOPATH/bin:$GOROOT/bin:$PATH' >> ~/.profile
# `user` is executed without the root privilege
- mode: user
  script: |
    #!/bin/bash
    set -eux -o pipefail
    echo 'export GOROOT=/usr/local/go' >> ~/.bashrc
    echo 'export GOPATH=$HOME/go' >> ~/.bashrc
    echo 'export PATH=$GOPATH/bin:$GOROOT/bin:$PATH' >> ~/.bashrc
```

Now everything is ready to bootstrat our VM, close editor start the VM:

```bash
limactl start crio
INFO[0000] Using the existing instance "crio"
INFO[0000] Starting the instance "crio" with VM driver "qemu"
INFO[0000] [hostagent] hostagent socket created at /Users/user/.lima/crio/ha.sock
INFO[0001] [hostagent] Using system firmware ("/opt/homebrew/share/qemu/edk2-x86_64-code.fd")
INFO[0001] [hostagent] Starting QEMU (hint: to watch the boot progress, see "/Users/user/.lima/crio/serial*.log")
INFO[0001] SSH Local Port: 52867
INFO[0001] [hostagent] Waiting for the essential requirement 1 of 4: "ssh"
INFO[0041] [hostagent] Waiting for the essential requirement 1 of 4: "ssh"
INFO[0051] [hostagent] Waiting for the essential requirement 1 of 4: "ssh"
INFO[0061] [hostagent] Waiting for the essential requirement 1 of 4: "ssh"
INFO[0067] [hostagent] The essential requirement 1 of 4 is satisfied
INFO[0067] [hostagent] Waiting for the essential requirement 2 of 4: "user session is ready for ssh"
INFO[0107] [hostagent] Waiting for the essential requirement 2 of 4: "user session is ready for ssh"
INFO[0147] [hostagent] Waiting for the essential requirement 2 of 4: "user session is ready for ssh"
INFO[0188] [hostagent] Waiting for the essential requirement 2 of 4: "user session is ready for ssh"
INFO[0228] [hostagent] Waiting for the essential requirement 2 of 4: "user session is ready for ssh"
INFO[0268] [hostagent] Waiting for the essential requirement 2 of 4: "user session is ready for ssh"
```

You can check the logs of VM here:

```bash
tail -f /Users/user/.lima/crio/serial.log
```

If everything is functioning properly, after starting the VM, executing the `limactl shell crio` command should open a shell and process the last commands.

```bash
sudo -i
git clone https://github.com/containers/conmon
cd conmon
env "PATH=$PATH" make
env "PATH=$PATH" make install
# Link runc to tests
ln -s /usr/local/bin/runc /usr/bin/runc
```

Lets start some tests:

```bash
# We need pass PATH variable to the sh shell
sudo -E env "PATH=$PATH" make testunit
```

Tip :cool:

[How to configure `lima` and `VSCode : Remote - SSH` plugin.](https://github.com/lima-vm/lima/discussions/1890#discussioncomment-7221563)

Happy coding!
