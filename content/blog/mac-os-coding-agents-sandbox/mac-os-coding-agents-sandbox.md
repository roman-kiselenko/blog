---
title: Coding Agents Sandboxing on MacOS
description: Let's use MacOS sandboxing tools to restrict coding agents.
date: 2026-04-09
draft: true
tags:
  - llm
  - opencode
  - macos
  - arm
  - macbook
  - apple silicon
---

I've frequently encountered a problem with agents: they work on my host system without any kind of control.
To resolve issues, they are often smart enough to perform software installations.

For example:

```bash
# Install gocognit linter
$ go install github.com/uudashr/gocognit/v2/cmd/gocognit@latest
go: github.com/uudashr/gocognit/v2/cmd/gocognit@latest: module github.com/uudas found (v1.2.1), but does not contain package github.com/uudashr/gocognit/v2/cmc
# Install gocognit linter from correct path
$ go install github.com/uudashr/gocognit/cmd/gocognit@latest
```

In the sequence of commands there might be a case it'll install something harmful.
I've tried to use Docker to isolate LLM agents, but it's fragile and not useful.

After expirimenting with different cases I've reach an article of Vitalik Buterin [My self-sovereign / local / private / secure LLM setup, April 2026](https://vitalik.eth.limo/general/2026/04/02/secure_llms.html)

<div class="message-box">
To keep my LLMs in check, I do most of my LLM usage from inside of a sandbox.
</div>

My first impression was _That's a huge!_, it's exactly what I need.
Since my working station is Mac I've started to find anything related to software sandboxing on Mac.

The things I consider:

1. [Alcoholless: lightweight security sandbox for Homebrew, AI agents, etc. on macOS](https://github.com/AkihiroSuda/alcless)
1. [App and Terminal Isolation / Sandboxing](https://apple.stackexchange.com/questions/469368/app-and-terminal-isolation-sandboxing)
1. [AI Agent Builder and Runtime by Docker Engineering](https://github.com/docker/docker-agent)

The second one looks interesting for me. Let's break it a little.

### Credits

- <small>[RAG from scratch](https://github.com/pguso/rag-from-scratch/tree/main?tab=readme-ov-file)</small>
- <small>[langchaingo](https://tmc.github.io/langchaingo/docs/)</small>
- <small>[chatGPT like UI components built for React](https://github.com/miskibin/chat-components/tree/main)</small>

Happy coding!
