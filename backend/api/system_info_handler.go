package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/core"
)

type SystemInfoHandler struct {
	Service *core.SystemInfoService
}

func NewSystemInfoHandler(service *core.SystemInfoService) *SystemInfoHandler {
	return &SystemInfoHandler{Service: service}
}

func (h *SystemInfoHandler) GetOverview(c *gin.Context) {
	overview, err := h.Service.GetOverview()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get system info"})
		return
	}

	c.JSON(http.StatusOK, overview)
}
