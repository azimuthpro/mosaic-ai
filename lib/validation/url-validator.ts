import { lookup } from "dns/promises";

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
}

// Private IP ranges that should be blocked
const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.0.0/16
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.0.0.0/8 (loopback)
  /^0\.0\.0\.0$/, // 0.0.0.0
  /^169\.254\.\d{1,3}\.\d{1,3}$/, // 169.254.0.0/16 (link-local, includes AWS metadata)
  /^::1$/, // IPv6 loopback
  /^fc00:/i, // IPv6 unique local
  /^fe80:/i, // IPv6 link-local
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  // Cloud metadata endpoints
  "metadata.google.internal",
  "169.254.169.254",
  "metadata.azure.com",
  "100.100.100.200", // Alibaba Cloud metadata
];

// Dangerous ports that should be blocked
const BLOCKED_PORTS = new Set([
  21, // FTP
  22, // SSH
  23, // Telnet
  25, // SMTP
  53, // DNS
  110, // POP3
  135, // Windows RPC
  139, // NetBIOS
  143, // IMAP
  445, // SMB
  1433, // MSSQL
  1521, // Oracle
  3306, // MySQL
  3389, // RDP
  5432, // PostgreSQL
  5900, // VNC
  6379, // Redis
  6380, // Redis SSL
  11211, // Memcached
  27017, // MongoDB
  27018, // MongoDB
  28017, // MongoDB HTTP
]);

// Allowed ports (explicit allow list)
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

// IPv4 address pattern for validation
const IPV4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

function isBlockedHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().trim();
  return BLOCKED_HOSTNAMES.some(
    (blocked) => normalizedHostname === blocked.toLowerCase(),
  );
}

function isAllowedPort(port: number | null): boolean {
  // Default ports for http/https are always allowed
  if (port === null) return true;

  // Explicitly allowed ports
  if (ALLOWED_PORTS.has(port)) return true;

  // Block dangerous ports
  if (BLOCKED_PORTS.has(port)) return false;

  // Allow other ports > 1024 (non-privileged)
  return port > 1024;
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validates a URL for SSRF protection.
 * Checks for private IPs, blocked hostnames, and dangerous ports.
 * Does NOT perform DNS resolution (use validateUrlWithDnsCheck for that).
 */
export function validateUrl(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { isValid: false, error: "Invalid URL format" };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      isValid: false,
      error: `Invalid protocol: ${parsed.protocol}. Only http and https are allowed.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isBlockedHostname(hostname)) {
    return {
      isValid: false,
      error: `Blocked hostname: ${hostname}. Internal and metadata endpoints are not allowed.`,
    };
  }

  if (IPV4_REGEX.test(hostname) && isPrivateIp(hostname)) {
    return {
      isValid: false,
      error: `Private IP address not allowed: ${hostname}`,
    };
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : null;
  if (!isAllowedPort(port)) {
    const reason = BLOCKED_PORTS.has(port!)
      ? " This port is commonly used for internal services."
      : "";
    return {
      isValid: false,
      error: `Port ${port} is not allowed.${reason}`,
    };
  }

  return { isValid: true };
}

/**
 * Validates a URL with DNS resolution check to prevent DNS rebinding attacks.
 * This performs an actual DNS lookup to verify the resolved IP is not private.
 */
export async function validateUrlWithDnsCheck(
  url: string,
): Promise<UrlValidationResult> {
  const basicValidation = validateUrl(url);
  if (!basicValidation.isValid) {
    return basicValidation;
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname;

  // Skip DNS check if hostname is already an IP (we already validated it)
  if (IPV4_REGEX.test(hostname)) {
    return { isValid: true };
  }

  // Perform DNS resolution to detect rebinding attacks
  try {
    const result = await lookup(hostname, { all: true });
    const addresses = Array.isArray(result) ? result : [result];

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        return {
          isValid: false,
          error: `DNS rebinding detected: ${hostname} resolves to private IP ${record.address}`,
        };
      }
    }
  } catch {
    return {
      isValid: false,
      error: `DNS resolution failed for ${hostname}`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes and validates a web search query.
 * Prevents injection attacks and ensures query is within bounds.
 */
export function sanitizeSearchQuery(query: string): {
  isValid: boolean;
  sanitized?: string;
  error?: string;
} {
  const MAX_QUERY_LENGTH = 500;

  if (!query || typeof query !== "string") {
    return { isValid: false, error: "Query is required" };
  }

  // Trim whitespace
  let sanitized = query.trim();

  if (sanitized.length === 0) {
    return { isValid: false, error: "Query cannot be empty" };
  }

  // Check length
  if (sanitized.length > MAX_QUERY_LENGTH) {
    sanitized = sanitized.substring(0, MAX_QUERY_LENGTH);
  }

  // Block potential injection patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /&#/i, // HTML entities
    /%3C/i, // URL encoded <
    /%3E/i, // URL encoded >
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      return {
        isValid: false,
        error: "Query contains potentially dangerous content",
      };
    }
  }

  // Remove any control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  return { isValid: true, sanitized };
}
