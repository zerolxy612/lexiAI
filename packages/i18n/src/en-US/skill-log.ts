const translations = {
  generateTitle: {
    title: 'Generate Title',
    description: 'Title generated: {{title}}, completed in {{duration}}ms',
  },
  generateTitleFailed: {
    title: 'Generate Title',
    description: 'Failed to generate title due to model capability, fallback to use query as title',
  },
  rewriteQuery: {
    title: 'Break Down Question',
    description: 'Sub queries: {{rewrittenQueries}}, completed in {{duration}}ms',
  },
  translateQuery: {
    title: 'Translate Query',
    description: 'Translated queries: {{translatedQueries}}, completed in {{duration}}ms',
  },
  webSearchCompleted: {
    title: 'Web Search Completed',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  librarySearchCompleted: {
    title: 'Library Search Completed',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  translateResults: {
    title: 'Translate Results',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  rerankResults: {
    title: 'Select Related Results',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  generateAnswer: {
    title: 'Generate Answer',
    description: 'Start to generate answer...',
  },
  extractUrls: {
    title: 'Extract URLs',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  crawlUrls: {
    title: 'Read URLs',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  analyzeQuery: {
    title: 'Analyze Query',
    description: 'Analyze query completed, completed in {{duration}}ms',
  },
  generatingCodeArtifact: {
    title: 'Generating Code Artifact',
    description: 'Code artifact generating, completed in {{duration}}ms',
  },
  codeArtifactGenerated: {
    title: 'Code Artifact Generated',
    description: 'Code artifact generated, completed in {{duration}}ms',
  },
  // Image Generation Translations
  'image.generating': {
    title: 'Generating Image',
    description: 'Generating image based on prompt: {{prompt}}',
  },
  'image.api.request': {
    title: 'API Request',
    description: 'Sending request to image API: {{url}}',
  },
  'image.api.error': {
    title: 'API Error',
    description: 'Image generation API error: {{status}} - {{error}}',
  },
  'image.stream.error': {
    title: 'Stream Error',
    description: 'Error reading response stream: {{error}}',
  },
  'image.stream.processing': {
    title: 'Processing Stream',
    description: 'Processing image generation for prompt: {{prompt}}',
  },
  'image.stream.progress': {
    title: 'Generation Progress',
    description: 'Image generation in progress for {{seconds}} seconds',
  },
  'image.url.found': {
    title: 'Image URL Found',
    description: 'Found image URL in response: {{url}}',
  },
  'image.genid.found': {
    title: 'Generation ID Found',
    description: 'Found generation ID: {{genId}}',
  },
  'image.timeout': {
    title: 'Generation Timeout',
    description: 'Image generation timed out after {{timeout}} seconds',
  },
  'image.url.found.alternative': {
    title: 'Alternative URL Found',
    description: 'Found alternative image URL: {{url}}',
  },
  'image.url.missing': {
    title: 'URL Missing',
    description: 'Could not extract image URL from response (length: {{responseLength}})',
  },
  'image.artifact.created': {
    title: 'Image Artifact Created',
    description: 'Created image artifact: {{title}}',
  },
  'image.node.creating': {
    title: 'Creating Image Node',
    description: 'Creating canvas node for image: {{entityId}}',
  },
  'image.node.created': {
    title: 'Image Node Created',
    description: 'Canvas node created for image: {{entityId}}',
  },
};

export default translations;
