#!/bin/bash

# SmartAttend Security Audit Script
# Comprehensive security assessment for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPORT_FILE="./security-audit-$(date +%Y%m%d_%H%M%S).json"
LOG_FILE="./logs/security-audit.log"
CHECKLIST_FILE="./security-checklist.md"

# Create logs directory
mkdir -p logs

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] [AUDIT]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize audit results
audit_results='{
    "audit_info": {
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "auditor": "SmartAttend Security Audit Script",
        "version": "1.0.0"
    },
    "summary": {
        "total_checks": 0,
        "passed": 0,
        "failed": 0,
        "warnings": 0
    },
    "categories": {}
}'

# Helper function to add audit result
add_result() {
    local category="$1"
    local check="$2"
    local status="$3"
    local details="$4"
    local severity="${5:-medium}"
    
    # Update counters
    audit_results=$(echo "$audit_results" | jq --arg cat "$category" --arg check "$check" --arg status "$status" --arg details "$details" --arg severity "$severity" '
        .summary.total_checks += 1 |
        if $status == "pass" then .summary.passed += 1
        elif $status == "fail" then .summary.failed += 1
        else .summary.warnings += 1 end |
        .categories[$cat] += [{
            "check": $check,
            "status": $status,
            "details": $details,
            "severity": $severity,
            "timestamp": now | todateiso8601
        }]
    ')
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    error "jq is required for this script. Please install jq first."
    exit 1
fi

log "=== SmartAttend Security Audit Started ==="

# 1. Environment Variables Security
check_environment_security() {
    log "Checking environment variables security..."
    
    local env_file=".env.production"
    local category="Environment Security"
    
    if [[ -f "$env_file" ]]; then
        # Check for secrets in environment file
        if grep -q "YOUR_.*_HERE" "$env_file"; then
            add_result "$category" "Default Secrets" "fail" "Default placeholder secrets found in environment file" "high"
            error "Default secrets found in $env_file"
        else
            add_result "$category" "Default Secrets" "pass" "No default secrets found"
            success "No default secrets in environment file"
        fi
        
        # Check for weak passwords
        if grep -i "password.*123\|password.*password\|password.*admin" "$env_file"; then
            add_result "$category" "Weak Passwords" "fail" "Weak passwords detected" "high"
            error "Weak passwords detected in environment file"
        else
            add_result "$category" "Weak Passwords" "pass" "No weak passwords detected"
            success "No weak passwords detected"
        fi
        
        # Check file permissions
        local perms=$(stat -c "%a" "$env_file" 2>/dev/null || stat -f "%A" "$env_file" 2>/dev/null)
        if [[ "$perms" == "600" ]] || [[ "$perms" == "400" ]]; then
            add_result "$category" "File Permissions" "pass" "Environment file has secure permissions ($perms)"
            success "Environment file permissions are secure"
        else
            add_result "$category" "File Permissions" "fail" "Environment file has insecure permissions ($perms)" "medium"
            warning "Environment file has insecure permissions: $perms"
        fi
        
        # Check for required security variables
        required_vars=("JWT_SECRET" "JWT_REFRESH_SECRET" "SESSION_SECRET" "POSTGRES_PASSWORD" "REDIS_PASSWORD")
        missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if ! grep -q "^$var=" "$env_file"; then
                missing_vars+=("$var")
            fi
        done
        
        if [[ ${#missing_vars[@]} -eq 0 ]]; then
            add_result "$category" "Required Variables" "pass" "All required security variables are present"
            success "All required security variables present"
        else
            add_result "$category" "Required Variables" "fail" "Missing variables: ${missing_vars[*]}" "high"
            error "Missing required variables: ${missing_vars[*]}"
        fi
        
    else
        add_result "$category" "Environment File" "fail" "Environment file not found" "high"
        error "Environment file $env_file not found"
    fi
}

# 2. Docker Security
check_docker_security() {
    log "Checking Docker security configuration..."
    
    local category="Docker Security"
    local compose_file="docker-compose.production.yml"
    
    if [[ -f "$compose_file" ]]; then
        # Check for security options
        if grep -q "no-new-privileges:true" "$compose_file"; then
            add_result "$category" "No New Privileges" "pass" "no-new-privileges security option is enabled"
            success "Docker no-new-privileges option enabled"
        else
            add_result "$category" "No New Privileges" "warn" "no-new-privileges security option not found" "medium"
            warning "Docker no-new-privileges option not set"
        fi
        
        # Check for user configuration
        if grep -q "user:" "$compose_file"; then
            add_result "$category" "User Configuration" "pass" "Non-root user configuration found"
            success "Docker user configuration found"
        else
            add_result "$category" "User Configuration" "warn" "No explicit user configuration found" "low"
            warning "Consider setting explicit user for containers"
        fi
        
        # Check for resource limits
        if grep -q "limits:" "$compose_file"; then
            add_result "$category" "Resource Limits" "pass" "Resource limits are configured"
            success "Docker resource limits configured"
        else
            add_result "$category" "Resource Limits" "warn" "No resource limits found" "medium"
            warning "Consider setting resource limits for containers"
        fi
        
        # Check for health checks
        if grep -q "healthcheck:" "$compose_file"; then
            add_result "$category" "Health Checks" "pass" "Health checks are configured"
            success "Docker health checks configured"
        else
            add_result "$category" "Health Checks" "warn" "No health checks found" "low"
            warning "Consider adding health checks to containers"
        fi
        
        # Check for secret management
        if grep -q "secrets:" "$compose_file"; then
            add_result "$category" "Secret Management" "pass" "Docker secrets are used"
            success "Docker secrets configured"
        else
            add_result "$category" "Secret Management" "warn" "No Docker secrets configuration found" "medium"
            warning "Consider using Docker secrets for sensitive data"
        fi
        
    else
        add_result "$category" "Compose File" "fail" "Docker Compose file not found" "high"
        error "Docker Compose file $compose_file not found"
    fi
}

# 3. Network Security
check_network_security() {
    log "Checking network security configuration..."
    
    local category="Network Security"
    local nginx_conf="nginx/nginx.conf"
    
    if [[ -f "$nginx_conf" ]]; then
        # Check for HTTPS redirect
        if grep -q "return 301 https" "$nginx_conf"; then
            add_result "$category" "HTTPS Redirect" "pass" "HTTP to HTTPS redirect is configured"
            success "HTTPS redirect configured"
        else
            add_result "$category" "HTTPS Redirect" "fail" "No HTTPS redirect found" "high"
            error "HTTPS redirect not configured"
        fi
        
        # Check for security headers
        security_headers=("X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection" "Strict-Transport-Security")
        missing_headers=()
        
        for header in "${security_headers[@]}"; do
            if ! grep -q "$header" "$nginx_conf"; then
                missing_headers+=("$header")
            fi
        done
        
        if [[ ${#missing_headers[@]} -eq 0 ]]; then
            add_result "$category" "Security Headers" "pass" "All security headers are configured"
            success "All security headers configured"
        else
            add_result "$category" "Security Headers" "warn" "Missing headers: ${missing_headers[*]}" "medium"
            warning "Missing security headers: ${missing_headers[*]}"
        fi
        
        # Check for rate limiting
        if grep -q "limit_req" "$nginx_conf"; then
            add_result "$category" "Rate Limiting" "pass" "Rate limiting is configured"
            success "Rate limiting configured"
        else
            add_result "$category" "Rate Limiting" "warn" "No rate limiting found" "medium"
            warning "Rate limiting not configured"
        fi
        
        # Check SSL configuration
        if grep -q "ssl_protocols.*TLSv1.3" "$nginx_conf"; then
            add_result "$category" "SSL/TLS Version" "pass" "Modern TLS protocols configured"
            success "Modern TLS protocols configured"
        else
            add_result "$category" "SSL/TLS Version" "warn" "TLS configuration may need updating" "medium"
            warning "Consider updating TLS configuration"
        fi
        
    else
        add_result "$category" "Nginx Configuration" "fail" "Nginx configuration file not found" "medium"
        warning "Nginx configuration file not found"
    fi
}

# 4. Database Security
check_database_security() {
    log "Checking database security configuration..."
    
    local category="Database Security"
    local env_file=".env.production"
    
    if [[ -f "$env_file" ]]; then
        # Check database URL format
        if grep -q "DATABASE_URL.*sslmode=require" "$env_file"; then
            add_result "$category" "SSL Connection" "pass" "Database SSL connection required"
            success "Database SSL connection configured"
        elif grep -q "DATABASE_URL.*sslmode=prefer" "$env_file"; then
            add_result "$category" "SSL Connection" "warn" "Database SSL connection preferred but not required" "low"
            warning "Database SSL connection preferred but not required"
        else
            add_result "$category" "SSL Connection" "fail" "Database SSL connection not configured" "high"
            error "Database SSL connection not configured"
        fi
        
        # Check for strong database password
        db_password=$(grep "POSTGRES_PASSWORD=" "$env_file" | cut -d'=' -f2)
        if [[ ${#db_password} -ge 16 ]]; then
            add_result "$category" "Password Strength" "pass" "Database password meets length requirements"
            success "Database password strength adequate"
        else
            add_result "$category" "Password Strength" "fail" "Database password too short" "high"
            error "Database password too short (minimum 16 characters)"
        fi
        
        # Check for database user (not using default postgres user)
        if grep -q "POSTGRES_USER=postgres" "$env_file"; then
            add_result "$category" "Database User" "warn" "Using default postgres user" "medium"
            warning "Consider using a custom database user instead of 'postgres'"
        else
            add_result "$category" "Database User" "pass" "Custom database user configured"
            success "Custom database user configured"
        fi
    fi
}

# 5. Application Security
check_application_security() {
    log "Checking application security configuration..."
    
    local category="Application Security"
    
    # Check backend security configuration
    local backend_files=(
        "../smartattend-backend/src/middleware/security.ts"
        "../smartattend-backend/src/config/env.ts"
    )
    
    for file in "${backend_files[@]}"; do
        if [[ -f "$file" ]]; then
            # Check for security middleware
            if grep -q "helmet\|cors\|rateLimit" "$file"; then
                add_result "$category" "Security Middleware" "pass" "Security middleware configured in $file"
                success "Security middleware found in $(basename "$file")"
            else
                add_result "$category" "Security Middleware" "warn" "Security middleware not found in $file" "medium"
                warning "Security middleware not found in $(basename "$file")"
            fi
            
            # Check for input validation
            if grep -q "validator\|zod\|joi" "$file"; then
                add_result "$category" "Input Validation" "pass" "Input validation configured"
                success "Input validation found"
            else
                add_result "$category" "Input Validation" "warn" "Input validation not clearly configured" "medium"
                warning "Input validation configuration unclear"
            fi
        fi
    done
    
    # Check for JWT secret strength
    local env_file=".env.production"
    if [[ -f "$env_file" ]]; then
        jwt_secret=$(grep "JWT_SECRET=" "$env_file" | cut -d'=' -f2)
        if [[ ${#jwt_secret} -ge 32 ]]; then
            add_result "$category" "JWT Secret Strength" "pass" "JWT secret meets length requirements"
            success "JWT secret strength adequate"
        else
            add_result "$category" "JWT Secret Strength" "fail" "JWT secret too short" "high"
            error "JWT secret too short (minimum 32 characters)"
        fi
    fi
}

# 6. File and Directory Permissions
check_file_permissions() {
    log "Checking file and directory permissions..."
    
    local category="File Permissions"
    
    # Check sensitive files
    sensitive_files=(".env.production" "deploy.sh")
    
    for file in "${sensitive_files[@]}"; do
        if [[ -f "$file" ]]; then
            local perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
            if [[ "$perms" == "600" ]] || [[ "$perms" == "700" ]]; then
                add_result "$category" "File Permissions ($file)" "pass" "Secure permissions ($perms)"
                success "Secure permissions for $file"
            else
                add_result "$category" "File Permissions ($file)" "warn" "Permissions may be too open ($perms)" "medium"
                warning "File $file has permissions $perms"
            fi
        fi
    done
    
    # Check script executability
    if [[ -x "deploy.sh" ]]; then
        add_result "$category" "Script Executable" "pass" "Deploy script is executable"
        success "Deploy script is executable"
    else
        add_result "$category" "Script Executable" "warn" "Deploy script is not executable" "low"
        warning "Deploy script is not executable"
    fi
}

# 7. SSL/TLS Certificate Check
check_ssl_certificates() {
    log "Checking SSL certificate configuration..."
    
    local category="SSL Certificates"
    local ssl_dir="nginx/ssl"
    
    if [[ -d "$ssl_dir" ]]; then
        # Check for certificate files
        if [[ -f "$ssl_dir/smartattend.crt" ]] && [[ -f "$ssl_dir/smartattend.key" ]]; then
            add_result "$category" "Certificate Files" "pass" "SSL certificate files found"
            success "SSL certificate files found"
            
            # Check certificate validity (if openssl is available)
            if command -v openssl &> /dev/null; then
                local expiry=$(openssl x509 -in "$ssl_dir/smartattend.crt" -noout -enddate 2>/dev/null | cut -d'=' -f2)
                if [[ -n "$expiry" ]]; then
                    add_result "$category" "Certificate Validity" "pass" "Certificate expires: $expiry"
                    info "Certificate expires: $expiry"
                else
                    add_result "$category" "Certificate Validity" "warn" "Could not verify certificate expiry" "low"
                    warning "Could not verify certificate expiry"
                fi
            fi
        else
            add_result "$category" "Certificate Files" "fail" "SSL certificate files not found" "high"
            error "SSL certificate files not found"
        fi
    else
        add_result "$category" "SSL Directory" "fail" "SSL directory not found" "high"
        error "SSL directory not found"
    fi
}

# 8. Monitoring and Logging Security
check_monitoring_security() {
    log "Checking monitoring and logging security..."
    
    local category="Monitoring Security"
    local prometheus_config="monitoring/prometheus.yml"
    
    if [[ -f "$prometheus_config" ]]; then
        # Check for authentication in monitoring
        if grep -q "basic_auth\|bearer_token" "$prometheus_config"; then
            add_result "$category" "Monitoring Authentication" "pass" "Authentication configured for monitoring"
            success "Monitoring authentication configured"
        else
            add_result "$category" "Monitoring Authentication" "warn" "No authentication found for monitoring endpoints" "medium"
            warning "Consider adding authentication to monitoring endpoints"
        fi
        
        # Check for external monitoring
        if grep -q "remote_write" "$prometheus_config"; then
            add_result "$category" "External Monitoring" "pass" "External monitoring configured"
            success "External monitoring configured"
        else
            add_result "$category" "External Monitoring" "warn" "No external monitoring found" "low"
            info "Consider configuring external monitoring"
        fi
    fi
    
    # Check log retention
    if grep -q "max-file.*max-size" "docker-compose.production.yml" 2>/dev/null; then
        add_result "$category" "Log Retention" "pass" "Log retention policies configured"
        success "Log retention policies configured"
    else
        add_result "$category" "Log Retention" "warn" "Log retention policies not configured" "low"
        warning "Consider configuring log retention policies"
    fi
}

# 9. Backup Security
check_backup_security() {
    log "Checking backup security configuration..."
    
    local category="Backup Security"
    
    # Check for backup scripts
    if [[ -f "scripts/backup.sh" ]] || grep -q "backup" "docker-compose.production.yml" 2>/dev/null; then
        add_result "$category" "Backup Configuration" "pass" "Backup system configured"
        success "Backup system configured"
    else
        add_result "$category" "Backup Configuration" "warn" "No backup system found" "high"
        warning "No backup system configured"
    fi
    
    # Check backup directory permissions
    if [[ -d "backups" ]]; then
        local perms=$(stat -c "%a" "backups" 2>/dev/null || stat -f "%A" "backups" 2>/dev/null)
        if [[ "$perms" == "700" ]] || [[ "$perms" == "750" ]]; then
            add_result "$category" "Backup Directory Permissions" "pass" "Secure backup directory permissions"
            success "Secure backup directory permissions"
        else
            add_result "$category" "Backup Directory Permissions" "warn" "Backup directory permissions may be too open" "medium"
            warning "Backup directory permissions: $perms"
        fi
    fi
}

# 10. Vulnerability Assessment
check_vulnerabilities() {
    log "Checking for common vulnerabilities..."
    
    local category="Vulnerability Assessment"
    
    # Check for exposed debug information
    if grep -r "console.log\|debugger\|debug.*true" "../smartattend-frontend/src" 2>/dev/null; then
        add_result "$category" "Debug Information" "warn" "Debug statements found in frontend code" "low"
        warning "Debug statements found in frontend code"
    else
        add_result "$category" "Debug Information" "pass" "No debug statements found in frontend"
        success "No debug statements in frontend"
    fi
    
    # Check for hardcoded secrets
    if grep -r "password.*=.*['\"].*['\"]" "../smartattend-backend/src" "../smartattend-frontend/src" 2>/dev/null | grep -v "placeholder\|example\|test"; then
        add_result "$category" "Hardcoded Secrets" "fail" "Potential hardcoded secrets found" "high"
        error "Potential hardcoded secrets found in source code"
    else
        add_result "$category" "Hardcoded Secrets" "pass" "No hardcoded secrets found"
        success "No hardcoded secrets found"
    fi
    
    # Check for TODO/FIXME comments with security implications
    if grep -r "TODO.*security\|FIXME.*security\|XXX.*security" "../smartattend-backend/src" "../smartattend-frontend/src" 2>/dev/null; then
        add_result "$category" "Security TODOs" "warn" "Security-related TODO items found" "medium"
        warning "Security-related TODO items found in code"
    else
        add_result "$category" "Security TODOs" "pass" "No security TODOs found"
        success "No security-related TODOs found"
    fi
}

# Run all security checks
run_security_audit() {
    log "Starting comprehensive security audit..."
    
    check_environment_security
    check_docker_security
    check_network_security
    check_database_security
    check_application_security
    check_file_permissions
    check_ssl_certificates
    check_monitoring_security
    check_backup_security
    check_vulnerabilities
    
    log "Security audit completed"
}

# Generate security report
generate_security_report() {
    log "Generating security audit report..."
    
    # Save detailed JSON report
    echo "$audit_results" | jq '.' > "$REPORT_FILE"
    
    # Generate summary
    local total=$(echo "$audit_results" | jq '.summary.total_checks')
    local passed=$(echo "$audit_results" | jq '.summary.passed')
    local failed=$(echo "$audit_results" | jq '.summary.failed')
    local warnings=$(echo "$audit_results" | jq '.summary.warnings')
    local score=$(echo "scale=1; $passed * 100 / $total" | bc -l 2>/dev/null || echo "0")
    
    log ""
    log "=== SECURITY AUDIT SUMMARY ==="
    log "Total Checks: $total"
    log "Passed: $passed"
    log "Failed: $failed"
    log "Warnings: $warnings"
    log "Security Score: $score%"
    log ""
    
    if [[ $failed -gt 0 ]]; then
        error "Security audit failed with $failed critical issues"
        log "Please review and fix all failed checks before deploying to production"
        
        # Show failed checks
        log ""
        log "FAILED CHECKS:"
        echo "$audit_results" | jq -r '.categories[] | .[] | select(.status == "fail") | "- " + .check + ": " + .details'
        
        return 1
    elif [[ $warnings -gt 0 ]]; then
        warning "Security audit passed with $warnings warnings"
        log "Consider addressing warnings for improved security"
        
        # Show warnings
        log ""
        log "WARNINGS:"
        echo "$audit_results" | jq -r '.categories[] | .[] | select(.status == "warn") | "- " + .check + ": " + .details'
        
        return 0
    else
        success "Security audit passed with no issues!"
        return 0
    fi
}

# Generate security checklist
generate_security_checklist() {
    cat > "$CHECKLIST_FILE" << 'EOF'
# SmartAttend Security Checklist

## Pre-Deployment Security Checklist

### Environment Configuration
- [ ] All placeholder secrets replaced with strong, unique values
- [ ] Environment file has secure permissions (600 or 400)
- [ ] Database password is at least 16 characters long
- [ ] JWT secrets are at least 32 characters long
- [ ] Redis password is configured and strong
- [ ] No default or weak passwords in use

### SSL/TLS Configuration
- [ ] Valid SSL certificates installed
- [ ] HTTPS redirect configured
- [ ] Modern TLS protocols (1.2+) configured
- [ ] Strong cipher suites configured
- [ ] HSTS headers configured

### Network Security
- [ ] Rate limiting configured
- [ ] Security headers configured (X-Frame-Options, X-Content-Type-Options, etc.)
- [ ] CORS properly configured
- [ ] Firewall rules configured
- [ ] Only necessary ports exposed

### Database Security
- [ ] Database SSL connections required
- [ ] Strong database passwords
- [ ] Custom database user (not default postgres)
- [ ] Database access restricted to application only
- [ ] Regular security patches applied

### Application Security
- [ ] Input validation implemented
- [ ] SQL injection protection enabled
- [ ] XSS protection configured
- [ ] CSRF protection enabled
- [ ] Security middleware configured
- [ ] Error messages don't expose sensitive information

### Docker Security
- [ ] Containers run as non-root users
- [ ] Security options configured (no-new-privileges)
- [ ] Resource limits set
- [ ] Health checks configured
- [ ] Secrets management implemented
- [ ] Base images regularly updated

### Monitoring and Logging
- [ ] Security event logging enabled
- [ ] Log retention policies configured
- [ ] Monitoring alerts configured
- [ ] Audit logging implemented
- [ ] Log access restricted

### Backup Security
- [ ] Backup system configured
- [ ] Backup encryption enabled
- [ ] Backup access restricted
- [ ] Backup retention policies set
- [ ] Backup restoration tested

### Code Security
- [ ] No hardcoded secrets in code
- [ ] Debug statements removed from production
- [ ] Security-related TODOs addressed
- [ ] Dependency vulnerabilities checked
- [ ] Static code analysis performed

### Access Control
- [ ] Role-based access control implemented
- [ ] Strong authentication required
- [ ] Session management secure
- [ ] API authentication configured
- [ ] Admin access restricted

## Post-Deployment Security Checklist

### Monitoring
- [ ] Security monitoring active
- [ ] Intrusion detection configured
- [ ] Performance monitoring running
- [ ] Error tracking configured
- [ ] Uptime monitoring active

### Maintenance
- [ ] Security patch schedule established
- [ ] Dependency update process defined
- [ ] Backup verification automated
- [ ] Security audit schedule set
- [ ] Incident response plan ready

### Compliance
- [ ] Privacy policy updated
- [ ] Terms of service current
- [ ] Data retention policies defined
- [ ] User consent mechanisms active
- [ ] Regulatory compliance verified

EOF

    log "Security checklist generated: $CHECKLIST_FILE"
}

# Main execution
main() {
    log "Initializing security audit..."
    
    # Initialize audit results
    audit_results=$(echo "$audit_results" | jq '.categories = {}')
    
    # Run security audit
    run_security_audit
    
    # Generate reports
    generate_security_report
    local audit_status=$?
    
    generate_security_checklist
    
    log "Security audit report saved: $REPORT_FILE"
    log "Security checklist saved: $CHECKLIST_FILE"
    
    return $audit_status
}

# Run the audit
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi