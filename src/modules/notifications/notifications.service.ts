import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
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

export interface OrderStatusPayload {
  type: 'order_status_update';
  orderId: string;
  status: string;
  statusLabel: string;
  statusEmoji: string;
  storeName: string;
  updatedAt: string;
}

export interface UserRegisteredPayload {
  type: 'user_registered';
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export interface InvitationAcceptedPayload {
  type: 'invitation_accepted';
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  storeName: string;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  // Each user may have multiple concurrent connections (browser tabs).
  // We track an array of Subjects per userId and clean up via finalize().
  private readonly streams = new Map<number, { subjects: Subject<MessageEvent>[]; role: string }>();

  constructor(private readonly callMeBot: CallMeBotService) {}

  subscribe(userId: number, role: string): Observable<MessageEvent> {
    if (!this.streams.has(userId)) {
      this.streams.set(userId, { subjects: [], role });
    }
    const entry = this.streams.get(userId)!;
    // Always update role in case it changed (e.g. role upgrade)
    entry.role = role;

    const subject = new Subject<MessageEvent>();
    entry.subjects.push(subject);

    // Clean up this specific connection when the HTTP stream closes
    return subject.asObservable().pipe(
      finalize(() => {
        const e = this.streams.get(userId);
        if (e) {
          e.subjects = e.subjects.filter((s) => s !== subject);
          if (e.subjects.length === 0) {
            this.streams.delete(userId);
          }
        }
      }),
    );
  }

  unsubscribe(userId: number) {
    const entry = this.streams.get(userId);
    if (entry) {
      entry.subjects.forEach((s) => s.complete());
      this.streams.delete(userId);
    }
  }

  notifyUser(userId: number, payload: OrderStatusPayload): void {
    const entry = this.streams.get(userId);
    if (entry) {
      const event: MessageEvent = { data: payload };
      entry.subjects.forEach((s) => s.next(event));
    }
  }

  notifyAdmins(payload: UserRegisteredPayload | InvitationAcceptedPayload): void {
    const event: MessageEvent = { data: payload };
    this.streams.forEach(({ subjects, role }) => {
      if (role === 'admin') subjects.forEach((s) => s.next(event));
    });
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

    // Broadcast to ALL connected panel users (sellers AND admins)
    const event: MessageEvent = { data: payload };
    this.streams.forEach(({ subjects }) => {
      subjects.forEach((s) => s.next(event));
    });

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
