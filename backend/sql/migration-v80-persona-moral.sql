-- Persona moral (empresa) + flotilla / subusuarios

ALTER TABLE contacts ADD COLUMN person_type VARCHAR(20) NOT NULL DEFAULT 'fisica' AFTER name;
ALTER TABLE contacts ADD COLUMN rfc VARCHAR(20) NULL AFTER person_type;
ALTER TABLE contacts ADD COLUMN razon_social VARCHAR(255) NULL AFTER rfc;
ALTER TABLE contacts ADD COLUMN fiscal_street VARCHAR(255) NULL;
ALTER TABLE contacts ADD COLUMN fiscal_ext_number VARCHAR(40) NULL;
ALTER TABLE contacts ADD COLUMN fiscal_int_number VARCHAR(40) NULL;
ALTER TABLE contacts ADD COLUMN fiscal_colony VARCHAR(120) NULL;
ALTER TABLE contacts ADD COLUMN fiscal_zip VARCHAR(10) NULL;
ALTER TABLE contacts ADD COLUMN fiscal_city VARCHAR(120) NULL;
ALTER TABLE contacts ADD COLUMN fiscal_country VARCHAR(80) NULL DEFAULT 'México';
ALTER TABLE contacts ADD COLUMN account_holder VARCHAR(255) NULL;
ALTER TABLE contacts ADD COLUMN job_title VARCHAR(120) NULL;
ALTER TABLE contacts ADD COLUMN empresa_user_id VARCHAR(36) NULL;

CREATE INDEX idx_contacts_person_type ON contacts (user_id, person_type);
CREATE INDEX idx_contacts_empresa_user ON contacts (empresa_user_id);
CREATE INDEX idx_contacts_rfc ON contacts (rfc);

ALTER TABLE contact_vehicles ADD COLUMN assigned_user_id VARCHAR(36) NULL AFTER user_id;
ALTER TABLE contact_vehicles ADD COLUMN created_by_user_id VARCHAR(36) NULL AFTER assigned_user_id;

CREATE INDEX idx_cv_assigned_user ON contact_vehicles (assigned_user_id);

ALTER TABLE contact_vehicle_documents ADD COLUMN uploaded_by_user_id VARCHAR(36) NULL AFTER user_id;

CREATE INDEX idx_cvd_uploaded_by ON contact_vehicle_documents (uploaded_by_user_id);
