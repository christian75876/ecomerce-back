import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { Store } from '../stores/entities/store.entity';
import { Order } from '../orders/entities/order.entity';
import { Customer } from '../customers/entities/customer.entity';
import { CallMeBotService } from './callmebot.service';

export interface NewOrderPayload {
  type: 'new_order';
  orderId: string;
  customerName: string;
  total: number;
  itemCount: number;
  deliveryMethod: string | null;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  private readonly streams = new Map<number, Subject<MessageEvent>>();

  constructor(private readonly callMeBot: CallMeBotService) {}

  subscribe(userId: number): Observable<MessageEvent> {
    if (!this.streams.has(userId)) {
      this.streams.set(userId, new Subject<MessageEvent>());
    }
    return this.streams.get(userId)!.asObservable();
  }

  unsubscribe(userId: number) {
    const subject = this.streams.get(userId);
    if (subject) {
      subject.complete();
      this.streams.delete(userId);
    }
  }

  async notifyNewOrder(order: Order, customer: Customer, stores: Store[]) {
    const customerName = `${customer.firstName} ${customer.lastName}`.trim();
    const itemCount = order.items?.length ?? 0;

    const payload: NewOrderPayload = {
      type: 'new_order',
      orderId: order.id,
      customerName,
      total: Number(order.total),
      itemCount,
      deliveryMethod: order.deliveryMethod ?? null,
      createdAt: new Date().toISOString(),
    };

    // SSE — broadcast to all connected admin/seller sessions
    const event: MessageEvent = { data: payload };
    this.streams.forEach((subject) => subject.next(event));

    // WhatsApp via CallMeBot — per store
    for (const store of stores) {
      if (store.wppNotificationsEnabled && store.wppApiKey && store.whatsappNumber) {
        const text =
          `🛍️ *Nuevo pedido*\n` +
          `Cliente: ${customerName}\n` +
          `Total: $${Number(order.total).toLocaleString('es-CO')}\n` +
          `Artículos: ${itemCount}\n` +
          `Entrega: ${order.deliveryMethod === 'DELIVERY' ? 'Domicilio' : 'Recoger en tienda'}\n` +
          `Tienda: ${store.name}`;

        await this.callMeBot.send(store.whatsappNumber, store.wppApiKey, text);
      }
    }
  }
}
