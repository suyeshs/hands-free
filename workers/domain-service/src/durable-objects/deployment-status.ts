/**
 * Deployment Status Durable Object
 * 
 * Manages real-time deployment status tracking with WebSocket support.
 * Clients can connect via WebSocket to receive live updates about:
 * - KV namespace creation
 * - D1 database provisioning
 * - R2 bucket setup
 * - Worker deployment
 * - Resource verification
 */

import type { DeploymentStatus, DeploymentStep } from '../automation/deployment-tracker';

interface WebSocketClient {
  webSocket: WebSocket;
  deploymentId: string;
  connectedAt: string;
}

export class DeploymentStatusDO {
  private state: DurableObjectState;
  private ctx: DurableObjectState;
  private sessions: Map<string, WebSocketClient>;
  private deploymentStatus: DeploymentStatus | null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.ctx = state; // Store context for acceptWebSocket
    this.sessions = new Map();
    this.deploymentStatus = null;
    
    // Load deployment status from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<DeploymentStatus>('deploymentStatus');
      if (stored) {
        this.deploymentStatus = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      console.log(`[DeploymentStatusDO] Received request: ${request.method} ${path}`);
      console.log(`[DeploymentStatusDO] Upgrade header: ${request.headers.get('Upgrade')}`);

      // Extract the actual path after /deployment-status/{id}/
      // The path from worker will be like: /deployment-status/dep-123/ws
      const pathMatch = path.match(/\/deployment-status\/[^\/]+(.*)$/);
      const actualPath = pathMatch ? pathMatch[1] : path;
      
      console.log(`[DeploymentStatusDO] Actual path: ${actualPath}`);

      // WebSocket upgrade endpoint
      if (actualPath === '/ws' && request.headers.get('Upgrade') === 'websocket') {
        console.log('[DeploymentStatusDO] Handling WebSocket upgrade');
        return this.handleWebSocket(request);
      }

      // HTTP API endpoints
      if (request.method === 'POST' && actualPath === '/initialize') {
        return this.handleInitialize(request);
      }

      if (request.method === 'POST' && actualPath === '/update') {
        return this.handleUpdate(request);
      }

      if (request.method === 'GET' && (actualPath === '/status' || actualPath === '')) {
        return this.handleGetStatus();
      }

      return new Response(JSON.stringify({
        error: 'Not found',
        path: actualPath,
        method: request.method,
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('[DeploymentStatusDO] Error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle WebSocket connection
   */
  private async handleWebSocket(request: Request): Promise<Response> {
    try {
      console.log('[DeploymentStatusDO] Creating WebSocketPair');
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      if (!server || !client) {
        console.error('[DeploymentStatusDO] WebSocketPair creation failed');
        return new Response('WebSocket creation failed', { status: 500 });
      }

      const sessionId = crypto.randomUUID();
      const deploymentId = new URL(request.url).searchParams.get('deploymentId') || 'unknown';
      
      console.log(`[DeploymentStatusDO] Session ${sessionId} for deployment ${deploymentId}`);

      // Accept WebSocket connection using Durable Object context (correct API!)
      this.ctx.acceptWebSocket(server);
      console.log('[DeploymentStatusDO] WebSocket accepted via ctx');

    // Store session
    this.sessions.set(sessionId, {
      webSocket: server,
      deploymentId,
      connectedAt: new Date().toISOString(),
    });

    // Send current status immediately
    if (this.deploymentStatus) {
      this.sendToClient(server, {
        type: 'status_update',
        data: this.deploymentStatus,
      });
    } else {
      this.sendToClient(server, {
        type: 'info',
        message: 'Connected. Waiting for deployment to start...',
      });
    }

    // Handle incoming messages
    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string);
        this.handleClientMessage(sessionId, message);
      } catch (error) {
        this.sendToClient(server, {
          type: 'error',
          message: 'Invalid message format',
        });
      }
    });

    // Handle close
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
      console.log(`WebSocket session ${sessionId} closed. Active sessions: ${this.sessions.size}`);
    });

    // Handle errors
    server.addEventListener('error', (event: Event) => {
      console.error(`[DeploymentStatusDO] WebSocket error for session ${sessionId}:`, event);
      this.sessions.delete(sessionId);
    });

    console.log('[DeploymentStatusDO] Returning WebSocket upgrade response');
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
    } catch (error) {
      console.error('[DeploymentStatusDO] Error in handleWebSocket:', error);
      return new Response(JSON.stringify({
        error: 'WebSocket setup failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Initialize deployment tracking
   */
  private async handleInitialize(request: Request): Promise<Response> {
    try {
      const data = await request.json() as {
        deploymentId: string;
        environment: 'staging' | 'production' | 'development';
      };

      const now = new Date().toISOString();

      this.deploymentStatus = {
        deploymentId: data.deploymentId,
        environment: data.environment,
        status: 'initializing',
        currentStep: 'init_deployment',
        progress: 0,
        steps: this.getInitialSteps(),
        startedAt: now,
        lastUpdated: now,
        resources: {
          kvNamespaces: {},
        },
      };

      await this.state.storage.put('deploymentStatus', this.deploymentStatus);

      // Broadcast to all connected clients
      this.broadcast({
        type: 'deployment_started',
        data: this.deploymentStatus,
      });

      return new Response(JSON.stringify({
        success: true,
        data: this.deploymentStatus,
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Update deployment status
   */
  private async handleUpdate(request: Request): Promise<Response> {
    try {
      const update = await request.json() as {
        stepId: string;
        status?: DeploymentStep['status'];
        resourceId?: string;
        resourceName?: string;
        error?: string;
        metadata?: Record<string, any>;
        workerUrl?: string;
      };

      if (!this.deploymentStatus) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Deployment not initialized',
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Update step
      const stepIndex = this.deploymentStatus.steps.findIndex(s => s.step === update.stepId);
      if (stepIndex === -1) {
        return new Response(JSON.stringify({
          success: false,
          error: `Step not found: ${update.stepId}`,
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }

      const step = this.deploymentStatus.steps[stepIndex];
      if (!step) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Step not found in array',
        }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      
      const now = new Date().toISOString();

      // Update step status
      if (update.status === 'in_progress' && !step.startedAt) {
        step.startedAt = now;
        this.deploymentStatus.currentStep = update.stepId;
      }

      if (update.status === 'completed' || update.status === 'failed') {
        step.completedAt = now;
        if (step.startedAt) {
          step.duration = new Date(now).getTime() - new Date(step.startedAt).getTime();
        }
      }

      if (update.status) step.status = update.status;
      if (update.resourceId) step.resourceId = update.resourceId;
      if (update.resourceName) step.resourceName = update.resourceName;
      if (update.error) step.error = update.error;
      if (update.metadata) {
        step.metadata = { ...step.metadata, ...update.metadata };
      }

      // Store resource IDs
      if (update.resourceId && step.category === 'kv') {
        this.deploymentStatus.resources!.kvNamespaces![step.step] = update.resourceId;
      } else if (update.resourceId && step.category === 'd1') {
        this.deploymentStatus.resources!.d1DatabaseId = update.resourceId;
      } else if (update.resourceName && step.category === 'r2') {
        this.deploymentStatus.resources!.r2BucketName = update.resourceName;
      }

      // Update worker URL
      if (update.workerUrl) {
        this.deploymentStatus.workerUrl = update.workerUrl;
      }

      // Update overall status
      this.deploymentStatus.progress = this.calculateProgress();
      this.deploymentStatus.lastUpdated = now;

      if (update.status === 'failed') {
        this.deploymentStatus.status = 'failed';
        this.deploymentStatus.error = {
          message: update.error || 'Step failed',
          step: update.stepId,
          timestamp: now,
        };
      } else if (this.allStepsCompleted()) {
        this.deploymentStatus.status = 'completed';
        this.deploymentStatus.completedAt = now;
        this.deploymentStatus.duration = 
          new Date(now).getTime() - new Date(this.deploymentStatus.startedAt).getTime();
        this.deploymentStatus.progress = 100;
      } else {
        // Update status based on current step category
        switch (step.category) {
          case 'kv':
          case 'd1':
          case 'r2':
            this.deploymentStatus.status = 'provisioning';
            break;
          case 'config':
          case 'secrets':
            this.deploymentStatus.status = 'configuring';
            break;
          case 'deployment':
            this.deploymentStatus.status = 'deploying';
            break;
          case 'verification':
            this.deploymentStatus.status = 'verifying';
            break;
        }
      }

      // Calculate estimated time remaining
      if (this.deploymentStatus.status !== 'completed' && this.deploymentStatus.status !== 'failed') {
        this.deploymentStatus.estimatedTimeRemaining = this.estimateTimeRemaining();
      }

      // Save to storage
      await this.state.storage.put('deploymentStatus', this.deploymentStatus);

      // Broadcast update to all connected clients
      this.broadcast({
        type: 'status_update',
        data: this.deploymentStatus,
        step: {
          id: update.stepId,
          name: step.name,
          status: step.status,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        data: this.deploymentStatus,
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  /**
   * Get current deployment status
   */
  private handleGetStatus(): Response {
    if (!this.deploymentStatus) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No deployment in progress',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: this.deploymentStatus,
      activeConnections: this.sessions.size,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle client messages
   */
  private handleClientMessage(sessionId: string, message: any): void {
    switch (message.type) {
      case 'ping':
        const session = this.sessions.get(sessionId);
        if (session) {
          this.sendToClient(session.webSocket, {
            type: 'pong',
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case 'get_status':
        const sessionForStatus = this.sessions.get(sessionId);
        if (sessionForStatus && this.deploymentStatus) {
          this.sendToClient(sessionForStatus.webSocket, {
            type: 'status_update',
            data: this.deploymentStatus,
          });
        }
        break;

      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(webSocket: WebSocket, message: any): void {
    try {
      webSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending to client:', error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    let closedSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      try {
        session.webSocket.send(messageStr);
      } catch (error) {
        console.error(`Error broadcasting to session ${sessionId}:`, error);
        closedSessions.push(sessionId);
      }
    });

    // Clean up closed sessions
    closedSessions.forEach(sessionId => this.sessions.delete(sessionId));
  }

  /**
   * Get initial deployment steps
   */
  private getInitialSteps(): DeploymentStep[] {
    const steps: Omit<DeploymentStep, 'status'>[] = [
      { step: 'init_deployment', name: 'Initialize Deployment', description: 'Validating configuration', category: 'config' },
      { step: 'kv_domain_metadata', name: 'Create DOMAIN_METADATA KV', description: 'Provisioning KV namespace', category: 'kv' },
      { step: 'kv_tenant_config', name: 'Create TENANT_CONFIG KV', description: 'Provisioning KV namespace', category: 'kv' },
      { step: 'kv_ssl_certificates', name: 'Create SSL_CERTIFICATES KV', description: 'Provisioning KV namespace', category: 'kv' },
      { step: 'kv_validation_tokens', name: 'Create VALIDATION_TOKENS KV', description: 'Provisioning KV namespace', category: 'kv' },
      { step: 'd1_database', name: 'Create D1 Database', description: 'Provisioning D1 database', category: 'd1' },
      { step: 'd1_schema', name: 'Initialize D1 Schema', description: 'Creating database tables', category: 'd1' },
      { step: 'r2_bucket', name: 'Create R2 Bucket', description: 'Provisioning R2 bucket', category: 'r2' },
      { step: 'wrangler_config', name: 'Update Wrangler Config', description: 'Updating configuration', category: 'config' },
      { step: 'set_secrets', name: 'Set Worker Secrets', description: 'Configuring secrets', category: 'secrets' },
      { step: 'deploy_worker', name: 'Deploy Worker', description: 'Deploying to Cloudflare', category: 'deployment' },
      { step: 'verify_deployment', name: 'Verify Deployment', description: 'Running health checks', category: 'verification' },
    ];

    return steps.map(step => ({ ...step, status: 'pending' as const }));
  }

  /**
   * Calculate progress percentage
   */
  private calculateProgress(): number {
    if (!this.deploymentStatus) return 0;

    const weights: Record<string, number> = {
      init_deployment: 5,
      kv_domain_metadata: 8,
      kv_tenant_config: 8,
      kv_ssl_certificates: 8,
      kv_validation_tokens: 8,
      d1_database: 12,
      d1_schema: 8,
      r2_bucket: 10,
      wrangler_config: 8,
      set_secrets: 10,
      deploy_worker: 10,
      verify_deployment: 5,
    };

    let totalWeight = 0;
    let completedWeight = 0;

    this.deploymentStatus.steps.forEach(step => {
      const weight = weights[step.step] || 5;
      totalWeight += weight;

      if (step.status === 'completed' || step.status === 'skipped') {
        completedWeight += weight;
      } else if (step.status === 'in_progress') {
        completedWeight += weight * 0.5;
      }
    });

    return Math.min(100, Math.round((completedWeight / totalWeight) * 100));
  }

  /**
   * Check if all steps are completed
   */
  private allStepsCompleted(): boolean {
    return this.deploymentStatus?.steps.every(step => 
      step.status === 'completed' || step.status === 'skipped'
    ) || false;
  }

  /**
   * Estimate time remaining
   */
  private estimateTimeRemaining(): number {
    if (!this.deploymentStatus) return 0;

    const estimatedDurations: Record<string, number> = {
      init_deployment: 2,
      kv_domain_metadata: 3,
      kv_tenant_config: 3,
      kv_ssl_certificates: 3,
      kv_validation_tokens: 3,
      d1_database: 5,
      d1_schema: 4,
      r2_bucket: 4,
      wrangler_config: 2,
      set_secrets: 5,
      deploy_worker: 10,
      verify_deployment: 3,
    };

    let remainingTime = 0;
    let foundCurrent = false;

    this.deploymentStatus.steps.forEach(step => {
      if (step.step === this.deploymentStatus!.currentStep) {
        foundCurrent = true;
        remainingTime += (estimatedDurations[step.step] || 3) * 0.5;
      } else if (foundCurrent && step.status === 'pending') {
        remainingTime += estimatedDurations[step.step] || 3;
      }
    });

    return Math.ceil(remainingTime);
  }

  /**
   * Clean up resources when the object is destroyed
   */
  async alarm(): Promise<void> {
    // Auto-cleanup old deployments after 24 hours
    if (this.deploymentStatus) {
      const ageHours = (Date.now() - new Date(this.deploymentStatus.startedAt).getTime()) / (1000 * 60 * 60);
      
      if (ageHours > 24) {
        console.log(`Cleaning up deployment ${this.deploymentStatus.deploymentId} (age: ${ageHours.toFixed(1)}h)`);
        
        // Close all WebSocket connections
        this.sessions.forEach(session => {
          this.sendToClient(session.webSocket, {
            type: 'info',
            message: 'Deployment tracking session expired',
          });
          session.webSocket.close();
        });
        
        this.sessions.clear();
        await this.state.storage.deleteAll();
      }
    }
  }
}

