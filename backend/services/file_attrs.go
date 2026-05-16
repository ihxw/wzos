package services

import (
	"mime"
	"path/filepath"
	"strings"

	"github.com/wzos/backend/models"
)

// FillFileAttrs sets kind / openWith / mimeType / extension / mediaType / language for the web UI.
func FillFileAttrs(f *models.FileInfo) {
	if f == nil {
		return
	}

	ext := fileExtension(f.Name)
	f.Extension = ext
	if f.IsDir {
		f.Kind = "directory"
		f.OpenWith = "file-manager"
		f.MimeType = "inode/directory"
		return
	}

	f.MimeType = mime.TypeByExtension("." + ext)
	if f.MimeType == "" {
		f.MimeType = "application/octet-stream"
	}

	switch {
	case isMediaExt(ext):
		f.Kind = "media"
		f.OpenWith = "media-viewer"
		f.MediaType = mediaTypeForExt(ext)
	case isTextName(f.Name, ext):
		f.Kind = "text"
		f.OpenWith = "text-editor"
		f.Language = monacoLanguage(f.Name, ext)
	case ext == "pdf":
		f.Kind = "pdf"
		f.OpenWith = "browser"
	case isArchiveExt(ext):
		f.Kind = "archive"
		f.OpenWith = "reveal"
	default:
		f.Kind = "unknown"
		f.OpenWith = "reveal"
	}
}

func fileExtension(name string) string {
	base := filepath.Base(name)
	if strings.EqualFold(base, "dockerfile") || strings.EqualFold(base, "makefile") {
		return strings.ToLower(base)
	}
	dot := strings.LastIndex(base, ".")
	if dot <= 0 {
		return ""
	}
	return strings.ToLower(base[dot+1:])
}

func isMediaExt(ext string) bool {
	switch ext {
	case "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "tif", "heic", "heif", "avif",
		"mp3", "wav", "flac", "ogg", "aac", "wma", "m4a", "opus", "aiff", "ape",
		"mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "mpeg", "mpg", "3gp":
		return true
	default:
		return false
	}
}

func mediaTypeForExt(ext string) string {
	switch ext {
	case "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "tif", "heic", "heif", "avif":
		return "image"
	case "mp3", "wav", "flac", "ogg", "aac", "wma", "m4a", "opus", "aiff", "ape":
		return "audio"
	default:
		return "video"
	}
}

func isArchiveExt(ext string) bool {
	switch ext {
	case "zip", "rar", "tar", "gz", "bz2", "xz", "7z", "tgz", "tbz2", "zst", "deb", "rpm":
		return true
	default:
		return false
	}
}

func isTextName(name, ext string) bool {
	if isTextExt(ext) {
		return true
	}
	lower := strings.ToLower(filepath.Base(name))
	switch lower {
	case "makefile", "dockerfile", "license", "readme", "changelog", "gemfile", "rakefile", "procfile":
		return true
	}
	return false
}

func isTextExt(ext string) bool {
	switch ext {
	case "txt", "md", "markdown", "json", "jsonc", "js", "mjs", "cjs", "jsx",
		"ts", "tsx", "html", "htm", "xhtml", "css", "scss", "sass", "less",
		"xml", "yaml", "yml", "toml", "ini", "cfg", "conf", "config",
		"env", "properties", "gitignore", "dockerignore", "editorconfig",
		"go", "mod", "sum", "py", "pyw", "rb", "php", "java", "kt", "kts",
		"c", "h", "cpp", "cc", "cxx", "hpp", "cs", "rs", "swift", "sql",
		"sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "lua", "r",
		"vue", "svelte", "graphql", "gql", "proto", "log", "csv", "tsv",
		"nginx", "service", "desktop", "plist", "claude", "cursorrules":
		return true
	default:
		return false
	}
}

func monacoLanguage(name, ext string) string {
	if strings.EqualFold(filepath.Base(name), "dockerfile") {
		return "dockerfile"
	}
	if strings.EqualFold(filepath.Base(name), "makefile") {
		return "makefile"
	}
	switch ext {
	case "js", "mjs", "cjs", "jsx":
		return "javascript"
	case "ts", "tsx", "mts", "cts":
		return "typescript"
	case "json", "jsonc":
		return "json"
	case "html", "htm", "xhtml", "vue", "svelte":
		return "html"
	case "css":
		return "css"
	case "scss", "sass":
		return "scss"
	case "less":
		return "less"
	case "md", "markdown":
		return "markdown"
	case "xml", "svg":
		return "xml"
	case "yaml", "yml":
		return "yaml"
	case "py", "pyw":
		return "python"
	case "go", "mod", "sum":
		return "go"
	case "rs":
		return "rust"
	case "java":
		return "java"
	case "kt", "kts":
		return "kotlin"
	case "c", "h":
		return "c"
	case "cpp", "cc", "cxx", "hpp":
		return "cpp"
	case "cs":
		return "csharp"
	case "php":
		return "php"
	case "rb":
		return "ruby"
	case "swift":
		return "swift"
	case "sh", "bash", "zsh", "fish", "env":
		return "shell"
	case "ps1":
		return "powershell"
	case "bat", "cmd":
		return "bat"
	case "sql":
		return "sql"
	case "lua":
		return "lua"
	case "r":
		return "r"
	case "graphql", "gql":
		return "graphql"
	case "proto":
		return "protobuf"
	case "ini", "cfg", "conf", "properties", "editorconfig", "toml":
		return "ini"
	default:
		return "plaintext"
	}
}
