---
title: Development On Apple Silicon with Apple Container Machine
description: A concise tutorial detailing the setup of development VMs with Apple Container Machine.
date: 2026-06-14
image: pi.png
tags:
- vm
- apple container machine
- arm
- macbook
- apple silicon
---

<div class="message-box">
	<p>Container machines are persistent Linux environments built from OCI images — your home directory is mounted in, the user account matches your host account, and the filesystem survives stop and start. <a href='https://github.com/apple/container/blob/1.0.0/docs/how-to.md#use-container-machines'>ref</a></p>
</div>

I like the idea to isolate development stuff from my host machine, all those tools and libraries to fight with, lives in the isolated environment. The last WWDC26 announce Apple's [native Container tool for macOS](https://github.com/apple/container/releases/tag/1.0.0). It's WSL-ish tool to create vm's on macOS.
I've poke around little bit and trying to setup development machine with all tools in there. The goal is to understand how robust it and does it ready to every dayly driver.

This article goes through all pitfalls in order to setup dev machine, some of those ways a crunky and ugly. :smile:
But I've tried my best to overcome it.

I'm going to setup machine with following requirements:

- `golang` compiler
- ssh access for `Zed` editor
- `pi` coding agent

Let's start from installing the `container`, you need at least macOS 26, [follow this guide](https://github.com/apple/container/tree/1.0.0#initial-install).

Now we need an image:

{% codetitle "", "Dockerfile" %}

```docker
FROM ubuntu:26.04

ENV container container
ENV DEBIAN_FRONTEND=noninteractive

RUN apt update -y && apt upgrade -y && apt install -y --no-install-recommends \
      curl ca-certificates git sudo systemd init systemd-sysv openssh-server \
      binutils gpg vim libc6-dev libcurl4-openssl-dev libedit2 libgcc-s1 \
      unzip gnupg2 libgcc-13-dev libstdc++-13-dev libncurses-dev \
      libpython3-dev libsqlite3-0 libstdc++6 libxml2-dev libz3-dev \
      pkg-config tzdata zlib1g-dev net-tools iproute2 iputils-ping wget jq \
      && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN echo 'ALL ALL=(ALL:ALL) NOPASSWD: ALL' > /etc/sudoers.d/nopasswd \
 && chmod 0440 /etc/sudoers.d/nopasswd

RUN mkdir -p /var/run/sshd \
 && ssh-keygen -A \
 && sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'                    /etc/ssh/sshd_config \
 && sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/'     /etc/ssh/sshd_config \
 && sed -i 's/^#\?PubkeyAuthentication.*/PubkeyAuthentication yes/'         /etc/ssh/sshd_config \
 && echo 'UseDNS no'               >> /etc/ssh/sshd_config \
 && echo 'GSSAPIAuthentication no' >> /etc/ssh/sshd_config \
 && systemctl enable ssh

RUN systemctl mask getty@.service systemd-logind.service \
      apt-daily.timer apt-daily-upgrade.timer fstrim.timer || true

RUN (cd /lib/systemd/system/sysinit.target.wants/; for i in *; do [ $i == \
systemd-tmpfiles-setup.service ] || rm -f $i; done); \
rm -f /lib/systemd/system/multi-user.target.wants/*;\
rm -f /etc/systemd/system/*.wants/*;\
rm -f /lib/systemd/system/local-fs.target.wants/*; \
rm -f /lib/systemd/system/sockets.target.wants/*udev*; \
rm -f /lib/systemd/system/sockets.target.wants/*initctl*; \
rm -f /lib/systemd/system/basic.target.wants/*;\
rm -f /lib/systemd/system/anaconda.target.wants/*;

# Copy ssh pub key to the image
COPY pub-key.pub /etc/ssh/
RUN chmod a+rwx /etc/ssh/pub-key.pub

EXPOSE 22
STOPSIGNAL SIGRTMIN+3
VOLUME [ "/sys/fs/cgroup" ]
CMD [ "/usr/sbin/init" ]

```

