package ws

import (
	"encoding/json"
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

type resizePayload struct {
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

type clientMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

func RegisterTerminalRoute(r *gin.Engine) {
	r.GET("/ws/terminal", HandleTerminalWebsocket)
}

func HandleTerminalWebsocket(c *gin.Context) {
	log.Println("[TERM] New WebSocket connection (JSON protocol v2)")
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
	if homeDir, err := os.UserHomeDir(); err == nil {
		cmd.Dir = homeDir
	}
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
				return
			}
			ws.WriteMessage(websocket.TextMessage, buf[:n])
		}
	}()

	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			break
		}

		var clientMsg clientMessage
		if json.Unmarshal(msg, &clientMsg) != nil || clientMsg.Type == "" {
			log.Printf("[TERM] RAW: %q", string(msg))
			ptmx.Write(msg)
			continue
		}

		switch clientMsg.Type {
		case "input":
			var input string
			if json.Unmarshal(clientMsg.Data, &input) == nil {
				ptmx.Write([]byte(input))
			}
		case "resize":
			var size resizePayload
			if json.Unmarshal(clientMsg.Data, &size) == nil {
				log.Printf("[TERM] RESIZE %dx%d", size.Cols, size.Rows)
				pty.Setsize(ptmx, &pty.Winsize{Rows: size.Rows, Cols: size.Cols})
			}
		default:
			log.Printf("[TERM] UNKNOWN type=%s data=%s", clientMsg.Type, string(clientMsg.Data))
		}
	}
}
