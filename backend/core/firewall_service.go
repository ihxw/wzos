package core

import (
	"bytes"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

type FirewallStatus struct {
	Enabled   bool   `json:"enabled"`
	Status    string `json:"status"`
	Backend   string `json:"backend"`
	Available bool   `json:"available"`
}

type FirewallService struct{}

func NewFirewallService() *FirewallService {
	return &FirewallService{}
}

func (s *FirewallService) GetStatus() FirewallStatus {
	if runtime.GOOS != "linux" {
		return FirewallStatus{
			Status:    "防火墙管理仅支持 Linux",
			Backend:   "none",
			Available: false,
		}
	}

	if out, err := runCmd("ufw", "status", "verbose"); err == nil {
		text := string(out)
		enabled := strings.Contains(strings.ToLower(text), "status: active")
		return FirewallStatus{
			Enabled:   enabled,
			Status:    strings.TrimSpace(text),
			Backend:   "ufw",
			Available: true,
		}
	}

	if out, err := runCmd("firewall-cmd", "--state"); err == nil {
		state := strings.TrimSpace(string(out))
		enabled := strings.EqualFold(state, "running")
		detail := state
		if full, err := runCmd("firewall-cmd", "--list-all"); err == nil {
			detail = strings.TrimSpace(string(full))
		}
		return FirewallStatus{
			Enabled:   enabled,
			Status:    detail,
			Backend:   "firewalld",
			Available: true,
		}
	}

	return FirewallStatus{
		Status:    "未检测到 ufw 或 firewalld，可安装其中之一后重试",
		Backend:   "none",
		Available: false,
	}
}

func (s *FirewallService) SetEnabled(enabled bool) (FirewallStatus, error) {
	status := s.GetStatus()
	if !status.Available {
		return status, fmt.Errorf("当前环境没有可管理的防火墙服务")
	}

	switch status.Backend {
	case "ufw":
		var args []string
		if enabled {
			args = []string{"--force", "enable"}
		} else {
			args = []string{"disable"}
		}
		if _, err := runCmd("ufw", args...); err != nil {
			return s.GetStatus(), err
		}
	case "firewalld":
		action := "stop"
		if enabled {
			action = "start"
		}
		if _, err := runCmd("systemctl", action, "firewalld"); err != nil {
			return s.GetStatus(), err
		}
	default:
		return status, fmt.Errorf("不支持的防火墙后端")
	}

	return s.GetStatus(), nil
}

func runCmd(name string, args ...string) ([]byte, error) {
	cmd := exec.Command(name, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return nil, fmt.Errorf("%s: %s", name, msg)
	}
	return out, nil
}
