package models

import "time"

type FileInfo struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"isDir"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
}

type Favorite struct {
	ID   int64  `json:"id" db:"id"`
	Name string `json:"name" db:"name"`
	Path string `json:"path" db:"path"`
	Icon string `json:"icon" db:"icon"`
}
