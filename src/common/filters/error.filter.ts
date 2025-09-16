import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../dtos/api-response.dto';

interface IExceptionReponseArray {
  message: string[];
  statusCode: number;
}

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();

    const apiExceptionResponse: ApiResponse<void> = {
      success: false,
      statusCode: 0,
      resource: request.url,
      method: request.method,
      message: '',
      data: null,
      timeStamp: new Date().toISOString(),
    };

    // If it's a BadRequestException (Client error), unpack the array of error message and organize then in a JSON
    if (
      exception instanceof BadRequestException &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse &&
      Array.isArray(exceptionResponse['message'])
    ) {
      const { statusCode, message } =
        exceptionResponse as IExceptionReponseArray;
      apiExceptionResponse.success = false;
      apiExceptionResponse.statusCode = (
        exceptionResponse as IExceptionReponseArray
      ).statusCode;
      apiExceptionResponse.message = message.map((msg: string) => {
        // Transform messages into a structured format
        const [name, ...reasonParts] = msg.split(' - ');
        return { name, reason: reasonParts.join(' - ') };
      });
    } else {
      // Default handling for other HttpExceptions
      apiExceptionResponse.success = false;
      apiExceptionResponse.statusCode = (
        exceptionResponse as IExceptionReponseArray
      ).statusCode;
      apiExceptionResponse.message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse['message'] || 'An unexpected error occurred';
    }

    response.status(status).json(apiExceptionResponse);
  }
}
