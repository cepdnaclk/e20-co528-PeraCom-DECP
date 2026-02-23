export interface BaseEvent<T> {
    eventId: string;
    eventType: string;
    eventVersion: string;
    timestamp: string;
    producer: string;
    correlationId?: string;
    data: T;
}
//# sourceMappingURL=event.interface.d.ts.map