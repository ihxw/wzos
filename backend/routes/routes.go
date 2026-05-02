package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/api"
	"github.com/wzos/backend/core"
	"github.com/wzos/backend/db"
	"github.com/wzos/backend/handlers"
	"github.com/wzos/backend/middleware"
	"github.com/wzos/backend/ws"
)

func SetupRoutes(r *gin.Engine) {
	authService := core.NewAuthService(db.DB)
	systemInfoService := core.NewSystemInfoService()

	authHandler := api.NewAuthHandler(authService)
	systemInfoHandler := api.NewSystemInfoHandler(systemInfoService)

	r.POST("/api/login", authHandler.Login)

	// File browsing - read-only routes (no auth required for browsing)
	handlers.RegisterFileRoutes(r)

	// Protected routes
	auth := r.Group("/api")
	auth.Use(middleware.JWTAuth())
	{
		auth.GET("/sysinfo/overview", systemInfoHandler.GetOverview)
	}

	ws.RegisterTerminalRoute(r)
}
