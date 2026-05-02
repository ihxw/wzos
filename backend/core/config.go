package core

import (
	"log"
	"os"
)

var JWTSecret string

func init() {
	JWTSecret = os.Getenv("WZOS_JWT_SECRET")
	if JWTSecret == "" {
		JWTSecret = "wzos-jwt-secret-key-2026"
		log.Println("Warning: WZOS_JWT_SECRET not set; using default JWT secret")
	}
}
