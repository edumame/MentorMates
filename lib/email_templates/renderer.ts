import { EmailTemplateSettings, getEmailTemplateSettings } from './config';

export interface EmailTemplate {
  subject: string;
  html: string;
}

export interface TemplateVariables {
  [key: string]: any;
}

/**
 * Simple template renderer that supports Handlebars-like syntax
 * Supports: {{variable}}, {{#if condition}}, {{/if}}, {{#unless condition}}, {{/unless}}
 */
export class EmailTemplateRenderer {
  private settings: EmailTemplateSettings;

  constructor(customSettings?: Partial<EmailTemplateSettings>) {
    this.settings = customSettings 
      ? this.mergeSettings(getEmailTemplateSettings(), customSettings)
      : getEmailTemplateSettings();
  }

  private mergeSettings(
    defaultSettings: EmailTemplateSettings, 
    customSettings: Partial<EmailTemplateSettings>
  ): EmailTemplateSettings {
    return {
      ...defaultSettings,
      ...customSettings,
      from: { ...defaultSettings.from, ...customSettings.from },
      branding: { ...defaultSettings.branding, ...customSettings.branding },
      styling: { ...defaultSettings.styling, ...customSettings.styling },
      templates: { ...defaultSettings.templates, ...customSettings.templates },
    };
  }

  /**
   * Render an email template with the given variables
   */
  public renderTemplate(templateKey: string, variables: TemplateVariables): EmailTemplate {
    const templateConfig = this.settings.templates[templateKey];
    
    if (!templateConfig) {
      throw new Error(`Email template '${templateKey}' not found`);
    }

    if (!templateConfig.enabled) {
      throw new Error(`Email template '${templateKey}' is disabled`);
    }

    // Merge template variables with global settings
    const allVariables = {
      ...this.settings.branding,
      ...this.settings.styling,
      buttonStyle: this.settings.styling.buttonStyle,
      ...variables,
    };

    const subject = this.processTemplate(templateConfig.subject, allVariables);
    const html = this.processTemplate(templateConfig.template, allVariables);

    return { subject, html };
  }

  /**
   * Process template string with variable substitution and basic conditionals
   */
  private processTemplate(template: string, variables: TemplateVariables): string {
    let processed = template;

    // Process conditionals first
    processed = this.processConditionals(processed, variables);

    // Process variable substitutions
    processed = processed.replace(/\{\{([^}]+)\}\}/g, (match, variablePath) => {
      const value = this.getNestedValue(variables, variablePath.trim());
      return value !== undefined && value !== null ? String(value) : '';
    });

    return processed;
  }

  /**
   * Process conditional blocks: {{#if condition}} and {{#unless condition}}
   */
  private processConditionals(template: string, variables: TemplateVariables): string {
    let processed = template;

    // Process {{#if condition}}...{{/if}} blocks
    processed = processed.replace(
      /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        const value = this.getNestedValue(variables, condition.trim());
        return this.isTruthy(value) ? content : '';
      }
    );

    // Process {{#unless condition}}...{{/unless}} blocks
    processed = processed.replace(
      /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      (match, condition, content) => {
        const value = this.getNestedValue(variables, condition.trim());
        return !this.isTruthy(value) ? content : '';
      }
    );

    return processed;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Check if a value is truthy for template conditionals
   */
  private isTruthy(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.length > 0;
    if (typeof value === 'number') return value !== 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  }

  /**
   * Get available template keys
   */
  public getAvailableTemplates(): string[] {
    return Object.keys(this.settings.templates).filter(
      key => this.settings.templates[key].enabled
    );
  }

  /**
   * Check if a template exists and is enabled
   */
  public isTemplateAvailable(templateKey: string): boolean {
    const template = this.settings.templates[templateKey];
    return template && template.enabled;
  }

  /**
   * Get the configured 'from' address
   */
  public getFromAddress(): string {
    return `${this.settings.from.name} <${this.settings.from.email}>`;
  }

  /**
   * Update template settings at runtime
   */
  public updateSettings(customSettings: Partial<EmailTemplateSettings>): void {
    this.settings = this.mergeSettings(this.settings, customSettings);
  }
}

// Singleton instance for global use
let globalRenderer: EmailTemplateRenderer | null = null;

/**
 * Get or create the global email template renderer
 */
export function getEmailRenderer(customSettings?: Partial<EmailTemplateSettings>): EmailTemplateRenderer {
  if (!globalRenderer || customSettings) {
    globalRenderer = new EmailTemplateRenderer(customSettings);
  }
  return globalRenderer;
}

/**
 * Quick helper function to render a template
 */
export function renderEmailTemplate(
  templateKey: string, 
  variables: TemplateVariables,
  customSettings?: Partial<EmailTemplateSettings>
): EmailTemplate {
  const renderer = getEmailRenderer(customSettings);
  return renderer.renderTemplate(templateKey, variables);
}