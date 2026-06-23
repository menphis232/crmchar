-- v43: Billetera de documentos del cliente (independiente de trámites)
CREATE TABLE IF NOT EXISTS client_wallet_documents (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'Otro',
  file_url TEXT NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wallet_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
