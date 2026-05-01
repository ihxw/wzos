package handlers

import (
	"net/http"
	"runtime"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/services"
)

func RegisterFileRoutes(r *gin.Engine) {
	api := r.Group("/api/files")
	{
		api.GET("/list", ListFiles)
		api.GET("/favorites", GetFavorites)
		api.POST("/delete", DeleteFile)
		api.POST("/rename", RenameFile)
		api.POST("/create", CreateFileOrFolder)
	}
}

func ListFiles(c *gin.Context) {
	dirPath := c.Query("path")
	if dirPath == "" {
		if runtime.GOOS == "windows" {
			dirPath = "C:\\"
		} else {
			dirPath = "/"
		}
	}

	files, err := services.ListFiles(dirPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, files)
}

func GetFavorites(c *gin.Context) {
	favorites, err := services.GetFavorites()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, favorites)
}

func DeleteFile(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := services.DeleteFile(req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func RenameFile(c *gin.Context) {
	var req struct {
		OldPath string `json:"oldPath"`
		NewPath string `json:"newPath"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := services.RenameFile(req.OldPath, req.NewPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func CreateFileOrFolder(c *gin.Context) {
	var req struct {
		Path  string `json:"path"`
		IsDir bool   `json:"isDir"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := services.CreateFileOrFolder(req.Path, req.IsDir); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
