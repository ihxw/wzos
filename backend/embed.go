package main

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var embeddedFiles embed.FS

func SetupEmbeddedFrontend(r *gin.Engine) {
	distFS, err := fs.Sub(embeddedFiles, "dist")
	if err != nil {
		panic(err)
	}

	fileServer := http.FileServer(http.FS(distFS))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") {
			c.Next()
			return
		}

		if strings.Contains(path, ".") {
			fileServer.ServeHTTP(c.Writer, c.Request)
		} else {
			c.Request.URL.Path = "/index.html"
			fileServer.ServeHTTP(c.Writer, c.Request)
		}
	})
}
