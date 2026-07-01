USE tramites_vehiculares;

ALTER TABLE users ADD COLUMN chat_ai_auto_reply_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN chat_ai_inactivity_minutes INT DEFAULT 30;

ALTER TABLE chat_messages ADD COLUMN is_ai_generated TINYINT(1) DEFAULT 0;
