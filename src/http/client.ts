import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import got, { type OptionsOfJSONResponseBody } from 'got';
import { CookieJar } from 'tough-cookie';
import { paths, userAgent } from '../config.js';

const timeout = Number(process.env.BRASOES_HTTP_TIMEOUT_MS ?? 15_000);
export const cookieJar = new CookieJar();

export const http = got.extend({
  cookieJar,
  timeout: { request: timeout },
  hooks: {
    beforeRequest: [
      (options) => {
        options.headers['user-agent'] = userAgent();
      },
    ],
  },
  retry: {
    limit: 3,
    methods: ['GET'],
    statusCodes: [408, 413, 500, 502, 503, 504],
  },
  followRedirect: true,
  maxRedirects: 5,
});

export async function cachedJson<T>(
  url: string,
  options: OptionsOfJSONResponseBody = {},
): Promise<T> {
  const key = createHash('sha256')
    .update(`${url}\n${JSON.stringify(options.searchParams ?? {})}`)
    .digest('hex');
  const file = path.join(paths.cache, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    /* cache miss */
  }
  const body = await http.get(url, options).json<T>();
  await mkdir(paths.cache, { recursive: true });
  await writeFile(file, `${JSON.stringify(body)}\n`);
  return body;
}
