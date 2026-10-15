import { Test, TestingModule } from '@nestjs/testing';
import { MessageEvent } from '@nestjs/common';
import { NotificationsService, NewOrderPayload } from './notifications.service';
import { CallMeBotService } from './callmebot.service';

describe('NotificationsService — aislamiento de notificaciones en tiempo real', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: CallMeBotService, useValue: { send: jest.fn() } },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  function listenAs(userId: number, role: string) {
    const received: MessageEvent[] = [];
    const sub = service.subscribe(userId, role).subscribe((event) => received.push(event));
    return { received, unsubscribe: () => sub.unsubscribe() };
  }

  it('notifyNewOrder solo llega a admins y a los dueños de las tiendas del pedido', async () => {
    const adminListener = listenAs(1, 'admin');
    const ownerListener = listenAs(2, 'seller'); // dueño de la tienda del pedido
    const otherSellerListener = listenAs(3, 'seller'); // tienda ajena al pedido

    const order = { id: 'order-1', total: 1000, deliveryMethod: 'DELIVERY', items: [{}] } as any;
    const customer = { firstName: 'Ana', lastName: 'Pérez' } as any;
    const stores = [{ id: 'store-1', userId: 2, wppNotificationsEnabled: false }] as any;

    await service.notifyNewOrder(order, customer, stores);

    const newOrderEvents = (listener: { received: MessageEvent[] }) =>
      listener.received.filter((e) => (e.data as NewOrderPayload).type === 'new_order');

    expect(newOrderEvents(adminListener)).toHaveLength(1);
    expect(newOrderEvents(ownerListener)).toHaveLength(1);
    expect(newOrderEvents(otherSellerListener)).toHaveLength(0);

    adminListener.unsubscribe();
    ownerListener.unsubscribe();
    otherSellerListener.unsubscribe();
  });
});
