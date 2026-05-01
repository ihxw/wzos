package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() {
	var err error
	dbPath := "wzos.db"
	
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	createTables()
	seedData()
}

func createTables() {
	query := `
	CREATE TABLE IF NOT EXISTS favorites (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		path TEXT NOT NULL,
		icon TEXT NOT NULL
	);`
	
	_, err := DB.Exec(query)
	if err != nil {
		log.Fatalf("Failed to create favorites table: %v", err)
	}
}

func seedData() {
	// Check if favorites is empty
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM favorites").Scan(&count)
	if err != nil {
		log.Printf("Error checking favorites count: %v", err)
		return
	}

	if count == 0 {
		home, _ := os.UserHomeDir()
		if home == "" {
			home = "/home/user"
		}

		favorites := []struct {
			Name string
			Path string
			Icon string
		}{
			{"桌面", filepath.Join(home, "Desktop"), "desktop"},
			{"文档", filepath.Join(home, "Documents"), "file-text"},
			{"下载", filepath.Join(home, "Downloads"), "download"},
			{"图片", filepath.Join(home, "Pictures"), "picture"},
		}

		for _, f := range favorites {
			_, err := DB.Exec("INSERT INTO favorites (name, path, icon) VALUES (?, ?, ?)", f.Name, f.Path, f.Icon)
			if err != nil {
				log.Printf("Error seeding favorite %s: %v", f.Name, err)
			}
		}
	}
}
