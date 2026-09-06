---
title: Disposable environments for local, LLM-based AI agents
description: This tutorial explains how to use Apple Containers with oMLX to create disposable envs for your agents.
date: 2026-09-06
image: header.png
tags:
- vm
- apple containers
- arm
- omlx
- llm
- mac
- apple silicon
---

I'm a local and self hosted stuff addict. If I can, I host everything and try to avoid subscriptions and pay-as-you-go stuff as much as possible. If you're in the same boat as me and hosting LLM models, I suggest reading the article below where I'm going to show my current setup for local, LLM-based AI agents development.

My machine is a temple or a garden, I like the order and clean envs, but agents do a lot of stuff to achieve
the task. Today's reality is the `yolo` mode enabled by default.

> YOLO mode in AI coding agents lets the tool execute file changes and shell commands completely on its own without stopping to ask for your permission.

I don't want to clean the garbage agent produce, but I like the new development techniques where agents do the work for you.

I treat working agents as a minion squad, in most cases that squad doing _shit_, writing scripts I'll never need, installing tools I'll never touch. But that's a new way of working, you're in charge of validating the work.

Just like in the funny movie about _minions_ they screw a lot of things up, so I need a way to keep them in the isolated rooms - those rooms must be disposable, and the mess inside must not bother me.

The tools I'm using - [oMLX](https://omlx.ai/), [container](https://github.com/apple/container#initial-install), [pi](https://pi.dev/), [pi-web](https://github.com/agegr/pi-web), [just](https://just.systems/man/en/introduction.html).

To create _rooms_ for agents I'm using Apple Containers, Apple Container uses a unique one-VM-per-container architecture on Apple silicon.
So overall every container is a VM.

The simplified scheme how it works is below:

{% image "./setup.png", "setup", [900] %}

In every project I have a `Dockerfile.agents`:

{% codetitle "", "Dockerfile.agents" %}

```docker
FROM node:lts-alpine3.24
RUN corepack enable
RUN apk add --update curl python3 make g++ && rm -rf /var/cache/apk/*
RUN npm install -g @agegr/pi-web@latest
USER node

ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pi-web", "-p", "7777", "-H", "0.0.0.0", "--no-open"]
```

A `justfile` to run commands:

{% codetitle "", "justfile" %}

```makefile
@_default:
        just --list

run:
        container run --name project --rm -it -p 8080:8080 -p 7777:7777 \
        -v $HOME/agent:/home/node/.pi/agent \
        --mount type=volume,target=/home/node/pnpm-store \
        -v $(pwd):/home/node/project local/project

build:
        container build -t local/project -f Dockerfile.agents
```

Dependency. I ask the agent to install all required dependencies (compilers, linters etc) in the container and almost always the agent is able to launch the project.

Dev server. If I need to check the dev server I'm asking the agent to launch it on the 8080 port, because the port is mapped to the host.

Pi sessions. Every session pi has is stored in the `~/.pi` folder in the container.

Access to GitHub. I'm using a restricted token and pass that token to the container in order to get read/write access to GitHub.

Happy coding!
