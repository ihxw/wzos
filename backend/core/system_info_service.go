package core

import (
	"runtime"
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

	osInfo := hostInfo.OS
	if runtime.GOOS == "linux" {
		osInfo = detectLinuxDistro()
	}

	return &SystemOverview{
		CPUUsage:    cpuUsage,
		MemoryTotal: memInfo.Total,
		MemoryUsed:  memInfo.Used,
		MemoryUsage: memInfo.UsedPercent,
		DiskTotal:   diskInfo.Total,
		DiskUsed:    diskInfo.Used,
		DiskUsage:   diskInfo.UsedPercent,
		OS:          osInfo,
		Hostname:    hostInfo.Hostname,
		Uptime:      hostInfo.Uptime,
	}, nil
}

func detectLinuxDistro() string {
	// Simple detection - can be expanded
	return "Linux"
}
