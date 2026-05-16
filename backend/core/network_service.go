package core

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"strings"
)

type NetworkOverview struct {
	Connected      bool                `json:"connected"`
	InternetReach  bool                `json:"internetReach"`
	Hostname       string              `json:"hostname"`
	PrimaryDevice  string              `json:"primaryDevice"`
	DefaultGateway string              `json:"defaultGateway"`
	Services       []NetworkService    `json:"services"`
	Backend        string              `json:"backend"`
	Capabilities   NetworkCapabilities `json:"capabilities"`
}

type NetworkService struct {
	Device     string   `json:"device"`
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	Kind       string   `json:"kind"`
	State      string   `json:"state"`
	Connection string   `json:"connection"`
	MAC        string   `json:"mac"`
	IPv4       []string `json:"ipv4"`
	IPv6       []string `json:"ipv6"`
	Signal     int      `json:"signal,omitempty"`
}

type NetworkDetail struct {
	Device       string   `json:"device"`
	Connection   string   `json:"connection"`
	Name         string   `json:"name"`
	Type         string   `json:"type"`
	Kind         string   `json:"kind"`
	State        string   `json:"state"`
	IPv4Method   string   `json:"ipv4Method"`
	Addresses    []string `json:"addresses"`
	Gateway      string   `json:"gateway"`
	DNS          []string `json:"dns"`
	SubnetMask   string   `json:"subnetMask"`
	SearchDomain string   `json:"searchDomain"`
	MTU          int      `json:"mtu"`
	MAC          string   `json:"mac"`
}

type WiFiNetwork struct {
	SSID     string `json:"ssid"`
	Signal   int    `json:"signal"`
	Security string `json:"security"`
	InUse    bool   `json:"inUse"`
}

type SetIPv4Request struct {
	Method   string   `json:"method"`
	Address  string   `json:"address"`
	Prefix   int      `json:"prefix"`
	Gateway  string   `json:"gateway"`
	DNS      []string `json:"dns"`
}

type ConnectWiFiRequest struct {
	SSID     string `json:"ssid"`
	Password string `json:"password"`
}

type NetworkServiceCore struct{}

func NewNetworkService() *NetworkServiceCore {
	return &NetworkServiceCore{}
}

func (s *NetworkServiceCore) GetOverview() (NetworkOverview, error) {
	if runtime.GOOS != "linux" {
		return NetworkOverview{Backend: "none"}, fmt.Errorf("网络管理仅支持 Linux")
	}

	hostname, _ := os.Hostname()
	overview := NetworkOverview{
		Hostname: hostname,
		Backend:  "ip",
	}

	if hasCmd("nmcli") {
		overview.Backend = "NetworkManager"
		services, err := s.listNMDevices()
		if err == nil && len(services) > 0 {
			overview.Services = services
		}
	}

	if len(overview.Services) == 0 {
		services, err := s.listIPDevices()
		if err != nil {
			return overview, err
		}
		overview.Services = services
	}

	overview.DefaultGateway = defaultGateway()
	for i := range overview.Services {
		if overview.Services[i].State == "connected" || overview.Services[i].State == "connected (externally)" {
			overview.Connected = true
			if overview.PrimaryDevice == "" && overview.Services[i].Kind != "other" {
				overview.PrimaryDevice = overview.Services[i].Device
			}
		}
	}
	if overview.PrimaryDevice == "" && len(overview.Services) > 0 {
		overview.PrimaryDevice = overview.Services[0].Device
	}
	overview.InternetReach = overview.Connected && overview.DefaultGateway != ""
	overview.Capabilities = detectNetworkCapabilities()
	if overview.Backend == "ip" && overview.Capabilities.Backend != "ip" {
		overview.Backend = overview.Capabilities.Backend
	}

	sort.Slice(overview.Services, func(i, j int) bool {
		return serviceRank(overview.Services[i]) < serviceRank(overview.Services[j])
	})

	return overview, nil
}

func (s *NetworkServiceCore) GetDetail(device string) (NetworkDetail, error) {
	if runtime.GOOS != "linux" {
		return NetworkDetail{}, fmt.Errorf("网络管理仅支持 Linux")
	}
	device = strings.TrimSpace(device)
	if device == "" {
		return NetworkDetail{}, fmt.Errorf("缺少设备名")
	}

	if hasCmd("nmcli") {
		if detail, err := s.nmDeviceDetail(device); err == nil {
			return detail, nil
		}
	}
	return s.ipDeviceDetail(device)
}

func (s *NetworkServiceCore) SetDeviceEnabled(device string, enabled bool) error {
	if hasCmd("nmcli") {
		if enabled {
			_, err := runCmd("nmcli", "device", "connect", device)
			return err
		}
		_, err := runCmd("nmcli", "device", "disconnect", device)
		return err
	}
	if hasCmd("ip") {
		state := "down"
		if enabled {
			state = "up"
		}
		_, err := runCmd("ip", "link", "set", device, state)
		return err
	}
	return fmt.Errorf("无法管理网络接口")
}

