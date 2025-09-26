const { createHash } = require('crypto');

const logger = require('./logger');

let predictionClient;
let simulationNoticeLogged = false;
let vertexModuleLoaded = false;

function ensurePredictionClient() {
  if (predictionClient !== undefined) {
    return predictionClient;
  }

  try {
    // Lazy-load to avoid crashing if the dependency is unavailable during local development.
    const { v1 } = require('@google-cloud/aiplatform');
    predictionClient = new v1.PredictionServiceClient();
    vertexModuleLoaded = true;
  } catch (error) {
    predictionClient = null;
    logSimulationNotice('Vertex AI SDK unavailable', error);
  }

  return predictionClient;
}

async function getPoseKeypoints(photoBase64) {
  if (!photoBase64 || typeof photoBase64 !== 'string' || photoBase64.trim().length === 0) {
    throw new Error('photoBase64 is required for pose detection.');
  }

  const trimmed = photoBase64.trim();
  const client = ensurePredictionClient();
  const projectId = process.env.GCP_PROJECT_ID;
  const region = process.env.GCP_REGION;
  const endpointId = process.env.VERTEX_AI_POSE_ENDPOINT;

  if (!client || !endpointId || !projectId || !region || typeof client.predict !== 'function') {
    logSimulationNotice('Vertex AI configuration incomplete');
    return simulateKeypoints(trimmed);
  }

  try {
    const endpoint = client.endpointPath(projectId, region, endpointId);
    const request = {
      endpoint,
      instances: [
        {
          imageBytes: trimmed,
        },
      ],
    };

    const [response] = await client.predict(request);
    const keypoints = extractKeypoints(response);

    if (!Array.isArray(keypoints) || keypoints.length === 0) {
      throw new Error('Vertex AI response did not include keypoints.');
    }

    return { keypoints };
  } catch (error) {
    logSimulationNotice('Vertex AI prediction failed', error);
    return simulateKeypoints(trimmed);
  }
}

function extractKeypoints(response) {
  if (!response) {
    return [];
  }

  if (Array.isArray(response?.predictions)) {
    const [firstPrediction] = response.predictions;
    if (firstPrediction && Array.isArray(firstPrediction.keypoints)) {
      return firstPrediction.keypoints.map(normalizeKeypoint).filter(Boolean);
    }
  }

  if (Array.isArray(response?.keypoints)) {
    return response.keypoints.map(normalizeKeypoint).filter(Boolean);
  }

  return [];
}

function normalizeKeypoint(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const { name, x, y, score } = raw;
  if (typeof name !== 'string') {
    return null;
  }

  return {
    name,
    x: Number.isFinite(x) ? Number(x) : undefined,
    y: Number.isFinite(y) ? Number(y) : undefined,
    score: Number.isFinite(score) ? Number(score) : undefined,
  };
}

function simulateKeypoints(seed) {
  const keypointLabels = [
    'nose',
    'eye_left',
    'eye_right',
    'ear_left',
    'ear_right',
    'shoulder_left',
    'shoulder_right',
    'elbow_left',
    'elbow_right',
    'wrist_left',
    'wrist_right',
    'hip_left',
    'hip_right',
    'knee_left',
    'knee_right',
    'ankle_left',
    'ankle_right',
  ];

  const hash = createHash('sha256').update(seed).digest();
  const keypoints = keypointLabels.map((label, index) => {
    const x = 60 + (hash[index] % 400);
    const y = 80 + (hash[(index + keypointLabels.length) % hash.length] % 520);
    const score = 0.6 + (hash[(index + keypointLabels.length * 2) % hash.length] / 255) * 0.4;
    return {
      name: label,
      x,
      y,
      score: Number(score.toFixed(3)),
    };
  });

  return { keypoints };
}

function logSimulationNotice(reason, error) {
  if (simulationNoticeLogged) {
    return;
  }
  simulationNoticeLogged = true;
  logger.info('Using simulated Vertex AI pose keypoints.', {
    event: 'VERTEX_POSE_SIMULATION',
    reason,
    vertexModuleLoaded,
    error: error ? error.message : undefined,
  });
}

module.exports = {
  getPoseKeypoints,
};
