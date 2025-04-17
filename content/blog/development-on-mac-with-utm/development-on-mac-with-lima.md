---
title: Development On Apple Silicon with UTM
description: A concise tutorial detailing the setup of development VMs on Apple Silicon MacBooks.
date: 2025-04-17
image: UTM-Fedora.jpg
tags:
- vm
- utm
- arm
- macbook
- apple silicon
---

<div class="message-box">
<p>"UTM is an app for running other operating systems on your iPhone or iPad. It is not for running iOS on other systems. This allows you, among other things, to run Windows or Linux on your iOS device at a usable speed." – UTM Website
</div>

{% image "./UTM-Fedora.jpeg", "", [900] %}

In this article I'll utilizing [UTM VMs](https://getutm.app/) to establish Linux development environments on Apple silicon.

This article uses the same technic I've described [here](/blog/development-on-mac-with-lima).

### Dependencies

It's better to install `UTM` with `brew`, `brew install --cask utm`.

Install `brew install cdrtools` to create `init.iso` our seed script for VM.

We need a bunch of tools and images.

- Takes Fedora Cloud images here [mirror.bahnhof.net](https://mirror.bahnhof.net/pub/fedora/linux/releases/).
    1. For `aarch64`
 [Fedora-Cloud-Base-Generic-42-1.1.aarch64.qcow2](https://mirror.bahnhof.net/pub/fedora/linux/releases/42/Cloud/aarch64/images/Fedora-Cloud-Base-Generic-42-1.1.aarch64.qcow2)
    1. For `x86_64` use [Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2](https://mirror.bahnhof.net/pub/fedora/linux/releases/42/Cloud/x86_64/images/Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2)

- Takes Ubuntu Cloud images here [cdimage.ubuntu.com](https://cdimage.ubuntu.com/ubuntu-server/daily-preinstalled/current).
    1. For `aarch64` [plucky-preinstalled-server-arm64.img.xz](https://cdimage.ubuntu.com/ubuntu-server/daily-preinstalled/current/plucky-preinstalled-server-arm64.img.xz)
    1. For `x86_64` [plucky-preinstalled-server-amd64.img.xz](https://cdimage.ubuntu.com/ubuntu-server/daily-preinstalled/current/plucky-preinstalled-server-amd64.img.xz)

### Cloud-Init

I'm going to use [cloud-init](https://cloudinit.readthedocs.io/en/latest/index.html) scripts to initialize VM with packages (`git`, `jq`, `go`, `docker` etc) and settings I need for development, also for provision ssh key:


{% codetitle "", "user-data" %}

```yaml
#cloud-config

system_info:
   default_user:
     name: fedora

users:
  - name: fedora
    sudo: ['ALL=(ALL) NOPASSWD:ALL']
    groups: users, admin, docker
    shell: /bin/bash

ssh_authorized_keys:
   - ssh-rsa AAAAB3Nza...

groups:
  - docker

packages:
  - curl
  - wget
  - git
  - jq
  - gcc
  - clang

chpasswd:
  list: |
    fedora:password
  expire: False

resize_rootfs: True

write_files:
  - path: /etc/sysctl.d/enabled_ipv4_forwarding.conf
    content: |
      net.ipv4.conf.all.forwarding=1
  - path: /opt/go.sh
    owner: fedora:fedora
    permissions: '0700'
    content: |
      #!/usr/bin/env bash
      set -ex
      wget https://go.dev/dl/go1.24.1.linux-amd64.tar.gz -O go.tar.gz
      sudo tar -C /usr/local -xzvf go.tar.gz
      rm -rf go
      echo 'export GOROOT=/usr/local/go' >> /home/fedora/.bashrc
      echo 'export GOPATH=$HOME/.go' >> /home/fedora/.bashrc
      echo 'export PATH=$GOPATH/bin:$GOROOT/bin:$PATH' >> /home/fedora/.bashrc
runcmd:
  - [dnf, config-manager, addrepo, --from-repofile="https://download.docker.com/linux/fedora/docker-ce.repo"]
  - [dnf, install, docker-ce, docker-ce-cli, containerd.io]
  - [systemctl, enable, --now, docker]
  - /opt/go.sh
```

Generate `init.iso`:

```bash
touch meta-data # going to be empty
mkisofs -output init.iso -volid cidata -joliet -rock {user-data,meta-data}
```

### Create VM

Create VM, chose Emulate:

{% image "./1.jpeg", "", [900] %}

Chose Other:

{% image "./2.jpeg", "", [900] %}

No changes in Hardware:

{% image "./3.jpeg", "", [900] %}

In Summary name the VM and check `Open VM Settings`:

{% image "./4.jpeg", "", [900] %}

Uncheck `UEFI Boot`:

{% image "./5.jpeg", "", [900] %}

Remove `Display`, `Sound` with rigth mouse click, and add `Serial` -> `Built-In`:

{% image "./6.jpeg", "", [900] %}

Remove created `Drive`, and add new one `VirtiO`,
`Import` the [Fedora-Cloud-Base-Generic-42-1.1.x86_64.qcow2](/blog/development-on-mac-with-utm/development-on-mac-with-lima/#dependencies)

{% image "./7.jpeg", "", [900] %}

{% image "./8.jpeg", "", [900] %}

Create another one `Drive` -> `VirtiO`,
import the [init.iso](/blog/development-on-mac-with-utm/development-on-mac-with-lima/#dependencies-for-vm)

{% image "./9.jpeg", "", [900] %}

Run VM, if everything goes right you'll see boot terminal, like on the image below:

{% image "./10.jpeg", "", [900] %}

Wait until you see login screen:

Wait a little it more, so cloud-init script done his job.

{% image "./11.jpeg", "", [900] %}

Power off VM and remove `init.iso` drive, it does his job only on the first boot.

You can check logs of cloud-init scripts by this command `sudo cat /var/log/cloud-init-output.log`

Tip:

In order to create `aarch64` VM, use `arm64` cloud images (on Ubuntu the process is almost the same, expect you dont need to disable `UEFI Boot` and extract `*.img.xz` :shrug:)


Happy coding!
