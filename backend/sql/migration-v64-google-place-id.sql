-- Place ID de Google Maps + caché de reseñas sincronizadas
ALTER TABLE gestores
  ADD COLUMN google_place_id VARCHAR(128) DEFAULT NULL,
  ADD COLUMN google_rating DECIMAL(3,1) DEFAULT NULL,
  ADD COLUMN google_review_count INT DEFAULT NULL,
  ADD COLUMN google_reviews_json JSON DEFAULT NULL,
  ADD COLUMN google_reviews_synced_at DATETIME DEFAULT NULL;

-- TVM (ficha principal): Place ID aportado por el usuario
UPDATE gestores
SET google_place_id = 'ChIJsbBkGrH_0YUR0L_ilErdMKU'
WHERE google_place_id IS NULL
  AND (
    name LIKE '%Trámites Vehiculares%'
    OR name LIKE '%Tramites Vehiculares%'
    OR slug LIKE '%tramites%'
  );
