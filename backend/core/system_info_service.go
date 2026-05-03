package core

import (
	"bufio"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type SystemInfoService struct{}

func NewSystemInfoService() *SystemInfoService {
	return &SystemInfoService{}
}

type SystemOverview struct {
	CPUUsage    float64 `json:"cpu_usage"`
	MemoryTotal uint64  `json:"memory_total"`
	MemoryUsed  uint64  `json:"memory_used"`
	MemoryUsage float64 `json:"memory_usage"`
	DiskTotal   uint64  `json:"disk_total"`
	DiskUsed    uint64  `json:"disk_used"`
	DiskUsage   float64 `json:"disk_usage"`
	OS          string  `json:"os"`
	Hostname    string  `json:"hostname"`
	Uptime      uint64  `json:"uptime"`

	// macOS-style extended fields
	OSVersion    string `json:"os_version"`
	Kernel       string `json:"kernel"`
	Architecture string `json:"architecture"`
	MachineModel string `json:"machine_model"`
	CPUBrand     string `json:"cpu_brand"`
	CPUCores     int    `json:"cpu_cores"`
	GPUInfo      string `json:"gpu_info"`
	SerialNumber string `json:"serial_number"`
}

func (s *SystemInfoService) GetOverview() (*SystemOverview, error) {
	cpuPercent, _ := cpu.Percent(time.Second, false)
	memInfo, _ := mem.VirtualMemory()
	diskInfo, _ := disk.Usage("/")
	hostInfo, _ := host.Info()

	var cpuUsage float64
	if len(cpuPercent) > 0 {
		cpuUsage = cpuPercent[0]
	}

	osName, osVersion := detectOS()
	kernel := detectKernel()
	arch := runtime.GOARCH
	model := detectMachineModel()
	cpuBrand := detectCPUBrand()
	cores := detectCPUCores()
	gpu := detectGPU()
	serial := detectSerial()

	up := hostInfo.Uptime
	if up == 0 {
		up = detectUptime()
	}

	diskTotal := diskInfo.Total
	diskUsed := diskInfo.Used
	diskUsage := diskInfo.UsedPercent
	if diskTotal == 0 {
		diskTotal = memInfo.Total
		diskUsed = memInfo.Used
		diskUsage = memInfo.UsedPercent
	}

	return &SystemOverview{
		CPUUsage:    cpuUsage,
		MemoryTotal: memInfo.Total,
		MemoryUsed:  memInfo.Used,
		MemoryUsage: memInfo.UsedPercent,
		DiskTotal:   diskTotal,
		DiskUsed:    diskUsed,
		DiskUsage:   diskUsage,
		OS:          osName,
		Hostname:    hostInfo.Hostname,
		Uptime:      up,

		OSVersion:    osVersion,
		Kernel:       kernel,
		Architecture: arch,
		MachineModel: model,
		CPUBrand:     cpuBrand,
		CPUCores:     cores,
		GPUInfo:      gpu,
		SerialNumber: serial,
	}, nil
}

func detectOS() (string, string) {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return runtime.GOOS, ""
	}
	name := ""
	version := ""
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			name = strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
		if strings.HasPrefix(line, "VERSION_ID=") {
			version = strings.Trim(strings.TrimPrefix(line, "VERSION_ID="), `"`)
		}
	}
	if name == "" {
		name = runtime.GOOS
	}
	return name, version
}

func detectKernel() string {
	out, err := exec.Command("uname", "-r").Output()
	if err != nil {
		return runtime.GOOS
	}
	return strings.TrimSpace(string(out))
}

func detectMachineModel() string {
	// Try DMI first
	data, err := os.ReadFile("/sys/devices/virtual/dmi/id/product_name")
	if err == nil {
		model := strings.TrimSpace(string(data))
		if model != "" && model != "System Product Name" && model != "To Be Filled By O.E.M." {
			vendor := ""
			if v, err := os.ReadFile("/sys/devices/virtual/dmi/id/sys_vendor"); err == nil {
				vendor = strings.TrimSpace(string(v))
			}
			if vendor != "" {
				return vendor + " " + model
			}
			return model
		}
	}

	// Try /proc/cpuinfo for model name
	f, err := os.Open("/proc/cpuinfo")
	if err == nil {
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "model name") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					return strings.TrimSpace(parts[1])
				}
			}
		}
	}

	// Virtual machine detection
	return detectVM()
}

func detectVM() string {
	out, err := exec.Command("systemd-detect-virt").Output()
	if err == nil {
		virt := strings.TrimSpace(string(out))
		if virt != "none" && virt != "" {
			return "Virtual Machine (" + virt + ")"
		}
	}
	// Fallback
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return "Docker Container"
	}
	return "Unknown Device"
}

func detectCPUBrand() string {
	out, err := exec.Command("sh", "-c", "cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2").Output()
	if err != nil {
		return runtime.GOARCH
	}
	brand := strings.TrimSpace(string(out))
	if brand == "" {
		return runtime.GOARCH
	}
	return brand
}

func detectCPUCores() int {
	out, err := exec.Command("nproc").Output()
	if err != nil {
		return runtime.NumCPU()
	}
	// Parse number from output
	s := strings.TrimSpace(string(out))
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	if n == 0 {
		return runtime.NumCPU()
	}
	return n
}

func detectGPU() string {
	// Try lspci for GPU
	out, err := exec.Command("sh", "-c", "lspci 2>/dev/null | grep -i 'vga\\|3d\\|display' | head -1 | cut -d: -f3").Output()
	if err == nil {
		gpu := strings.TrimSpace(string(out))
		if gpu != "" {
			return gpu
		}
	}
	return ""
}

func detectSerial() string {
	// Use machine-id as a serial number equivalent
	data, err := os.ReadFile("/etc/machine-id")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func detectUptime() uint64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	parts := strings.Fields(string(data))
	if len(parts) == 0 {
		return 0
	}
	var up float64
	for _, c := range parts[0] {
		if c >= '0' && c <= '9' {
			up = up*10 + float64(c-'0')
		} else {
			break
		}
	}
	return uint64(up)
}
