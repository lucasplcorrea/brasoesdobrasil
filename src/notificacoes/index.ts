import { http } from '../http/client.js';
import { log } from '../io.js';

export type ErrorNotification = {
  event: string;
  message: string;
  codigoIbge?: string;
  tipo?: string;
};

export function notificationSearchParams(notification: ErrorNotification) {
  return {
    projeto: 'brasoes-do-brasil',
    timestamp: new Date().toISOString(),
    ...notification,
  };
}

export async function notifyError(notification: ErrorNotification): Promise<void> {
  const url = process.env.BRASOES_ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    const response = await http.get(url, {
      searchParams: notificationSearchParams(notification),
      retry: { limit: 1 },
      throwHttpErrors: false,
    });
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw new Error(`HTTP ${response.statusCode}`);
    log('notificacao.enviada', { eventOriginal: notification.event });
  } catch (error: unknown) {
    log('notificacao.falha', {
      eventOriginal: notification.event,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
