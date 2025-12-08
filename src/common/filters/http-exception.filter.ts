import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
        ? exception.message
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof message === 'string'
          ? message
          : (message as any)?.message || 'Internal server error',
      ...(typeof message === 'object' && (message as any)?.error
        ? { error: (message as any).error }
        : {}),
    };

    // Log the error
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    // In production, don't expose stack traces
    if (process.env.NODE_ENV === 'production') {
      // Only log full error details, don't send to client
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        errorResponse.message = 'Internal server error';
      }
    } else {
      // In development, include more details
      if (exception instanceof Error) {
        (errorResponse as any).stack = exception.stack;
      }
    }

    response.status(status).json(errorResponse);
  }
}

