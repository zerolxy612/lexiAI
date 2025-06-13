-- Provider: hkgai
-- Models: SearchEntry, MissingInfo, Timeline
-- HKGAI_BASE_URL: https://dify.hkgai.net/v1
-- API Keys:
-- HKGAI_SEARCHENTRY_API_KEY: app-mYHumURK2S010ZonuvzeX1Ad
-- HKGAI_MISSINGINFO_API_KEY: app-cWHko7usG7aP8ZsAnSeglYc3
-- HKGAI_TIMELINE_API_KEY: app-R9k11qz64Cd86NCsw2ojZVLC
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('hkgai/searchentry', 'HKGAI SearchEntry', 'hkgai', 't2', 't', 'f', 16384, 4096, '{}'),
    ('hkgai/missinginfo', 'HKGAI MissingInfo', 'hkgai', 't2', 't', 'f', 16384, 4096, '{}'),
    ('hkgai/timeline', 'HKGAI Timeline', 'hkgai', 't2', 't', 'f', 16384, 4096, '{}'); 