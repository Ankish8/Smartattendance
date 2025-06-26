-- SmartAttend Production Database Initialization Script
-- This script sets up the initial database structure and configuration

-- Create database if it doesn't exist
-- Note: This is run automatically by PostgreSQL Docker container

-- Set up database encoding and collation
ALTER DATABASE smartattend_prod SET timezone TO 'UTC';
ALTER DATABASE smartattend_prod SET default_text_search_config TO 'pg_catalog.english';

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create performance monitoring views
CREATE OR REPLACE VIEW pg_stat_statements_view AS
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
ORDER BY total_time DESC;

-- Create database statistics function
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname||'.'||tablename as table_name,
        n_tup_ins + n_tup_upd as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Create performance indexes for common queries
-- Note: These will be created after Prisma migrations run

-- Create audit trigger function for tracking changes
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (action, resource, resource_id, details, created_at)
        VALUES ('INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW), NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (action, resource, resource_id, details, created_at)
        VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, 
                json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)), 
                NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (action, resource, resource_id, details, created_at)
        VALUES ('DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD), NOW());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create backup and maintenance functions
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also cleanup old file uploads that are marked as failed
    DELETE FROM file_uploads 
    WHERE processing_status = 'FAILED' 
    AND created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get system health metrics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS JSON AS $$
DECLARE
    result JSON;
    db_size BIGINT;
    connection_count INTEGER;
    slow_queries INTEGER;
BEGIN
    -- Get database size
    SELECT pg_database_size(current_database()) INTO db_size;
    
    -- Get active connections
    SELECT count(*) FROM pg_stat_activity WHERE state = 'active' INTO connection_count;
    
    -- Get slow queries (queries taking more than 1 second)
    SELECT count(*) FROM pg_stat_activity 
    WHERE state = 'active' AND now() - query_start > interval '1 second'
    INTO slow_queries;
    
    -- Build result
    result := json_build_object(
        'database_size', db_size,
        'database_size_pretty', pg_size_pretty(db_size),
        'active_connections', connection_count,
        'slow_queries', slow_queries,
        'uptime', extract(epoch from (now() - pg_postmaster_start_time())),
        'timestamp', extract(epoch from now())
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for attendance statistics
-- This will be created after tables exist
-- CREATE MATERIALIZED VIEW attendance_stats AS
-- SELECT
--     s.id as session_id,
--     s.title as session_title,
--     s.subject,
--     s.scheduled_at,
--     COUNT(DISTINCT se.student_id) as enrolled_students,
--     COUNT(DISTINCT ar.student_id) as present_students,
--     ROUND(
--         (COUNT(DISTINCT ar.student_id)::DECIMAL / NULLIF(COUNT(DISTINCT se.student_id), 0)) * 100, 
--         2
--     ) as attendance_percentage
-- FROM sessions s
-- LEFT JOIN session_enrollments se ON s.id = se.session_id AND se.is_active = true
-- LEFT JOIN attendance_records ar ON s.id = ar.session_id AND ar.status = 'PRESENT'
-- GROUP BY s.id, s.title, s.subject, s.scheduled_at;

-- Create function to refresh attendance statistics
CREATE OR REPLACE FUNCTION refresh_attendance_stats()
RETURNS VOID AS $$
BEGIN
    -- This will refresh the materialized view once it's created
    -- REFRESH MATERIALIZED VIEW attendance_stats;
    PERFORM 1; -- Placeholder for now
END;
$$ LANGUAGE plpgsql;

-- Set up database configuration for optimal performance
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET log_statement = 'ddl';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries taking more than 1 second

-- Set up connection limits
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Set up WAL configuration for better performance
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.7;
ALTER SYSTEM SET checkpoint_timeout = '10min';

-- Enable query optimization
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Log configuration
ALTER SYSTEM SET log_timezone = 'UTC';
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d ';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Create scheduled maintenance job placeholder
-- Note: In production, set up pg_cron extension for automated maintenance
COMMENT ON FUNCTION cleanup_old_logs(INTEGER) IS 'Function to cleanup old audit logs and failed uploads. Should be run daily via cron.';
COMMENT ON FUNCTION refresh_attendance_stats() IS 'Function to refresh attendance statistics. Should be run hourly via cron.';

-- Create backup verification function
CREATE OR REPLACE FUNCTION verify_backup_integrity()
RETURNS BOOLEAN AS $$
DECLARE
    table_count INTEGER;
    expected_tables INTEGER := 10; -- Adjust based on actual table count
BEGIN
    SELECT count(*) FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    INTO table_count;
    
    RETURN table_count >= expected_tables;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
-- These will be handled by Prisma migrations, but we can set up additional permissions here
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT CREATE ON SCHEMA public TO PUBLIC;

-- Log initialization completion
DO $$
BEGIN
    RAISE NOTICE 'SmartAttend database initialization completed successfully';
    RAISE NOTICE 'Database: %, Size: %', current_database(), pg_size_pretty(pg_database_size(current_database()));
END $$;