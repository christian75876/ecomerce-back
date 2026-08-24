import { Controller, Get, Header } from '@nestjs/common';

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
  // Google reportaba para la raíz de este subdominio).
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  robots() {
    return 'User-agent: *\nDisallow: /\n';
  }
}
