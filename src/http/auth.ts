import { http } from './client.js';
import { log } from '../io.js';

const META_API = 'https://meta.wikimedia.org/w/api.php';

type TokenResponse = { query?: { tokens?: { logintoken?: string } } };
type LoginResponse = { login?: { result?: string; reason?: string } };

export async function authenticateBotPassword(): Promise<void> {
  const username = process.env.WIKIMEDIA_BOT_USERNAME;
  const password = process.env.WIKIMEDIA_BOT_PASSWORD;
  if (!username || !password) {
    throw new Error('Defina WIKIMEDIA_BOT_USERNAME e WIKIMEDIA_BOT_PASSWORD no ambiente.');
  }
  const tokenResponse = await http
    .get(META_API, {
      searchParams: { action: 'query', meta: 'tokens', type: 'login', format: 'json' },
    })
    .json<TokenResponse>();
  const token = tokenResponse.query?.tokens?.logintoken;
  if (!token) throw new Error('A Wikimedia não retornou token de login.');
  const loginResponse = await http
    .post(META_API, {
      form: {
        action: 'login',
        format: 'json',
        lgname: username,
        lgpassword: password,
        lgtoken: token,
      },
    })
    .json<LoginResponse>();
  if (loginResponse.login?.result !== 'Success') {
    throw new Error(
      `Falha no login Wikimedia: ${loginResponse.login?.reason ?? loginResponse.login?.result ?? 'resposta desconhecida'}`,
    );
  }
  log('wikimedia.autenticado', { username });
}
