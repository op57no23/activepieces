import * as Sentry from '@sentry/node'
import { FastifyBaseLogger } from 'fastify'

let sentryInitialized = false

export const exceptionHandler = {
    initializeSentry: (sentryDsn: string | undefined) => {
        if (!sentryDsn) {
            return
        }
        sentryInitialized = true
        Sentry.init({
            dsn: sentryDsn,
            beforeSend: (event) => {
                // Errors from outbound HTTP calls are downstream failures (e.g. a
                // bad credential returning 401), not server faults. `AxiosError`
                // is already filtered, but pieces-common wraps it in `HttpError`
                // before it propagates, which bypassed this filter — so drop both.
                const type = event?.exception?.values?.[0]?.type
                if (type === 'AxiosError' || type === 'HttpError') {
                    return null
                }
                const value = event?.exception?.values?.[0]?.value
                if (value && ['EXECUTION_TIMEOUT', 'ENTITY_NOT_FOUND'].includes(value)) {
                    return null
                }
                return event
            },
        })
    },
    handle: (e: unknown, log: FastifyBaseLogger): void => {
        log.error({ err: e }, 'Unhandled exception')
        if (sentryInitialized) {
            Sentry.captureException(e)
        }
    },
}
