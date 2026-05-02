package services

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/wzos/backend/models"
	"github.com/wzos/backend/repository"
)

// skipDirs lists directory names to skip during listing and search
var skipDirs = map[string]bool{
	"/proc": true, "/sys": true, "/dev": true, "/run": true,
	"/snap": true, "/lost+found": true,
}

// skipDirNames lists directory base names to skip anywhere
var skipDirNames = map[string]bool{
	".cache": true, ".local": true, ".config": true,
}

func isPathSafe(path string) bool {
	cleaned := filepath.Clean(path)
	if strings.Contains(cleaned, "..") {
		return false
	}
	return true
}

func shouldSkipDir(path string) bool {
	if skipDirs[path] {
		return true
	}
	base := filepath.Base(path)
	if skipDirNames[base] {
		return true
	}
	return false
}

func ListFiles(dirPath string) ([]models.FileInfo, error) {
	dirPath = filepath.Clean(dirPath)

	if !isPathSafe(dirPath) {
		return nil, fmt.Errorf("unsafe path: %s", dirPath)
	}

	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("无法访问路径 %s: %v", dirPath, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("不是一个目录: %s", dirPath)
	}

	entries, err := os.ReadDir(dirPath)
	if err != nil {
		// Check if it's a permission error
		if os.IsPermission(err) {
			return nil, fmt.Errorf("没有权限访问 %s", dirPath)
		}
		return nil, fmt.Errorf("无法读取目录 %s: %v", dirPath, err)
	}

	var files []models.FileInfo
	for _, entry := range entries {
		filePath := filepath.Join(dirPath, entry.Name())

		if entry.IsDir() && shouldSkipDir(filePath) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		files = append(files, models.FileInfo{
			Name:        entry.Name(),
			Path:        filePath,
			IsDir:       entry.IsDir(),
			Size:        info.Size(),
			ModTime:     info.ModTime(),
			Permissions: info.Mode().String(),
		})
	}
	return files, nil
}

func GetFavorites() ([]models.Favorite, error) {
	all, err := repository.GetFavorites()
	if err != nil {
		return nil, err
	}
	// Filter out favorites whose paths no longer exist
	var valid []models.Favorite
	for _, f := range all {
		if _, err := os.Stat(f.Path); err == nil {
			valid = append(valid, f)
		}
	}
	if valid == nil {
		valid = []models.Favorite{}
	}
	return valid, nil
}

func AddFavorite(f models.Favorite) error {
	return repository.AddFavorite(f)
}

func DeleteFavorite(id uint) error {
	return repository.DeleteFavorite(id)
}

func DeleteFile(path string) error {
	path = filepath.Clean(path)
	if !isPathSafe(path) {
		return fmt.Errorf("unsafe path")
	}
	// Prevent deleting root or critical system paths
	if path == "/" || path == "/etc" || path == "/boot" || path == "/bin" || path == "/sbin" || path == "/lib" || path == "/usr" {
		return fmt.Errorf("不允许删除系统关键路径")
	}
	return os.RemoveAll(path)
}

func RenameFile(oldPath, newPath string) error {
	oldPath = filepath.Clean(oldPath)
	newPath = filepath.Clean(newPath)
	if !isPathSafe(oldPath) || !isPathSafe(newPath) {
		return fmt.Errorf("unsafe path")
	}
	// Ensure parent directory exists
	parentDir := filepath.Dir(newPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("无法创建目标目录: %v", err)
	}
	return os.Rename(oldPath, newPath)
}

func CreateFileOrFolder(path string, isDir bool) error {
	path = filepath.Clean(path)
	if !isPathSafe(path) {
		return fmt.Errorf("unsafe path")
	}
	// Ensure parent exists
	parentDir := filepath.Dir(path)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("无法创建父目录: %v", err)
	}
	if isDir {
		return os.MkdirAll(path, 0755)
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	return file.Close()
}

func CopyFile(src, dst string) error {
	src = filepath.Clean(src)
	dst = filepath.Clean(dst)

	sourceFile, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("无法打开源文件: %v", err)
	}
	defer sourceFile.Close()

	info, err := sourceFile.Stat()
	if err != nil {
		return err
	}

	parentDir := filepath.Dir(dst)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("无法创建目标目录: %v", err)
	}

	destFile, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, info.Mode())
	if err != nil {
		return fmt.Errorf("无法创建目标文件: %v", err)
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

func CopyDir(src, dst string) error {
	src = filepath.Clean(src)
	dst = filepath.Clean(dst)

	srcInfo, err := os.Stat(src)
	if err != nil {
		return fmt.Errorf("源目录不存在: %v", err)
	}
	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return fmt.Errorf("无法创建目标目录: %v", err)
	}

	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip inaccessible files
		}
		if shouldSkipDir(path) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return nil
		}
		dstPath := filepath.Join(dst, relPath)
		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}
		return CopyFile(path, dstPath)
	})
}

func SearchFiles(root, query string, limit int) ([]models.FileInfo, error) {
	root = filepath.Clean(root)
	if !isPathSafe(root) {
		return nil, fmt.Errorf("unsafe path")
	}
	if limit <= 0 {
		limit = 100
	}
	query = strings.ToLower(query)
	var results []models.FileInfo

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Skip files we can't access based on permission errors
			if os.IsPermission(err) || os.IsNotExist(err) {
				if info != nil && info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			// Skip paths that cause other errors
			return nil
		}

		// Skip special directories
		if info.IsDir() && shouldSkipDir(path) {
			return filepath.SkipDir
		}

		// Limit search depth to 8
		rel, _ := filepath.Rel(root, path)
		depth := strings.Count(rel, string(os.PathSeparator))
		if depth > 8 {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if len(results) >= limit {
			return fmt.Errorf("limit reached")
		}

		if strings.Contains(strings.ToLower(info.Name()), query) {
			results = append(results, models.FileInfo{
				Name:        info.Name(),
				Path:        path,
				IsDir:       info.IsDir(),
				Size:        info.Size(),
				ModTime:     info.ModTime(),
				Permissions: info.Mode().String(),
			})
		}
		return nil
	})

	if err != nil && err.Error() == "limit reached" {
		return results, nil
	}
	return results, err
}

// GetDiskUsage returns disk usage info for a path
type DiskUsage struct {
	Total uint64 `json:"total"`
	Used  uint64 `json:"used"`
	Free  uint64 `json:"free"`
}

func GetDiskUsage(path string) (*DiskUsage, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return nil, err
	}
	return &DiskUsage{
		Total: stat.Blocks * uint64(stat.Bsize),
		Free:  stat.Bfree * uint64(stat.Bsize),
		Used:  (stat.Blocks - stat.Bfree) * uint64(stat.Bsize),
	}, nil
}
