package services

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/wzos/backend/models"
	"github.com/wzos/backend/repository"
)

// trashDir is the location of the trash directory
var trashDir = filepath.Join(os.Getenv("HOME"), ".wzos-trash")

// trashInfoDir stores metadata about trashed files
var trashInfoDir = filepath.Join(os.Getenv("HOME"), ".wzos-trash", ".trashinfo")

// recentlyUsed holds recently accessed paths (in-memory, max 20)
var recentlyUsed []models.FileInfo
var maxRecent = 20

func init() {
	_ = os.MkdirAll(trashInfoDir, 0700)
}

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

// ===== Trash =====

type TrashItem struct {
	Name          string    `json:"name"`
	OriginalPath  string    `json:"originalPath"`
	TrashPath     string    `json:"trashPath"`
	IsDir         bool      `json:"isDir"`
	Size          int64     `json:"size"`
	DeletionDate  time.Time `json:"deletionDate"`
	Permissions   string    `json:"permissions"`
}

func MoveToTrash(path string) error {
	path = filepath.Clean(path)
	if !isPathSafe(path) {
		return fmt.Errorf("unsafe path")
	}
	if path == "/" || path == "/etc" || path == "/boot" || path == "/bin" || path == "/sbin" || path == "/lib" || path == "/usr" {
		return fmt.Errorf("不允许删除系统关键路径")
	}

	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("文件不存在: %v", err)
	}

	// Generate unique trash name to prevent collisions
	baseName := filepath.Base(path)
	trashName := baseName
	counter := 1
	for {
		checkPath := filepath.Join(trashDir, trashName)
		if _, err := os.Stat(checkPath); os.IsNotExist(err) {
			break
		}
		ext := filepath.Ext(baseName)
		nameWithoutExt := strings.TrimSuffix(baseName, ext)
		trashName = fmt.Sprintf("%s_%d%s", nameWithoutExt, counter, ext)
		counter++
	}

	trashPath := filepath.Join(trashDir, trashName)

	// Move the file
	if err := os.Rename(path, trashPath); err != nil {
		// Try copy+delete for cross-filesystem moves
		if info.IsDir() {
			if err := CopyDir(path, trashPath); err != nil {
				return fmt.Errorf("无法移动到废纸篓: %v", err)
			}
			os.RemoveAll(path)
		} else {
			if err := CopyFile(path, trashPath); err != nil {
				return fmt.Errorf("无法移动到废纸篓: %v", err)
			}
			os.Remove(path)
		}
	}

	// Write trashinfo metadata
	infoData := map[string]interface{}{
		"originalPath": path,
		"deletionDate": time.Now(),
		"isDir":        info.IsDir(),
	}
	infoJSON, _ := json.Marshal(infoData)
	infoPath := filepath.Join(trashInfoDir, trashName+".json")
	os.WriteFile(infoPath, infoJSON, 0600)

	return nil
}

func ListTrash() ([]TrashItem, error) {
	entries, err := os.ReadDir(trashDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []TrashItem{}, nil
		}
		return nil, err
	}

	var items []TrashItem
	for _, entry := range entries {
		if entry.Name() == ".trashinfo" {
			continue
		}
		trashPath := filepath.Join(trashDir, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue
		}

		item := TrashItem{
			Name:        entry.Name(),
			TrashPath:   trashPath,
			IsDir:       entry.IsDir(),
			Size:        info.Size(),
			Permissions: info.Mode().String(),
		}

		// Read metadata
		infoPath := filepath.Join(trashInfoDir, entry.Name()+".json")
		if data, err := os.ReadFile(infoPath); err == nil {
			var meta struct {
				OriginalPath string `json:"originalPath"`
				DeletionDate string `json:"deletionDate"`
				IsDir        bool   `json:"isDir"`
			}
			if json.Unmarshal(data, &meta) == nil {
				item.OriginalPath = meta.OriginalPath
				if t, err := time.Parse(time.RFC3339Nano, meta.DeletionDate); err == nil {
					item.DeletionDate = t
				} else if t, err := time.Parse(time.RFC3339, meta.DeletionDate); err == nil {
					item.DeletionDate = t
				}
			}
		}
		if item.DeletionDate.IsZero() {
			item.DeletionDate = info.ModTime()
		}

		items = append(items, item)
	}

	if items == nil {
		items = []TrashItem{}
	}
	return items, nil
}

