-- Add HKGAI provider
INSERT INTO refly.providers (provider_id, provider_key, name, is_global, categories, api_key, base_url, enabled) 
VALUES (
  'hkgai-global', 
  'hkgai', 
  'HKGAI', 
  true, 
  '["llm"]'::jsonb, 
  'app-cWHko7usG7aP8ZsAnSeglYc3', 
  'https://dify.hkgai.net', 
  true
); 