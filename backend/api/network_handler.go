package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/core"
)

type NetworkHandler struct {
	Service *core.NetworkServiceCore
}

func NewNetworkHandler(service *core.NetworkServiceCore) *NetworkHandler {
	return &NetworkHandler{Service: service}
}

func (h *NetworkHandler) GetOverview(c *gin.Context) {
	overview, err := h.Service.GetOverview()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, overview)
}

func (h *NetworkHandler) GetDetail(c *gin.Context) {
	device := c.Param("device")
	detail, err := h.Service.GetDetail(device)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *NetworkHandler) SetEnabled(c *gin.Context) {
	device := c.Param("device")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := h.Service.SetDeviceEnabled(device, req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *NetworkHandler) SetIPv4(c *gin.Context) {
	device := c.Param("device")
	var req core.SetIPv4Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := h.Service.SetIPv4(device, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *NetworkHandler) ScanWiFi(c *gin.Context) {
	device := c.Query("device")
	list, err := h.Service.ScanWiFi(device)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *NetworkHandler) ConnectWiFi(c *gin.Context) {
	device := c.Param("device")
	var req core.ConnectWiFiRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := h.Service.ConnectWiFi(device, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
