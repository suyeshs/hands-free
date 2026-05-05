/**
 * Provisioning Tracker
 * 
 * Tracks detailed provisioning steps for store creation, allowing customers
 * to monitor real-time progress throughout the workflow.
 */

export interface ProvisioningStep {
  /** Unique step identifier */
  step: string;
  
  /** Human-readable step name */
  name: string;
  
  /** Step description */
  description: string;
  
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
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

export interface ProvisioningStatus {
  /** Tenant/Store ID */
  tenantId: string;
  
  /** Subdomain being provisioned */
  subdomain: string;
  
  /** Full domain URL */
  fullDomain: string;
  
  /** Store URL */
  storeUrl: string;
  
  /** Overall status */
  status: 'initiating' | 'provisioning' | 'verifying' | 'completing' | 'completed' | 'failed';
  
  /** Current step being executed */
  currentStep: string;
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** All provisioning steps */
  steps: ProvisioningStep[];
  
  /** When provisioning started */
  startedAt: string;
  
  /** When provisioning completed */
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
  
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Standard provisioning steps for store creation
 */
const PROVISIONING_STEPS: Pick<ProvisioningStep, 'step' | 'name' | 'description'>[] = [
  {
    step: 'availability_check',
    name: 'Checking Availability',
    description: 'Verifying subdomain is available',
  },
  {
    step: 'subdomain_generation',
    name: 'Generating Subdomain',
    description: 'Creating unique subdomain identifier',
  },
  {
    step: 'dns_provisioning',
    name: 'Provisioning DNS',
    description: 'Creating DNS records in Cloudflare',
  },
  {
    step: 'dns_propagation',
    name: 'DNS Propagation',
    description: 'Waiting for DNS to propagate globally',
  },
  {
    step: 'accessibility_verification',
    name: 'Verifying Access',
    description: 'Checking subdomain is accessible',
  },
  {
    step: 'store_initialization',
    name: 'Initializing Store',
    description: 'Setting up store data and configuration',
  },
  {
    step: 'worker_deployment',
    name: 'Deploying Worker',
    description: 'Deploying tenant-specific worker',
  },
  {
    step: 'finalization',
    name: 'Finalizing',
    description: 'Completing setup and notifications',
  },
];

/**
 * ProvisioningTracker - Manages detailed provisioning status
 */
export class ProvisioningTracker {
  private kv: KVNamespace;
  
  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Initialize provisioning tracking for a tenant
   */
  async initialize(
    tenantId: string,
    subdomain: string,
    fullDomain: string
  ): Promise<ProvisioningStatus> {
    const now = new Date().toISOString();
    
    const status: ProvisioningStatus = {
      tenantId,
      subdomain,
      fullDomain,
      storeUrl: `https://${fullDomain}`,
      status: 'initiating',
      currentStep: 'availability_check',
      progress: 0,
      steps: PROVISIONING_STEPS.map(step => ({
        ...step,
        status: 'pending',
      })),
      startedAt: now,
      lastUpdated: now,
    };

    await this.save(status);
    return status;
  }

