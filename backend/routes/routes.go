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
	firewallService := core.NewFirewallService()
	networkService := core.NewNetworkService()

	authHandler := api.NewAuthHandler(authService)
	systemInfoHandler := api.NewSystemInfoHandler(systemInfoService)
	firewallHandler := api.NewFirewallHandler(firewallService)
	networkHandler := api.NewNetworkHandler(networkService)

	r.POST("/api/login", authHandler.Login)

	// File browsing - read-only routes (no auth required for browsing)
	handlers.RegisterFileRoutes(r)

	// Protected routes
	auth := r.Group("/api")
	auth.Use(middleware.JWTAuth())
	{
		auth.GET("/sysinfo/overview", systemInfoHandler.GetOverview)
		auth.GET("/firewall/status", firewallHandler.GetStatus)
		auth.POST("/firewall/enable", firewallHandler.SetEnabled)

		auth.GET("/network/overview", networkHandler.GetOverview)
		auth.GET("/network/device/:device", networkHandler.GetDetail)
		auth.POST("/network/device/:device/enabled", networkHandler.SetEnabled)
		auth.PUT("/network/device/:device/ipv4", networkHandler.SetIPv4)
		auth.GET("/network/wifi/scan", networkHandler.ScanWiFi)
		auth.POST("/network/wifi/:device/connect", networkHandler.ConnectWiFi)
	}

	ws.RegisterTerminalRoute(r)
}
