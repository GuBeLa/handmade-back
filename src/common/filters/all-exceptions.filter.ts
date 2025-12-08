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

    // Log the error
    this.logger.error(
      `❌ ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    // Build error response
    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof message === 'string'
          ? message
          : (message as any)?.message || 'Internal server error',
    };

    // Add error details in development
    if (process.env.NODE_ENV !== 'production') {
      if (exception instanceof Error) {
        errorResponse.error = exception.name;
        errorResponse.stack = exception.stack;
      }
      if (typeof message === 'object') {
        errorResponse.details = message;
      }
    }

    response.status(status).json(errorResponse);
  }
}

