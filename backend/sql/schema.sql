CREATE DATABASE IF NOT EXISTS tramites_vehiculares
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('gestor', 'concesionaria', 'cliente') NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gestores (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) UNIQUE NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  state VARCHAR(100) NOT NULL,
  banner_url TEXT,
  photo_url TEXT,
  rating DECIMAL(3,1) DEFAULT 0,
  review_count INT DEFAULT 0,
  tramites_count INT DEFAULT 0,
  experience_years INT DEFAULT 0,
  bio TEXT,
  whatsapp VARCHAR(50),
  schedule VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gestor_services (
  id VARCHAR(36) PRIMARY KEY,
  gestor_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  time_estimate VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (gestor_id) REFERENCES gestores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gestor_reviews (
  id VARCHAR(36) PRIMARY KEY,
  gestor_id VARCHAR(36) NOT NULL,
  author VARCHAR(255) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gestor_id) REFERENCES gestores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id VARCHAR(36) PRIMARY KEY,
  gestor_id VARCHAR(36) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  status ENUM('nuevo', 'en_proceso', 'completado') DEFAULT 'nuevo',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gestor_id) REFERENCES gestores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS autos (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INT NOT NULL,
  price DECIMAL(14,2) NOT NULL,
  mileage INT NOT NULL,
  transmission VARCHAR(50) DEFAULT 'Automático',
  location VARCHAR(255),
  description TEXT,
  image_url TEXT,
  images JSON,
  dealer_name VARCHAR(255),
  active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
