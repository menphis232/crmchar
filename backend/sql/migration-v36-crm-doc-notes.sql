USE tramites_vehiculares;

ALTER TABLE crm_documents
  ADD COLUMN notes TEXT NULL AFTER file_url,
  ADD COLUMN doc_kind VARCHAR(32) NOT NULL DEFAULT 'attachment' AFTER notes;