func (s *NetworkServiceCore) SetIPv4(device string, req SetIPv4Request) error {
	if hasCmd("nmcli") {
		return s.setIPv4NMCLI(device, req)
	}
	if fileExists("/etc/network/interfaces") && hasCmd("ifup") && hasCmd("ifdown") {
		return s.setIPv4Ifupdown(device, req)
	}
	if hasCmd("ip") {
		return s.setIPv4IP(device, req)
	}
	return fmt.Errorf("无法配置 IPv4")
}

func (s *NetworkServiceCore) setIPv4NMCLI(device string, req SetIPv4Request) error {
	conn, err := s.activeConnection(device)
	if err != nil {
		return err
	}

	method := strings.ToLower(strings.TrimSpace(req.Method))
	switch method {
	case "auto", "dhcp", "":
		_, err = runCmd("nmcli", "connection", "modify", conn, "ipv4.method", "auto")
	case "manual", "static":
		if req.Address == "" {
			return fmt.Errorf("静态 IP 需要填写地址")
		}
		prefix := req.Prefix
		if prefix <= 0 {
			prefix = 24
		}
		addr := fmt.Sprintf("%s/%d", req.Address, prefix)
		args := []string{"connection", "modify", conn, "ipv4.method", "manual", "ipv4.addresses", addr}
		if req.Gateway != "" {
			args = append(args, "ipv4.gateway", req.Gateway)
		}
		if len(req.DNS) > 0 {
			args = append(args, "ipv4.dns", strings.Join(req.DNS, ","))
		}
		_, err = runCmd("nmcli", args...)
	default:
		return fmt.Errorf("不支持的配置方式: %s", req.Method)
	}
	if err != nil {
		return err
	}
	_, err = runCmd("nmcli", "connection", "up", conn)
	return err
}

func (s *NetworkServiceCore) ScanWiFi(device string) ([]WiFiNetwork, error) {
	if !hasCmd("nmcli") {
		return []WiFiNetwork{}, nil
	}
	if device == "" {
		device = s.firstWiFiDevice()
	}
	if device == "" {
		return nil, fmt.Errorf("未找到无线网卡")
	}

	_, _ = runCmd("nmcli", "device", "wifi", "rescan", "ifname", device)
	out, err := runCmd("nmcli", "-t", "-f", "ACTIVE,SSID,SIGNAL,SECURITY", "device", "wifi", "list", "ifname", device)
	if err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var list []WiFiNetwork
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, ":")
		if len(parts) < 4 {
			continue
		}
		ssid := parts[1]
		if ssid == "" || ssid == "--" || seen[ssid] {
			continue
		}
		seen[ssid] = true
		signal, _ := strconv.Atoi(parts[2])
		list = append(list, WiFiNetwork{
			SSID:     ssid,
			Signal:   signal,
			Security: parts[3],
			InUse:    parts[0] == "yes",
		})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].InUse != list[j].InUse {
			return list[i].InUse
		}
		return list[i].Signal > list[j].Signal
	})
	return list, nil
}

func (s *NetworkServiceCore) ConnectWiFi(device string, req ConnectWiFiRequest) error {
	if !hasCmd("nmcli") {
		return fmt.Errorf("Wi-Fi 需要安装 NetworkManager：apt install network-manager")
	}
	if device == "" {
		device = s.firstWiFiDevice()
	}
	ssid := strings.TrimSpace(req.SSID)
	if ssid == "" {
		return fmt.Errorf("请选择 Wi-Fi 网络")
	}
	args := []string{"device", "wifi", "connect", ssid, "ifname", device}
	if req.Password != "" {
		args = append(args, "password", req.Password)
	}
	_, err := runCmd("nmcli", args...)
	return err
}

func (s *NetworkServiceCore) listNMDevices() ([]NetworkService, error) {
	out, err := runCmd("nmcli", "-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status")
	if err != nil {
		return nil, err
	}

	var services []NetworkService
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, ":")
		if len(parts) < 4 {
			continue
		}
		dev, typ, state, conn := parts[0], parts[1], parts[2], parts[3]
		if dev == "lo" || typ == "loopback" {
			continue
		}
		if conn == "--" {
			conn = ""
		}
		svc := NetworkService{
			Device:     dev,
			Name:       friendlyName(dev, typ, conn),
			Type:       typ,
			Kind:       deviceKind(typ),
			State:      state,
			Connection: conn,
			MAC:        readMAC(dev),
		}
		svc.IPv4, svc.IPv6 = deviceIPs(dev)
		if typ == "wifi" {
			svc.Signal = wifiSignal(dev)
		}
		services = append(services, svc)
	}
	return services, nil
}

