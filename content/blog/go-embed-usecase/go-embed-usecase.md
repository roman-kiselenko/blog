---
title: One file web application in Golang
description: A little tutorial on how to create one file web application in Golang.
date: 2021-02-22 11:02:57
tags:
  - golang
---
With the version 1.16 we have a way to include in the binary an arbitrary files at compile time using [embed](https://golang.org/pkg/embed/) standard package.

> Package embed provides access to files embedded in the running Go program.

That feature is very useful in order to create a one-file web application.

There are many libs provides that way, for example: [pkger](https://github.com/markbates/pkger), [go.rice](https://github.com/GeertJohan/go.rice) [go-bindata](https://github.com/jteeuwen/go-bindata).

In this post, I'll describe how to do it without external dependencies.

The main goal is to have a file that we can run with no additional dependencies and a runtime environment.

There are many applications built in the same way, for examplee: 

* [filebrowser](https://github.com/filebrowser/filebrowser)
* [gogs](https://github.com/gogs/gogs)

Let's embed the directory `embed` with two files inside: `index.html` and `styles.css`.

```html
<html>
	<head>
		<title>Title</title>
		<link rel="stylesheet" href="styles.css">
	</head>
	<body>
		<h1>This is a header</h1>
		<h1>The body has lightblue color</h1>
		<hr>
	</body>
</html>
```

```css
body {
  background-color: lightblue;
}

h1 {
  color: navy;
  margin-left: 20px;
}
```

I have created a simple `main.go`, it looks as follows:

```go
package main

import (
	"fmt"
	"net/http"

	"embed"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

//go:embed embed/*

var content embed.FS

func main() {
	r := &Router{&mux.Router{}}

	r.MustResponse("GET", "/", func(res http.ResponseWriter, req *http.Request) {
		data, _ := content.ReadFile("embed/index.html")
		res.Header().Set("Content-Type", "text/html")
		fmt.Fprint(res, string(data))
	})

	r.MustResponse("GET", "/styles.css", func(res http.ResponseWriter, req *http.Request) {
		data, _ := content.ReadFile("embed/styles.css")
		res.Header().Set("Content-Type", "text/css")
		fmt.Fprint(res, string(data))
	})

	r.Run(":8080", "*")
}

type Router struct {
	*mux.Router
}

func (r *Router) MustResponse(meth, path string, h http.HandlerFunc) {
	r.HandleFunc(path, h).Methods(meth)
}

func (r *Router) Run(address, origins string) {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{origins},
		AllowedMethods:   []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "If-None-Match", "Content-Length", "Accept-Encoding", "Authorization"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)
	http.ListenAndServe(address, handler)
}

func vars(req *http.Request) map[string]string {
	return mux.Vars(req)
}
```

Compile code with command `go build main.go` and run it `./main`. Open browser at address `http://localhost:8080` you'll see a page like below:

{% image "./embed-page-example.png", "An example image rendered from golang source code" %}

Currently, we have one executable file with index.html and styles.css embedded in the binary.

Feel free to play around. For example, you can include some rich js frameworks like [Nuxt](https://nuxtjs.org/).

Happy coding!