package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/models"
	"github.com/wzos/backend/services"
)

func RegisterFileRoutes(r gin.IRouter) {
	files := r.Group("/api/files")
	{
		files.GET("/list", ListFiles)
		files.GET("/favorites", GetFavorites)
		files.GET("/search", SearchFiles)
		files.POST("/delete", DeleteFile)
		files.POST("/rename", RenameFile)
		files.POST("/create", CreateFileOrFolder)
		files.POST("/copy", CopyFileOrDir)
		files.POST("/duplicate", DuplicateFile)
		files.POST("/upload", UploadFile)
		files.GET("/download", DownloadFile)
		files.GET("/view", ViewFile)
		files.GET("/diskusage", DiskUsage)
		files.POST("/favorites/add", AddFavorite)
		files.POST("/favorites/delete", DeleteFavorite)
		// Trash
		files.POST("/trash/move", MoveToTrash)
		files.GET("/trash/list", ListTrash)
		files.POST("/trash/restore", RestoreFromTrash)
		files.POST("/trash/empty", EmptyTrash)
		// Compress / Extract
		files.POST("/compress", CompressFile)
		files.POST("/extract", ExtractFile)
		// Recent
		files.GET("/recent", GetRecentItems)
		files.POST("/recent/add", AddRecentItem)
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

	dirPath = filepath.Clean(dirPath)
	if info, err := os.Stat(dirPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "路径不存在: " + dirPath})
		return
	} else if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "无法访问路径: " + err.Error()})
		return
	} else if !info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不是一个目录: " + dirPath})
		return
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

func CopyFileOrDir(c *gin.Context) {
	var req struct {
		Src string `json:"src"`
		Dst string `json:"dst"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	info, err := os.Stat(req.Src)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Source not found"})
		return
	}

	if info.IsDir() {
		err = services.CopyDir(req.Src, req.Dst)
	} else {
		err = services.CopyFile(req.Src, req.Dst)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func AddFavorite(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
		Path string `json:"path"`
		Icon string `json:"icon"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	fav := models.Favorite{Name: req.Name, Path: req.Path, Icon: req.Icon}
	if err := services.AddFavorite(fav); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteFavorite(c *gin.Context) {
	var req struct {
		ID uint `json:"id"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := services.DeleteFavorite(req.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func SearchFiles(c *gin.Context) {
	root := c.Query("path")
	query := c.Query("query")

	if root == "" {
		if runtime.GOOS == "windows" {
			root = "C:\\"
		} else {
			root = "/"
		}
	}
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter required"})
		return
	}

	files, err := services.SearchFiles(root, query, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, files)
}

func UploadFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File required"})
		return
	}

	destPath := c.PostForm("path")
	if destPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Destination path required"})
		return
	}

	destDir := filepath.Clean(destPath)
	if err := c.SaveUploadedFile(file, filepath.Join(destDir, file.Filename)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DiskUsage(c *gin.Context) {
	dirPath := c.Query("path")
	if dirPath == "" {
		dirPath = "/"
	}
	usage, err := services.GetDiskUsage(dirPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, usage)
}

func DownloadFile(c *gin.Context) {
	filePath := c.Query("path")
	if filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path required"})
		return
	}

	filePath = filepath.Clean(filePath)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.FileAttachment(filePath, filepath.Base(filePath))
}

// ViewFile serves a file for inline viewing (no Content-Disposition: attachment).
// Used for displaying images, audio, video in the browser.
func ViewFile(c *gin.Context) {
	filePath := c.Query("path")
	if filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path required"})
		return
	}

	filePath = filepath.Clean(filePath)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.File(filePath)
}

// ===== Trash Handlers =====

func MoveToTrash(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := services.MoveToTrash(req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func ListTrash(c *gin.Context) {
	items, err := services.ListTrash()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func RestoreFromTrash(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := services.RestoreFromTrash(req.Name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func EmptyTrash(c *gin.Context) {
	if err := services.EmptyTrash(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ===== Duplicate Handler =====

func DuplicateFile(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	if err := services.DuplicateFile(req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ===== Compress / Extract Handlers =====

func CompressFile(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	zipPath, err := services.CompressToZip(req.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"zipPath": zipPath, "success": true})
}

func ExtractFile(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	extractPath, err := services.ExtractZip(req.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"extractPath": extractPath, "success": true})
}

// ===== Recent Items Handlers =====

func GetRecentItems(c *gin.Context) {
	items := services.GetRecent()
	c.JSON(http.StatusOK, items)
}

func AddRecentItem(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Path        string `json:"path"`
		IsDir       bool   `json:"isDir"`
		Size        int64  `json:"size"`
		ModTime     string `json:"modTime"`
		Permissions string `json:"permissions"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	// Parse time string to time.Time for internal use
	modTime, _ := time.Parse(time.RFC3339, req.ModTime)
	services.AddRecent(models.FileInfo{
		Name:        req.Name,
		Path:        req.Path,
		IsDir:       req.IsDir,
		Size:        req.Size,
		ModTime:     modTime,
		Permissions: req.Permissions,
	})
	c.JSON(http.StatusOK, gin.H{"success": true})
}
