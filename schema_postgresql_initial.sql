-- Application Services Menagers
-- Schema PostgreSQL initial coherent avec les diagrammes UML

BEGIN;

-- 1) Types metier
CREATE TYPE user_role AS ENUM ('client', 'prestataire', 'admin');
CREATE TYPE demande_status AS ENUM ('ouverte', 'attribuee', 'annulee', 'expiree');
CREATE TYPE mission_status AS ENUM (
    'en_attente',
    'acceptee',
    'confirmee',
    'en_cours',
    'terminee',
    'annulee',
    'litige'
);
CREATE TYPE paiement_status AS ENUM ('en_attente', 'paye', 'echoue', 'rembourse');
CREATE TYPE paiement_method AS ENUM ('mobile_money', 'carte', 'virement', 'especes');

-- 2) Utilisateurs
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Specialisation Client (heritage UML)
CREATE TABLE clients (
    user_id BIGINT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_clients_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

-- Specialisation Prestataire (heritage UML)
CREATE TABLE prestataires (
    user_id BIGINT PRIMARY KEY,
    rating NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_prestataires_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE
);

-- 3) Services proposes par un prestataire
CREATE TABLE services (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prestataire_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_services_prestataire
        FOREIGN KEY (prestataire_id)
        REFERENCES prestataires (user_id)
        ON DELETE RESTRICT
);

-- 4) Demandes publiees par un client
CREATE TABLE demandes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id BIGINT NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    status demande_status NOT NULL DEFAULT 'ouverte',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_demandes_client
        FOREIGN KEY (client_id)
        REFERENCES clients (user_id)
        ON DELETE RESTRICT
);

-- 5) Mission = prise en charge d'une demande
-- Une mission reference 1 demande (et une demande produit au plus 1 mission)
CREATE TABLE missions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    demande_id BIGINT NOT NULL UNIQUE,
    client_id BIGINT NOT NULL,
    prestataire_id BIGINT NOT NULL,
    service_id BIGINT,
    mission_date TIMESTAMPTZ,
    status mission_status NOT NULL DEFAULT 'en_attente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_missions_demande
        FOREIGN KEY (demande_id)
        REFERENCES demandes (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_missions_client
        FOREIGN KEY (client_id)
        REFERENCES clients (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_missions_prestataire
        FOREIGN KEY (prestataire_id)
        REFERENCES prestataires (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_missions_service
        FOREIGN KEY (service_id)
        REFERENCES services (id)
        ON DELETE SET NULL
);

-- 6) Evaluation (Review)
-- Une mission peut recevoir une evaluation unique
CREATE TABLE reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mission_id BIGINT NOT NULL UNIQUE,
    client_id BIGINT NOT NULL,
    prestataire_id BIGINT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_reviews_mission
        FOREIGN KEY (mission_id)
        REFERENCES missions (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reviews_client
        FOREIGN KEY (client_id)
        REFERENCES clients (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_reviews_prestataire
        FOREIGN KEY (prestataire_id)
        REFERENCES prestataires (user_id)
        ON DELETE RESTRICT
);

-- 7) Paiement
-- Une mission peut avoir 0..1 paiement
CREATE TABLE paiements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mission_id BIGINT NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    status paiement_status NOT NULL DEFAULT 'en_attente',
    method paiement_method NOT NULL,
    external_txn_id VARCHAR(120),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_paiements_mission
        FOREIGN KEY (mission_id)
        REFERENCES missions (id)
        ON DELETE CASCADE
);

-- 8) Index utiles (filtres frequents)
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_prestataires_verified ON prestataires (verified);
CREATE INDEX idx_services_prestataire ON services (prestataire_id);
CREATE INDEX idx_demandes_client ON demandes (client_id);
CREATE INDEX idx_demandes_status ON demandes (status);
CREATE INDEX idx_missions_client ON missions (client_id);
CREATE INDEX idx_missions_prestataire ON missions (prestataire_id);
CREATE INDEX idx_missions_status ON missions (status);
CREATE INDEX idx_reviews_prestataire ON reviews (prestataire_id);
CREATE INDEX idx_paiements_status ON paiements (status);

COMMIT;
