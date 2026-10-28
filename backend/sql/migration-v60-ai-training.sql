-- Conocimiento que el gestor le enseña a su IA (chatbot público y respuestas en chats de trámite)
ALTER TABLE users ADD COLUMN ai_training MEDIUMTEXT NULL AFTER panel_assistant_prompt;
