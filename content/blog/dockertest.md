---
title: Write integration tests with dockertest in Golang 
description: In this tutorial, we explore how to use dockertest for integration tests.
date: 2023-04-10
tags:
  - docker
  - golang
  - tests
---

<div class="message-box">
 “Tests are stories we tell the next generation of programmers on a project.”

   ― Roy Osherove
</div>

Integration tests are the most effective way to test your application.
The developers themselves usually write those tests.
This tutorial aims to show you how easy and efficient it is to write integration tests with [dockertest](https://github.com/ory/dockertest).

## Appication
First, let's describe the tools we'll use:

* [gin](https://gin-gonic.com/) - HTTP web framework.
* [redis](https://redis.io/) - Key/Value storage
* [docker-compose](https://docs.docker.com/compose/) - A tool for defining and running multi-container Docker applications.
* [ginkgo](https://onsi.github.io/ginkgo/#getting-started) - Testing Framework for Go
* [dockertest](https://github.com/ory/dockertest) - Dockertest helps you boot up ephermal docker images for your Go tests with minimal work.

Next, let's describe the application; as an example, we'll use a simple application with REST API.
Our API exposes three endpoints:

* `GET /health` - check if application ready to accept requests.
* `GET /item` - get item from the storage.
* `POST /item` - put item to storage.

The item we will put to the `Redis` contains an expire timeout set to 10 seconds.

The application logic is simple: an external client puts an item into the service, and another client gets the thing.

## Structure

Usually, we’re using  Docker Compose as our development environment. The config contains all our docker image tags and parameters.
The command to build and run the application: `docker-compose up --build`.
Here is the `docker-compose.yml` file for our application:

```yml
services:
  redis:
    image: 'bitnami/redis:latest'
    environment:
      - ALLOW_EMPTY_PASSWORD=yes
    networks:
      - "test_network"
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      REDIS_ADDR: redis:6379
      HTTP_PORT: ":8080"
    depends_on:
      - redis
    networks:
      - "test_network"
networks:
   test_network:
        driver: bridge
```

The structure:

```bash
> tree
├── Dockerfile
├── bin
│   └── server
├── cmd
│   ├── config.go # config struct for parsing ENV variables
│   ├── main.go
│   └── server.go # holds handlers for out REST API
├── docker-compose.yml
├── go.mod
├── go.sum
├── integration_tests
│   ├── service
│   │   └── service.go # dockertest logic to spinup containers
│   └── suite_test.go  # ginkgo specs to tests our application
└── pkg
    └── recache
        └── recache.go # redis client

7 directories, 12 files
```

## Tests

Our tests cases would cover next steps:

* Put item to redis by calling `POST /item` with json payload like this for example `{"counter": 15}`.
* Get item from redis by calling `GET /item` and expect json response like  `{"counter": 15}`.
* Wait 15 seconds and call `GET /item` again and expect an error.

Our tests are placed in the `integration_tests` folder.

There is `integration_tests/service` package holds the logic to spin up docker containers for our application in the same way as we're using it in our `docker-compose.yml`.

Here is the code from `integration_tests/service` package:


```go
// This struct holds services
// 1. The application container built from Dockerfile
// 2. The redis container build from bitnami/redis image
type Service struct {
	Container *dockertest.Resource
	Redis     *dockertest.Resource
	Network   *dockertest.Network
	Pool      *dockertest.Pool
}
```

The `New` function we're using in our `suite_test.go`, follow comments in the code:

```go
func New() (*Service, error) {
    // Initialize docker pool
    // This command create a pool to interact with docker runtime
    // I'm using colima but Docker Desktop also should work.
	pool, err := dockertest.NewPool("")
	if err != nil {
		log.Printf("Could not construct pool: %s", err)
		return nil, err
	}

    // Ping the docker daemon
    // check if everything is good and
    // there is the connection with docker
	if err = pool.Client.Ping(); err != nil {
		log.Printf(`could not connect to docker: %s`, err)
		return nil, err
	}

    // Create a network for our containers
	network, err := pool.CreateNetwork("test_network")
	if err != nil {
		log.Printf(`could not connect to docker: %s`, err)
		return nil, err
	}

	// Build and run the redis server
	redisContainer, err := pool.Run("bitnami/redis", "latest", []string{"ALLOW_EMPTY_PASSWORD=yes"})
	if err != nil {
		log.Printf(`could not start redis: %s`, err)
		return nil, err
	}

    // Connect redis container to our network 
	if err := redisContainer.ConnectToNetwork(network); err != nil {
		log.Printf(`could not connect to network: %s`, err)
		return nil, err
	}

	// retry check redis connection
	if err = pool.Retry(func() error {
		var db *redis.Client
        // Here we are connecting to the redis server and ping that server
		// It's matter to note the address, since we're out of the docker network
		// We can use `localhost`, but in the our application container we can't use `localhost`
		db = redis.NewClient(&redis.Options{
			Addr: fmt.Sprintf("localhost:%s", redisContainer.GetPort("6379/tcp")),
		})
		err := db.Ping().Err()
		if err != nil {
			log.Printf("health check error: %s", err)
			return err
		}
		return nil
	}); err != nil {
		log.Printf("Could not connect pass redis check: %s", err)
		return nil, err
	}

	// Build and run the given Dockerfile
	resource, err := pool.BuildAndRunWithOptions(
		"../Dockerfile",
		&dockertest.RunOptions{
			Hostname:  "server",
			NetworkID: network.Network.ID,
			Name:      "test-application",
			PortBindings: map[docker.Port][]docker.PortBinding{
				"8080/tcp": []docker.PortBinding{ { HostPort: "8080" } },
			},
			Env: []string{
                // Here is we get the actuall IP of redis container in our docker network
				// The address is different from localhost
				"REDIS_ADDR=" + fmt.Sprintf("%s:6379", redisContainer.GetIPInNetwork(network)),
				"HTTP_PORT=:8080",
			},
		},
	)
	if err != nil {
		log.Printf("Could not start resource: %s", err)
		return nil, err
	}

	// Retry /health endpoint
	// and check if our application container is ready to accept requests
	if err = pool.Retry(func() error {
		err := checkHealth()
		if err != nil {
			log.Printf("health check error: %s", err)
			return err
		}
		return nil
	}); err != nil {
		log.Printf("Could not pass health: %s", err)
		return nil, err
	}
	return &Service{resource, redisContainer, network, pool}, nil
}
```

The code above does all the routine to build and run our application by using `Dockerfile`.
There is a useful function for HTTP calls and `Close()` function which cleanup our resources by removing the network and purging containers.

Here is the code from `integration_tests/suite_tests.go`:

```go
var _ = Describe("IntegrationTests", Ordered, func() {
	var (
		srv     *service.Service
		err     error
		counter float64
	)
    // Initialize our docker containers
    // Pass all health checks
    // Expect no errors
	BeforeAll(func() {
		srv, err = service.New()
		counter = float64(15)
		Expect(err).To(BeNil())
		Expect(srv).NotTo(BeNil())
	})

    // Cleanup our resoursec after all steps
	AfterAll(func() {
		err = srv.Close()
		Expect(err).To(BeNil())
	})

	Describe("put item to redis", func() {
		Context("send POST request", func() {
			It("should be a 200 OK response", func() {
				body := []byte(fmt.Sprintf(`{ "counter": %v }`, counter))
                // Use `localhost:8080` since we're outside of docker network
				response, err := service.PostRequst("http://localhost:8080/item", body)
				Expect(err).To(BeNil())
				Expect(response).To(Equal(map[string]interface{}{"success": true}))
			})
		})
	})

	Describe("get item from redis", func() {
		Context("send GET request", func() {
			It("should be a 200 OK response", func() {
				response, err := service.GetRequst("http://localhost:8080/item")
				Expect(err).To(BeNil())
				Expect(response).To(Equal(map[string]interface{}{"counter": counter}))
			})
		})
	})

	Describe("get item from redis", func() {
		Context("wait 15 seconds and send GET request", func() {
			It("should be a 500 Internal Error response", func() {
				time.Sleep(15 * time.Second)
				_, err := service.GetRequst("http://localhost:8080/item")
				Expect(err).NotTo(BeNil())
			})
		})
	})
})
```

If we run tests we'll see next output:

```bash
go run github.com/onsi/ginkgo/v2/ginkgo -vv ./integration_tests/...
Running Suite: IntegrationTests Suite - /Users/user/example/integration_tests
============================================================================================
Random Seed: 1681140106

Will run 3 of 3 specs
------------------------------
IntegrationTests
/Users/user/example/example/integration_tests/suite_test.go:19
  put item to redis
  /Users/user/example/example/integration_tests/suite_test.go:37
    send POST request
    /Users/user/example/example/integration_tests/suite_test.go:38
      should be a 200 OK response
      /Users/user/example/example/integration_tests/suite_test.go:39
  > Enter [BeforeAll] IntegrationTests - /Users/user/example/example/integration_tests/suite_test.go:25 @ 04/10/23 17:21:47.982
  < Exit [BeforeAll] IntegrationTests - /Users/user/example/example/integration_tests/suite_test.go:25 @ 04/10/23 17:23:36.056 (1m48.075s)
  > Enter [It] should be a 200 OK response - /Users/user/example/example/integration_tests/suite_test.go:39 @ 04/10/23 17:23:36.057
  < Exit [It] should be a 200 OK response - /Users/user/example/example/integration_tests/suite_test.go:39 @ 04/10/23 17:23:36.068 (11ms)
• [108.087 seconds]
------------------------------
IntegrationTests
/Users/user/example/example/integration_tests/suite_test.go:19
  get item from redis
  /Users/user/example/example/integration_tests/suite_test.go:48
    send GET request
    /Users/user/example/example/integration_tests/suite_test.go:49
      should be a 200 OK response
      /Users/user/example/example/integration_tests/suite_test.go:50
  > Enter [It] should be a 200 OK response - /Users/user/example/example/integration_tests/suite_test.go:50 @ 04/10/23 17:23:36.069
  < Exit [It] should be a 200 OK response - /Users/user/example/example/integration_tests/suite_test.go:50 @ 04/10/23 17:23:36.07 (2ms)
• [0.002 seconds]
------------------------------
IntegrationTests
/Users/user/example/example/integration_tests/suite_test.go:19
  get item from redis
  /Users/user/example/example/integration_tests/suite_test.go:58
    wait 15 seconds and send GET request
    /Users/user/example/example/integration_tests/suite_test.go:59
      should be a 500 Internal Error response
      /Users/user/example/example/integration_tests/suite_test.go:60
  > Enter [It] should be a 500 Internal Error response - /Users/user/example/example/integration_tests/suite_test.go:60 @ 04/10/23 17:23:36.071
2023/04/10 17:23:51 Could not call API: 500 body: map[error:redis: nil]
  < Exit [It] should be a 500 Internal Error response - /Users/user/example/example/integration_tests/suite_test.go:60 @ 04/10/23 17:23:51.075 (15.005s)
  > Enter [AfterAll] IntegrationTests - /Users/user/example/example/integration_tests/suite_test.go:32 @ 04/10/23 17:23:51.075
  < Exit [AfterAll] IntegrationTests - /Users/user/example/example/integration_tests/suite_test.go:32 @ 04/10/23 17:23:51.736 (660ms)
• [15.665 seconds]
------------------------------

Ran 3 of 3 Specs in 123.755 seconds
SUCCESS! -- 3 Passed | 0 Failed | 0 Pending | 0 Skipped
PASS

Ginkgo ran 1 suite in 2m4.977159458s
Test Suite Passed
```
Our tests are well formatted, the output is very descriptive.
The `ginkgo` is able to generate `junit` report btw.

I hope this article gives you a good idea of how to write integration tests for your `Golang` application.

Happy coding!