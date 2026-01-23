CREATE INDEX CONCURRENTLY "BenchmarkSubmission_data_idx" ON "BenchmarkSubmission" USING GIN ("data" jsonb_path_ops);
