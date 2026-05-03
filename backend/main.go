package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/db"
	"github.com/wzos/backend/routes"
)

func main() {
	db.InitDB()

	r := gin.Default()

	routes.SetupRoutes(r)

	if _, err := os.Stat("dist"); err == nil {
		SetupEmbeddedFrontend(r)
	}

	log.Println("Backend server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}
