//go:build !linux

package services

import "fmt"

func getDiskUsage(path string) (*DiskUsage, error) {
	return nil, fmt.Errorf("disk usage not supported on %s", path)
}
