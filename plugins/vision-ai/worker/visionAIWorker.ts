/**
 * Vision AI Plugin - Cloudflare Worker
 * Cloud AI processing with Gemini Vision and Cloudflare AI
 */

interface Env {
  GEMINI_API_KEY: string;
  AI: any; // Cloudflare AI binding
  VISION_DB: D1Database;
  VISION_SNAPSHOTS: R2Bucket;
}

interface SnapshotAnalysisRequest {
  cameraId: string;
  tenantId: string;
  imageBase64: string;
  location: string;
  analysisType: 'people_counting' | 'table_occupancy' | 'safety_compliance' | 'scene_understanding' | 'anomaly';
}

interface GeminiAnalysisResponse {
  success: boolean;
  analysis: string;
  peopleCount?: number;
  confidence: number;
  insights: string[];
  warnings: string[];
}

/**
 * Analyze snapshot with Gemini Vision API
 */
async function analyzeWithGemini(
  request: SnapshotAnalysisRequest,
  env: Env
): Promise<GeminiAnalysisResponse> {
  const prompt = getPromptForAnalysisType(request.analysisType, request.location);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: request.imageBase64,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return parseGeminiResponse(analysisText, request.analysisType);
  } catch (error) {
    console.error('Gemini analysis failed:', error);
    return {
      success: false,
      analysis: 'Analysis failed',
      confidence: 0,
      insights: [],
      warnings: ['Failed to analyze with Gemini'],
    };
  }
}

/**
 * Analyze snapshot with Cloudflare Worker AI
 */
async function analyzeWithWorkerAI(
  request: SnapshotAnalysisRequest,
  env: Env
): Promise<any> {
  try {
    // Convert base64 to Uint8Array
    const imageData = Uint8Array.from(atob(request.imageBase64), c => c.charCodeAt(0));

    // Run object detection
    const response = await env.AI.run('@cf/meta/detr-resnet-50', {
      image: Array.from(imageData),
    });

    // Count people
    const peopleCount = response.filter((det: any) =>
      det.label === 'person' && det.score > 0.5
    ).length;

    return {
      success: true,
      detections: response,
      peopleCount,
      processingSource: 'cloud_worker_ai',
    };
  } catch (error) {
    console.error('Worker AI analysis failed:', error);
    return {
      success: false,
      detections: [],
      peopleCount: 0,
    };
  }
}

/**
 * Get appropriate prompt for analysis type
 */
function getPromptForAnalysisType(type: string, location: string): string {
  const prompts: Record<string, string> = {
    people_counting: `Analyze this image from a restaurant ${location} camera and count the number of people visible.
Provide:
1. Total people count
2. Brief description of what they're doing
3. Any notable observations

Format your response as:
COUNT: [number]
DESCRIPTION: [brief description]
OBSERVATIONS: [any notable points]`,

    table_occupancy: `Analyze this image from a restaurant dining area and identify:
1. Number of tables visible
2. Which tables are occupied (have people sitting)
3. Which tables need clearing (empty with dishes)
4. Which tables are ready for guests

Format your response clearly with table status.`,

    safety_compliance: `Analyze this kitchen surveillance image for safety compliance:
1. Are staff wearing proper attire (hats, aprons)?
2. Any visible safety hazards?
3. Cleanliness observations
4. Any immediate concerns?

Provide clear yes/no answers and specific observations.`,

    scene_understanding: `Provide a detailed analysis of this restaurant ${location} scene:
1. Overall activity level (busy, moderate, quiet)
2. Customer behavior and engagement
3. Staff activity
4. Any unusual or noteworthy events
5. Recommendations for management`,

    anomaly: `Analyze this image for any unusual or anomalous activity:
1. Any unexpected behavior or events?
2. Safety concerns?
3. Security issues?
4. Anything requiring immediate attention?`,
  };

  return prompts[type] || prompts['scene_understanding'];
}

/**
 * Parse Gemini response text
 */
function parseGeminiResponse(text: string, analysisType: string): GeminiAnalysisResponse {
  const insights: string[] = [];
  const warnings: string[] = [];
  let peopleCount: number | undefined;
  let confidence = 0.8;

  // Extract people count if present
  const countMatch = text.match(/COUNT:\s*(\d+)/i);
  if (countMatch) {
    peopleCount = parseInt(countMatch[1]);
  }

  // Extract insights from numbered lists
  const insightMatches = text.match(/\d+\.\s*([^\n]+)/g);
  if (insightMatches) {
    insights.push(...insightMatches.map(m => m.replace(/^\d+\.\s*/, '')));
  }

  // Check for warnings (words like "concern", "hazard", "issue")
  if (/concern|hazard|issue|warning|problem/i.test(text)) {
    const concernMatches = text.match(/[^.!?]*(?:concern|hazard|issue|warning|problem)[^.!?]*/gi);
    if (concernMatches) {
      warnings.push(...concernMatches);
    }
  }

  return {
    success: true,
    analysis: text,
    peopleCount,
    confidence,
    insights,
    warnings,
  };
}

