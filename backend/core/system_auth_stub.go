//go:build !linux || !cgo

package core

// ProbeSystemAuth reports whether Linux PAM authentication is available.
func ProbeSystemAuth() bool {
	return false
}

// SystemAuth authenticates against the system account database (PAM on Linux).
func SystemAuth(_, _ string) (bool, error) {
	return false, nil
}
