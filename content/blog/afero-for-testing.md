---
title: Test file uploads with afero in Golang 
description: This is an example how to test http upload without access to real filesystem with afero.
date: 2022-01-13 11:02:57
tags:
  - golang
  - tests
---

Suppose we have a simple file upload http handler that looks like this: 

```go
package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

const MB = 1 << 20

func main() {
	r := &Router{&mux.Router{}}

	r.MustResponse("POST", "/", processFile())

	r.Run(":8080", "*")
}

func processFile() http.HandlerFunc {
	return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		if err := req.ParseMultipartForm(50 * MB); nil != err {
			log.Printf("while parse %s", err)
			res.WriteHeader(http.StatusInternalServerError)
			return
		}

		defer func() {
			err := req.MultipartForm.RemoveAll()
			if err != nil {
				log.Printf("Cant delete multipart error %s", err)
			}
		}()

		for _, fheaders := range req.MultipartForm.File {
			for _, hdr := range fheaders {
				log.Printf("Income file name: %s", hdr.Filename)

				infile, err := hdr.Open()
				if err != nil {
					log.Printf("Handle open error: %v", err)
					res.WriteHeader(http.StatusInternalServerError)
					continue
				}
				defer infile.Close()

				f, err := os.OpenFile("./downloaded", os.O_WRONLY|os.O_CREATE, 0666)
				if err != nil {
					log.Printf("Create Read Input error %v", err)
					res.WriteHeader(http.StatusInternalServerError)
					continue
				}
				defer f.Close()
				io.Copy(f, infile)
			}
		}
		res.Header().Set("Content-Type", "text/html")
		fmt.Fprint(res, "<h2>Success</h2>")
	})
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

The code above is a common way to upload files to the server. The code below is for testing:

```go
package main

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestMain(t *testing.T) {
	filePath := "file.jpg"
	fieldName := "file"
	body := new(bytes.Buffer)
	mw := multipart.NewWriter(body)
	file, err := os.Open(filePath)
	if err != nil {
		t.Fatal(err)
	}
	w, err := mw.CreateFormFile(fieldName, filePath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.Copy(w, file); err != nil {
		t.Fatal(err)
	}
	mw.Close()

	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Add("Content-Type", mw.FormDataContentType())
	res := httptest.NewRecorder()
	handler := processFile()

	handler.ServeHTTP(res, req)
	if res.Code != 200 {
		t.Errorf("Expected %d, received %d", 200, res.Code)
	}
}

```

The problem here is that our test is actually working with the real filesystem.
We need a bunch of things in order to have the desired result.

* it needs an actual file to upload
* we should check uploaded file saved without errors
* we should have a cleanup procedure in order to delete saved file

There is a way to test our handler without access to the real filesystem. 
The [afero](https://github.com/spf13/afero) can help here. 

> The MemMapFs backend is perfect for testing.

 * Much faster than performing I/O operations on disk
 * Avoid security issues and permissions
 * Far more control. `rm -rf /` with confidence
 * Test setup is far more easier to do
 * No test cleanup needed

The output of our test:

```shell
Running tool: /usr/bin/go test -timeout 30s -run ^TestMain$ httptestfs -v

=== RUN   TestMain
2022/01/13 15:24:21 Income file: file.jpg
--- PASS: TestMain (0.00s)
PASS
ok  	httptestfs	0.002s
```

After tests, the saved file is in the directory exactly how our handler processes it.

Now let's use `afero`!

```git
diff --git main.go main.go
index 999fe42..2157943 100644
--- main.go
+++ main.go
@@ -9,6 +9,7 @@ import (

        "github.com/gorilla/mux"
        "github.com/rs/cors"
+       "github.com/spf13/afero"
 )

 const MB = 1 << 20
@@ -16,12 +17,14 @@ const MB = 1 << 20
 func main() {
        r := &Router{&mux.Router{}}

-       r.MustResponse("POST", "/", processFile())
+       var AppFs = afero.NewOsFs()
+
+       r.MustResponse("POST", "/", processFile(AppFs))

        r.Run(":8080", "*")
 }

-func processFile() http.HandlerFunc {
+func processFile(fs afero.Fs) http.HandlerFunc {
        return http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
                if err := req.ParseMultipartForm(50 * MB); nil != err {
                        log.Printf("while parse %s", err)
@@ -38,7 +41,7 @@ func processFile() http.HandlerFunc {

                for _, fheaders := range req.MultipartForm.File {
                        for _, hdr := range fheaders {
-                               log.Printf("Income file len: %d", hdr.Size)
+                               log.Printf("Income file: %s", hdr.Filename)

                                infile, err := hdr.Open()
                                if err != nil {
@@ -48,7 +51,7 @@ func processFile() http.HandlerFunc {
                                }
                                defer infile.Close()

-                               f, err := os.OpenFile("./downloaded", os.O_WRONLY|os.O_CREATE, 0666)
+                               f, err := fs.OpenFile("./downloaded", os.O_WRONLY|os.O_CREATE, 0666)
                                if err != nil {
                                        log.Printf("Create Read Input error %v", err)
                                        res.WriteHeader(http.StatusInternalServerError)
diff --git main_test.go main_test.go
index d3875bf..66739c7 100644
--- main_test.go
+++ main_test.go
@@ -8,14 +8,19 @@ import (
        "net/http/httptest"
        "os"
        "testing"
+
+       "github.com/spf13/afero"
 )

 func TestMain(t *testing.T) {
        filePath := "file.jpg"
        fieldName := "file"
+       var AppFs = afero.NewMemMapFs()
+
        body := new(bytes.Buffer)
        mw := multipart.NewWriter(body)
-       file, err := os.Open(filePath)
+       afero.WriteFile(AppFs, filePath, []byte("hello world"), 0644)
+       file, err := AppFs.Create(filePath)
        if err != nil {
                t.Fatal(err)
        }
@@ -32,10 +37,15 @@ func TestMain(t *testing.T) {
        req := httptest.NewRequest(http.MethodPost, "/", body)
        req.Header.Add("Content-Type", mw.FormDataContentType())
        res := httptest.NewRecorder()
-       handler := processFile()
+       handler := processFile(AppFs)

        handler.ServeHTTP(res, req)
        if res.Code != 200 {
                t.Errorf("Expected %d, received %d", 200, res.Code)
        }
+       fileName := "downloaded"
+       _, err = AppFs.Stat(fileName)
+       if os.IsNotExist(err) {
+               t.Errorf("file \"%s\" does not exist.\n", fileName)
+       }
```

With a little change, we create a mock filesystem for testing purposes. Let's run new tests.

```shell
Running tool: /usr/bin/go test -timeout 30s -run ^TestMain$ httptestfs -v

=== RUN   TestMain
2022/01/13 15:24:21 Income file: file.jpg
--- PASS: TestMain (0.00s)
PASS
ok  	httptestfs	0.002s
```

It's pass! Let's break our handler to check if tests actually works.

```git

- f, err := os.OpenFile("./downloaded", os.O_WRONLY|os.O_CREATE, 0666)
+ f, err := fs.OpenFile("./download", os.O_WRONLY|os.O_CREATE, 0666)
                                if err != nil {
```

Tests fails due to not exist file. Just as we want. 

```shell
Running tool: /usr/bin/go test -timeout 30s -run ^TestMain$ httptestfs -v

=== RUN   TestMain
2022/01/13 15:31:55 Income file: file.jpg
    /home/user/dev/httpfs/main_test.go:49: file "downloaded" does not exist.
--- FAIL: TestMain (0.00s)
FAIL
FAIL	httptestfs	0.002s
```

Happy coding!