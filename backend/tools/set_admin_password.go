package main

import (
    "log"

    "golang.org/x/crypto/bcrypt"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

func main() {
    db, err := gorm.Open(sqlite.Open("wzos.db"), &gorm.Config{})
    if err != nil {
        log.Fatalf("open db: %v", err)
    }

    pass := "Wz0s!A9#2026$"
    hash, err := bcrypt.GenerateFromPassword([]byte(pass), 10)
    if err != nil {
        log.Fatalf("hash error: %v", err)
    }

    if err := db.Model(map[string]interface{}{"username": "admin"}).Where("username = ?", "admin").Update("password", string(hash)).Error; err != nil {
        // fallback: update using SQL
        if err := db.Exec("UPDATE users SET password = ? WHERE username = ?", string(hash), "admin").Error; err != nil {
            log.Fatalf("update admin password failed: %v", err)
        }
    }

    log.Printf("admin password updated to '%s'\n", pass)
}
