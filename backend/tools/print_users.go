package main

import (
    "fmt"
    "log"

    "github.com/wzos/backend/models"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

func main() {
    db, err := gorm.Open(sqlite.Open("wzos.db"), &gorm.Config{})
    if err != nil {
        log.Fatalf("open db: %v", err)
    }

    var users []models.User
    if err := db.Find(&users).Error; err != nil {
        log.Fatalf("query users: %v", err)
    }

    for _, u := range users {
        fmt.Printf("%s|%s\n", u.Username, u.Password)
    }
}
