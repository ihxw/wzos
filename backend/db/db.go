package db

import (
	"log"
	"os"

	"github.com/wzos/backend/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	dbPath := "wzos.db"

	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	if err = DB.AutoMigrate(&models.User{}, &models.SystemConfig{}, &models.Favorite{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	seedData()
}

func seedData() {
	var count int64
	DB.Model(&models.Favorite{}).Count(&count)

	if count == 0 {
		home, _ := os.UserHomeDir()

		favorites := []models.Favorite{
			{Name: "根目录", Path: "/", Icon: "hdd"},
			{Name: "主目录", Path: home, Icon: "home"},
			{Name: "系统配置", Path: "/etc", Icon: "setting"},
			{Name: "日志", Path: "/var/log", Icon: "file-text"},
		}

		for _, f := range favorites {
			DB.Create(&f)
		}
	}

	var userCount int64
	DB.Model(&models.User{}).Count(&userCount)
	if userCount == 0 {
		DB.Create(&models.User{
			Username: "admin",
			Password: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
		})
	}
}
