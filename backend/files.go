package main

import (
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

type FileInfo struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

func setupFileRoutes(r *gin.Engine) {
	r.GET("/api/files/list", listFiles)
	r.POST("/api/files/delete", deleteFile)
	r.POST("/api/files/rename", renameFile)
	r.POST("/api/files/create", createFileOrFolder)
}

func listFiles(c *gin.Context) {
	dirPath := c.Query("path")
	if dirPath == "" {
		if runtimeOS := "linux"; runtimeOS == "windows" { // Simplistic check, update logic if needed
			dirPath = "C:\\"
		} else {
			dirPath = "/"
		}
	}

	entries, err := ioutil.ReadDir(dirPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var files []FileInfo
	for _, entry := range entries {
		files = append(files, FileInfo{
			Name:    entry.Name(),
			Path:    filepath.Join(dirPath, entry.Name()),
			IsDir:   entry.IsDir(),
			Size:    entry.Size(),
			ModTime: entry.ModTime(),
		})
	}

	c.JSON(http.StatusOK, files)
}

func deleteFile(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	err := os.RemoveAll(req.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func renameFile(c *gin.Context) {
	var req struct {
		OldPath string `json:"oldPath"`
		NewPath string `json:"newPath"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	err := os.Rename(req.OldPath, req.NewPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func createFileOrFolder(c *gin.Context) {
	var req struct {
		Path  string `json:"path"`
		IsDir bool   `json:"isDir"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if req.IsDir {
		err := os.MkdirAll(req.Path, 0755)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		file, err := os.Create(req.Path)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		file.Close()
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
