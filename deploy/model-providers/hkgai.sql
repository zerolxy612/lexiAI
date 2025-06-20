-- Provider: hkgai
-- Default model: hkgai-missinginfo
-- HKGAI_BASE_URL: https://dify.hkgai.net
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('hkgai-searchentry', 'HKGAI Search Entry', 'hkgai', 't2', 't', 'f', 8000, 4000, '{}'),
    ('hkgai-missinginfo', 'HKGAI Missing Info', 'hkgai', 't2', 't', 't', 8000, 4000, '{}'),
    ('hkgai-timeline', 'HKGAI Timeline', 'hkgai', 't2', 't', 'f', 8000, 4000, '{}'),
    ('hkgai-general', 'HKGAI General', 'hkgai', 't2', 't', 'f', 8000, 4000, '{}'),
    ('hkgai-rag', 'HKGAI RAG', 'hkgai', 't2', 't', 'f', 8000, 4000, '{}'); 