func (s *NetworkServiceCore) nmDeviceDetail(device string) (NetworkDetail, error) {
	out, err := runCmd("nmcli", "-t", "device", "show", device)
	if err != nil {
		return NetworkDetail{}, err
	}

	detail := NetworkDetail{Device: device, MTU: 1500}
	fields := parseNMKeyValues(string(out))
	detail.Type = fields["GENERAL.TYPE"]
	detail.State = fields["GENERAL.STATE"]
	detail.Connection = fields["GENERAL.CONNECTION"]
	if detail.Connection == "--" {
		detail.Connection = ""
	}
	detail.Name = friendlyName(device, detail.Type, detail.Connection)
	detail.Kind = deviceKind(detail.Type)
	detail.MAC = fields["GENERAL.HWADDR"]
	if detail.MAC == "" {
		detail.MAC = readMAC(device)
	}

	if v := fields["IP4.ADDRESS"]; v != "" {
		for _, a := range strings.Split(v, ",") {
			detail.Addresses = append(detail.Addresses, strings.TrimSpace(a))
		}
	}
	detail.Gateway = fields["IP4.GATEWAY"]
	if v := fields["IP4.DNS"]; v != "" {
		for _, d := range strings.Split(v, ",") {
			detail.DNS = append(detail.DNS, strings.TrimSpace(d))
		}
	}
	if v := fields["IP4.DOMAIN"]; v != "" {
		detail.SearchDomain = v
	}
	if mtu, err := strconv.Atoi(fields["GENERAL.MTU"]); err == nil && mtu > 0 {
		detail.MTU = mtu
	}

	method := "dhcp"
	conn := detail.Connection
	if conn == "" {
		conn, _ = s.activeConnection(device)
	}
	if conn != "" {
		connOut, err := runCmd("nmcli", "-t", "connection", "show", conn)
		if err == nil {
			cf := parseNMKeyValues(string(connOut))
			if m := cf["ipv4.method"]; m != "" {
				method = m
			}
		}
	}
	detail.IPv4Method = method
	if len(detail.Addresses) > 0 {
		detail.SubnetMask = cidrToMask(detail.Addresses[0])
	}
	return detail, nil
}

func (s *NetworkServiceCore) listIPDevices() ([]NetworkService, error) {
	out, err := runCmd("ip", "-j", "addr", "show")
	if err != nil {
		return nil, err
	}

	var entries []ipAddrEntry
	if err := json.Unmarshal(out, &entries); err != nil {
		return nil, err
	}

	var services []NetworkService
	for _, e := range entries {
		if e.IfName == "lo" {
			continue
		}
		state := "disconnected"
		if strings.Contains(strings.ToLower(e.OperState), "up") {
			state = "connected"
		}
		svc := NetworkService{
			Device: e.IfName,
			Name:   friendlyName(e.IfName, e.IfName, ""),
			Type:   e.IfName,
			Kind:   guessKind(e.IfName),
			State:  state,
			MAC:    e.Address,
		}
		for _, ai := range e.AddrInfo {
			if ai.Family == "inet" {
				svc.IPv4 = append(svc.IPv4, fmt.Sprintf("%s/%d", ai.Local, ai.Prefixlen))
			}
			if ai.Family == "inet6" && !strings.HasPrefix(ai.Local, "fe80:") {
				svc.IPv6 = append(svc.IPv6, fmt.Sprintf("%s/%d", ai.Local, ai.Prefixlen))
			}
		}
		services = append(services, svc)
	}
	return services, nil
}

func (s *NetworkServiceCore) ipDeviceDetail(device string) (NetworkDetail, error) {
	services, err := s.listIPDevices()
	if err != nil {
		return NetworkDetail{}, err
	}
	for _, svc := range services {
		if svc.Device != device {
			continue
		}
		detail := NetworkDetail{
			Device:     device,
			Name:       svc.Name,
			Type:       svc.Type,
			Kind:       svc.Kind,
			State:      svc.State,
			IPv4Method: "dhcp",
			Addresses:  append([]string{}, svc.IPv4...),
			MAC:        svc.MAC,
			MTU:        1500,
		}
		detail.Gateway = defaultGateway()
		detail.DNS = readResolvConf()
		if len(detail.Addresses) > 0 {
			detail.SubnetMask = cidrToMask(detail.Addresses[0])
		}
		if fileExists("/etc/network/interfaces") {
			if method := interfacesIPv4Method(device); method != "" {
				detail.IPv4Method = method
			}
		}
		return detail, nil
	}
	return NetworkDetail{}, fmt.Errorf("设备不存在: %s", device)
}

