/**
 * Deployment Status Tracker
 * 
 * Tracks real-time status of infrastructure deployment including:
 * - KV namespace creation
 * - D1 database provisioning
 * - R2 bucket setup
 * - Wrangler configuration
 * - Worker deployment
 * - Resource verification
 */

export interface DeploymentStep {
  /** Step identifier */
  step: string;
  
  /** Human-readable step name */
  name: string;
  
  /** Step description */
  description: string;
  
  /** Step category */
  category: 'kv' | 'd1' | 'r2' | 'config' | 'secrets' | 'deployment' | 'verification';
  
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
  /** Resource ID (if applicable) */
  resourceId?: string;
  
  /** Resource name */
  resourceName?: string;
  
  /** When step started */
  startedAt?: string;
  
  /** When step completed */
  completedAt?: string;
  
  /** Duration in milliseconds */
  duration?: number;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface DeploymentStatus {
  /** Deployment ID */
  deploymentId: string;
  
  /** Environment being deployed */
  environment: 'staging' | 'production' | 'development';
  
  /** Overall status */
  status: 'initializing' | 'provisioning' | 'configuring' | 'deploying' | 'verifying' | 'completed' | 'failed';
  
  /** Current step being executed */
  currentStep: string;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** All deployment steps */
  steps: DeploymentStep[];
  
  /** When deployment started */
  startedAt: string;
  
  /** When deployment completed */
  completedAt?: string;
  
  /** Total duration */
  duration?: number;
  
  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining?: number;
  
  /** Error information if failed */
  error?: {
    message: string;
    step: string;
    timestamp: string;
  };
  
  /** Resource IDs created */
  resources?: {
    kvNamespaces?: Record<string, string>;
    d1DatabaseId?: string;
    r2BucketName?: string;
  };
  
  /** Worker URL (after deployment) */
  workerUrl?: string;
  
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Standard deployment steps
 */
const DEPLOYMENT_STEPS: Pick<DeploymentStep, 'step' | 'name' | 'description' | 'category'>[] = [
  {
    step: 'init_deployment',
    name: 'Initialize Deployment',
    description: 'Validating configuration and preparing resources',
    category: 'config',
  },
  {
    step: 'kv_domain_metadata',
    name: 'Create DOMAIN_METADATA KV',
    description: 'Provisioning KV namespace for domain metadata',
    category: 'kv',
  },
  {
    step: 'kv_tenant_config',
    name: 'Create TENANT_CONFIG KV',
    description: 'Provisioning KV namespace for tenant configuration',
    category: 'kv',
  },
  {
    step: 'kv_ssl_certificates',
    name: 'Create SSL_CERTIFICATES KV',
    description: 'Provisioning KV namespace for SSL certificates',
    category: 'kv',
  },
  {
    step: 'kv_validation_tokens',
    name: 'Create VALIDATION_TOKENS KV',
    description: 'Provisioning KV namespace for validation tokens',
    category: 'kv',
  },
  {
    step: 'd1_database',
    name: 'Create D1 Database',
    description: 'Provisioning D1 serverless database',
    category: 'd1',
  },
  {
    step: 'd1_schema',
    name: 'Initialize D1 Schema',
    description: 'Creating database tables and schema',
    category: 'd1',
  },
  {
    step: 'r2_bucket',
    name: 'Create R2 Bucket',
    description: 'Provisioning R2 object storage bucket',
    category: 'r2',
  },
  {
    step: 'wrangler_config',
    name: 'Update Wrangler Config',
    description: 'Updating wrangler.toml with resource IDs',
    category: 'config',
  },
  {
    step: 'set_secrets',
    name: 'Set Worker Secrets',
    description: 'Configuring environment secrets',
    category: 'secrets',
  },
  {
    step: 'deploy_worker',
    name: 'Deploy Worker',
    description: 'Deploying worker to Cloudflare',
    category: 'deployment',
  },
  {
    step: 'verify_deployment',
    name: 'Verify Deployment',
    description: 'Running health checks and verification',
    category: 'verification',
  },
];

/**
 * DeploymentTracker - Manages deployment status tracking
 */
export class DeploymentTracker {
  private status: DeploymentStatus;
  private statusCallbacks: ((status: DeploymentStatus) => void)[] = [];
  
  constructor(
    deploymentId: string,
    environment: DeploymentStatus['environment']
  ) {
    const now = new Date().toISOString();
    
    this.status = {
      deploymentId,
      environment,
      status: 'initializing',
      currentStep: 'init_deployment',
      progress: 0,
      steps: DEPLOYMENT_STEPS.map(step => ({
        ...step,
        status: 'pending',
      })),
      startedAt: now,
      lastUpdated: now,
      resources: {
        kvNamespaces: {},
      },
    };
  }

  /**
   * Register callback for status updates
   */
  onStatusUpdate(callback: (status: DeploymentStatus) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * Emit status update to all callbacks
   */
  private emitStatusUpdate(): void {
    this.statusCallbacks.forEach(cb => {
      try {
        cb(this.getStatus());
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  /**
   * Get current deployment status
   */
  getStatus(): DeploymentStatus {
    return JSON.parse(JSON.stringify(this.status));
  }

  /**
   * Update a specific step's status
   */
  updateStep(
    stepId: string,
    updates: {
      status?: DeploymentStep['status'];
      resourceId?: string;
      resourceName?: string;
      error?: string;
      metadata?: Record<string, any>;
    }
  ): void {
    const stepIndex = this.status.steps.findIndex(s => s.step === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const step = this.status.steps[stepIndex];
    if (!step) return;
    
    const now = new Date().toISOString();

    // Update step
    if (updates.status === 'in_progress' && !step.startedAt) {
      step.startedAt = now;
      this.status.currentStep = stepId;
    }

    if (updates.status === 'completed' || updates.status === 'failed') {
      step.completedAt = now;
      if (step.startedAt) {
        step.duration = new Date(now).getTime() - new Date(step.startedAt).getTime();
      }
    }

    step.status = updates.status || step.status;
    if (updates.resourceId !== undefined) {
      step.resourceId = updates.resourceId;
    }
    if (updates.resourceName !== undefined) {
      step.resourceName = updates.resourceName;
    }
    if (updates.error !== undefined) {
      step.error = updates.error;
    }
    if (updates.metadata !== undefined) {
      step.metadata = { ...step.metadata, ...updates.metadata };
    }

    // Update overall status
    this.status.progress = this.calculateProgress();
    this.status.lastUpdated = now;
    
    // Update overall status based on steps
    if (updates.status === 'failed') {
      this.status.status = 'failed';
      this.status.error = {
        message: updates.error || 'Step failed',
        step: stepId,
        timestamp: now,
      };
    } else if (this.allStepsCompleted()) {
      this.status.status = 'completed';
      this.status.completedAt = now;
      this.status.duration = new Date(now).getTime() - new Date(this.status.startedAt).getTime();
      this.status.progress = 100;
    } else {
      // Determine status based on current step category
      const currentStep = this.status.steps.find(s => s.step === this.status.currentStep);
      if (currentStep) {
        switch (currentStep.category) {
          case 'kv':
          case 'd1':
          case 'r2':
            this.status.status = 'provisioning';
            break;
          case 'config':
          case 'secrets':
            this.status.status = 'configuring';
            break;
          case 'deployment':
            this.status.status = 'deploying';
            break;
          case 'verification':
            this.status.status = 'verifying';
            break;
        }
      }
    }

    // Calculate estimated time remaining
    if (this.status.status !== 'completed' && this.status.status !== 'failed') {
      this.status.estimatedTimeRemaining = this.estimateTimeRemaining();
    }

    // Emit update
    this.emitStatusUpdate();
  }

  /**
   * Start a step
   */
  startStep(stepId: string, metadata?: Record<string, any>): void {
    const updates: Parameters<typeof this.updateStep>[1] = {
      status: 'in_progress',
    };
    if (metadata !== undefined) {
      updates.metadata = metadata;
    }
    this.updateStep(stepId, updates);
  }

  /**
   * Complete a step
   */
  completeStep(
    stepId: string,
    resourceId?: string,
    resourceName?: string,
    metadata?: Record<string, any>
  ): void {
    const updates: Parameters<typeof this.updateStep>[1] = {
      status: 'completed',
    };
    if (resourceId !== undefined) updates.resourceId = resourceId;
    if (resourceName !== undefined) updates.resourceName = resourceName;
    if (metadata !== undefined) updates.metadata = metadata;
    
    this.updateStep(stepId, updates);

    // Store resource IDs
    const step = this.status.steps.find(s => s.step === stepId);
    if (step && resourceId) {
      if (step.category === 'kv') {
        this.status.resources!.kvNamespaces![step.step] = resourceId;
      } else if (step.category === 'd1') {
        this.status.resources!.d1DatabaseId = resourceId;
      } else if (step.category === 'r2') {
        this.status.resources!.r2BucketName = resourceName || resourceId;
      }
    }
  }

  /**
   * Fail a step
   */
  failStep(stepId: string, error: string): void {
    this.updateStep(stepId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Skip a step
   */
  skipStep(stepId: string, reason: string): void {
    this.updateStep(stepId, {
      status: 'skipped',
      metadata: { reason },
    });
  }

  /**
   * Set worker URL after deployment
   */
  setWorkerUrl(url: string): void {
    this.status.workerUrl = url;
    this.emitStatusUpdate();
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(): number {
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

    this.status.steps.forEach(step => {
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
    return this.status.steps.every(step => 
      step.status === 'completed' || step.status === 'skipped'
    );
  }

  /**
   * Estimate time remaining based on current progress
   */
  private estimateTimeRemaining(): number {
    // Estimated durations for each step (in seconds)
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

    this.status.steps.forEach(step => {
      if (step.step === this.status.currentStep) {
        foundCurrent = true;
        remainingTime += (estimatedDurations[step.step] || 3) * 0.5;
      } else if (foundCurrent && step.status === 'pending') {
        remainingTime += estimatedDurations[step.step] || 3;
      }
    });

    return Math.ceil(remainingTime);
  }

  /**
   * Get user-friendly status message
   */
  static getStatusMessage(status: DeploymentStatus): string {
    const messages: Record<DeploymentStatus['status'], string> = {
      initializing: 'Initializing deployment...',
      provisioning: 'Provisioning Cloudflare resources...',
      configuring: 'Configuring worker settings...',
      deploying: 'Deploying worker to Cloudflare...',
      verifying: 'Verifying deployment...',
      completed: 'Deployment completed successfully!',
      failed: 'Deployment failed. Please check errors.',
    };

    return messages[status.status];
  }

  /**
   * Get current step user-friendly message
   */
  static getCurrentStepMessage(status: DeploymentStatus): string {
    const currentStep = status.steps.find(s => s.step === status.currentStep);
    return currentStep?.description || 'Processing...';
  }

  /**
   * Get resource summary
   */
  getResourceSummary(): {
    kvNamespaces: number;
    d1Databases: number;
    r2Buckets: number;
    total: number;
  } {
    const kvCount = Object.keys(this.status.resources?.kvNamespaces || {}).length;
    const d1Count = this.status.resources?.d1DatabaseId ? 1 : 0;
    const r2Count = this.status.resources?.r2BucketName ? 1 : 0;

    return {
      kvNamespaces: kvCount,
      d1Databases: d1Count,
      r2Buckets: r2Count,
      total: kvCount + d1Count + r2Count,
    };
  }
}

