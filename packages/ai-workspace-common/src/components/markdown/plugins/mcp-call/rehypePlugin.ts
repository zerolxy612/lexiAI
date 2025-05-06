import { SKIP, visit } from 'unist-util-visit';

// Define the tool use and tool result tags directly here to avoid circular dependencies
const TOOL_USE_TAG = 'tool_use';

// Regular expressions to match tool tags and their content
const TOOL_USE_REGEX = new RegExp(`<${TOOL_USE_TAG}[^>]*>([\\s\\S]*?)<\\/${TOOL_USE_TAG}>`, 'i');

// Regular expressions to extract data from tool tags with improved special character handling
const NAME_REGEX = /<name>([\s\S]*?)<\/name>/i;
const ARGUMENTS_REGEX = /<arguments>([\s\S]*?)<\/arguments>/i;
const RESULT_REGEX = /<result>([\s\S]*?)<\/result>/i;

/**
 * Utility function to safely extract content from regex matches
 * @param content The content to extract from
 * @param regex The regex pattern to use
 * @returns The extracted content or empty string
 */
const safeExtract = (content: string, regex: RegExp): string => {
  const match = regex.exec(content);
  if (match?.[1]) {
    return match[1].trim();
  }
  return '';
};

/**
 * Rehype plugin to process tool_use tags in markdown
 * 解析 <tool_use> 标签时，如果有 <result>，则同时提取 <arguments> 和 <result>，都放到同一个节点属性上；如果没有 <result>，只提取 <arguments>。
 */
function rehypePlugin() {
  return (tree: any) => {
    visit(tree, (node, index, parent) => {
      // Handle raw HTML nodes that might contain our tool tags
      if (node.type === 'raw') {
        // Check for tool_use tags
        if (node.value?.includes(`<${TOOL_USE_TAG}`)) {
          const match = TOOL_USE_REGEX.exec(node.value);
          if (match?.[1]) {
            const content = match[1];
            const attributes: Record<string, string> = {};

            // Extract tool name using safe extraction
            const name = safeExtract(content, NAME_REGEX);
            if (name) {
              attributes['data-tool-name'] = name;
            }

            // Extract arguments using safe extraction
            const args = safeExtract(content, ARGUMENTS_REGEX);
            if (args) {
              attributes['data-tool-arguments'] = args;
            }

            // Extract result using safe extraction
            const result = safeExtract(content, RESULT_REGEX);
            if (result) {
              attributes['data-tool-result'] = result;
            }

            // Create a new node with the extracted data
            const newNode = {
              type: 'element',
              tagName: 'pre',
              properties: attributes,
              children: [],
            };

            // Replace the original node
            parent.children.splice(index, 1, newNode);
            return [SKIP, index];
          }
        }
      }

      // Handle text nodes within paragraphs that might contain our tool tags
      if (node.type === 'element' && node.tagName === 'p' && node.children?.length > 0) {
        const paragraphText = node.children
          .map((child: any) => {
            if (child.type === 'text') return child.value;
            if (child.type === 'raw') return child.value;
            return '';
          })
          .join('');

        // Check if paragraph contains tool_use tags
        if (paragraphText.includes(`<${TOOL_USE_TAG}`)) {
          const useMatch = TOOL_USE_REGEX.exec(paragraphText);
          if (useMatch?.[1]) {
            const content = useMatch[1];
            const attributes: Record<string, string> = {};

            // Extract tool name using safe extraction
            const name = safeExtract(content, NAME_REGEX);
            if (name) {
              attributes['data-tool-name'] = name;
            }

            // Extract arguments using safe extraction
            const args = safeExtract(content, ARGUMENTS_REGEX);
            if (args) {
              attributes['data-tool-arguments'] = args;
            }

            // Extract result using safe extraction
            const result = safeExtract(content, RESULT_REGEX);
            if (result) {
              attributes['data-tool-result'] = result;
            }

            // Create a new node with the extracted data
            const newNode = {
              type: 'element',
              tagName: 'pre',
              properties: attributes,
              children: [],
            };

            // Replace the paragraph with the new node
            parent.children.splice(index, 1, newNode);
            return [SKIP, index];
          }
        }
      }
    });
  };
}

export default rehypePlugin;
