import { defaultRules } from "@/lib/config/constants";
import type { Rule } from "@/lib/types";

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeRules(rules: Rule[]): Rule[] {
  return rules.map((rule) => ({
    title: normalizeText(rule.title),
    items: rule.items.map((item) => normalizeText(item)).filter(Boolean),
  }));
}

function isSameRulesTemplate(a: Rule[], b: Rule[]): boolean {
  if (a.length !== b.length) return false;

  const left = normalizeRules(a);
  const right = normalizeRules(b);

  return left.every((rule, idx) => {
    const target = right[idx];
    if (!target) return false;
    if (rule.title !== target.title) return false;
    if (rule.items.length !== target.items.length) return false;
    return rule.items.every((item, itemIdx) => item === target.items[itemIdx]);
  });
}

/**
 * Hide the legacy hard-coded rules template from public display.
 * Organizers can still set custom rules explicitly.
 */
export function getDisplayRules(rules: Rule[] | null | undefined): Rule[] {
  if (!Array.isArray(rules) || rules.length === 0) return [];
  if (isSameRulesTemplate(rules, defaultRules)) return [];
  return rules;
}