/**
 * Store snapshot in R2
 */
async function storeSnapshot(
  tenantId: string,
  cameraId: string,
  imageBase64: string,
  env: Env
): Promise<string> {
  const timestamp = Date.now();
  const key = `global/vision/${tenantId}/${cameraId}/${timestamp}.jpg`;

  // Convert base64 to buffer
  const imageData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

  await env.VISION_SNAPSHOTS.put(key, imageData, {
    httpMetadata: {
      contentType: 'image/jpeg',
    },
  });

  return key;
}

/**
 * Save analysis result to D1
 */
async function saveAnalysisResult(
  request: SnapshotAnalysisRequest,
  geminiResult: GeminiAnalysisResponse,
  workerAIResult: any,
  snapshotId: string,
  env: Env
): Promise<void> {
  const detectionId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  // Combine detections
  const detections = JSON.stringify({
    gemini: geminiResult,
    workerAI: workerAIResult.detections || [],
  });

  await env.VISION_DB.prepare(`
    INSERT INTO vision_detections (
      id, camera_id, tenant_id, timestamp, detections,
      people_count, processing_source, snapshot_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    detectionId,
    request.cameraId,
    request.tenantId,
    timestamp,
    detections,
    geminiResult.peopleCount || workerAIResult.peopleCount || 0,
    'cloud_gemini',
    snapshotId,
    timestamp
  ).run();

  // Check for warnings and create events
  if (geminiResult.warnings.length > 0) {
    for (const warning of geminiResult.warnings) {
      await createVisionEvent(
        request.cameraId,
        request.tenantId,
        'safety_violation',
        'high',
        'Safety Concern Detected',
        warning,
        snapshotId,
        env
      );
    }
  }
}

/**
 * Create vision event
 */
async function createVisionEvent(
  cameraId: string,
  tenantId: string,
  eventType: string,
  severity: string,
  title: string,
  description: string,
  snapshotId: string,
  env: Env
): Promise<void> {
  const eventId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  await env.VISION_DB.prepare(`
    INSERT INTO vision_events (
      id, camera_id, tenant_id, event_type, severity,
      title, description, snapshot_id, timestamp, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    eventId,
    cameraId,
    tenantId,
    eventType,
    severity,
    title,
    description,
    snapshotId,
    timestamp,
    timestamp
  ).run();
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // POST /api/vision/snapshot/analyze
      if (url.pathname === '/api/vision/snapshot/analyze' && request.method === 'POST') {
        const body = await request.json() as SnapshotAnalysisRequest;

        // Store snapshot in R2
        const r2Key = await storeSnapshot(body.tenantId, body.cameraId, body.imageBase64, env);
        const snapshotId = crypto.randomUUID();

        // Run both Gemini and Worker AI in parallel
        const [geminiResult, workerAIResult] = await Promise.all([
          analyzeWithGemini(body, env),
          analyzeWithWorkerAI(body, env),
        ]);

        // Save results to D1
        await saveAnalysisResult(body, geminiResult, workerAIResult, snapshotId, env);

        return new Response(JSON.stringify({
          success: true,
          snapshotId,
          r2Key,
          gemini: geminiResult,
          workerAI: workerAIResult,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST /api/vision/detect (Worker AI only, faster)
      if (url.pathname === '/api/vision/detect' && request.method === 'POST') {
        const body = await request.json() as SnapshotAnalysisRequest;
        const result = await analyzeWithWorkerAI(body, env);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // GET /api/vision/analytics/occupancy
      if (url.pathname === '/api/vision/analytics/occupancy' && request.method === 'GET') {
        const tenantId = url.searchParams.get('tenant_id');
        const location = url.searchParams.get('location');
        const hours = parseInt(url.searchParams.get('hours') || '24');

        const startTime = Math.floor(Date.now() / 1000) - (hours * 3600);

        const result = await env.VISION_DB.prepare(`
          SELECT
            AVG(people_count) as avg_count,
            MAX(people_count) as max_count,
            COUNT(*) as total_readings
          FROM vision_detections
          WHERE tenant_id = ? AND timestamp > ?
        `).bind(tenantId, startTime).first();

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
