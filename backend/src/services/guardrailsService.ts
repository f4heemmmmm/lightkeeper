import crypto from 'crypto';

export interface SanitizationResult {
  sanitizedContent: string;
  violations: GuardrailViolation[];
  hasViolations: boolean;
  originalLength: number;
  sanitizedLength: number;
}

export interface GuardrailViolation {
  type: ViolationType;
  pattern: string;
  position: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  redactedValue: string;
}

export enum ViolationType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  API_KEY = 'api_key',
  PASSWORD = 'password',
  IP_ADDRESS = 'ip_address',
  URL_WITH_CREDENTIALS = 'url_with_credentials',
  PERSONAL_ID = 'personal_id',
  FINANCIAL_ACCOUNT = 'financial_account'
}

// Sensitive data patterns with severity levels
const SENSITIVE_PATTERNS = [
  {
    type: ViolationType.EMAIL,
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'medium' as const,
    replacement: '[EMAIL_REDACTED]'
  },
  {
    type: ViolationType.PHONE,
    pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    severity: 'medium' as const,
    replacement: '[PHONE_REDACTED]'
  },
  {
    type: ViolationType.SSN,
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    severity: 'critical' as const,
    replacement: '[SSN_REDACTED]'
  },
  {
    type: ViolationType.CREDIT_CARD,
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    severity: 'critical' as const,
    replacement: '[CARD_REDACTED]'
  },
  {
    type: ViolationType.API_KEY,
    pattern: /(?:api[_-]?key|token|secret)["\s]*[:=]["\s]*([a-zA-Z0-9_-]{20,})/gi,
    severity: 'critical' as const,
    replacement: '[API_KEY_REDACTED]'
  },
  {
    type: ViolationType.PASSWORD,
    pattern: /(?:password|pwd|pass)["\s]*[:=]["\s]*["']?([^\s"']{6,})["']?/gi,
    severity: 'critical' as const,
    replacement: '[PASSWORD_REDACTED]'
  },
  {
    type: ViolationType.IP_ADDRESS,
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    severity: 'low' as const,
    replacement: '[IP_REDACTED]'
  },
  {
    type: ViolationType.URL_WITH_CREDENTIALS,
    pattern: /https?:\/\/[^:\s]+:[^@\s]+@[^\s]+/g,
    severity: 'critical' as const,
    replacement: '[URL_WITH_CREDS_REDACTED]'
  }
];

/**
 * Sanitize content by detecting and redacting sensitive information
 */
export function sanitizeContent(content: string, context?: string): SanitizationResult {
  if (!content || typeof content !== 'string') {
    return {
      sanitizedContent: content || '',
      violations: [],
      hasViolations: false,
      originalLength: 0,
      sanitizedLength: 0
    };
  }

  let sanitizedContent = content;
  const violations: GuardrailViolation[] = [];
  const originalLength = content.length;

  // Apply each pattern
  for (const patternConfig of SENSITIVE_PATTERNS) {
    const matches = Array.from(content.matchAll(patternConfig.pattern));
    
    for (const match of matches) {
      if (match.index !== undefined) {
        violations.push({
          type: patternConfig.type,
          pattern: patternConfig.pattern.source,
          position: match.index,
          severity: patternConfig.severity,
          redactedValue: match[0]
        });

        // Replace with redaction marker
        sanitizedContent = sanitizedContent.replace(match[0], patternConfig.replacement);
      }
    }
  }

  const result: SanitizationResult = {
    sanitizedContent,
    violations,
    hasViolations: violations.length > 0,
    originalLength,
    sanitizedLength: sanitizedContent.length
  };

  // Log violations if any
  if (result.hasViolations) {
    logGuardrailViolations(result, context);
  }

  return result;
}

/**
 * Log guardrail violations for monitoring and compliance
 */
