import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class AppController {
  @Get()
  root() {
    return { name: 'Merku API', status: 'ok' };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // api.merku.co es una API, no una página — le decimos a los crawlers que
  // no rastreen/indexen nada aquí (evita el falso "No encontrada (404)" que
  // Google reportaba para la raíz de este subdominio). @Res() bypasea el
  // interceptor global que envuelve todo en {success, data, ...} — un
  // robots.txt de verdad tiene que ser texto plano, no JSON.
  @Get('robots.txt')
  robots(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.send('User-agent: *\nDisallow: /\n');
  }
}
