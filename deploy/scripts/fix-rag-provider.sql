-- Fix RAG provider configuration

-- First, check if hkgai-rag-item already exists
DO $$
DECLARE
  item_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM provider_items WHERE item_id = 'hkgai-rag-item') INTO item_exists;
  
  IF NOT item_exists THEN
    -- Insert RAG provider item if it doesn't exist
    INSERT INTO provider_items (provider_id, item_id, category, name, enabled, config, tier, "order")
    VALUES ('hkgai-global', 'hkgai-rag-item', 'llm', 'HKGAI RAG', true, 
            '{"modelId": "hkgai-rag", "contextLimit": 8000, "maxOutput": 4000, "capabilities": {}}', 
            't2', 5);
  ELSE
    -- Update RAG provider item if it exists but might have wrong configuration
    UPDATE provider_items 
    SET name = 'HKGAI RAG', 
        enabled = true, 
        config = '{"modelId": "hkgai-rag", "contextLimit": 8000, "maxOutput": 4000, "capabilities": {}}',
        tier = 't2',
        "order" = 5
    WHERE item_id = 'hkgai-rag-item';
  END IF;
END $$;

-- Make sure hkgai-rag model is defined in model_infos if your system uses that table
DO $$
DECLARE
  model_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM model_infos WHERE name = 'hkgai-rag') INTO model_exists;
  
  IF NOT model_exists THEN
    INSERT INTO model_infos (name, label, provider, tier, enabled, is_default, context_limit, max_output, capabilities)
    VALUES ('hkgai-rag', 'HKGAI RAG', 'hkgai', 't2', true, false, 8000, 4000, '{}');
  END IF;
END $$;

-- Update provider base URL for RAG model
UPDATE providers 
SET base_url = 'https://ragpipeline.hkgai.asia'
WHERE provider_key = 'hkgai';

-- Add comment to remember the configuration
COMMENT ON TABLE provider_items IS 'Provider items table contains model configurations. For HKGAI RAG model, use the OpenAI-compatible API at https://ragpipeline.hkgai.asia'; 