// Utilities for determining contract generation commands

/**
 * Проверяет, является ли текст командой генерации контракта
 * @param text - Текст для проверки
 * @returns true, если текст содержит команду генерации
 */
export function isGenerationCommand(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  
  // Exact commands
  const exactCommands = [
    'create contract',
    'create smart contract',
    'generate contract',
    'generate smart contract',
    'build contract',
    'build smart contract',
    'create a contract',
    'create a smart contract',
    'generate a contract',
    'generate a smart contract',
    'build a contract',
    'build a smart contract',
  ];
  
  // Check exact commands
  for (const command of exactCommands) {
    if (lowerText.includes(command)) {
      return true;
    }
  }
  
  // Check word combinations
  const hasCreate = lowerText.includes('create');
  const hasGenerate = lowerText.includes('generate');
  const hasBuild = lowerText.includes('build');
  const hasContract = lowerText.includes('contract');
  const hasSmart = lowerText.includes('smart');
  
  // Combinations: create/generate/build + contract
  if ((hasCreate || hasGenerate || hasBuild) && hasContract) {
    return true;
  }
  
  // Combinations: create/generate/build + smart + contract
  if ((hasCreate || hasGenerate || hasBuild) && hasSmart && hasContract) {
    return true;
  }
  
  return false;
}

/**
 * Извлекает описание контракта из команды генерации
 * @param text - Текст команды
 * @returns Описание контракта или исходный текст
 */
export function extractContractDescription(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Remove generation commands from beginning of text
  const commands = [
    'create contract',
    'create smart contract',
    'create a contract',
    'create a smart contract',
    'generate contract',
    'generate smart contract',
    'generate a contract',
    'generate a smart contract',
    'build contract',
    'build smart contract',
    'build a contract',
    'build a smart contract',
  ];
  
  let cleanedText = text;
  
  for (const command of commands) {
    if (lowerText.startsWith(command)) {
      cleanedText = text.substring(command.length).trim();
      break;
    }
  }
  
  // If text starts with "for", "that", "which" - remove these words
  const prefixes = ['for', 'that', 'which', 'to'];
  for (const prefix of prefixes) {
    if (cleanedText.toLowerCase().startsWith(prefix + ' ')) {
      cleanedText = cleanedText.substring(prefix.length + 1).trim();
    }
  }
  
  return cleanedText || text;
}

/**
 * Проверяет, является ли текст командой аудита
 * @param text - Текст для проверки
 * @returns true, если текст содержит команду аудита
 */
export function isAuditCommand(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  
  const auditCommands = [
    'audit',
    'audit contract',
    'audit code',
    'check contract',
    'check code',
    'review contract',
    'review code',
    'analyze contract',
    'analyze code',
    'security audit',
    'code audit',
  ];
  
  return auditCommands.some(command => lowerText.includes(command));
}

/**
 * Проверяет, является ли текст командой сборки
 * @param text - Текст для проверки
 * @returns true, если текст содержит команду сборки
 */
export function isBuildCommand(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  
  const buildCommands = [
    'build',
    'build contract',
    'compile',
    'compile contract',
    'make',
    'make contract',
  ];
  
  return buildCommands.some(command => lowerText.includes(command));
}

/**
 * Проверяет, является ли текст командой деплоя
 * @param text - Текст для проверки
 * @returns true, если текст содержит команду деплоя
 */
export function isDeployCommand(text: string): boolean {
  const lowerText = text.toLowerCase().trim();
  
  const deployCommands = [
    'deploy',
    'deploy contract',
    'publish',
    'publish contract',
    'release',
    'release contract',
    'go live',
    'launch',
    'launch contract',
  ];
  
  return deployCommands.some(command => lowerText.includes(command));
}

/**
 * Определяет тип команды
 * @param text - Текст для анализа
 * @returns Тип команды или null
 */
export function getCommandType(text: string): 'generate' | 'audit' | 'build' | 'deploy' | null {
  if (isGenerationCommand(text)) return 'generate';
  if (isAuditCommand(text)) return 'audit';
  if (isBuildCommand(text)) return 'build';
  if (isDeployCommand(text)) return 'deploy';
  return null;
}
