package core

import (
	"log"
	"os/user"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/wzos/backend/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	DB *gorm.DB
}

func NewAuthService(db *gorm.DB) *AuthService {
	return &AuthService{DB: db}
}

var systemAuthInit bool
var systemAuthAvailable bool

func initSystemAuth() {
	if systemAuthInit {
		return
	}
	systemAuthInit = true
	if ProbeSystemAuth() {
		systemAuthAvailable = true
		log.Println("系统认证 (PAM): 已就绪，将使用 Linux 系统账户密码验证")
	} else {
		log.Println("系统认证 (PAM): 不可用，仅限 SQLite 数据库认证")
	}
}

func (s *AuthService) Login(username, password string) (string, error) {
	// Try system authentication first (only for system users to avoid PAM faildelay)
	initSystemAuth()
	if systemAuthAvailable {
		if _, err := user.Lookup(username); err == nil {
			// User exists on the system, try PAM authentication
			if ok, err := SystemAuth(username, password); err != nil {
				log.Printf("系统认证异常 (%v)，回退到数据库", err)
			} else if ok {
				log.Printf("系统认证成功: %s", username)
				return s.issueTokenForUser(username)
			}
		}
	}

	// Fallback: SQLite database authentication
	var user models.User
	if err := s.DB.Where("username = ?", username).First(&user).Error; err != nil {
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", err
	}

	log.Printf("数据库认证成功: %s", username)
	return s.issueTokenForUser(username)
}

// issueTokenForUser creates a JWT token for the given username.
// If the user doesn't exist in the database, a new record is created automatically.
func (s *AuthService) issueTokenForUser(username string) (string, error) {
	var user models.User
	if err := s.DB.Where("username = ?", username).First(&user).Error; err != nil {
		// Auto-create user in DB for system accounts
		user = models.User{
			Username: username,
			Password: "", // System users don't need a stored password
		}
		if err := s.DB.Create(&user).Error; err != nil {
			return "", err
		}
		log.Printf("自动创建用户记录: %s", username)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})

	return token.SignedString([]byte(JWTSecret))
}

func (s *AuthService) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	return string(bytes), err
}
