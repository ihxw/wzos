package core

import (
	"fmt"
	"runtime"
	"strings"
)

type SystemServiceItem struct {
	Name        string `json:"name"`
	Active      bool   `json:"active"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
}

func ListSystemServices() ([]SystemServiceItem, error) {
	if runtime.GOOS != "linux" || !hasCmd("systemctl") {
		return []SystemServiceItem{}, nil
	}

	out, err := runCmd("systemctl", "list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend")
	if err != nil {
		return nil, err
	}

	var items []SystemServiceItem
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 4 {
			continue
		}
		name := strings.TrimSuffix(fields[0], ".service")
		active := fields[2] == "active"
		desc := strings.Join(fields[4:], " ")
		enabled := fields[1] != "masked" && fields[1] != "disabled"
		items = append(items, SystemServiceItem{
			Name:        name,
			Active:      active,
			Enabled:     enabled,
			Description: desc,
		})
		if len(items) >= 80 {
			break
		}
	}
	return items, nil
}

func SetSystemServiceEnabled(name string, enabled bool) error {
	if !hasCmd("systemctl") {
		return fmt.Errorf("需要 systemd")
	}
	action := "disable"
	if enabled {
		action = "enable"
	}
	_, err := runCmd("systemctl", action, name)
	return err
}

func SetSystemServiceActive(name string, active bool) error {
	if !hasCmd("systemctl") {
		return fmt.Errorf("需要 systemd")
	}
	action := "stop"
	if active {
		action = "start"
	}
	_, err := runCmd("systemctl", action, name)
	return err
}
