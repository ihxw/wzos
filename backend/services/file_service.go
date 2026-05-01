package services

import (
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/wzos/backend/models"
	"github.com/wzos/backend/repository"
)

func ListFiles(dirPath string) ([]models.FileInfo, error) {
	entries, err := ioutil.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var files []models.FileInfo
	for _, entry := range entries {
		files = append(files, models.FileInfo{
			Name:    entry.Name(),
			Path:    filepath.Join(dirPath, entry.Name()),
			IsDir:   entry.IsDir(),
			Size:    entry.Size(),
			ModTime: entry.ModTime(),
		})
	}
	return files, nil
}

func GetFavorites() ([]models.Favorite, error) {
	return repository.GetFavorites()
}

func DeleteFile(path string) error {
	return os.RemoveAll(path)
}

func RenameFile(oldPath, newPath string) error {
	return os.Rename(oldPath, newPath)
}

func CreateFileOrFolder(path string, isDir bool) error {
	if isDir {
		return os.MkdirAll(path, 0755)
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	return file.Close()
}