function logGuardrailViolations(result: SanitizationResult, context?: string): void {
  const criticalViolations = result.violations.filter(v => v.severity === 'critical');
  const highViolations = result.violations.filter(v => v.severity === 'high');
  
  console.warn('[GUARDRAILS] Data privacy violations detected:', {
    context: context || 'unknown',
    timestamp: new Date().toISOString(),
    totalViolations: result.violations.length,
    criticalCount: criticalViolations.length,
    highCount: highViolations.length,
    violationTypes: [...new Set(result.violations.map(v => v.type))],
    contentReduction: `${result.originalLength} -> ${result.sanitizedLength} chars`,
    // Don't log actual redacted values for security
    severityBreakdown: result.violations.reduce((acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  // Alert on critical violations
  if (criticalViolations.length > 0) {
    console.error('[GUARDRAILS] CRITICAL: Highly sensitive data detected and redacted!', {
      context,
      criticalTypes: criticalViolations.map(v => v.type),
      count: criticalViolations.length
    });
  }
}

/**
 * Validate if content is safe to send to LLM after sanitization
 */
export function validateContentSafety(result: SanitizationResult): {
  isSafe: boolean;
  reason?: string;
} {
  const criticalViolations = result.violations.filter(v => v.severity === 'critical');
  
  if (criticalViolations.length > 0) {
    return {
      isSafe: false,
      reason: `Critical data privacy violations detected: ${criticalViolations.map(v => v.type).join(', ')}`
    };
  }

  // Additional safety checks
  const reductionPercentage = ((result.originalLength - result.sanitizedLength) / result.originalLength) * 100;
  if (reductionPercentage > 50) {
    return {
      isSafe: false,
      reason: `Content heavily redacted (${reductionPercentage.toFixed(1)}% removed), may not be suitable for processing`
    };
  }

  return { isSafe: true };
}

/**
 * Enhanced sanitization for meeting transcripts with speaker identification
 */
export function sanitizeMeetingTranscript(transcript: string): SanitizationResult {
  // First apply general sanitization
  let result = sanitizeContent(transcript, 'meeting_transcript');
  
  // Additional meeting-specific patterns
  const meetingPatterns = [
    {
      type: ViolationType.PERSONAL_ID,
      pattern: /(?:employee\s+id|badge\s+number|staff\s+id)[:\s]+([a-zA-Z0-9]+)/gi,
      severity: 'high' as const,
      replacement: '[EMPLOYEE_ID_REDACTED]'
    }
  ];

  let sanitizedContent = result.sanitizedContent;
  
  for (const patternConfig of meetingPatterns) {
    const matches = Array.from(result.sanitizedContent.matchAll(patternConfig.pattern));
    
    for (const match of matches) {
      if (match.index !== undefined) {
        result.violations.push({
          type: patternConfig.type,
          pattern: patternConfig.pattern.source,
          position: match.index,
          severity: patternConfig.severity,
          redactedValue: match[0]
        });

        sanitizedContent = sanitizedContent.replace(match[0], patternConfig.replacement);
      }
    }
  }

  return {
    ...result,
    sanitizedContent,
    hasViolations: result.violations.length > 0,
    sanitizedLength: sanitizedContent.length
  };
}

/**
 * Enhanced sanitization for emails with additional email-specific patterns
 */
export function sanitizeEmailContent(subject: string, body: string, from?: string): {
  sanitizedSubject: string;
  sanitizedBody: string;
  sanitizedFrom?: string;
  violations: GuardrailViolation[];
  hasViolations: boolean;
} {
  const subjectResult = sanitizeContent(subject, 'email_subject');
  const bodyResult = sanitizeContent(body, 'email_body');
  const fromResult = from ? sanitizeContent(from, 'email_from') : null;

  const allViolations = [
    ...subjectResult.violations,
    ...bodyResult.violations,
    ...(fromResult?.violations || [])
  ];

  return {
    sanitizedSubject: subjectResult.sanitizedContent,
    sanitizedBody: bodyResult.sanitizedContent,
    sanitizedFrom: fromResult?.sanitizedContent,
    violations: allViolations,
    hasViolations: allViolations.length > 0
  };
}