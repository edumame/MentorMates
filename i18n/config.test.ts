/** @jest-environment node */
import { execFileSync } from 'node:child_process';
it.each(['0', '1', ''])('gates the Next plugin consistently with the rollout flag %s', flag => {
 const result = execFileSync(process.execPath, ['--input-type=module', '-e', `const {default: config} = await import('./next.config.mjs'); console.log(Object.hasOwn(config.env ?? {}, '_next_intl_trailing_slash'));`], { cwd: process.cwd(), env: { ...process.env, NEXT_PUBLIC_I18N_ENABLED: flag }, encoding: 'utf8' });
 expect(result.trim()).toBe(String(flag === '1'));
});
