-- Insert HKGAI provider items
INSERT INTO refly.provider_items (provider_id, item_id, category, name, enabled, config, tier, "order")
VALUES 
    ('hkgai-global', 'hkgai-searchentry-item', 'llm', 'HKGAI Search Entry', true, '{"modelId": "hkgai-searchentry", "contextLimit": 8000, "maxOutput": 4000, "capabilities": {}}', 't2', 1),
    ('hkgai-global', 'hkgai-missinginfo-item', 'llm', 'HKGAI Missing Info', true, '{"modelId": "hkgai-missinginfo", "contextLimit": 8000, "maxOutput": 4000, "capabilities": {}}', 't2', 2),
    ('hkgai-global', 'hkgai-timeline-item', 'llm', 'HKGAI Timeline', true, '{"modelId": "hkgai-timeline", "contextLimit": 8000, "maxOutput": 4000, "capabilities": {}}', 't2', 3)
ON CONFLICT (item_id) DO UPDATE SET
    name = EXCLUDED.name,
    enabled = EXCLUDED.enabled,
    config = EXCLUDED.config,
    tier = EXCLUDED.tier,
    "order" = EXCLUDED."order"; 