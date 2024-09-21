---
title: Organize gRPC and protobuf code in Golang
description: Briefly examine how to use protoc and plugins with the proper imports and project structure in Golang
date: 2023-08-27
image: grpc-architecture.jpg
tags:
  - design
  - golang
  - docker
  - grpc
---

<div class="message-box">
<p>At this point, it's a simple, effective and fast RPC framework with a lot of cross-language support. If you need something like it, there's not many other choices available with this big of an ecosystem. - Anonymous from HN about gRPC</p>
</div>

In this article, I'll describe how to organize protobuf files messages and gRPC services in the `Go` sources. I'll briefly examine how to use `protoc` and plugins with the proper imports, and project structure.

Requirements:

- `Go` >= 1.21
- `Docker`, `docker-compose`

A diagram describes how the repositories `service-a`, `service-b` requires `echo-contracts`:

{% image "./echo-go-module.png", "how golang modules organized", [900] %}

## Jumt to

* [Structure](#project-structure)
* [Makefile](#makefile)
* [Dockerfile](#dockerfile)
* [docker-compose](#docker-compose)
* [proto options](#proto-options)
* [generate](#generate)
* [usage](#usage)

### Project structure

The repository `echo-contracts` describes our proto files. It is a <b>standalone</b> `Go` repository intended to import into other `Go` sources. Below is a project structure:

```plaintext
├── Makefile
├── docker
│   ├── Dockerfile
│   └── docker-compose.yaml
├── go.mod
├── go.sum
└── pb
    ├── message.proto
    └── service.proto
```

### Makefile

The `Makefile` contains a bunch of valuable targets.

{% codetitle "", "Makefile" %}

```makefile
PROTOC_VERSION ?= 24.0
.PHONY: help
help: ## Display available commands.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: proto-clean
proto-clean: ## Clean generated proto.
	@rm -rf pb/message
	@rm -rf pb/service

.PHONY: proto-compile
proto-compile: ## Compile message protobuf and gRPC service files.
	PLATFORM=$(shell uname -m) PROTOC_VERSION=$(PROTOC_VERSION) docker-compose -f docker/docker-compose.yaml run --rm protogen

.PHONY: docker-config
docker-config: ## Dump docker-compose configuration.
	PLATFORM=$(shell uname -m) PROTOC_VERSION=$(PROTOC_VERSION) docker-compose -f docker/docker-compose.yaml config
```

### Dockerfile

In the `Dockerfile`, `protoc` with a particular version is downloaded. The version of `protoc` binary is declared as `PROTOC_VERSION` variable at the top of the `Makefile` and is passed to the docker container during the build stage.

`protoc` doesn't officially support `Go` as output, you need to install external plugins.
`gRPC` is not the same as `Protocol Buffers`, `gRPC` uses `Protocol Buffers`, hence different plugins are needed to generate `Go` code messages and services.

Plugins installed:
- [protoc-gen-go-grpc](https://pkg.go.dev/google.golang.org/grpc/cmd/protoc-gen-go-grpc) - Generates `Go` bindings of services in protobuf definition files for `gRPC`.
- [protoc-gen-go](https://pkg.go.dev/google.golang.org/protobuf) - A tool to generate `Go` code for the protocol buffer language, and also the runtime implementation to handle serialization of messages in `Go`.

{% codetitle "", "docker/Dockerfile" %}

```docker
FROM golang:1.21

ARG PLATFORM
ARG PROTOC_VERSION

RUN apt-get update && apt-get install -y unzip

# By default Intel chipset (x86_64) is assumed but if the host device is an Apple
# silicon (arm) chipset based then a relevant (aarch_64) release file is used.

RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.31.0
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.3.0

RUN export ZIP=x86_64 && \
    if [ ${PLATFORM} = "arm64" ]; then export ZIP=aarch_64; fi && \
    wget --quiet https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-${ZIP}.zip && \
    unzip -o protoc-${PROTOC_VERSION}-linux-${ZIP}.zip -d /usr/local bin/protoc && \
    unzip -o protoc-${PROTOC_VERSION}-linux-${ZIP}.zip -d /usr/local 'include/*'
```

### docker-compose

I'm using `docker-compose.yaml` as an engine for generating `proto`.

{% codetitle "", "docker/docker-compose.yaml" %}

```yaml
services:
  protogen:
    build:
      context: "."
      args:
        PLATFORM: ${PLATFORM}
        PROTOC_VERSION: ${PROTOC_VERSION}
    working_dir: "/source"
    volumes:
      - "../pb:/source"
    command: bash -c "
        protoc *.proto --proto_path=.
         --go_out=. --go_opt=module=github.com/user/echo-contracts/pb
         --go-grpc_out=. --go-grpc_opt=module=github.com/user/echo-contracts/pb
        "
```

### proto options

Now we're instructing the `protoc` to generate code for us, we're planning to import `echo-contracts` as `Go` module and we need a proper package structure.

There is an options for `--go_out` and `--go-grpc_opt`:
* `module=$PREFIX` -  the output file is placed in a directory named after the `Go` package’s import path, but with the specified directory prefix removed from the output filename.

For example, an input file `pb/message.proto` with a `Go` import path of `github.com/user/echo-contracts/pb/message` and `github.com/user/echo-contracts/pb` specified as the module prefix results in an output file at `pb/message/message.pb.go`.

{% image "./pb_module_option.png", "module option", [900] %}

Here are our `proto` files:

{% codetitle "", "pb/message.proto" %}

```protobuf
syntax = "proto3";
package echo.service.v1;
option go_package = "github.com/user/echo-contracts/pb/message";

message StringMessage {
    string value = 1;
}
```

{% codetitle "", "pb/service.proto" %}

```protobuf
syntax = "proto3";
package echo.service.v1;
option go_package = "github.com/user/echo-contracts/pb/service";

import "message.proto";

service EchoService {
    rpc Echo(StringMessage) returns (StringMessage) {}
}
```

{% codetitle "", "go.mod" %}

```go
module github.com/user/echo-contracts

go 1.21.0

require (
	google.golang.org/grpc v1.57.0
	google.golang.org/protobuf v1.31.0
)

require (
	github.com/golang/protobuf v1.5.3 // indirect
	golang.org/x/net v0.9.0 // indirect
	golang.org/x/sys v0.7.0 // indirect
	golang.org/x/text v0.9.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20230525234030-28d5490b6b19 // indirect
)
```
### generate

At this step we can generate `Go` code from proto files. Use the command `make proto-compile`.
Here is the directory structure after `proto` compilation:

```plaintext
├── Makefile
├── docker
│   ├── Dockerfile
│   └── docker-compose.yaml
├── go.mod
├── go.sum
└── pb
    ├── message
    │   └── message.pb.go
    ├── message.proto
    ├── service
    │   ├── service.pb.go
    │   └── service_grpc.pb.go
    └── service.proto
```
Release `echo-contracts` [Using Go Modules](https://go.dev/blog/using-go-modules), so it is published as `Go` module with the proper version.

### usage

To import our `echo-contracts` `Go` module, we need to declare it in the `main.go` file and `go.mod` as an external dependency:

{% codetitle "", "main.go" %}

```go
package main

import (
	// ...
	message "github.com/user/echo-contracts/pb/message"
	service "github.com/user/echo-contracts/pb/service"
  // ...
)

// Some code here
```

And in `go.mod`:

{% codetitle "", "go.mod" %}

```go
module service-a

go 1.21.0

require (
  // Some imports here
  github.com/user/echo-contracts v0.0.1
)
```

Happy coding!