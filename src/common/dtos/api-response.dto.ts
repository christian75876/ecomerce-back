export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  resource: string;
  method: string;
  message: string | messageObject[];
  data: T;
  timeStamp: string;
}

interface messageObject {
  name: string;
  reason: string;
}
