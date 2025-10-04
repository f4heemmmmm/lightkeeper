export const GUARDRAILS_CONFIG = {
  enabled: process.env.GUARDRAILS_ENABLED === 'true',
  logLevel: process.env.GUARDRAILS_LOG_LEVEL || 'warn',
  strictMode: process.env.GUARDRAILS_STRICT_MODE === 'true',
  
  // Severity thresholds
  maxCriticalViolations: 0,
  maxHighViolations: 3,
  maxContentReductionPercent: 50,
  
  // Context-specific settings
  contexts: {
    meeting_transcript: {
      allowedReductionPercent: 30,
      requireManualReview: false
    },
    email_content: {
      allowedReductionPercent: 40,
      requireManualReview: true
    },
    chat_interaction: {
      allowedReductionPercent: 20,
      requireManualReview: false
    }
  }
};