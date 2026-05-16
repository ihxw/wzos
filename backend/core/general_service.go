package core

import (
	"fmt"
	"os"
	"runtime"
	"sort"
	"strings"
	"time"
)

type GeneralCapabilities struct {
	CanSetHostname  bool   `json:"canSetHostname"`
	CanSetTimezone  bool   `json:"canSetTimezone"`
	CanSetNTP       bool   `json:"canSetNTP"`
	CanSetLocale    bool   `json:"canSetLocale"`
	CanManageWZOS   bool   `json:"canManageWzos"`
	Hint            string `json:"hint"`
}

type LocaleOption struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Active bool   `json:"active"`
}

type GeneralSettings struct {
	Hostname           string             `json:"hostname"`
	Timezone           string             `json:"timezone"`
	LocalTime          string             `json:"localTime"`
	NTPSync            bool               `json:"ntpSync"`
	Locale             string             `json:"locale"`
	Locales            []LocaleOption     `json:"locales"`
	WzosServiceEnabled bool               `json:"wzosServiceEnabled"`
	WzosServiceActive  bool               `json:"wzosServiceActive"`
	Timezones          []string           `json:"timezones"`
	Capabilities       GeneralCapabilities `json:"capabilities"`
}

type GeneralService struct{}

func NewGeneralService() *GeneralService {
	return &GeneralService{}
}

func (s *GeneralService) GetSettings() (GeneralSettings, error) {
	if runtime.GOOS != "linux" {
		return GeneralSettings{}, fmt.Errorf("通用设置仅支持 Linux")
	}

	host, _ := os.Hostname()
	settings := GeneralSettings{
		Hostname:  host,
		Timezone:  readTimezone(),
		LocalTime: time.Now().Format("2006-01-02 15:04:05 MST"),
		NTPSync:   readNTPSync(),
		Locale:    readLocale(),
		Locales:   listLocales(),
		Timezones: commonTimezones(),
		Capabilities: GeneralCapabilities{
			CanSetHostname: hasCmd("hostnamectl") || fileExists("/etc/hostname"),
			CanSetTimezone: hasCmd("timedatectl"),
			CanSetNTP:      hasCmd("timedatectl"),
			CanSetLocale:   hasCmd("localectl") || fileExists("/etc/locale.conf"),
			CanManageWZOS:  hasCmd("systemctl"),
		},
	}

	if settings.Capabilities.CanManageWZOS {
		settings.WzosServiceEnabled = systemdEnabled("wzos")
		settings.WzosServiceActive = systemdActive("wzos")
	}

	if settings.Capabilities.Hint == "" && !settings.Capabilities.CanSetTimezone {
		settings.Capabilities.Hint = "部分功能需要 timedatectl / hostnamectl，当前为只读展示。"
	}

	return settings, nil
}

func (s *GeneralService) SetHostname(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("主机名不能为空")
	}
	if len(name) > 253 {
		return fmt.Errorf("主机名过长")
	}

	if hasCmd("hostnamectl") {
		_, err := runCmd("hostnamectl", "set-hostname", name)
		return err
	}

	if err := os.WriteFile("/etc/hostname", []byte(name+"\n"), 0644); err != nil {
		return err
	}
	_, _ = runCmd("hostname", name)
	return nil
}

func (s *GeneralService) SetTimezone(tz string) error {
	tz = strings.TrimSpace(tz)
	if tz == "" {
		return fmt.Errorf("请选择时区")
	}
	if !hasCmd("timedatectl") {
		return fmt.Errorf("需要 timedatectl")
	}
	_, err := runCmd("timedatectl", "set-timezone", tz)
	return err
}

func (s *GeneralService) SetNTPSync(enabled bool) error {
	if !hasCmd("timedatectl") {
		return fmt.Errorf("需要 timedatectl")
	}
	val := "false"
	if enabled {
		val = "true"
	}
	_, err := runCmd("timedatectl", "set-ntp", val)
	return err
}

