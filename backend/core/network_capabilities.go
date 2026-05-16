package core

import "os"

type NetworkCapabilities struct {
	Backend    string `json:"backend"`
	CanToggle  bool   `json:"canToggle"`
	CanSetIPv4 bool   `json:"canSetIPv4"`
	CanWiFi    bool   `json:"canWiFi"`
	ReadOnly   bool   `json:"readOnly"`
	Hint       string `json:"hint"`
}

func detectNetworkCapabilities() NetworkCapabilities {
	if hasCmd("nmcli") {
		return NetworkCapabilities{
			Backend:    "NetworkManager",
			CanToggle:  true,
			CanSetIPv4: true,
			CanWiFi:    true,
			ReadOnly:   false,
			Hint:       "",
		}
	}

	cap := NetworkCapabilities{
		Backend:    "ip",
		CanToggle:  hasCmd("ip"),
		CanSetIPv4: hasCmd("ip"),
		CanWiFi:    hasCmd("nmcli") || hasCmd("iw"),
		ReadOnly:   false,
	}

	if fileExists("/etc/network/interfaces") && hasCmd("ifup") && hasCmd("ifdown") {
		cap.Backend = "ifupdown"
		cap.CanSetIPv4 = true
		cap.Hint = "使用 ip/ifupdown 管理网络（未安装 NetworkManager）。修改会写入 /etc/network/interfaces 并重启接口。"
	} else if cap.CanToggle {
		cap.Hint = "使用 ip 命令管理（未安装 NetworkManager）。部分更改可能在重启后失效。"
	} else {
		cap.ReadOnly = true
		cap.Hint = "当前系统仅支持查看网络状态。若要完整管理，请安装：apt install network-manager"
	}

	if !cap.CanWiFi {
		if cap.Hint != "" {
			cap.Hint += " Wi-Fi 需要 NetworkManager 或 iw。"
		}
	}

	return cap
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
