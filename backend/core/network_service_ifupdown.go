package core

import (
	"fmt"
	"net"
	"os"
	"strings"
)

func (s *NetworkServiceCore) setIPv4IP(device string, req SetIPv4Request) error {
	method := strings.ToLower(strings.TrimSpace(req.Method))
	if method == "auto" || method == "dhcp" || method == "" {
		return fmt.Errorf("DHCP 需要 ifupdown，请安装 network-manager 或确保 /etc/network/interfaces 可用")
	}

	if req.Address == "" {
		return fmt.Errorf("静态 IP 需要填写地址")
	}
	prefix := req.Prefix
	if prefix <= 0 {
		prefix = 24
	}

	_, _ = runCmd("ip", "addr", "flush", "dev", device)
	_, err := runCmd("ip", "addr", "add", fmt.Sprintf("%s/%d", req.Address, prefix), "dev", device)
	if err != nil {
		return err
	}
	_, _ = runCmd("ip", "link", "set", device, "up")

	if req.Gateway != "" {
		_, _ = runCmd("ip", "route", "replace", "default", "via", req.Gateway, "dev", device)
	}
	if len(req.DNS) > 0 {
		_ = writeResolvConf(req.DNS)
	}
	return nil
}

func (s *NetworkServiceCore) setIPv4Ifupdown(device string, req SetIPv4Request) error {
	method := strings.ToLower(strings.TrimSpace(req.Method))
	if err := updateInterfacesFile(device, req); err != nil {
		return err
	}

	_, _ = runCmd("ifdown", device)
	if out, err := runCmd("ifup", device); err != nil {
		msg := strings.TrimSpace(string(out))
		if msg != "" {
			return fmt.Errorf("ifup %s: %s", device, msg)
		}
		return fmt.Errorf("ifup %s: %w", device, err)
	}

	if method == "manual" || method == "static" {
		if req.Gateway != "" {
			_, _ = runCmd("ip", "route", "replace", "default", "via", req.Gateway, "dev", device)
		}
		if len(req.DNS) > 0 {
			_ = writeResolvConf(req.DNS)
		}
	}
	return nil
}

func updateInterfacesFile(device string, req SetIPv4Request) error {
	path := "/etc/network/interfaces"
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	method := strings.ToLower(strings.TrimSpace(req.Method))
	lines := strings.Split(string(content), "\n")
	var out []string
	skip := false

	for i := 0; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "iface "+device+" ") ||
			strings.HasPrefix(trimmed, "allow-hotplug "+device) ||
			strings.HasPrefix(trimmed, "auto "+device) {
			skip = true
			continue
		}
		if skip {
			if trimmed == "" || strings.HasPrefix(trimmed, "iface ") ||
				strings.HasPrefix(trimmed, "allow-hotplug ") || strings.HasPrefix(trimmed, "auto ") {
				skip = false
			} else {
				continue
			}
		}
		out = append(out, line)
	}

	for len(out) > 0 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}

	out = append(out, "", "allow-hotplug "+device)
	if method == "auto" || method == "dhcp" || method == "" {
		out = append(out, "iface "+device+" inet dhcp")
	} else {
		if req.Address == "" {
			return fmt.Errorf("静态 IP 需要填写地址")
		}
		mask := cidrToMask(fmt.Sprintf("%s/%d", req.Address, maxPrefix(req.Prefix)))
		out = append(out, "iface "+device+" inet static")
		out = append(out, "    address "+req.Address)
		out = append(out, "    netmask "+mask)
		if req.Gateway != "" {
			out = append(out, "    gateway "+req.Gateway)
		}
		for _, dns := range req.DNS {
			dns = strings.TrimSpace(dns)
			if dns != "" {
				out = append(out, "    dns-nameservers "+dns)
			}
		}
	}
	out = append(out, "")

	return os.WriteFile(path, []byte(strings.Join(out, "\n")), 0644)
}

func maxPrefix(p int) int {
	if p <= 0 {
		return 24
	}
	return p
}

func interfacesIPv4Method(device string) string {
	content, err := os.ReadFile("/etc/network/interfaces")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(content), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "iface "+device+" ") {
			if strings.Contains(trimmed, " dhcp") || strings.HasSuffix(trimmed, " dhcp") {
				return "auto"
			}
			if strings.Contains(trimmed, " static") {
				return "manual"
			}
		}
	}
	return ""
}

func readResolvConf() []string {
	b, err := os.ReadFile("/etc/resolv.conf")
	if err != nil {
		return nil
	}
	var dns []string
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "nameserver ") {
			ip := strings.TrimSpace(strings.TrimPrefix(line, "nameserver "))
			if net.ParseIP(ip) != nil {
				dns = append(dns, ip)
			}
		}
	}
	return dns
}

func writeResolvConf(servers []string) error {
	var b strings.Builder
	b.WriteString("# Updated by WZOS\n")
	for _, s := range servers {
		s = strings.TrimSpace(s)
		if s != "" {
			b.WriteString("nameserver " + s + "\n")
		}
	}
	return os.WriteFile("/etc/resolv.conf", []byte(b.String()), 0644)
}
