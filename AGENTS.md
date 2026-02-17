# AGENTS.md

Guidance for coding agents working in this repository.

## Debounce and Autosave

- Use the shared debounce hook: `@/lib/hooks/use-debounced-effect`.
- Do not duplicate raw debounce timers (`setTimeout` + cleanup) in feature components when the shared hook covers the need.
- Keep save semantics in the local component or feature (payload building, validation, API calls, status UI).
- Use debounce only for timing concerns.

### Standard Pattern

```tsx
useDebouncedEffect(
  () => {
    if (!canAutoSave) return;
    void handleAutoSave();
  },
  [formData, canAutoSave],
  2000
);
```

## Shared Hooks

- Shared hooks live in `lib/hooks/`.
- Reuse existing hooks before adding new one-off utilities.
