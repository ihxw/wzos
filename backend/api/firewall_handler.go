package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/core"
)

type FirewallHandler struct {
	Service *core.FirewallService
}

func NewFirewallHandler(service *core.FirewallService) *FirewallHandler {
	return &FirewallHandler{Service: service}
}

func (h *FirewallHandler) GetStatus(c *gin.Context) {
	c.JSON(http.StatusOK, h.Service.GetStatus())
}

func (h *FirewallHandler) SetEnabled(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	status, err := h.Service.SetEnabled(req.Enabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}
