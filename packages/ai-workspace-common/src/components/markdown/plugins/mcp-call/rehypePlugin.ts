import { SKIP, visit } from 'unist-util-visit';

// Define the tool use and tool result tags directly here to avoid circular dependencies
const TOOL_USE_TAG = 'tool_use';
const TOOL_RESULT_TAG = 'tool_use_result';

// Regular expressions to match tool tags and their content
const TOOL_USE_REGEX = new RegExp(`<${TOOL_USE_TAG}[^>]*>([\\s\\S]*?)<\\/${TOOL_USE_TAG}>`, 'i');
const TOOL_RESULT_REGEX = new RegExp(
  `<${TOOL_RESULT_TAG}[^>]*>([\\s\\S]*?)<\\/${TOOL_RESULT_TAG}>`,
  'i',
);

// Regular expressions to extract data from tool tags
const NAME_REGEX = /<name>(.*?)<\/name>/is;
const ARGUMENTS_REGEX = /<arguments>(.*?)<\/arguments>/is;
const RESULT_REGEX = /<result>(.*?)<\/result>/is;

/**
 * Rehype plugin to process tool_use and tool_use_result tags in markdown
 * This transforms the XML-style tags into React component props
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

            // Extract tool name
            const nameMatch = NAME_REGEX.exec(content);
            if (nameMatch?.[1]) {
              attributes['data-tool-name'] = nameMatch[1].trim();
            }

            // Extract arguments
            const argsMatch = ARGUMENTS_REGEX.exec(content);
            if (argsMatch?.[1]) {
              attributes['data-tool-arguments'] = argsMatch[1].trim();
            }

            // Set the tool type attribute
            attributes['data-tool-type'] = 'use';

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

        // Check for tool_use_result tags
        if (node.value?.includes(`<${TOOL_RESULT_TAG}`)) {
          const match = TOOL_RESULT_REGEX.exec(node.value);
          if (match?.[1]) {
            const content = match[1];
            const attributes: Record<string, string> = {};

            // Extract tool name
            const nameMatch = NAME_REGEX.exec(content);
            if (nameMatch?.[1]) {
              attributes['data-tool-name'] = nameMatch[1].trim();
            }

            // Extract result
            const resultMatch = RESULT_REGEX.exec(content);
            if (resultMatch?.[1]) {
              attributes['data-tool-result'] = resultMatch[1].trim();
            }

            // Set the tool type attribute
            attributes['data-tool-type'] = 'result';

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

        // Check if paragraph contains tool_use or tool_use_result tags
        if (
          paragraphText.includes(`<${TOOL_USE_TAG}`) ||
          paragraphText.includes(`<${TOOL_RESULT_TAG}`)
        ) {
          // Check for tool_use tags
          const useMatch = TOOL_USE_REGEX.exec(paragraphText);
          if (useMatch?.[1]) {
            const content = useMatch[1];
            const attributes: Record<string, string> = {};

            // Extract tool name
            const nameMatch = NAME_REGEX.exec(content);
            if (nameMatch?.[1]) {
              attributes['data-tool-name'] = nameMatch[1].trim();
            }

            // Extract arguments
            const argsMatch = ARGUMENTS_REGEX.exec(content);
            if (argsMatch?.[1]) {
              attributes['data-tool-arguments'] = argsMatch[1].trim();
            }

            // Set the tool type attribute
            attributes['data-tool-type'] = 'use';

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

          // Check for tool_use_result tags
          const resultMatch = TOOL_RESULT_REGEX.exec(paragraphText);
          if (resultMatch?.[1]) {
            const content = resultMatch[1];
            const attributes: Record<string, string> = {};

            // Extract tool name
            const nameMatch = NAME_REGEX.exec(content);
            if (nameMatch?.[1]) {
              attributes['data-tool-name'] = nameMatch[1].trim();
            }

            // Extract result
            const resultContentMatch = RESULT_REGEX.exec(content);
            if (resultContentMatch?.[1]) {
              attributes['data-tool-result'] = resultContentMatch[1].trim();
            }

            // Set the tool type attribute
            attributes['data-tool-type'] = 'result';

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
