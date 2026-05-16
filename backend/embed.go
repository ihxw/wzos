package main

import (
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"path"
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

	r.NoRoute(func(c *gin.Context) {
		reqPath := c.Request.URL.Path

		if strings.HasPrefix(reqPath, "/api") || strings.HasPrefix(reqPath, "/ws") {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		filePath := strings.TrimPrefix(reqPath, "/")
		if filePath == "" {
			filePath = "index.html"
		}

		if data, ok := readDistFile(distFS, filePath); ok {
			writeDistFile(c, filePath, data)
			return
		}

		// Missing static asset (e.g. /foo.js) — do not fall back to SPA shell.
		if strings.Contains(path.Base(filePath), ".") {
			c.Status(http.StatusNotFound)
			return
		}

		if data, ok := readDistFile(distFS, "index.html"); ok {
			writeDistFile(c, "index.html", data)
			return
		}

		c.Status(http.StatusNotFound)
	})
}

func readDistFile(fsys fs.FS, name string) ([]byte, bool) {
	name = path.Clean(name)
	if name == "." || strings.HasPrefix(name, "..") {
		return nil, false
	}

	info, err := fs.Stat(fsys, name)
	if err != nil || info.IsDir() {
		return nil, false
	}

	data, err := fs.ReadFile(fsys, name)
	if err != nil {
		return nil, false
	}
	return data, true
}

func writeDistFile(c *gin.Context, name string, data []byte) {
	contentType := mime.TypeByExtension(path.Ext(name))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if name == "index.html" {
		contentType = "text/html; charset=utf-8"
	}
	c.Data(http.StatusOK, contentType, data)
}
