ALTER TABLE users ADD COLUMN panel_assistant_enabled TINYINT(1) DEFAULT 1;
ALTER TABLE users ADD COLUMN panel_assistant_name VARCHAR(50) DEFAULT 'VEGA';
ALTER TABLE users ADD COLUMN panel_assistant_position VARCHAR(20) DEFAULT 'bottom-right';
ALTER TABLE users ADD COLUMN panel_assistant_bg_color VARCHAR(20) DEFAULT '#0f172a';
ALTER TABLE users ADD COLUMN panel_assistant_btn_color VARCHAR(20) DEFAULT '#4F46E5';
ALTER TABLE users ADD COLUMN panel_assistant_text_color VARCHAR(20) DEFAULT '#FFFFFF';
