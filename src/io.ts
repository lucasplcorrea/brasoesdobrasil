import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}
export async function writeTextAtomic(file: string, value: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, file);
}
export function log(event: string, fields: Record<string, unknown> = {}): void {
  process.stderr.write(
    `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields })}\n`,
  );
}
