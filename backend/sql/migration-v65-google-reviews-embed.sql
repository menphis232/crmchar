-- Embed de widget de reseñas Google (alternativa / Famewall / Elfsight, etc.)
-- Alternativa cuando Places API no está disponible (p. ej. restricción por país).
ALTER TABLE gestores
  ADD COLUMN google_reviews_embed TEXT DEFAULT NULL;
