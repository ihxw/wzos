package repository

import (
	"github.com/wzos/backend/db"
	"github.com/wzos/backend/models"
)

func GetFavorites() ([]models.Favorite, error) {
	rows, err := db.DB.Query("SELECT id, name, path, icon FROM favorites")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var favorites []models.Favorite
	for rows.Next() {
		var f models.Favorite
		if err := rows.Scan(&f.ID, &f.Name, &f.Path, &f.Icon); err != nil {
			return nil, err
		}
		favorites = append(favorites, f)
	}
	return favorites, nil
}

func AddFavorite(f models.Favorite) error {
	_, err := db.DB.Exec("INSERT INTO favorites (name, path, icon) VALUES (?, ?, ?)", f.Name, f.Path, f.Icon)
	return err
}

func DeleteFavorite(id int64) error {
	_, err := db.DB.Exec("DELETE FROM favorites WHERE id = ?", id)
	return err
}
