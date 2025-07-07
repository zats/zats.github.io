/**
 * Simple language detection based on common patterns
 * @param {string} code - The code to analyze
 * @returns {string} - Detected language or 'text'
 */
export function detectCodeLanguage(code) {
  const trimmedCode = code.trim();
  
  // Early return for empty code
  if (!trimmedCode) return 'text';
  
  // JavaScript/TypeScript patterns
  if (/^(import\s|export\s|const\s|let\s|var\s|function\s|class\s|\(\)\s*=>|async\s|await\s)/m.test(trimmedCode) ||
      /console\.(log|error|warn|info)/.test(trimmedCode) ||
      /require\(['"]/.test(trimmedCode)) {
    if (/interface\s|type\s\w+\s*=/.test(trimmedCode)) {
      return 'typescript';
    }
    return 'javascript';
  }
  
  // Python patterns
  if (/^(def\s|class\s|import\s|from\s.*import)/m.test(trimmedCode) ||
      /print\(/.test(trimmedCode)) {
    return 'python';
  }
  
  // HTML patterns
  if (/<(!DOCTYPE|html|head|body|div|span|p|a|img|script|style|link|meta)/i.test(trimmedCode)) {
    return 'html';
  }
  
  // CSS patterns
  if (/^\s*[\w-]+\s*\{[\s\S]*\}/.test(trimmedCode) ||
      /^\s*\.([\w-]+)\s*\{/.test(trimmedCode) ||
      /^\s*#([\w-]+)\s*\{/.test(trimmedCode)) {
    return 'css';
  }
  
  // JSON patterns
  if (/^\s*[\{\[][\s\S]*[\}\]]\s*$/.test(trimmedCode)) {
    try {
      JSON.parse(trimmedCode);
      return 'json';
    } catch (e) {
      // Not valid JSON, continue checking
    }
  }
  
  // Shell/Bash patterns
  if (/^#!/.test(trimmedCode) ||
      /^(npm|yarn|git|cd|ls|mkdir|rm|cp|mv)\s/.test(trimmedCode) ||
      /^\$\s/.test(trimmedCode)) {
    return 'bash';
  }
  
  // Swift patterns
  if (/^(import\s+\w+|class\s|struct\s|func\s|var\s|let\s)/m.test(trimmedCode) ||
      /NSString|UIView|@objc/.test(trimmedCode)) {
    return 'swift';
  }
  
  // Objective-C patterns
  if (/@interface|@implementation|@property|#import|NSLog/.test(trimmedCode)) {
    return 'objc';
  }
  
  // Default fallback
  return 'text';
}