func (s *NetworkServiceCore) activeConnection(device string) (string, error) {
	out, err := runCmd("nmcli", "-t", "-f", "GENERAL.CONNECTION", "device", "show", device)
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "GENERAL.CONNECTION:") {
			conn := strings.TrimPrefix(line, "GENERAL.CONNECTION:")
			conn = strings.TrimSpace(conn)
			if conn != "" && conn != "--" {
				return conn, nil
			}
		}
	}
	return "", fmt.Errorf("设备 %s 没有活动连接", device)
}

func (s *NetworkServiceCore) firstWiFiDevice() string {
	out, err := runCmd("nmcli", "-t", "-f", "DEVICE,TYPE", "device")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(out), "\n") {
		parts := strings.Split(line, ":")
		if len(parts) >= 2 && parts[1] == "wifi" {
			return parts[0]
		}
	}
	return ""
}

type ipAddrEntry struct {
	IfName    string `json:"ifname"`
	OperState string `json:"operstate"`
	Address   string `json:"address"`
	AddrInfo  []struct {
		Family    string `json:"family"`
		Local     string `json:"local"`
		Prefixlen int    `json:"prefixlen"`
	} `json:"addr_info"`
}

func parseNMKeyValues(raw string) map[string]string {
	m := map[string]string{}
	for _, line := range strings.Split(raw, "\n") {
		idx := strings.Index(line, ":")
		if idx <= 0 {
			continue
		}
		key := line[:idx]
		val := line[idx+1:]
		if prev, ok := m[key]; ok && val != "" {
			m[key] = prev + "," + val
		} else {
			m[key] = val
		}
	}
	return m
}

func deviceIPs(device string) ([]string, []string) {
	var v4, v6 []string
	out, err := runCmd("ip", "-j", "addr", "show", device)
	if err != nil {
		return v4, v6
	}
	var entries []ipAddrEntry
	if json.Unmarshal(out, &entries) != nil || len(entries) == 0 {
		return v4, v6
	}
	for _, ai := range entries[0].AddrInfo {
		if ai.Family == "inet" {
			v4 = append(v4, fmt.Sprintf("%s/%d", ai.Local, ai.Prefixlen))
		}
		if ai.Family == "inet6" && !strings.HasPrefix(ai.Local, "fe80:") {
			v6 = append(v6, fmt.Sprintf("%s/%d", ai.Local, ai.Prefixlen))
		}
	}
	return v4, v6
}

func readMAC(device string) string {
	b, err := os.ReadFile("/sys/class/net/" + device + "/address")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func defaultGateway() string {
	out, err := runCmd("ip", "route", "show", "default")
	if err != nil {
		return ""
	}
	fields := strings.Fields(string(out))
	for i, f := range fields {
		if f == "via" && i+1 < len(fields) {
			return fields[i+1]
		}
	}
	return ""
}

func wifiSignal(device string) int {
	out, err := runCmd("nmcli", "-t", "-f", "ACTIVE,SIGNAL", "dev", "wifi", "list", "ifname", device)
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.HasPrefix(line, "yes:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				n, _ := strconv.Atoi(parts[1])
				return n
			}
		}
	}
	return 0
}

func friendlyName(device, typ, conn string) string {
	if conn != "" && conn != "--" {
		return conn
	}
	lower := strings.ToLower(device)
	switch {
	case typ == "wifi" || strings.Contains(lower, "wlan") || strings.Contains(lower, "wifi"):
		return "Wi-Fi"
	case typ == "ethernet" || strings.HasPrefix(lower, "eth") || strings.HasPrefix(lower, "en"):
		return "以太网"
	default:
		return device
	}
}

func deviceKind(typ string) string {
	switch typ {
	case "wifi":
		return "wifi"
	case "ethernet":
		return "ethernet"
	default:
		return "other"
	}
}

func guessKind(device string) string {
	lower := strings.ToLower(device)
	if strings.Contains(lower, "wlan") || strings.Contains(lower, "wifi") {
		return "wifi"
	}
	if strings.HasPrefix(lower, "eth") || strings.HasPrefix(lower, "en") {
		return "ethernet"
	}
	return "other"
}

func serviceRank(s NetworkService) int {
	switch s.Kind {
	case "wifi":
		return 0
	case "ethernet":
		return 1
	default:
		return 2
	}
}

func cidrToMask(addr string) string {
	host, ipNet, err := net.ParseCIDR(addr)
	if err != nil {
		if strings.Contains(addr, "/") {
			parts := strings.Split(addr, "/")
			if len(parts) == 2 {
				if p, e := strconv.Atoi(parts[1]); e == nil {
					m := net.CIDRMask(p, 32)
					return net.IP(m).String()
				}
			}
		}
		_ = host
		return ""
	}
	ones, _ := ipNet.Mask.Size()
	m := net.CIDRMask(ones, 32)
	return net.IP(m).String()
}

func hasCmd(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
