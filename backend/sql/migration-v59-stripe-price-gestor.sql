-- Price ID de suscripción separado para consultores (gestores)
ALTER TABLE users ADD COLUMN stripe_price_id_gestor VARCHAR(255) NULL AFTER stripe_price_id;
