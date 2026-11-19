-- v69: multi-banner panel cliente con audiencia (usuarios / estados / compró servicio)
-- Los banners viven en site_settings.page_key = 'panel-cliente' como JSON promoBanners[].
-- Esta migración solo documenta el contrato; el código migra el banner legacy al array al guardar/leer.

USE tramites_vehiculares;

-- No-op estructural: se mantiene site_settings.settings (JSON).
SELECT 1;
