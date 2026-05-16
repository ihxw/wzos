package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/core"
)

type ServicesHandler struct{}

func NewServicesHandler() *ServicesHandler {
	return &ServicesHandler{}
}

func (h *ServicesHandler) List(c *gin.Context) {
	items, err := core.ListSystemServices()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, items)
}

func (h *ServicesHandler) SetEnabled(c *gin.Context) {
	var req struct {
		Name    string `json:"name"`
		Enabled bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := core.SetSystemServiceEnabled(req.Name, req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *ServicesHandler) SetActive(c *gin.Context) {
	var req struct {
		Name   string `json:"name"`
		Active bool   `json:"active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := core.SetSystemServiceActive(req.Name, req.Active); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