This `Dockerfile` is partially based on an examples from [apple repository](https://github.com/apple/container/blob/6508acea81c193580fe07b9a61170caa50ba9443/examples/container-machine-vscode/Dockerfile) and [sokoloowski container images](https://github.com/sokoloowski/container-machine-images).

<div class="message-box">
<p>We need an image with init system which is used by container machine to run the container as a VM.</p>
</div>

Build the container:

```bash
container build -t local/ubuntu -f Dockerfile
[+] Building 32.6s (13/13) FINISHED
 => [resolver] fetching image...docker.io/library/ubuntu:26.04                                                                                                                              0.0s
 => [internal] load build definition from Dockerfile                                                                                                                                        0.0s
 => => transferring dockerfile: 2.03kB                                                                                                                                                      0.0s
 => [internal] load .dockerignore                                                                                                                                                           0.0s
 => => transferring context: 2B                                                                                                                                                             0.0s
 => CACHED oci-layout://docker.io/library/ubuntu:26.04@sha256:f3d28607ddd78734bb7f71f117f3c6706c666b8b76cbff7c9ff6e5718d46ff64                                                              0.0s
 => => resolve docker.io/library/ubuntu:26.04@sha256:f3d28607ddd78734bb7f71f117f3c6706c666b8b76cbff7c9ff6e5718d46ff64                                                                       0.0s
 => [internal] load build context                                                                                                                                                           0.0s
 => => transferring context: 130B                                                                                                                                                           0.0s
 => [linux/arm64 1/8] RUN apt update -y && apt upgrade -y && apt install -y --no-install-recommends       curl ca-certificates git sudo systemd init systemd-sysv openssh-server       bi  24.8s
 => [linux/arm64 2/8] RUN echo 'ALL ALL=(ALL:ALL) NOPASSWD: ALL' > /etc/sudoers.d/nopasswd  && chmod 0440 /etc/sudoers.d/nopasswd                                                           0.1s
 => [linux/arm64 3/8] RUN mkdir -p /var/run/sshd  && ssh-keygen -A  && sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'                    /etc/ssh/sshd_config  && sed -i 's/^#\?Pass  0.0s
 => [linux/arm64 4/8] RUN systemctl mask getty@.service systemd-logind.service       apt-daily.timer apt-daily-upgrade.timer fstrim.timer || true                                           0.0s
 => [linux/arm64 5/8] RUN (cd /lib/systemd/system/sysinit.target.wants/; for i in *; do [ $i == systemd-tmpfiles-setup.service ] || rm -f $i; done); rm -f /lib/systemd/system/multi-user.  0.0s
 => [linux/arm64/v8 6/8] COPY pub-key.pub /etc/ssh/                                                                                                                                         0.0s
 => [linux/arm64 7/8] RUN chmod a+rwx /etc/ssh/pub-key.pub                                                                                                                                  0.0s
 => exporting to oci image format                                                                                                                                                           7.5s
 => => exporting layers                                                                                                                                                                     6.8s
 => => exporting manifest sha256:e198c20df4e404915ed2bcce4d3f95e03b23c34bd9b12c52207167565337eaf5                                                                                           0.0s
 => => exporting config sha256:3ca9dd443deb3f453b659f7c8791b8ce463aafc8d1fe5721588d999c3c41c609                                                                                             0.0s
 => => exporting manifest list sha256:daf30df7f72b17d29cdb21617ddbb00952031d242491ef5181cb7cd00f77b228                                                                                      0.0s
 => => sending tarball                                                                                                                                                                      0.7s
local/ubuntu:latest
```

Create and check the vm machine is in the `running` state:

```bash
container machine create local/ubuntu --set-default --name ubuntu
container machine ls
NAME    CREATED              IP             CPUS  MEMORY  DISK  STATE    DEFAULT
ubuntu  2026-06-14 14:08:48  192.168.64.19  8     4G      1.4G  running  *
```

Next we need a setup script to install all our tools. There is no _user_ at the container image build step because `container machine` uses [a custom script to create user](https://github.com/apple/container/blob/main/Sources/Plugins/MachineAPIServer/Resources/create-user.sh) at machine first boot.

```sh
#!/usr/bin/env bash
set -e

GOLANG_VERSION=1.26.4
NODE_VERSION=v24.13.0

# Golang part
wget https://go.dev/dl/go$GOLANG_VERSION.linux-arm64.tar.gz -O go.tar.gz
sudo tar -C /usr/local -xzvf go.tar.gz
rm -rf go go.tar.gz
echo 'export GOROOT=/usr/local/go' >> $HOME/.bashrc
echo 'export GOPATH=$HOME/.go' >> $HOME/.bashrc
echo 'export PATH=$GOPATH/bin:$GOROOT/bin:$PATH' >> $HOME/.bashrc
echo 'export GOCACHE=$HOME/.go/cache' >> $HOME/.bashrc
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> $HOME/.bashrc
echo 'export PI_OFFLINE=1' >> $HOME/.bashrc
echo 'export PI_TELEMETRY=0' >> $HOME/.bashrc

# Node & Pi agent
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. $HOME/.nvm/nvm.sh
nvm install $NODE_VERSION
nvm alias default $NODE_VERSION
echo 'install pi agent ...'

# Pi Agent
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
npm root -g
pi --version

mkdir -p $HOME/.ssh
echo $(cat /etc/ssh/pub-key.pub) >> $HOME/.ssh/authorized_keys
sudo systemctl start sshd.service
```

Since the `/Users/...` folder from the host will be mounted to the VM we can use scripts from the host and setup our vm after boot.

This script will be placed to the directory automatically mounted to the machine.

Run script from within machine:

```bash
container machine run -n ubuntu
# cd to directory with script ./setup.sh
exit
```

Next we're going to setup dns in order to access a host service (macOS `localhost`) from within our vm and reach the vm from host machine.

```bash
# To access guest from host
sudo container system dns create machine
# To access host from the guest
sudo container system dns create host.container.internal --localhost 203.0.113.113
```

Now lets use Zed to connect to our vm.

{% codetitle "The host ssh config", "~/.ssh/config" %}

```yaml
Host ubuntu.machine
   HostName ubuntu.machine
   ForwardAgent yes
   StrictHostKeyChecking no
   # PreferredAuthentications password
   # PubkeyAuthentication no
   UserKnownHostsFile /dev/null
```

After this change in the  host ssh config we can choose our vm in the Zed editor `Remote projects` feature.

I'm using `oMLX` and local models with open weights so my `pi` configuration is pointed to `host.container.internal` and from the `pi` side everything works smooth. :cool:


{% codetitle "The pi config file", "~/.pi/agent/models.json" %}


```json
{
  "providers": {
    "omlx": {
      "baseUrl": "http://host.container.internal:8000/v1",
      "api": "openai-completions",
      "apiKey": "none",
      "compat": {
        "supportsUsageInStreaming": true,
        "maxTokensField": "max_tokens"
      },
      "models": [
        {
          "id": "Nemotron-3-Nano",
          "reasoning": true,
          "thinking": true,
          "contextWindow": 131072,
          "maxTokens": 32768
        },
...
```

The `pi` data directory is on the host and guest vm `pi` instance reads `$PI_CODING_AGENT_DIR` variable.

{% codetitle "The bashrc on the guest", "" %}


```bash
export PI_CODING_AGENT_DIR="/Users/my-user/.pi/agent"
```


Lets login to the guest vm and run `pi` command.

```bash
container machine run -n ubuntu
pi
```

{% image "./pi.png", "agent screentshot", [900] %}


### the pros

- __pros__ - Overall UX is as cool as the [`lima`](https://lima-vm.io/docs/installation/), you just write a bunch of commands and everything seems to work.
- __pros__ - Pretty fast on the large codebases.
- __pros__ - Reproducable because of `docker`-like expirience.

### and cons

- __cons__ - Cumbersome stuff with dns
- __cons__ - Cant run provision script since user created at the first boot.
- __cons__ - Host mounts all `/Users/my-user` folder, you can only set `rw,ro,none` mount options, that a sad thing.

Check out my other howtos:

- [Development On Apple Silicon with UTM](/blog/development-on-mac-with-utm/)
- [Development On Apple Silicon with Lima](/blog/development-on-mac-with-lima/)

Happy coding!
