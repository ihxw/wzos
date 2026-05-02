package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wzos/backend/core"
)

type AuthHandler struct {
	Service *core.AuthService
}

func NewAuthHandler(service *core.AuthService) *AuthHandler {
	return &AuthHandler{Service: service}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	token, err := h.Service.Login(req.Username, req.Password)
	if err != nil {
		log.Printf("login failed for user=%s: %v", req.Username, err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}