func RestoreFromTrash(trashName string) error {
	trashPath := filepath.Join(trashDir, filepath.Base(trashName))

	// Read original path from metadata
	infoPath := filepath.Join(trashInfoDir, filepath.Base(trashName)+".json")
	originalPath := ""
	if data, err := os.ReadFile(infoPath); err == nil {
		var meta struct {
			OriginalPath string `json:"originalPath"`
		}
		if json.Unmarshal(data, &meta) == nil {
			originalPath = meta.OriginalPath
		}
	}

	if originalPath == "" {
		// Fallback: restore to home directory
		originalPath = filepath.Join(os.Getenv("HOME"), filepath.Base(trashName))
	}

	// Ensure parent directory exists
	parentDir := filepath.Dir(originalPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("无法创建原始目录: %v", err)
	}

	// Handle name collision at original location
	finalPath := originalPath
	counter := 1
	for {
		if _, err := os.Stat(finalPath); os.IsNotExist(err) {
			break
		}
		ext := filepath.Ext(originalPath)
		nameWithoutExt := strings.TrimSuffix(originalPath, ext)
		finalPath = fmt.Sprintf("%s_%d%s", nameWithoutExt, counter, ext)
		counter++
	}

	if err := os.Rename(trashPath, finalPath); err != nil {
		return fmt.Errorf("无法恢复文件: %v", err)
	}

	// Remove metadata
	os.Remove(infoPath)
	return nil
}

func EmptyTrash() error {
	entries, err := os.ReadDir(trashDir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.Name() == ".trashinfo" {
			continue
		}
		trashPath := filepath.Join(trashDir, entry.Name())
		os.RemoveAll(trashPath)
		// Remove metadata
		infoPath := filepath.Join(trashInfoDir, entry.Name()+".json")
		os.Remove(infoPath)
	}
	return nil
}

// ===== Duplicate =====

func DuplicateFile(path string) error {
	path = filepath.Clean(path)
	if !isPathSafe(path) {
		return fmt.Errorf("unsafe path")
	}

	srcInfo, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("文件不存在: %v", err)
	}

	// Generate duplicate name: "file copy.ext" or "file copy 2.ext"
	dir := filepath.Dir(path)
	ext := filepath.Ext(path)
	nameWithoutExt := strings.TrimSuffix(filepath.Base(path), ext)

	dstName := fmt.Sprintf("%s 副本%s", nameWithoutExt, ext)
	dst := filepath.Join(dir, dstName)

	counter := 2
	for {
		if _, err := os.Stat(dst); os.IsNotExist(err) {
			break
		}
		dstName = fmt.Sprintf("%s 副本 %d%s", nameWithoutExt, counter, ext)
		dst = filepath.Join(dir, dstName)
		counter++
	}

	if srcInfo.IsDir() {
		return CopyDir(path, dst)
	}
	return CopyFile(path, dst)
}

// ===== Compress / Extract =====

