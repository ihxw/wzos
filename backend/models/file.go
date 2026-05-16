package models

import "time"

type FileInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	IsDir       bool      `json:"isDir"`
	Size        int64     `json:"size"`
	ModTime     time.Time `json:"modTime"`
	Permissions string    `json:"permissions"`
	// UI hints for the web client (filled by ListFiles / search)
	Kind      string `json:"kind,omitempty"`      // directory | text | media | pdf | archive | unknown
	OpenWith  string `json:"openWith,omitempty"`  // file-manager | text-editor | media-viewer | browser | reveal
	MimeType  string `json:"mimeType,omitempty"`
	Extension string `json:"extension,omitempty"`
	MediaType string `json:"mediaType,omitempty"` // image | audio | video
	Language  string `json:"language,omitempty"`  // Monaco editor language id
}

type Favorite struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null"`
	Path      string    `json:"path" gorm:"not null"`
	Icon      string    `json:"icon"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
