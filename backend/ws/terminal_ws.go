package ws

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
		return true
	},
}

func RegisterTerminalRoute(r *gin.Engine) {
	r.GET("/ws/terminal", HandleTerminalWebsocket)
}

func HandleTerminalWebsocket(c *gin.Context) {
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to websocket: %v", err)
		return
	}
	defer ws.Close()

	shell := "bash"
	if runtime.GOOS == "windows" {
		shell = "cmd.exe"
	} else {
		if _, err := os.Stat("/bin/zsh"); err == nil {
			shell = "zsh"
		}
	}

	cmd := exec.Command(shell)

	ptmx, err := pty.Start(cmd)
	if err != nil {
		log.Printf("Failed to start pty: %v", err)
		return
	}
	defer ptmx.Close()

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
