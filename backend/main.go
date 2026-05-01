package main

import (
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

func main() {
	r := gin.Default()

	// CORS setup if needed
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Next()
	})

	r.GET("/api/ws/terminal", handleTerminalWebsocket)
	setupFileRoutes(r)

	log.Println("Backend server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to run server: %v", err)
	}
}

func handleTerminalWebsocket(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to websocket: %v", err)
		return
	}
	defer ws.Close()

	// Determine the shell to use
	shell := "bash"
	if runtime.GOOS == "windows" {
		shell = "cmd.exe" // Use cmd or powershell on windows for testing
	} else {
		// check if zsh exists, else bash
		if _, err := os.Stat("/bin/zsh"); err == nil {
			shell = "zsh"
		}
	}

	cmd := exec.Command(shell)
	
	// Start the command with a pty
	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("Failed to start pty: %v", err)
		return
	}
	defer ptmx.Close()

	// Read from PTY and write to Websocket
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				log.Printf("Error reading from pty: %v", err)
				return
			}
			err = ws.WriteMessage(websocket.TextMessage, buf[:n])
			if err != nil {
				log.Printf("Error writing to websocket: %v", err)
				return
			}
		}
	}()

	// Read from Websocket and write to PTY
	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			log.Printf("Error reading from websocket: %v", err)
			break
		}
		_, err = ptmx.Write(msg)
		if err != nil {
			log.Printf("Error writing to pty: %v", err)
			break
		}
	}
}
