import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../dtos/api-response.dto';
import { Request, Response } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const statusCode = response.statusCode;
    return next.handle().pipe(
      map<unknown, ApiResponse<any>>((data) => ({
        success: statusCode >= 200 && statusCode < 400,
        statusCode,
        resource: request.url,
        method: request.method,
        message: this.getMessageForStatusCode(statusCode),
        data,
        timeStamp: new Date().toISOString(),
      })),
    );
  }

  private getMessageForStatusCode(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return 'Request was successful';
      case 201:
        return 'Resource created successfully';
      case 202:
        return 'Accepted';
      case 203:
        return 'Non-Authoritative Information';
      case 204:
        return 'No Content';
      default:
        return 'Success';
    }
  }
}