  /**
   * Update a specific step's status
   */
  async updateStep(
    tenantId: string,
    stepId: string,
    updates: {
      status?: ProvisioningStep['status'];
      error?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ProvisioningStatus> {
    const status = await this.get(tenantId);
    if (!status) {
      throw new Error(`Provisioning status not found for tenant: ${tenantId}`);
    }

    const stepIndex = status.steps.findIndex(s => s.step === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const step = status.steps[stepIndex];
    if (!step) {
      throw new Error(`Step not found at index: ${stepIndex}`);
    }
    
    const now = new Date().toISOString();

    // Update step
    if (updates.status === 'in_progress' && !step.startedAt) {
      step.startedAt = now;
      status.currentStep = stepId;
    }

    if (updates.status === 'completed' || updates.status === 'failed') {
      step.completedAt = now;
      if (step.startedAt) {
        step.duration = new Date(now).getTime() - new Date(step.startedAt).getTime();
      }
    }

    step.status = updates.status || step.status;
    if (updates.error !== undefined) {
      step.error = updates.error;
    }
    if (updates.metadata !== undefined) {
      step.metadata = { ...step.metadata, ...updates.metadata };
    }

    // Update overall status
    status.progress = this.calculateProgress(status.steps);
    status.lastUpdated = now;
    
    // Update overall status based on steps
    if (updates.status === 'failed') {
      status.status = 'failed';
      status.error = {
        message: updates.error || 'Step failed',
        step: stepId,
        timestamp: now,
      };
    } else if (this.allStepsCompleted(status.steps)) {
      status.status = 'completed';
      status.completedAt = now;
      status.duration = new Date(now).getTime() - new Date(status.startedAt).getTime();
      status.progress = 100;
    } else if (stepId === 'dns_propagation' || stepId === 'accessibility_verification') {
      status.status = 'verifying';
    } else if (stepId === 'finalization') {
      status.status = 'completing';
    } else {
      status.status = 'provisioning';
    }

    // Calculate estimated time remaining
    if (status.status !== 'completed' && status.status !== 'failed') {
      status.estimatedTimeRemaining = this.estimateTimeRemaining(status.steps);
    }

    await this.save(status);
    return status;
  }

  /**
   * Get provisioning status for a tenant
   */
  async get(tenantId: string): Promise<ProvisioningStatus | null> {
    const data = await this.kv.get(`provisioning:${tenantId}`, 'json');
    return data as ProvisioningStatus | null;
  }

  /**
   * Save provisioning status
   */
  private async save(status: ProvisioningStatus): Promise<void> {
    // Store with 7 day expiration (auto-cleanup)
    await this.kv.put(
      `provisioning:${status.tenantId}`,
      JSON.stringify(status),
      { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
    );
  }

  /**
   * Delete provisioning status (after completion)
   */
  async delete(tenantId: string): Promise<void> {
    await this.kv.delete(`provisioning:${tenantId}`);
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(steps: ProvisioningStep[]): number {
    const weights: Record<string, number> = {
      availability_check: 5,
      subdomain_generation: 5,
      dns_provisioning: 15,
      dns_propagation: 30,  // Longest step
      accessibility_verification: 10,
      store_initialization: 15,
      worker_deployment: 10,
      finalization: 5,
    };

    let totalWeight = 0;
    let completedWeight = 0;

    steps.forEach(step => {
      const weight = weights[step.step] || 10;
      totalWeight += weight;

      if (step.status === 'completed') {
        completedWeight += weight;
      } else if (step.status === 'in_progress') {
        // Give partial credit for in-progress steps
        completedWeight += weight * 0.5;
      }
    });

    return Math.min(100, Math.round((completedWeight / totalWeight) * 100));
  }

  /**
   * Check if all steps are completed
   */
  private allStepsCompleted(steps: ProvisioningStep[]): boolean {
    return steps.every(step => 
      step.status === 'completed' || step.status === 'skipped'
    );
  }

  /**
   * Estimate time remaining based on current progress
   */
  private estimateTimeRemaining(steps: ProvisioningStep[]): number {
    const currentStep = steps.find(s => s.status === 'in_progress');
    if (!currentStep) return 0;

    // Estimated durations for remaining steps (in seconds)
    const estimatedDurations: Record<string, number> = {
      availability_check: 1,
      subdomain_generation: 1,
      dns_provisioning: 3,
      dns_propagation: 15,  // Most variable
      accessibility_verification: 3,
      store_initialization: 8,
      worker_deployment: 5,
      finalization: 2,
    };

    let remainingTime = 0;
    let foundCurrent = false;

    steps.forEach(step => {
      if (step.step === currentStep.step) {
        foundCurrent = true;
        // Add half the time for current step
        remainingTime += (estimatedDurations[step.step] || 5) * 0.5;
      } else if (foundCurrent && step.status === 'pending') {
        remainingTime += estimatedDurations[step.step] || 5;
      }
    });

    return Math.ceil(remainingTime);
  }

  /**
   * Mark step as completed with duration
   */
  async completeStep(
    tenantId: string,
    stepId: string,
    metadata?: Record<string, any>
  ): Promise<ProvisioningStatus> {
    const updates: Parameters<typeof this.updateStep>[2] = {
      status: 'completed',
    };
    if (metadata !== undefined) {
      updates.metadata = metadata;
    }
    return this.updateStep(tenantId, stepId, updates);
  }

  /**
   * Mark step as failed
   */
  async failStep(
    tenantId: string,
    stepId: string,
    error: string
  ): Promise<ProvisioningStatus> {
    return this.updateStep(tenantId, stepId, {
      status: 'failed',
      error,
    });
  }

  /**
   * Start a step
   */
  async startStep(
    tenantId: string,
    stepId: string,
    metadata?: Record<string, any>
  ): Promise<ProvisioningStatus> {
    const updates: Parameters<typeof this.updateStep>[2] = {
      status: 'in_progress',
    };
    if (metadata !== undefined) {
      updates.metadata = metadata;
    }
    return this.updateStep(tenantId, stepId, updates);
  }

  /**
   * Get user-friendly status message
   */
  static getStatusMessage(status: ProvisioningStatus): string {
    const messages: Record<ProvisioningStatus['status'], string> = {
      initiating: 'Starting store creation...',
      provisioning: 'Setting up your store...',
      verifying: 'Verifying your store is accessible...',
      completing: 'Finalizing setup...',
      completed: 'Your store is ready!',
      failed: 'Store creation failed. Please try again.',
    };

    return messages[status.status];
  }

  /**
   * Get current step user-friendly message
   */
  static getCurrentStepMessage(status: ProvisioningStatus): string {
    const currentStep = status.steps.find(s => s.step === status.currentStep);
    return currentStep?.description || 'Processing...';
  }
}