func CompressToZip(srcPath string) (string, error) {
	srcPath = filepath.Clean(srcPath)
	if !isPathSafe(srcPath) {
		return "", fmt.Errorf("unsafe path")
	}

	if _, err := os.Stat(srcPath); err != nil {
		return "", fmt.Errorf("文件不存在: %v", err)
	}

	dir := filepath.Dir(srcPath)
	baseName := filepath.Base(srcPath)
	zipName := baseName + ".zip"
	zipPath := filepath.Join(dir, zipName)

	// Handle existing name
	counter := 1
	for {
		if _, err := os.Stat(zipPath); os.IsNotExist(err) {
			break
		}
		zipName = fmt.Sprintf("%s_%d.zip", baseName, counter)
		zipPath = filepath.Join(dir, zipName)
		counter++
	}

	zipFile, err := os.Create(zipPath)
	if err != nil {
		return "", fmt.Errorf("无法创建压缩文件: %v", err)
	}
	defer zipFile.Close()

	writer := zip.NewWriter(zipFile)
	defer writer.Close()

	info, err := os.Stat(srcPath)
	if err != nil {
		return "", err
	}

	if info.IsDir() {
		prefix := baseName + "/"
		err = filepath.Walk(srcPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			if shouldSkipDir(path) && info.IsDir() {
				return filepath.SkipDir
			}
			rel, _ := filepath.Rel(srcPath, path)
			zipEntryPath := prefix + rel
			if rel == "." {
				zipEntryPath = prefix
			}

			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return nil
			}
			header.Name = zipEntryPath
			header.Method = zip.Deflate

			if info.IsDir() {
				header.Name += "/"
				_, err = writer.CreateHeader(header)
				return err
			}

			w, err := writer.CreateHeader(header)
			if err != nil {
				return err
			}
			f, err := os.Open(path)
			if err != nil {
				return nil
			}
			defer f.Close()
			io.Copy(w, f)
			return nil
		})
	} else {
		f, err := os.Open(srcPath)
		if err != nil {
			return "", err
		}
		defer f.Close()

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return "", err
		}
		header.Name = baseName
		header.Method = zip.Deflate
		w, err := writer.CreateHeader(header)
		if err != nil {
			return "", err
		}
		io.Copy(w, f)
	}

	if err != nil {
		os.Remove(zipPath)
		return "", err
	}

	return zipPath, nil
}

func ExtractZip(zipPath string) (string, error) {
	zipPath = filepath.Clean(zipPath)
	if !isPathSafe(zipPath) {
		return "", fmt.Errorf("unsafe path")
	}

	if _, err := os.Stat(zipPath); err != nil {
		return "", fmt.Errorf("压缩文件不存在: %v", err)
	}

	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", fmt.Errorf("无法打开压缩文件: %v", err)
	}
	defer reader.Close()

	dir := filepath.Dir(zipPath)
	baseName := strings.TrimSuffix(filepath.Base(zipPath), filepath.Ext(zipPath))
	extractPath := filepath.Join(dir, baseName)

	// Handle existing name
	counter := 1
	for {
		if _, err := os.Stat(extractPath); os.IsNotExist(err) {
			break
		}
		extractPath = filepath.Join(dir, fmt.Sprintf("%s_%d", baseName, counter))
		counter++
	}

	if err := os.MkdirAll(extractPath, 0755); err != nil {
		return "", err
	}

	for _, file := range reader.File {
		targetPath := filepath.Join(extractPath, file.Name)

		// Prevent zip slip
		cleanTarget := filepath.Clean(targetPath)
		if !strings.HasPrefix(cleanTarget, filepath.Clean(extractPath)+string(os.PathSeparator)) && cleanTarget != filepath.Clean(extractPath) {
			continue
		}

		if file.FileInfo().IsDir() {
			os.MkdirAll(targetPath, file.Mode())
			continue
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return "", err
		}

		src, err := file.Open()
		if err != nil {
			continue
		}

		dst, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			src.Close()
			continue
		}

		io.Copy(dst, src)
		src.Close()
		dst.Close()
	}

	return extractPath, nil
}

// ===== Recent Items =====

func AddRecent(file models.FileInfo) {
	// Remove duplicate
	for i, r := range recentlyUsed {
		if r.Path == file.Path {
			recentlyUsed = append(recentlyUsed[:i], recentlyUsed[i+1:]...)
			break
		}
	}
	// Prepend
	recentlyUsed = append([]models.FileInfo{file}, recentlyUsed...)
	if len(recentlyUsed) > maxRecent {
		recentlyUsed = recentlyUsed[:maxRecent]
	}
}

func GetRecent() []models.FileInfo {
	// Filter out items that no longer exist
	var valid []models.FileInfo
	for _, r := range recentlyUsed {
		if _, err := os.Stat(r.Path); err == nil {
			valid = append(valid, r)
		}
	}
	if valid == nil {
		valid = []models.FileInfo{}
	}
	return valid
}
