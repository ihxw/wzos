package core

import (
    "testing"

    "github.com/golang-jwt/jwt/v5"
    "github.com/wzos/backend/models"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
    db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
    if err != nil {
        t.Fatalf("failed to open test db: %v", err)
    }

    if err := db.AutoMigrate(&models.User{}); err != nil {
        t.Fatalf("failed to migrate: %v", err)
    }

    return db
}

func TestLoginSuccessAndFailure(t *testing.T) {
    db := setupTestDB(t)
    svc := NewAuthService(db)

    // create user
    hash, err := svc.HashPassword("secret123")
    if err != nil {
        t.Fatalf("hash password error: %v", err)
    }

    user := models.User{Username: "testuser", Password: hash}
    if err := db.Create(&user).Error; err != nil {
        t.Fatalf("failed to create user: %v", err)
    }

    // successful login
    tokenStr, err := svc.Login("testuser", "secret123")
    if err != nil {
        t.Fatalf("expected login success, got error: %v", err)
    }
    if tokenStr == "" {
        t.Fatalf("expected token, got empty string")
    }

    // parse token and check claims
    token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
        return []byte(JWTSecret), nil
    })
    if err != nil || !token.Valid {
        t.Fatalf("failed to parse token: %v", err)
    }

    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        t.Fatalf("invalid token claims type")
    }
    if claims["username"] != "testuser" {
        t.Fatalf("expected username claim 'testuser', got %v", claims["username"])
    }

    // failed login
    _, err = svc.Login("testuser", "wrongpass")
    if err == nil {
        t.Fatalf("expected error for wrong password")
    }
}