func (s *GeneralService) SetLocale(locale string) error {
	locale = strings.TrimSpace(locale)
	if locale == "" {
		return fmt.Errorf("请选择语言")
	}
	if hasCmd("localectl") {
		_, err := runCmd("localectl", "set-locale", "LANG="+locale)
		return err
	}
	content := "LANG=" + locale + "\nLC_ALL=" + locale + "\n"
	return os.WriteFile("/etc/locale.conf", []byte(content), 0644)
}

func (s *GeneralService) SetWZOSService(enabled bool) error {
	if !hasCmd("systemctl") {
		return fmt.Errorf("需要 systemd")
	}
	action := "disable"
	if enabled {
		action = "enable"
	}
	_, err := runCmd("systemctl", action, "wzos")
	return err
}

func readTimezone() string {
	if hasCmd("timedatectl") {
		if out, err := runCmd("timedatectl", "show", "-p", "Timezone", "--value"); err == nil {
			return strings.TrimSpace(string(out))
		}
	}
	if b, err := os.ReadFile("/etc/timezone"); err == nil {
		return strings.TrimSpace(string(b))
	}
	return "UTC"
}

func readNTPSync() bool {
	if !hasCmd("timedatectl") {
		return false
	}
	out, err := runCmd("timedatectl", "show", "-p", "NTPSynchronized", "--value")
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) == "yes"
}

func readLocale() string {
	if out, err := runCmd("localectl", "show-key", "LANG"); err == nil {
		line := strings.TrimSpace(string(out))
		if strings.HasPrefix(line, "LANG=") {
			return strings.TrimPrefix(line, "LANG=")
		}
	}
	if b, err := os.ReadFile("/etc/locale.conf"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "LANG=") {
				return strings.Trim(strings.TrimPrefix(line, "LANG="), "\"")
			}
		}
	}
	return "en_US.UTF-8"
}

func listLocales() []LocaleOption {
	current := readLocale()
	seen := map[string]bool{}
	var opts []LocaleOption

	add := func(code, label string) {
		if code == "" || seen[code] {
			return
		}
		seen[code] = true
		opts = append(opts, LocaleOption{
			Code:   code,
			Label:  label,
			Active: code == current,
		})
	}

	add("zh_CN.UTF-8", "简体中文（中国）")
	add("zh_TW.UTF-8", "繁体中文（台湾）")
	add("en_US.UTF-8", "English (US)")
	add("en_GB.UTF-8", "English (UK)")
	add("ja_JP.UTF-8", "日本語")

	if hasCmd("locale") {
		if out, err := runCmd("locale", "-a"); err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				code := strings.TrimSpace(line)
				if code == "" || !strings.Contains(code, ".") {
					continue
				}
				add(code, code)
			}
		}
	}

	sort.Slice(opts, func(i, j int) bool {
		if opts[i].Active != opts[j].Active {
			return opts[i].Active
		}
		return opts[i].Label < opts[j].Label
	})
	if len(opts) > 40 {
		opts = opts[:40]
	}
	return opts
}

func commonTimezones() []string {
	return []string{
		"Asia/Shanghai",
		"Asia/Hong_Kong",
		"Asia/Taipei",
		"Asia/Tokyo",
		"Asia/Seoul",
		"Asia/Singapore",
		"Europe/London",
		"Europe/Paris",
		"Europe/Berlin",
		"America/New_York",
		"America/Los_Angeles",
		"UTC",
	}
}

func systemdEnabled(unit string) bool {
	out, err := runCmd("systemctl", "is-enabled", unit)
	if err != nil {
		return false
	}
	state := strings.TrimSpace(string(out))
	return state == "enabled" || state == "enabled-runtime"
}

func systemdActive(unit string) bool {
	out, err := runCmd("systemctl", "is-active", unit)
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(out)) == "active"
}
