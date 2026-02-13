/**
 * ActiveOrderSession - Temporary placeholder for migration
 * This class will be deleted via migration tag v5
 */

export class ActiveOrderSession {
  constructor(public state: DurableObjectState, public env: any) {}

  async fetch(request: Request): Promise<Response> {
    return new Response('This class is deprecated and will be removed', { status: 410 });
  }
}
