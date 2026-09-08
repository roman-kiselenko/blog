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

I treat working agents as a minion squad, in most cases that squad makes _shit_ - scripts I'll never need, tools I'll never touch. But that's a new way of working, you're in charge of validating the work.

Just like in the funny movie about _minions_ they screw a lot of things up, so I need a way to keep them in the isolated rooms - those rooms must be disposable, and the mess inside must not bother me.

The tools I'm using - [oMLX](https://omlx.ai/), [container](https://github.com/apple/container#initial-install), [pi](https://pi.dev/), [pi-web](https://github.com/agegr/pi-web), [just](https://just.systems/man/en/introduction.html).

To create _rooms_ for agents I'm using Apple's [container](https://github.com/apple/container) CLI. It uses a unique one-VM-per-container architecture on Apple silicon, so effectively every container is its own little VM. It speaks plain OCI - standard `Dockerfile`s work as-is, no Docker Desktop fat VM in between.

The simplified scheme how it works is below:

{% image "./setup.png", "setup", [900] %}

The LLM stays on the Mac. The room is a Linux VM with no access to the Metal GPU, so the model can't live inside it. Instead I keep my models on the host, served by [oMLX](https://omlx.ai/) - a local inference server built for Apple silicon that pages KV-cache blocks to the SSD. That's exactly what coding agents need: big contexts and a lot of repeated prefixes, all of it staying on the Mac.

oMLX exposes an OpenAI-compatible API (and an Anthropic-compatible one) on port 8000, and its dashboard shows you how to wire up any client. From inside the container the Mac is reachable at `host.container.internal`, so pi's model config looks like this:

{% codetitle "", "models.json (excerpt)" %}

```json
{
  "providers": {
    "oMLX": {
      "baseUrl": "http://host.container.internal:8000/v1",
      "api": "openai-completions",
      "models": [
        { "id": "Qwen3.8-27B", "reasoning": true, "contextWindow": 262144 }
      ]
    }
  }
}
```

I configure this once on the host. pi keeps everything - models, settings, sessions, skills - in a single `~/.pi/agent` folder; I keep that folder on the Mac and mount it into every room, so each new minion wakes up already wired to my brain.

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

Inside the room the agent runs as [pi-web](https://github.com/agegr/pi-web) - pi's coding agent with a web UI. Port 7777 is mapped to the Mac, so I open `http://localhost:7777` in a browser and talk to the minion from my usual seat.

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

Two commands in total. `just build` compiles the room image once, `just run` boots a fresh room on top of it. Worth noticing in the flags:

- `--rm` - the whole point of this article: when the room stops, everything inside (garbage included) is gone
- `-v $(pwd):/home/node/project` - the only real code the minion can touch
- `--mount type=volume,target=/home/node/pnpm-store` - a throwaway cache volume, so `pnpm install` doesn't start from zero; wipe it whenever you want a truly clean slate
- `-p 8080:8080 -p 7777:7777` - the two windows into the room: your dev server and pi-web

Dependency. I ask the agent to install all required dependencies (compilers, linters etc) in the container and almost always the agent is able to launch the project.

Dev server. If I need to check the dev server I'm asking the agent to launch it on the 8080 port, because the port is mapped to the host.

Pi sessions. Every session pi has is stored in the `~/.pi/agent/sessions` folder - which is mounted from the host, so conversations survive even after the room is gone.

Access to GitHub. I'm using a restricted token and pass that token to the container in order to get read/write access to GitHub.

YOLO mode is only safe because the blast radius is small. The minion runs as an unprivileged user, sees only the mounted project folder and my LLM API, and holds a GitHub token scoped to exactly what it needs. When a minion screws something up, it screws it up inside the room - my Mac stays a temple.

Done? Stop the container and that's it - `--rm` takes the whole room: scripts, installed tools, half-broken node_modules, everything. The pnpm-store volume is the only survivor, and it can be deleted too if you want a fully clean slate.

Fun fact: this article was drafted by a minion inside one of these rooms - I just validated the work, like you're supposed to.

Happy coding!
