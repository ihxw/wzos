package repository

import (
	"github.com/wzos/backend/db"
	"github.com/wzos/backend/models"
)

func GetFavorites() ([]models.Favorite, error) {
	var favorites []models.Favorite
	err := db.DB.Find(&favorites).Error
	return favorites, err
}

func AddFavorite(f models.Favorite) error {
	return db.DB.Create(&f).Error
}

func DeleteFavorite(id uint) error {
	return db.DB.Delete(&models.Favorite{}, id).Error
}
