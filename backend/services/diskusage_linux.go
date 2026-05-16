//go:build linux

package services

import "syscall"

func getDiskUsage(path string) (*DiskUsage, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return nil, err
	}
	return &DiskUsage{
		Total: stat.Blocks * uint64(stat.Bsize),
		Free:  stat.Bfree * uint64(stat.Bsize),
		Used:  (stat.Blocks - stat.Bfree) * uint64(stat.Bsize),
	}, nil
}
